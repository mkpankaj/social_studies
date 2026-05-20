import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Home, MessageSquare, Send, AlertCircle } from 'lucide-react'
import { getChapter } from '../api'
import Spinner from '../components/Spinner'

export default function ChapterPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chapter, setChapter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [question, setQuestion] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    getChapter(id)
      .then(setChapter)
      .catch(() => setError('Could not load chapter. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [id])

  function handleAsk(e) {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    navigate('/ask', { state: { question: q, chapterId: Number(id), chapterName: chapter?.chapter_name } })
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#EFEFEF]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#E8725A] to-[#F0A050] text-white flex items-center px-4 shadow-md min-h-[60px]">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/25 hover:bg-white/40 transition-colors shrink-0"
        >
          <Home size={20} />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold pr-9">
          {loading ? '...' : chapter?.chapter_name ?? 'Chapter'}
        </h1>
      </header>

      {/* Sub-header: label + action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-white border-b border-gray-100">
        <span className="font-bold text-[#2D2D2D]">Summary of Chapter</span>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/chapter/${id}/read`)}
            className="flex-1 sm:flex-none bg-[#E8725A] hover:bg-[#D4614A] text-white text-sm font-medium px-4 py-1.5 rounded-xl"
          >
            Read Chapter
          </button>
          <button
            onClick={() => navigate(`/chapter/${id}/quiz`)}
            className="flex-1 sm:flex-none bg-[#E8725A] hover:bg-[#D4614A] text-white text-sm font-medium px-4 py-1.5 rounded-xl"
          >
            Take Quiz
          </button>
        </div>
      </div>

      {/* Summary area */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 pb-24">
        {loading ? (
          <div className="flex items-center gap-2 text-[#888888] text-sm mt-4">
            <Spinner size={16} />
            Loading summary...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 mt-4 text-red-600 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        ) : !chapter?.summary ? (
          <p className="text-[#888888] text-sm italic mt-4">
            No summary available. Run Refresh to generate chapter content.
          </p>
        ) : (
          <div className="rounded-2xl bg-white shadow-md p-5 min-h-64">
            <p className="text-[#2D2D2D] leading-relaxed whitespace-pre-line text-sm">
              {chapter.summary}
            </p>
          </div>
        )}
      </main>

      {/* Ask AI Assistant bar — fixed at bottom */}
      <form
        onSubmit={handleAsk}
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
      >
        <div className="flex items-center gap-1.5 sm:gap-2 text-[#E8725A] shrink-0">
          <MessageSquare size={18} />
          <span className="hidden sm:inline text-sm font-medium">Ask AI Assistant</span>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about this chapter..."
          className="flex-1 border-2 border-[#E8725A]/40 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#E8725A] focus:ring-2 focus:ring-[#E8725A]/20 bg-[#FEF6F4] placeholder-[#B0907E] transition-all"
        />
        <button
          type="submit"
          disabled={!question.trim()}
          className="bg-[#E8725A] hover:bg-[#D4614A] disabled:bg-[#C4A39B] text-white rounded-xl p-1.5 transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
