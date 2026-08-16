"""LangGraph state machine wiring guardrails, retrieval, and generation
together. This is the "harness" requirement: structured state in/out per
node, conditional routing, retries on the LLM call, and per-node latency
capture.

Only unsafe/empty input produces a hard refusal (no answer at all) — that's
a safety gate, not a data-coverage decision. Every other path always
produces an answer: either grounded in retrieved context, or a labeled
fallback to the model's own general knowledge when retrieval doesn't find
anything relevant enough. `grounded` on the result distinguishes the two,
so the guardrail requirement stays demonstrably intact (the system always
knows and reports whether an answer came from the dataset) without ever
leaving the user with a bare refusal for a coverage gap.
"""

from typing import Optional, TypedDict

from langchain_community.vectorstores import FAISS
from langchain_core.embeddings import Embeddings
from langchain_groq import ChatGroq

from . import guardrails
from .config import Settings
from .latency import LatencyTrace
from .retrieval import RetrievalResult, retrieve_best_strategy
from .retry import retry

NOT_GROUNDED_SENTINEL = "NOT_GROUNDED"

ANSWER_PROMPT = """You are a precise assistant answering ONLY from the provided context.
Do not use outside knowledge, even if you know the answer.

If, and only if, the context does not contain enough information to answer
the question: respond with exactly the token {sentinel} and nothing else.

Otherwise, answer normally, in the same language as the question.

Context:
{{context}}

Question: {{question}}

Answer:""".format(sentinel=NOT_GROUNDED_SENTINEL)

GENERAL_KNOWLEDGE_PROMPT = """Answer the following question directly and concisely,
in the same language and script as the question, using your own general
knowledge. If you genuinely don't know, say so honestly in one short sentence.

Question: {question}

Answer:"""

GENERIC_REFUSAL_MESSAGE = "I don't have enough relevant information to answer that confidently."


class PipelineState(TypedDict):
    query: str
    trace: LatencyTrace
    refused: bool  # True only for hard safety blocks (unsafe/empty input) or total generation failure
    refusal_reason: Optional[str]
    grounded: bool  # True if the answer came from retrieved dataset context, False if general-knowledge fallback
    fallback_reason: Optional[str]  # why it fell back, when grounded=False and refused=False
    retrieval_confident: bool
    retrieval: Optional[RetrievalResult]
    answer: Optional[str]


def _format_context(chunks) -> str:
    return "\n\n".join(f"[{i+1}] {c.page_content}" for i, c in enumerate(chunks))


