import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { DiagramProvider } from './store/DiagramContext.jsx'
import Landing from './pages/Landing.jsx'
import Editor from './pages/Editor.jsx'

export default function App() {
  return (
    <HashRouter>
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
