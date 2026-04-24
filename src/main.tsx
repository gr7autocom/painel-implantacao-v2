import React, { StrictMode } from 'react'
import ReactDOM from 'react-dom'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// axe-core: injeta warnings de acessibilidade no console em DEV.
// Build de produção não inclui (Vite faz tree-shaking do bloco).
if (import.meta.env.DEV) {
  import('@axe-core/react').then(({ default: axe }) => {
    axe(React, ReactDOM, 1000)
  }).catch(() => { /* não derruba o app se falhar */ })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
