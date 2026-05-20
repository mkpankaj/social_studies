import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
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
      <header className="bg-gradient-to-r from-[#E8725A] to-[#F0A050] text-white flex items-center px-4 shrink-0 shadow-md min-h-[60px]">
        <button
          onClick={() => navigate(`/chapter/${id}`)}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/25 hover:bg-white/40 transition-colors shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="flex-1 text-center text-xl font-bold pr-9">
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
