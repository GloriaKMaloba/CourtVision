import { useState, useRef } from "react"
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
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState("")
  const [uploadSuccess, setUploadSuccess] = useState(null)

  const fileInputRef = useRef(null)

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return
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
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
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

    setUploading(true)
    setUploadProgress(25)
    setError("")

    try {
      // Emulate progress steps during upload
      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => (prev < 90 ? prev + 20 : prev))
      }, 300)

      const result = await api.uploadVideo(file, { title, notes })

      clearInterval(progressTimer)
      setUploadProgress(100)
      setUploadSuccess(result.video)
    } catch (err) {
      setError(err.message || "Failed to upload video footage")
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setFile(null)
    setPreviewUrl("")
    setTitle("")
    setNotes("")
    setUploadSuccess(null)
    setUploadProgress(0)
    setError("")
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

        {uploadSuccess ? (
          <div className="bg-white rounded-3xl p-8 border border-green-200 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 text-green-700 rounded-2xl flex items-center justify-center text-2xl font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-cv-navy">
                  Footage Uploaded & Registered!
                </h3>
                <p className="text-sm text-green-700 font-medium">
                  Video ID #{uploadSuccess.id} is securely stored and queued for CV pipeline processing.
                </p>
              </div>
            </div>

            <div className="bg-[#FAFAF9] rounded-2xl p-5 border border-cv-navy/5 space-y-3">
              <div className="flex justify-between text-sm py-1 border-b border-gray-200/60">
                <span className="text-cv-navy/60">Title:</span>
                <span className="font-semibold text-cv-navy">{uploadSuccess.title}</span>
              </div>
              <div className="flex justify-between text-sm py-1 border-b border-gray-200/60">
                <span className="text-cv-navy/60">Original Filename:</span>
                <span className="font-mono text-xs text-cv-navy/80">{uploadSuccess.original_filename}</span>
              </div>
              <div className="flex justify-between text-sm py-1 border-b border-gray-200/60">
                <span className="text-cv-navy/60">File Size:</span>
                <span className="font-semibold text-cv-navy">{uploadSuccess.file_size_mb} MB</span>
              </div>
              <div className="flex justify-between text-sm py-1">
                <span className="text-cv-navy/60">Pipeline Status:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                  ⏳ {uploadSuccess.status.toUpperCase()} (Queued for YOLOv8 & MediaPipe)
                </span>
              </div>
            </div>

            <div className="border border-cv-orange/20 bg-orange-50/50 rounded-2xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cv-orange mb-2">
                Automated CV Extraction Stages
              </h4>
              <ul className="text-xs text-cv-navy/70 space-y-1.5 list-disc list-inside">
                <li>Frame Standardization & Bounding Box extraction via OpenCV</li>
                <li>Ball trajectory tracking using fine-tuned YOLOv8</li>
                <li>Joint landmarks & release frame estimation via MediaPipe</li>
                <li>Random Forest 2-Point vs 3-Point Shot Classification</li>
              </ul>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={resetForm}
                className="flex-1 bg-white border border-cv-navy/20 text-cv-navy py-3 rounded-xl font-semibold text-sm hover:border-cv-navy transition cursor-pointer"
              >
                Upload Another Video
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="flex-1 bg-cv-orange text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition shadow-xs cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="bg-white rounded-3xl p-6 sm:p-8 border border-cv-navy/10 shadow-sm space-y-6">
            {error && (
              <div className="p-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
                {error}
              </div>
            )}

            {/* Drag & Drop Zone */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-cv-navy/70 mb-2">
                Select Video File (Smartphone Shot Footage)
              </label>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition ${
                  isDragging
                    ? "border-cv-orange bg-orange-50/50"
                    : file
                    ? "border-green-400 bg-green-50/30"
                    : "border-gray-300 hover:border-cv-orange/60 bg-gray-50/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
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
                      {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready for processing
                    </p>
                    <p className="text-xs text-cv-orange font-medium underline">
                      Click to choose a different video
                    </p>
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
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Kisumu Clinic - 3pt Catch and Shoot"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
                  Drill Notes / Court Setting (Optional)
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Recorded using smartphone tripod at baseline angle, sunny outdoor court conditions."
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange"
                />
              </div>
            </div>

            {/* Upload Progress Bar */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold text-cv-navy">
                  <span>Uploading to CourtVision Video Storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-cv-orange h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full bg-cv-orange text-white py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {uploading ? "Uploading Footage..." : "Upload & Send to CV Pipeline"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}