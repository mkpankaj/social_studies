import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Home } from 'lucide-react'
import { getChapter, pdfUrl } from '../api'
import Spinner from '../components/Spinner'

export default function ReadPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chapterName, setChapterName] = useState('')
  const [iframeReady, setIframeReady] = useState(false)

  useEffect(() => {
    getChapter(id).then((ch) => setChapterName(ch.chapter_name))
  }, [id])

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white text-[#2D2D2D] flex items-center px-4 py-3 shrink-0 shadow-sm">
        <button onClick={() => navigate(`/chapter/${id}`)} className="text-[#888888] hover:text-[#2D2D2D]">
          <Home size={20} />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold pr-6">
          {chapterName || '...'}
        </h1>
      </header>

      {/* PDF viewer — fills all remaining height */}
      <div className="flex-1 relative">
        {!iframeReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <Spinner size={32} />
              <span className="text-sm">Loading PDF...</span>
            </div>
          </div>
        )}
        <iframe
          src={pdfUrl(id)}
          className="w-full h-full border-0"
          title={chapterName}
          onLoad={() => setIframeReady(true)}
        />
      </div>
    </div>
  )
}
