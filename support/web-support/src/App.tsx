/**
 * App — Support Console
 */
import { Suspense } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { SupportRoutes } from './routes/SupportRoutes'
import './App.css'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Suspense
        fallback={
          <div className="flex h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-orange-600" />
          </div>
        }
      >
        <SupportRoutes />
      </Suspense>
    </BrowserRouter>
  )
}

export default App
