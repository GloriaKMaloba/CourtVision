import { useState, useRef, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { api } from "../services/api"

export default function UploadPage() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)
  const [statusMessage, setStatusMessage] = useState("")
  const [error, setError] = useState("")

  const fileInputRef = useRef(null)
  const activePollingRef = useRef(null)

  useEffect(() => {
    return () => {
      if (activePollingRef.current) {
        clearInterval(activePollingRef.current)
      }
    }
  }, [])

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile || isProcessing) return
    const validTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"]
    const validExtensions = [".mp4", ".mov", ".avi", ".webm"]
    const ext = selectedFile.name.substring(selectedFile.name.lastIndexOf(".")).toLowerCase()

    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(ext)) {
      setError("Please select a supported video format (.mp4, .mov, .avi, .webm)")
      return
    }

    if (selectedFile.size > 500 * 1024 * 1024) {
      setError("File size exceeds 500MB limit.")
      return
    }

    setError("")
    setFile(selectedFile)
    setPreviewUrl(URL.createObjectURL(selectedFile))
    if (!title) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "))
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    if (!isProcessing) setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (isProcessing) return
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) {
      setError("Please choose a video file first.")
      return
    }

    setIsProcessing(true)
    setProgressPercent(15)
    setStatusMessage("Uploading footage to CourtVision...")
    setError("")

    try {
      // Simulate initial upload progress while file streams to backend
      const uploadTimer = setInterval(() => {
        setProgressPercent((prev) => (prev < 45 ? prev + 10 : prev))
      }, 250)

      const result = await api.uploadVideo(file, { title, notes })
      clearInterval(uploadTimer)

      const videoId = result?.video?.id
      if (!videoId) {
        throw new Error("Video uploaded but no ID was returned by server.")
      }

      setProgressPercent(50)
      setStatusMessage("Extracting shot mechanics (YOLOv8 & MediaPipe)...")

      // Poll video processing status until complete, then redirect directly to analytics
      activePollingRef.current = setInterval(async () => {
        try {
          const statusRes = await api.getVideoStatus(videoId)

          if (statusRes.status === "completed") {
            clearInterval(activePollingRef.current)
            setProgressPercent(100)
            setStatusMessage("Analysis complete! Redirecting to analytics...")
            setTimeout(() => {
              navigate(`/results?video_id=${videoId}`)
            }, 600)
          } else if (statusRes.status === "failed") {
            clearInterval(activePollingRef.current)
            setIsProcessing(false)
            setError(statusRes.error_message || "Video analysis encountered an error.")
          } else {
            const rawProgress = statusRes.progress_percent || 50
            const displayProgress = Math.max(50, Math.min(95, rawProgress))
            setProgressPercent(displayProgress)
            const stageLabel = statusRes.stage ? statusRes.stage.replace(/_/g, " ") : "processing"
            setStatusMessage(`Analyzing footage: ${stageLabel}...`)
          }
        } catch (pollErr) {
          console.error("Status polling error:", pollErr)
        }
      }, 1500)
    } catch (err) {
      setIsProcessing(false)
      setError(err.message || "Failed to upload video footage")
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-[#FAFAF9]">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-cv-navy/10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 text-cv-orange rounded-2xl flex items-center justify-center text-2xl font-bold">
            🏀
          </div>
          <h2 className="text-2xl font-display font-bold text-cv-navy">Authentication Required</h2>
          <p className="mt-3 text-sm text-cv-navy/60">
            Please log in or register an athlete account to upload smartphone basketball shooting footage.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              to="/login"
              className="w-full bg-cv-orange text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition text-center shadow-xs"
            >
              Sign In to Continue
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-80px)] py-10 px-4 sm:px-6 lg:px-8 bg-[#FAFAF9]">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <span className="text-xs uppercase font-bold tracking-widest text-cv-orange">
            Video Ingestion Module
          </span>
          <h1 className="mt-1 text-3xl font-display font-bold text-cv-navy">
            Upload Shooting Footage
          </h1>
          <p className="mt-1 text-sm text-cv-navy/65">
            Submit smartphone recorded shooting sessions for standardized computer vision evaluation.
          </p>
        </div>

        <form onSubmit={handleUpload} className="bg-white rounded-3xl p-6 sm:p-8 border border-cv-navy/10 shadow-sm space-y-6">
          {error && (
            <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
              {error}
            </div>
          )}

          {/* Recording Guidelines & Standards */}
          <div className="bg-[#F8F9FA] border border-cv-navy/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-base">📋</span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-cv-navy">
                Footage Recording Guidelines
              </h3>
            </div>
            <p className="text-xs text-cv-navy/60 mb-3.5">
              For optimal computer vision tracking and biomechanical accuracy, please adhere to these 4 standards:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-cv-navy/5 shadow-2xs">
                <span className="text-base leading-none">🎯</span>
                <div>
                  <p className="text-xs font-bold text-cv-navy">Max 10 Shots per Clip</p>
                  <p className="text-[11px] text-cv-navy/60 leading-relaxed mt-0.5">
                    Keep your recorded drill or session to no more than 10 shot attempts per video.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-cv-navy/5 shadow-2xs">
                <span className="text-base leading-none">🏀</span>
                <div>
                  <p className="text-xs font-bold text-cv-navy">Full Body in Frame</p>
                  <p className="text-[11px] text-cv-navy/60 leading-relaxed mt-0.5">
                    Feet on the court and ball at the highest release point must remain visible throughout.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-cv-navy/5 shadow-2xs">
                <span className="text-base leading-none">📐</span>
                <div>
                  <p className="text-xs font-bold text-cv-navy">Dominant Hand Side Angle</p>
                  <p className="text-[11px] text-cv-navy/60 leading-relaxed mt-0.5">
                    Position phone/tripod on the side of your dominant shooting hand (e.g. right side if right-handed).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 bg-white rounded-xl border border-cv-navy/5 shadow-2xs">
                <span className="text-base leading-none">☀️</span>
                <div>
                  <p className="text-xs font-bold text-cv-navy">Good Lighting & Contrast</p>
                  <p className="text-[11px] text-cv-navy/60 leading-relaxed mt-0.5">
                    Film in well-lit conditions (bright gym or daytime outdoor court) avoiding backlighting.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-cv-navy/70 mb-2">
              Select Video File (Smartphone Shot Footage)
            </label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center transition ${
                isProcessing
                  ? "border-gray-200 bg-gray-50/50 cursor-not-allowed opacity-75"
                  : isDragging
                  ? "border-cv-orange bg-orange-50/50 cursor-pointer"
                  : file
                  ? "border-green-400 bg-green-50/30 cursor-pointer"
                  : "border-gray-300 hover:border-cv-orange/60 bg-gray-50/50 cursor-pointer"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                disabled={isProcessing}
                accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files[0])}
              />

              {file ? (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto bg-green-100 text-green-700 rounded-2xl flex items-center justify-center text-xl">
                    📹
                  </div>
                  <p className="text-sm font-semibold text-cv-navy">{file.name}</p>
                  <p className="text-xs text-cv-navy/60">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • {isProcessing ? "Processing..." : "Ready for analysis"}
                  </p>
                  {!isProcessing && (
                    <p className="text-xs text-cv-orange font-medium underline">
                      Click to choose a different video
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 mx-auto bg-orange-100 text-cv-orange rounded-2xl flex items-center justify-center text-2xl">
                    ⬆
                  </div>
                  <p className="text-sm font-semibold text-cv-navy">
                    Drag and drop your basketball footage here
                  </p>
                  <p className="text-xs text-cv-navy/50">
                    Supports MP4, MOV, AVI, WebM (up to 500MB)
                  </p>
                  <span className="inline-block mt-2 px-4 py-1.5 bg-white border border-gray-200 text-xs font-semibold text-cv-navy rounded-xl shadow-2xs">
                    Browse Files
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Video Preview */}
          {previewUrl && (
            <div className="rounded-2xl overflow-hidden border border-gray-200 bg-black">
              <video src={previewUrl} controls className="w-full max-h-64 object-contain mx-auto" />
            </div>
          )}

          {/* Video Metadata Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
                Session / Drill Title
              </label>
              <input
                type="text"
                required
                disabled={isProcessing}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kisumu Clinic - 3pt Catch and Shoot"
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
                Drill Notes / Court Setting (Optional)
              </label>
              <textarea
                rows={3}
                disabled={isProcessing}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Recorded using smartphone tripod at baseline angle, sunny outdoor court conditions."
                className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Single Progress Bar during Upload & Processing */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-cv-navy">
                <span>{statusMessage}</span>
                <span className="font-mono text-cv-orange font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-cv-orange h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isProcessing || !file}
            className="w-full bg-cv-orange text-white py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 shadow-sm cursor-pointer"
          >
            {isProcessing ? "Analyzing Video Mechanics..." : "Upload & Analyze Video"}
          </button>
        </form>
      </div>
    </div>
  )
}
