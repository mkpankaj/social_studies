import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, AlertCircle, ClipboardList } from 'lucide-react'
import { getChapters } from '../api'
import Spinner from '../components/Spinner'

const STEPS = [
  'Loading files...',
  'Extracting content...',
  'Creating summaries...',
]

export default function HomePage() {
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [step, setStep] = useState(0)
  const [stepMsg, setStepMsg] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => setError('Could not load chapters. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  function handleRefresh() {
    setRefreshing(true)
    setRefreshError('')
    setStep(0)
    setStepMsg('Connecting...')

    const es = new EventSource('/api/refresh')

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)

      if (data.done) {
        es.close()
        getChapters().then(setChapters).finally(() => {
          setRefreshing(false)
          setStep(0)
          setStepMsg('')
        })
        return
      }

      if (data.step === 'error') {
        setStepMsg(`Error in ${data.stage} for ${data.file}: ${data.error}`)
      } else if (data.step === 'ocr') {
        setStep(1)
        setStepMsg(`Step 1: ${STEPS[0]} — ${data.file ?? ''} (${data.total ?? ''} pages)`)
      } else if (data.step === 'index') {
        setStep(2)
        setStepMsg(`Step 2: ${STEPS[1]} — ${data.file ?? ''}`)
      } else if (data.step === 'summary') {
        setStep(3)
        setStepMsg(`Step 3: ${STEPS[2]} — ${data.file ?? ''}`)
      } else if (data.step === 'done_file') {
        setStepMsg(`Done: ${data.file}`)
      } else if (data.current_step === 2) {
        setStep(2)
        setStepMsg(`Step 2: ${STEPS[1]}`)
      } else if (data.current_step === 3) {
        setStep(3)
        setStepMsg(`Step 3: ${STEPS[2]}`)
      }
    }

    es.onerror = () => {
      es.close()
      setRefreshing(false)
      setStep(0)
      setStepMsg('')
      setRefreshError('Refresh failed. Check that the backend is running and try again.')
    }
  }

  return (
    <div className="min-h-screen bg-[#EFEFEF]">
      {/* Header */}
      <header className="bg-white text-[#2D2D2D] text-center py-3 px-4 shadow-sm">
        <h1 className="text-xl font-bold">Social Studies – Table of Contents</h1>
      </header>

      {/* Refresh bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-white border-b border-gray-100">
        <span className="text-sm text-[#888888]">
          {loading ? '' : chapters.length > 0
            ? `${chapters.length} chapter${chapters.length !== 1 ? 's' : ''} loaded`
            : 'No chapters loaded yet'}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/status')}
            className="flex items-center gap-1.5 border border-[#E8725A] hover:bg-[#FEF0ED] text-[#E8725A] text-sm font-medium px-3 py-2 rounded-xl"
          >
            <ClipboardList size={14} />
            Status
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-[#E8725A] hover:bg-[#D4614A] disabled:bg-[#F0B8AE] text-white text-sm font-medium px-4 py-2 rounded-xl"
          >
            {refreshing
              ? <Spinner size={14} />
              : <RefreshCw size={14} />}
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Progress indicator */}
      {refreshing && (
        <div className="bg-[#FEF6F4] border-b border-[#F0C8BF] px-4 sm:px-6 py-3">
          <div className="flex flex-wrap gap-4 sm:gap-6 mb-2">
            {STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-1.5 text-sm">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                    step > i + 1
                      ? 'bg-[#5BC8C0] text-white'
                      : step === i + 1
                      ? 'bg-[#E8725A] text-white'
                      : 'bg-gray-200 text-[#888888]'
                  }`}
                >
                  {step > i + 1 ? '✓' : i + 1}
                </span>
                <span className={step >= i + 1 ? 'text-[#2D2D2D] font-medium' : 'text-[#888888]'}>
                  {label}
                </span>
              </div>
            ))}
          </div>
          {stepMsg && <p className="text-xs text-[#E8725A] break-words">{stepMsg}</p>}
        </div>
      )}

      {/* Refresh error */}
      {refreshError && (
        <div className="flex items-center gap-2 px-4 sm:px-6 py-3 bg-red-50 border-b border-red-200 text-red-600 text-sm">
          <AlertCircle size={16} className="shrink-0" />
          {refreshError}
        </div>
      )}

      {/* Chapter list */}
      <main className="px-4 sm:px-6 py-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-[#888888] text-sm mt-4">
            <Spinner size={16} />
            Loading chapters...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 mt-4 text-red-600 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        ) : chapters.length === 0 ? (
          <p className="text-[#888888] text-sm mt-4">
            No chapters loaded. Click <strong>Refresh</strong> to import the PDF content.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {chapters.map((ch, i) => (
              <li key={ch.id}>
                <button
                  onClick={() => navigate(`/chapter/${ch.id}`)}
                  className="w-full flex items-center gap-4 bg-white rounded-2xl shadow-sm px-5 py-4 hover:shadow-md transition-shadow text-left"
                >
                  <span className="w-8 h-8 rounded-full bg-[#E8725A] text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-[#2D2D2D] font-medium">{ch.chapter_name}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  )
}
