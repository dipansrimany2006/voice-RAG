import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// A minimal client-side router for exactly two routes ("/" and "/app").
// No new dependency, no server-side routing changes — Vite's dev server
// and any static host already fall back to index.html for SPA navigation,
// and this is the entire surface area a two-page product needs.
const RouterContext = createContext(null)

function getPath() {
  return typeof window === 'undefined' ? '/' : window.location.pathname
}

export function RouterProvider({ children }) {
  const [path, setPath] = useState(getPath)

  useEffect(() => {
    function handlePopState() {
      setPath(getPath())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((to, { hash } = {}) => {
    const target = hash ? `${to}${hash}` : to
    if (getPath() !== to) {
      window.history.pushState(null, '', target)
      setPath(to)
    } else if (hash) {
      window.history.replaceState(null, '', target)
    }
    if (hash) {
      // wait one paint so the destination page's sections exist before scrolling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        })
      })
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [])

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>
}

export function useRouter() {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used within a RouterProvider')
  return ctx
}
