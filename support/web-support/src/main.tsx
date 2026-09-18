import 'reflect-metadata'

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n/config'
import { initializeContainer } from './core/di/container'
import { registerSupportDependencies } from './core/di/support.bindings'

const container = initializeContainer()
registerSupportDependencies(container)

if (import.meta.env.DEV) {
  console.info('🎧 Support console initialized · port 5182 · route /support')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
