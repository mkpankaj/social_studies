import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ChapterPage from './pages/ChapterPage'
import ReadPage from './pages/ReadPage'
import QuizPage from './pages/QuizPage'
import AskPage from './pages/AskPage'
import StatusPage from './pages/StatusPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/chapter/:id" element={<ChapterPage />} />
        <Route path="/chapter/:id/read" element={<ReadPage />} />
        <Route path="/chapter/:id/quiz" element={<QuizPage />} />
        <Route path="/ask" element={<AskPage />} />
      </Routes>
    </BrowserRouter>
  )
}
