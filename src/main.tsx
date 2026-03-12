import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import Layout from './components/Layout'
import App from './App'
import PhysicsPlayground from './pages/PhysicsPlayground'
import Platformer from './pages/Platformer'
import OG from './pages/OG'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<App />} />
          <Route path="/physics" element={<PhysicsPlayground />} />
          <Route path="/platformer" element={<Platformer />} />
          <Route path="/og" element={<OG />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
