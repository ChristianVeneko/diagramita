import { useEffect } from 'react'
import { HashRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { DiagramProvider } from './store/DiagramContext.jsx'
import Landing from './pages/Landing.jsx'
import Editor from './pages/Editor.jsx'

function BodyClassSync() {
  const { pathname } = useLocation()
  useEffect(() => {
    const isEditor = pathname.startsWith('/editor')
    document.body.classList.toggle('editor-active', isEditor)
    return () => document.body.classList.remove('editor-active')
  }, [pathname])
  return null
}

export default function App() {
  return (
    <HashRouter>
      <BodyClassSync />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/editor" element={
          <DiagramProvider>
            <Editor />
          </DiagramProvider>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
