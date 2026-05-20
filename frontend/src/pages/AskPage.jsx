import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { X, MessageSquare, Send, ExternalLink } from 'lucide-react'
import { askAI } from '../api'

export default function AskPage() {
  const { state } = useLocation()
  const navigate = useNavigate()

  const initialQuestion = state?.question || ''
  const chapterId = state?.chapterId || null

  const [turns, setTurns] = useState([])
  const [input, setInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (initialQuestion) {
      fireQuestion(initialQuestion, [])
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  async function fireQuestion(question, history) {
    setTurns((prev) => [...prev, { question, loading: true }])
    setSubmitting(true)
    try {
      const res = await askAI({ question, chapter_id: chapterId, history })
      setTurns((prev) => {
        const next = [...prev]
        next[next.length - 1] = {
          question,
          answer: res.answer,
          internet_sources: res.internet_sources || [],
          loading: false,
        }
        return next
      })
    } catch {
      setTurns((prev) => {
        const next = [...prev]
        next[next.length - 1] = { question, error: 'Failed to get an answer. Please try again.', loading: false }
        return next
      })
    } finally {
      setSubmitting(false)
    }
  }

  function handleAsk(e) {
    e.preventDefault()
    const q = input.trim()
    if (!q || submitting) return
    setInput('')

    const history = turns
      .filter((t) => t.answer)
      .map((t) => ({ question: t.question, answer: t.answer }))

    fireQuestion(q, history)
  }

  function handleClose() {
    if (chapterId) {
      navigate(`/chapter/${chapterId}`)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#EFEFEF]">
      {/* Close button row */}
      <div className="px-4 pt-4 pb-2 shrink-0">
        <button onClick={handleClose} className="text-[#888888] hover:text-[#2D2D2D]">
          <X size={22} />
        </button>
      </div>

      {/* Conversation */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 pb-28">
        {turns.map((turn, i) => (
          <div key={i} className="mb-8">
            {/* Question bubble */}
            <div className="bg-white rounded-2xl shadow-sm px-4 py-3 mb-4">
              <p className="text-[#888888] italic text-sm text-center">{turn.question}</p>
            </div>

            {/* Answer */}
            {turn.loading && (
              <p className="text-[#888888] text-sm">Thinking...</p>
            )}
            {turn.error && (
              <p className="text-red-500 text-sm">{turn.error}</p>
            )}
            {turn.answer && (
              <>
                <p className="text-[#2D2D2D] leading-relaxed text-sm mb-4">
                  {turn.answer}
                </p>

                {/* Additional Info */}
                {turn.internet_sources.length > 0 && (
                  <div>
                    <p className="font-bold text-[#2D2D2D] mb-2">Additional Info</p>
                    {turn.internet_sources.map((src, j) => (
                      <div key={j} className="mb-3">
                        <p className="text-[#F5A623] text-sm leading-relaxed">{src.snippet}</p>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#F5A623] underline text-xs mt-1 hover:text-[#D4891A]"
                        >
                          {src.title || src.url}
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
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
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a follow-up question..."
          className="flex-1 border-2 border-[#E8725A]/40 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#E8725A] focus:ring-2 focus:ring-[#E8725A]/20 bg-[#FEF6F4] placeholder-[#B0907E] transition-all"
        />
        <button
          type="submit"
          disabled={!input.trim() || submitting}
          className="bg-[#E8725A] hover:bg-[#D4614A] disabled:bg-[#C4A39B] text-white rounded-xl p-1.5 transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}
