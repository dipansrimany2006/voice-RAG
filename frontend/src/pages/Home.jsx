import Hero from '../components/Hero'
import VoiceJourney from '../components/VoiceJourney'
import FinalCta from '../components/FinalCta'
import { useRouter } from '../router'

// Page 1: the premium marketing landing page. Purely presentational — no
// query/recorder state lives here at all, since the actual product only
// starts on Page 2 (VoiceApp). Deliberately focused on the product
// experience: hero, the pipeline story, a compact final CTA, footer — no
// standalone language showcase, since the navbar dropdown already owns
// language selection.
export default function Home() {
  const { navigate } = useRouter()

  return (
    <>
      <Hero
        onStart={() => navigate('/app')}
        onHowItWorks={() => navigate('/app', { hash: '#how-it-works' })}
      />

      <VoiceJourney />

      <FinalCta onStart={() => navigate('/app')} />
    </>
  )
}
