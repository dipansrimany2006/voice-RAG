import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { RouterProvider } from './router.jsx'
import { SoundProvider } from './SoundContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <SoundProvider>
        <RouterProvider>
          <App />
        </RouterProvider>
      </SoundProvider>
    </LanguageProvider>
  </StrictMode>,
)
