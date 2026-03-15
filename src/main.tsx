import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

declare global {
  interface Window {
    appWindow?: {
      minimize: () => Promise<void> | void
      toggleMaximize: () => Promise<void> | void
      close: () => Promise<void> | void
      isMaximized: () => Promise<boolean> | boolean
      onMaximizedChanged: (listener: (value: boolean) => void) => (() => void) | void
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
