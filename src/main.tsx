import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App.tsx'
import { Boundary } from './app/Boundary.tsx'
import './app/styles.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>,
)
