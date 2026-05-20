import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, AlertCircle } from 'lucide-react'
import { getChapters } from '../api'
import Spinner from '../components/Spinner'

export default function HomePage() {
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getChapters()
      .then(setChapters)
      .catch(() => setError('Could not load chapters. Is the backend running?'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#EFEFEF]">
      {/* Header — gradient with Load Doc inline */}
      <header className="bg-gradient-to-r from-[#E8725A] via-[#F0A050] to-[#5BC8C0] text-white px-4 shadow-md flex items-center min-h-[60px] gap-3">
        <div className="flex-1" />
        <h1 className="text-xl font-bold tracking-wide text-center">Social Studies – Table of Contents</h1>
        <div className="flex-1 flex justify-end">
          <button
            onClick={() => navigate('/status')}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/35 border border-white/40 text-white text-sm font-medium px-3 py-1.5 rounded-xl transition-colors shrink-0"
          >
            <Upload size={13} />
            Load Doc
          </button>
        </div>
      </header>

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
            No chapters loaded. Click <strong>Load Doc</strong> to import the PDF content.
          </p>
        ) : (
          <ol className="mt-3 space-y-3">
            {chapters.map((ch, i) => (
              <li key={ch.id}>
                <button
                  onClick={() => navigate(`/chapter/${ch.id}`)}
                  className="w-full flex items-center gap-4 bg-white rounded-2xl shadow-sm px-5 py-4 hover:shadow-md transition-all group text-left"
                >
                  <span className="w-8 h-8 rounded-full bg-[#E8725A] text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-[#2D2D2D] font-medium group-hover:text-[#E8725A] group-hover:underline transition-colors cursor-pointer">
                    {ch.chapter_name}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  )
}
