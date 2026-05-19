import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Home, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { getChapter, getQuiz, evaluateAnswer } from '../api'
import Spinner from '../components/Spinner'

export default function QuizPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [chapterName, setChapterName] = useState('')
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Quiz state
  const [current, setCurrent] = useState(0)
  const [answer, setAnswer] = useState('')
  const [evaluating, setEvaluating] = useState(false)
  const [evalError, setEvalError] = useState('')
  const [result, setResult] = useState(null)
  const [scores, setScores] = useState([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    Promise.all([getChapter(id), getQuiz(id)])
      .then(([ch, qs]) => {
        setChapterName(ch.chapter_name)
        setQuestions(qs)
      })
      .catch(() => setLoadError('Could not load quiz. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!answer.trim() || evaluating) return

    const q = questions[current]
    setEvaluating(true)
    setEvalError('')
    try {
      const res = await evaluateAnswer({
        chapter_id: Number(id),
        question: q.question,
        question_type: q.type,
        correct_answer: q.correct_answer,
        user_answer: answer,
      })
      setResult(res)
      setScores((prev) => [...prev, { q, userAnswer: answer, ...res }])
    } catch {
      setEvalError('Could not evaluate your answer. Please try again.')
    } finally {
      setEvaluating(false)
    }
  }

  function handleNext() {
    if (current + 1 >= questions.length) {
      setDone(true)
    } else {
      setCurrent((c) => c + 1)
      setAnswer('')
      setResult(null)
      setEvalError('')
    }
  }

  if (loading) {
    return (
      <PageShell chapterName="..." onHome={() => navigate(`/chapter/${id}`)}>
        <div className="flex items-center gap-2 text-[#888888] text-sm p-6">
          <Spinner size={16} />
          Loading quiz...
        </div>
      </PageShell>
    )
  }

  if (loadError) {
    return (
      <PageShell chapterName={chapterName} onHome={() => navigate(`/chapter/${id}`)}>
        <div className="flex items-center gap-2 m-6 text-red-600 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {loadError}
        </div>
      </PageShell>
    )
  }

  if (questions.length === 0) {
    return (
      <PageShell chapterName={chapterName} onHome={() => navigate(`/chapter/${id}`)}>
        <p className="text-[#888888] text-sm p-6">
          No quiz available. Run Refresh to generate quiz questions.
        </p>
      </PageShell>
    )
  }

  if (done) {
    return <ResultsScreen chapterName={chapterName} scores={scores} onHome={() => navigate(`/chapter/${id}`)} />
  }

  const q = questions[current]
  const total = questions.length

  return (
    <PageShell chapterName={chapterName} onHome={() => navigate(`/chapter/${id}`)}>
      <div className="px-4 sm:px-6 py-4 max-w-2xl">
        {/* Progress */}
        <p className="text-sm text-[#888888] mb-4">Question {current + 1} of {total}</p>

        {/* Question */}
        <p className="font-medium text-[#2D2D2D] mb-4 leading-snug">{q.question}</p>

        {/* Answer input */}
        <form onSubmit={handleSubmit}>
          {q.type === 'mcq' ? (
            <div className="space-y-2 mb-6">
              {q.options.map((opt) => (
                <label
                  key={opt}
                  className={`flex items-start gap-3 border rounded-xl px-4 py-2.5 cursor-pointer text-sm
                    ${answer === opt ? 'border-[#E8725A] bg-[#FEF0ED]' : 'border-gray-100 bg-white hover:bg-gray-50'}
                    ${result ? 'pointer-events-none' : ''}`}
                >
                  <input
                    type="radio"
                    name="mcq"
                    value={opt}
                    checked={answer === opt}
                    onChange={() => setAnswer(opt)}
                    className="mt-0.5 accent-[#E8725A]"
                    disabled={!!result}
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Write your answer in 2–3 sentences..."
              rows={4}
              disabled={!!result}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#E8725A] mb-6 resize-none disabled:bg-gray-50"
            />
          )}

          {/* Feedback after evaluation */}
          {result && (
            <div className={`flex gap-3 rounded-xl px-4 py-3 mb-4 text-sm ${result.correct ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {result.correct
                ? <CheckCircle size={18} className="text-green-600 shrink-0 mt-0.5" />
                : <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />}
              <div>
                <p className={`font-medium ${result.correct ? 'text-green-700' : 'text-red-600'}`}>
                  {result.correct ? 'Correct!' : 'Incorrect'}
                </p>
                {result.explanation && (
                  <p className="text-[#2D2D2D] mt-0.5">{result.explanation}</p>
                )}
              </div>
            </div>
          )}

          {/* Evaluate error */}
          {evalError && (
            <div className="flex items-center gap-2 mb-4 text-red-600 text-sm">
              <AlertCircle size={15} className="shrink-0" />
              {evalError}
            </div>
          )}

          {!result ? (
            <button
              type="submit"
              disabled={!answer.trim() || evaluating}
              className="flex items-center gap-2 bg-[#E8725A] hover:bg-[#D4614A] disabled:bg-gray-200 text-white text-sm font-medium px-6 py-2 rounded-xl"
            >
              {evaluating && <Spinner size={14} />}
              {evaluating ? 'Checking...' : 'Submit Answer'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="bg-[#E8725A] hover:bg-[#D4614A] text-white text-sm font-medium px-6 py-2 rounded-xl"
            >
              {current + 1 >= total ? 'See Results' : 'Next Question'}
            </button>
          )}
        </form>
      </div>
    </PageShell>
  )
}

function ResultsScreen({ chapterName, scores, onHome }) {
  const correct = scores.filter((s) => s.correct).length
  const total = scores.length

  return (
    <PageShell chapterName={chapterName} onHome={onHome}>
      <div className="px-4 sm:px-6 py-4 max-w-2xl">
        {/* Score banner */}
        <div className="bg-[#E8725A] text-white rounded-2xl px-6 py-4 mb-6 text-center shadow-md">
          <p className="text-sm uppercase tracking-wide mb-1 opacity-80">Your Score</p>
          <p className="text-4xl font-bold">{correct} / {total}</p>
        </div>

        {/* Per-question review */}
        <div className="space-y-4">
          {scores.map((s, i) => (
            <div
              key={i}
              className={`border rounded-xl px-4 py-3 text-sm ${s.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
            >
              <div className="flex gap-2 items-start">
                {s.correct
                  ? <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
                  : <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />}
                <p className="font-medium text-[#2D2D2D]">{i + 1}. {s.q.question}</p>
              </div>
              {!s.correct && (
                <div className="mt-2 ml-6 space-y-1 text-[#2D2D2D]">
                  <p><span className="font-medium">Your answer:</span> {s.userAnswer}</p>
                  <p><span className="font-medium">Correct answer:</span> {s.q.correct_answer}</p>
                  {s.explanation && <p className="italic">{s.explanation}</p>}
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={onHome}
          className="mt-6 bg-[#E8725A] hover:bg-[#D4614A] text-white text-sm font-medium px-6 py-2 rounded-xl"
        >
          Back to Chapter
        </button>
      </div>
    </PageShell>
  )
}

function PageShell({ chapterName, onHome, children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#EFEFEF]">
      <header className="bg-white text-[#2D2D2D] flex items-center px-4 py-3 shrink-0 shadow-sm">
        <button onClick={onHome} className="text-[#888888] hover:text-[#2D2D2D]">
          <Home size={20} />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold pr-6">{chapterName || '...'}</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
