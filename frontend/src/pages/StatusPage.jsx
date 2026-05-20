import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, X } from 'lucide-react'
import { getStatus } from '../api'
import Spinner from '../components/Spinner'

function progressBar(done, total) {
  if (!done || !total) return null
  const pct = Math.round((done / total) * 100)
  const filled = Math.round((done / total) * 10)
  return `[${'•'.repeat(filled)}${pct}%${'·'.repeat(10 - filled)}]`
}

function StatusCell({ status, error, pagesDone, pageCount, onErrorClick }) {
  if (!status) {
    return <span className="text-[#888888]">—</span>
  }
  if (status === 'in_progress') {
    const bar = progressBar(pagesDone, pageCount)
    return (
      <span className="text-[#E8725A] font-mono text-xs">
        {bar || <Spinner size={12} />}
        {bar && <Spinner size={10} className="inline ml-1" />}
      </span>
    )
  }
  if (status === 'success') {
    return <span className="text-green-600 font-medium">success</span>
  }
  if (status === 'failed') {
    return (
      <button
        onClick={() => error && onErrorClick(error)}
        className={`font-medium text-red-600 ${error ? 'underline cursor-pointer hover:text-red-800' : ''}`}
      >
        failed
      </button>
    )
  }
  return <span className="text-[#888888]">{status}</span>
}

export default function StatusPage() {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalError, setModalError] = useState(null)
  const pollRef = useRef(null)

  function load() {
    return getStatus()
      .then(data => {
        setFiles(data)
        setLoading(false)
        const busy = data.some(f =>
          f.step1_status === 'in_progress' ||
          f.step2_status === 'in_progress' ||
          f.step3_status === 'in_progress'
        )
        if (busy) {
          pollRef.current = setTimeout(load, 2000)
        } else {
          pollRef.current = null
        }
      })
      .catch(() => {
        setError('Could not load status. Is the backend running?')
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [])

  const anyBusy = files.some(f =>
    f.step1_status === 'in_progress' ||
    f.step2_status === 'in_progress' ||
    f.step3_status === 'in_progress'
  )

  return (
    <div className="min-h-screen bg-[#EFEFEF]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#5BC8C0] via-[#6BA3D6] to-[#E8725A] text-white px-4 flex items-center gap-3 shadow-md min-h-[72px]">
        <button onClick={() => navigate('/')} className="text-white/80 hover:text-white">
          <Home size={18} />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold">File Upload Status</h1>
        {anyBusy && <Spinner size={16} />}
      </header>

      <main className="px-4 sm:px-6 py-6 max-w-4xl mx-auto">
        {loading ? (
          <div className="flex items-center gap-2 text-[#888888] text-sm mt-4">
            <Spinner size={16} />
            Loading...
          </div>
        ) : error ? (
          <p className="text-red-600 text-sm mt-4">{error}</p>
        ) : files.length === 0 ? (
          <p className="text-[#888888] text-sm mt-4">No PDF files found in docs/content/.</p>
        ) : (
          <div className="bg-white rounded-2xl shadow-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F5F0EE] text-[#2D2D2D] text-left">
                  <th className="px-4 py-2 font-semibold rounded-tl-2xl">File Name</th>
                  <th className="px-4 py-2 font-semibold text-center">Pages</th>
                  <th className="px-4 py-2 font-semibold text-center">Step 1 — OCR</th>
                  <th className="px-4 py-2 font-semibold text-center">Step 2 — Index</th>
                  <th className="px-4 py-2 font-semibold text-center rounded-tr-2xl">Step 3 — Summary</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f, i) => (
                  <tr key={f.filename} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'}>
                    <td className="px-4 py-2 font-mono text-[#2D2D2D]">{f.filename}</td>
                    <td className="px-4 py-2 text-center text-[#888888]">
                      {f.page_count ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <StatusCell
                        status={f.step1_status}
                        error={f.step1_error}
                        pagesDone={f.step1_pages_done}
                        pageCount={f.page_count}
                        onErrorClick={setModalError}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <StatusCell
                        status={f.step2_status}
                        error={f.step2_error}
                        onErrorClick={setModalError}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <StatusCell
                        status={f.step3_status}
                        error={f.step3_error}
                        onErrorClick={setModalError}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-[#888888] mt-3">
          {anyBusy ? 'Auto-refreshing every 2 seconds…' : 'Click Refresh on the home page to re-run ingestion.'}
        </p>
      </main>

      {/* Error modal */}
      {modalError && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4"
          onClick={() => setModalError(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[#2D2D2D]">Error Details</h2>
              <button onClick={() => setModalError(null)} className="text-[#888888] hover:text-[#2D2D2D]">
                <X size={18} />
              </button>
            </div>
            <pre className="text-xs text-red-700 bg-red-50 rounded-xl p-3 overflow-auto max-h-64 whitespace-pre-wrap break-words">
              {modalError}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