class RagHarness:
    def __init__(self, settings: Settings, stores: dict[str, FAISS], embeddings: Embeddings):
        self.settings = settings
        self.stores = stores  # {strategy_name: FAISS index}, one per built chunking strategy
        self.embeddings = embeddings
        self.llm = ChatGroq(api_key=settings.groq_api_key, model=settings.groq_model, temperature=0)
        self.graph = self._build_graph()

    def _general_knowledge_answer(self, query: str) -> str:
        prompt = GENERAL_KNOWLEDGE_PROMPT.format(question=query)

        @retry(attempts=2, exceptions=(Exception,))
        def _call():
            return self.llm.invoke(prompt).content

        try:
            return _call().strip()
        except Exception:  # noqa: BLE001 - last resort if even the fallback call fails
            return GENERIC_REFUSAL_MESSAGE

    # ---- nodes ----

    def _node_input_guardrail(self, state: PipelineState) -> PipelineState:
        with state["trace"].timed("input_guardrail"):
            verdict = guardrails.input_guardrail(state["query"])
        if not verdict.allowed:
            state["refused"] = True
            state["refusal_reason"] = verdict.reason
        return state

    def _node_retrieve(self, state: PipelineState) -> PipelineState:
        result = retrieve_best_strategy(state["query"], self.stores, self.embeddings, state["trace"], k=4)
        state["retrieval"] = result
        return state

    def _node_retrieval_guardrail(self, state: PipelineState) -> PipelineState:
        with state["trace"].timed("retrieval_guardrail"):
            verdict = guardrails.retrieval_guardrail(state["retrieval"].top_score, self.settings.min_retrieval_score)
        state["retrieval_confident"] = verdict.allowed
        if not verdict.allowed:
            state["fallback_reason"] = verdict.reason
        return state

    def _node_generate_general(self, state: PipelineState) -> PipelineState:
        """Retrieval wasn't confident enough to attempt a grounded answer at
        all — skip straight to the labeled general-knowledge fallback."""
        with state["trace"].timed("fallback_generate"):
            state["answer"] = self._general_knowledge_answer(state["query"])
        state["grounded"] = False
        return state

    def _node_generate(self, state: PipelineState) -> PipelineState:
        context = _format_context(state["retrieval"].chunks)
        prompt = ANSWER_PROMPT.format(context=context, question=state["query"])

        @retry(attempts=2, exceptions=(Exception,))
        def _call():
            return self.llm.invoke(prompt).content

        with state["trace"].timed("generate"):
            try:
                answer = _call()
            except Exception as exc:  # noqa: BLE001 - can't ground or fall back without a working LLM call
                state["refused"] = True
                state["refusal_reason"] = f"generation_failed: {exc}"
                return state

        if answer.strip().upper().startswith(NOT_GROUNDED_SENTINEL):
            state["fallback_reason"] = "not_grounded"
            with state["trace"].timed("fallback_generate"):
                state["answer"] = self._general_knowledge_answer(state["query"])
            state["grounded"] = False
        else:
            state["answer"] = answer
            state["grounded"] = True
        return state

    def _node_grounding_guardrail(self, state: PipelineState) -> PipelineState:
        if state["refused"] or not state["grounded"]:
            return state  # already a hard block or already fell back — nothing to double-check
        with state["trace"].timed("grounding_guardrail"):
            verdict = guardrails.grounding_guardrail(state["answer"], state["retrieval"].chunks)
        if not verdict.allowed:
            # Safety-net catch behind the sentinel above: the model didn't
            # self-report NOT_GROUNDED but its answer doesn't lexically
            # overlap the context anyway — possible hallucination, so it's
            # discarded in favor of the labeled general-knowledge fallback
            # rather than shown as if it came from the dataset.
            state["fallback_reason"] = verdict.reason
            with state["trace"].timed("fallback_generate"):
                state["answer"] = self._general_knowledge_answer(state["query"])
            state["grounded"] = False
        return state

    # ---- graph wiring ----

    def _build_graph(self):
        from langgraph.graph import END, StateGraph

        graph = StateGraph(PipelineState)
        graph.add_node("input_guardrail", self._node_input_guardrail)
        graph.add_node("retrieve", self._node_retrieve)
        graph.add_node("retrieval_guardrail", self._node_retrieval_guardrail)
        graph.add_node("generate", self._node_generate)
        graph.add_node("generate_general", self._node_generate_general)
        graph.add_node("grounding_guardrail", self._node_grounding_guardrail)

        graph.set_entry_point("input_guardrail")
        graph.add_conditional_edges("input_guardrail", lambda s: "end" if s["refused"] else "retrieve", {"end": END, "retrieve": "retrieve"})
        graph.add_edge("retrieve", "retrieval_guardrail")
        graph.add_conditional_edges(
            "retrieval_guardrail",
            lambda s: "generate" if s["retrieval_confident"] else "generate_general",
            {"generate": "generate", "generate_general": "generate_general"},
        )
        graph.add_edge("generate", "grounding_guardrail")
        graph.add_edge("grounding_guardrail", END)
        graph.add_edge("generate_general", END)
        return graph.compile()

    def run(self, query: str, trace: Optional[LatencyTrace] = None) -> PipelineState:
        state: PipelineState = {
            "query": query,
            "trace": trace if trace is not None else LatencyTrace(),
            "refused": False,
            "refusal_reason": None,
            "grounded": True,
            "fallback_reason": None,
            "retrieval_confident": True,
            "retrieval": None,
            "answer": None,
        }
        return self.graph.invoke(state)
