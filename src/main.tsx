import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import Layout from './components/Layout'
import App from './App'
import PhysicsPlayground from './pages/PhysicsPlayground'
import Platformer from './pages/Platformer'
import OG from './pages/OG'
import Portal from './pages/Portal'

const CONVERTED_KEY = 'og-converted'

function HomePage() {
  const [converted, setConverted] = useState(() => localStorage.getItem(CONVERTED_KEY) === 'true')

  useEffect(() => {
    if (converted) return
    const timer = setTimeout(() => {
      localStorage.setItem(CONVERTED_KEY, 'true')
      setConverted(true)
    }, 5000)
    return () => clearTimeout(timer)
  }, [converted])

  if (converted) return <OG />
  return <App />
}

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/physics" element={<PhysicsPlayground />} />
          <Route path="/platformer" element={<Platformer />} />
          <Route path="/og" element={<OG />} />
          <Route path="/portal" element={<Portal />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
