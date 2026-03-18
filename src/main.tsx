import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import Layout from './components/Layout'
import Main from './pages/Main'

const Portal = lazy(() => import('./pages/Portal'))
const Inspection = lazy(() => import('./pages/Inspection'))
const NonEuclidean = lazy(() => import('./pages/NonEuclidean'))
const NonEuclideanLevel1 = lazy(() => import('./pages/NonEuclideanLevel1'))
const NonEuclideanLevel23 = lazy(() => import('./pages/NonEuclideanLevel23'))
const NonEuclideanLevel26 = lazy(() => import('./pages/NonEuclideanLevel26'))
const NonEuclideanStub = lazy(() => import('./pages/NonEuclideanStub'))

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Main />} />
          <Route path="/portal" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading portal...</div>}>
              <Portal />
            </Suspense>
          } />
          <Route path="/inspection" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading inspection...</div>}>
              <Inspection />
            </Suspense>
          } />
          <Route path="/non-euclidean" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading non-euclidean...</div>}>
              <NonEuclidean />
            </Suspense>
          } />
          <Route path="/non-euclidean/level1" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading non-euclidean...</div>}>
              <NonEuclideanLevel1 />
            </Suspense>
          } />
          <Route path="/non-euclidean/level1/:x/:y/:z/:yaw/:pitch" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading non-euclidean...</div>}>
              <NonEuclideanLevel1 />
            </Suspense>
          } />
          <Route path="/non-euclidean/level2-3" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading non-euclidean...</div>}>
              <NonEuclideanLevel23 />
            </Suspense>
          } />
          <Route path="/non-euclidean/level2-3/:x/:y/:z/:yaw/:pitch" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading non-euclidean...</div>}>
              <NonEuclideanLevel23 />
            </Suspense>
          } />
          <Route path="/non-euclidean/level2-6" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading non-euclidean...</div>}>
              <NonEuclideanLevel26 />
            </Suspense>
          } />
          <Route path="/non-euclidean/level2-6/:x/:y/:z/:yaw/:pitch" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading non-euclidean...</div>}>
              <NonEuclideanLevel26 />
            </Suspense>
          } />
          <Route path="/non-euclidean/level3" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading non-euclidean...</div>}>
              <NonEuclideanStub title="Level3" source="Level3.cpp" />
            </Suspense>
          } />
          <Route path="/non-euclidean/level4" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading non-euclidean...</div>}>
              <NonEuclideanStub title="Level4" source="Level4.cpp" />
            </Suspense>
          } />
          <Route path="/non-euclidean/level5" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading non-euclidean...</div>}>
              <NonEuclideanStub title="Level5" source="Level5.cpp" />
            </Suspense>
          } />
          <Route path="/non-euclidean/level6" element={
            <Suspense fallback={<div style={{ color: '#888', textAlign: 'center', paddingTop: '40vh' }}>loading non-euclidean...</div>}>
              <NonEuclideanStub title="Level6" source="Level6.cpp" />
            </Suspense>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>,
)
