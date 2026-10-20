import { useState, useEffect, useRef } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { api } from "../services/api"

export default function ResultsPage() {
  const [searchParams] = useSearchParams()
  const videoId = searchParams.get("video_id")
  const { isAuthenticated } = useAuth()

  const [video, setVideo] = useState(null)
  const [videosList, setVideosList] = useState([])
  const [selectedShot, setSelectedShot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reprocessing, setReprocessing] = useState(false)

  const videoRef = useRef(null)

  const fetchResults = async (id) => {
    try {
      const res = await api.getVideoResults(id)
      return {
        ...res.video,
        shots: res.shots,
        summary: res.summary,
        latest_job: res.latest_job,
      }
    } catch {
      const res = await api.getVideo(id)
      return res.video
    }
  }

  useEffect(() => {
    async function loadData() {
      if (!isAuthenticated) return
      setLoading(true)
      setError("")
      try {
        if (videoId) {
          const v = await fetchResults(videoId)
          setVideo(v)
          if (v.shots && v.shots.length > 0) {
            setSelectedShot(v.shots[0])
          }
        } else {
          // If no video_id in URL, fetch list and show the first completed one
          const listRes = await api.getVideos()
          setVideosList(listRes.videos || [])
          const firstCompleted = listRes.videos?.find((v) => v.status === "completed") || listRes.videos?.[0]
          if (firstCompleted) {
            const v = await fetchResults(firstCompleted.id)
            setVideo(v)
            if (v.shots && v.shots.length > 0) {
              setSelectedShot(v.shots[0])
            }
          }
        }
      } catch (err) {
        setError(err.message || "Failed to load video results")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [videoId, isAuthenticated])

  const seekToShot = (timestamp) => {
    if (videoRef.current && timestamp !== undefined && timestamp !== null) {
      videoRef.current.currentTime = Math.max(0, timestamp - 1.0)
      videoRef.current.play()
    }
  }

  const handleReprocess = async () => {
    if (!video) return
    setReprocessing(true)
    try {
      await api.processVideo(video.id)
      // Poll for completion
      const checkTimer = setInterval(async () => {
        try {
          const refreshed = await api.getVideo(video.id)
          if (refreshed.video.status === "completed") {
            clearInterval(checkTimer)
            const v = await fetchResults(video.id)
            setVideo(v)
            setReprocessing(false)
          }
        } catch {
          clearInterval(checkTimer)
          setReprocessing(false)
        }
      }, 2000)
    } catch (err) {
      alert("Failed to start re-processing: " + err.message)
      setReprocessing(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-[#FAFAF9]">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-cv-navy/10 text-center">
          <h2 className="text-2xl font-display font-bold text-cv-navy">Authentication Required</h2>
          <p className="mt-2 text-sm text-cv-navy/60">
            Please log in to review computer vision shot breakdowns.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block w-full bg-cv-orange text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition shadow-xs"
          >
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center py-20 bg-[#FAFAF9]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-cv-orange border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-cv-navy">Loading shooting metrics...</p>
        </div>
      </div>
    )
  }

  if (!video) {
    return (
      <div className="min-h-[calc(100vh-80px)] py-16 px-4 bg-[#FAFAF9] flex items-center justify-center">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-cv-navy/10 text-center space-y-4">
          <div className="w-12 h-12 mx-auto bg-gray-100 rounded-2xl flex items-center justify-center text-2xl">
            🏀
          </div>
          <h2 className="text-xl font-display font-bold text-cv-navy">No Analyzed Video Found</h2>
          <p className="text-sm text-cv-navy/60">
            Upload basketball footage to see frame-by-frame angle and jump height analytics.
          </p>
          <Link
            to="/upload"
            className="inline-block bg-cv-orange text-white px-6 py-3 rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-xs"
          >
            Upload Footage
          </Link>
        </div>
      </div>
    )
  }

  const shots = video.shots || []
  const summary = video.summary

  const avgAngle = summary?.shooting_angle?.mean ?? summary?.avg_shooting_angle
  const stdAngle = summary?.shooting_angle?.std
  const consistencyRating = summary?.shooting_angle?.consistency_rating

  const avgJump = summary?.jump_height_cm?.mean ?? summary?.avg_jump_height
  const maxJump = summary?.jump_height_cm?.max ?? summary?.max_jump_height
  const stdJump = summary?.jump_height_cm?.std

  return (
    <div className="min-h-[calc(100vh-80px)] py-10 px-4 sm:px-6 lg:px-8 bg-[#FAFAF9]">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-cv-navy/10 shadow-sm">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs uppercase font-bold tracking-widest text-cv-orange">
                Computer Vision Shot Analysis
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase border ${
                  video.status === "completed"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                ● {video.status}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-cv-navy mt-1">
              {video.title}
            </h1>
            <p className="text-xs text-cv-navy/60 mt-1">
              File: {video.original_filename} • Duration: {video.duration_seconds ? `${video.duration_seconds.toFixed(1)}s` : "—"} • FPS: {video.fps ? Math.round(video.fps) : 30}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReprocess}
              disabled={reprocessing}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-cv-navy/20 text-cv-navy hover:bg-gray-50 transition disabled:opacity-50"
            >
              {reprocessing ? "Reprocessing..." : "↻ Reprocess CV Pipeline"}
            </button>
            <Link
              to="/dashboard"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-cv-navy text-white hover:opacity-90 transition"
            >
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Aggregate Summary Cards with Consistency Badges */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
              <p className="text-xs font-semibold uppercase text-cv-navy/50">Total Attempts</p>
              <p className="text-2xl font-bold font-display text-cv-navy mt-1">{summary.total_shots}</p>
              <p className="text-xs text-cv-navy/60 mt-1">Shots identified in video</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
              <div className="flex justify-between items-start">
                <p className="text-xs font-semibold uppercase text-cv-navy/50">Avg Release Angle</p>
                {consistencyRating && consistencyRating !== "No Data" && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {consistencyRating}
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold font-display text-cv-orange mt-1">
                {avgAngle ? `${avgAngle}°` : "N/A"}
              </p>
              <p className="text-xs text-cv-navy/60 mt-1">
                {stdAngle !== undefined ? `Consistency: ±${stdAngle}°` : "Elbow release angle"}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
              <p className="text-xs font-semibold uppercase text-cv-navy/50">Avg Vertical Leap</p>
              <p className="text-2xl font-bold font-display text-cv-navy mt-1">
                {avgJump ? `${avgJump} cm` : "N/A"}
              </p>
              <p className="text-xs text-cv-navy/60 mt-1">
                {stdJump !== undefined ? `Variance: ±${stdJump} cm` : "Hip elevation from baseline"}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
              <p className="text-xs font-semibold uppercase text-cv-navy/50">Max Jump Height</p>
              <p className="text-2xl font-bold font-display text-cv-navy mt-1">
                {maxJump ? `${maxJump} cm` : "N/A"}
              </p>
              <p className="text-xs text-cv-navy/60 mt-1">Highest shot leap recorded</p>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs col-span-2 lg:col-span-1">
              <p className="text-xs font-semibold uppercase text-cv-navy/50">Shot Breakdown</p>
              <p className="text-2xl font-bold font-display text-cv-navy mt-1">
                {summary.two_pointers} <span className="text-xs font-medium text-cv-navy/60">2pt</span> / {summary.three_pointers} <span className="text-xs font-medium text-cv-navy/60">3pt</span>
              </p>
              <p className="text-xs text-cv-navy/60 mt-1">
                {summary.mean_confidence ? `${Math.round(summary.mean_confidence * 100)}% XGB Confidence` : "XGBoost Classification"}
              </p>
            </div>
          </div>
        )}

        {/* Video Player & Interactive Shot Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Video Player & Timeline */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-3xl p-5 border border-cv-navy/10 shadow-sm space-y-4">
              <h2 className="text-lg font-display font-bold text-cv-navy">Footage Playback</h2>
              <div className="rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  controls
                  src={api.getVideoFileUrl(video.id)}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Shot Jump Timeline */}
              {shots.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-cv-navy/70">
                    <span>Jump to Detected Shot Release:</span>
                    <span className="text-cv-orange">Click to seek video</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {shots.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setSelectedShot(s)
                          seekToShot(s.timestamp_release)
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          selectedShot?.id === s.id
                            ? "bg-cv-orange text-white shadow-2xs"
                            : "bg-gray-100 text-cv-navy hover:bg-gray-200"
                        }`}
                      >
                        Shot #{s.shot_index} ({s.timestamp_release}s)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Model Architecture Info */}
            <div className="bg-orange-50/60 rounded-3xl p-6 border border-orange-200/80 space-y-2 text-xs text-cv-navy/80">
              <h3 className="font-bold uppercase tracking-wider text-cv-orange">
                Scouting Pipeline Architecture
              </h3>
              <p>
                • <strong>MediaPipe Pose Landmark Model</strong> extracts 33 3D skeletal keypoints per frame.
              </p>
              <p>
                • <strong>Fine-Tuned YOLOv8</strong> (94.06% mAP@50) locates the ball and verifies upward trajectory.
              </p>
              <p>
                • <strong>Trained XGBoost Classifier</strong> predicts 2pt vs 3pt range from 15 kinematic features.
              </p>
            </div>
          </div>

          {/* Shot Cards List */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-lg font-display font-bold text-cv-navy">
              Detected Shots ({shots.length})
            </h2>

            {shots.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 border border-cv-navy/10 text-center space-y-2">
                <p className="text-sm font-semibold text-cv-navy">No shots detected yet</p>
                <p className="text-xs text-cv-navy/50">
                  {video.status === "processing"
                    ? "Computer vision analysis is running in the background. Refresh in a moment!"
                    : "Make sure the camera is positioned to clearly capture the shooter's upper body and release."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {shots.map((s) => {
                  const m = s.metric || {}
                  const isSelected = selectedShot?.id === s.id
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setSelectedShot(s)
                        seekToShot(s.timestamp_release)
                      }}
                      className={`p-5 rounded-2xl border transition cursor-pointer ${
                        isSelected
                          ? "bg-white border-cv-orange shadow-md ring-2 ring-cv-orange/20"
                          : "bg-white border-cv-navy/10 hover:border-cv-navy/30 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-display font-bold text-sm text-cv-navy">
                            Shot #{s.shot_index}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                              s.shot_type === "three_point"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {s.shot_type === "three_point" ? "3-Pointer" : "2-Pointer"}
                          </span>
                        </div>
                        <span className="text-xs text-cv-navy/50">
                          {s.timestamp_release ? `Release @ ${s.timestamp_release}s` : ""}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                        <div>
                          <p className="text-cv-navy/50 font-medium">Release Angle</p>
                          <p className="text-sm font-bold text-cv-orange mt-0.5">
                            {m.shooting_angle_deg !== undefined ? `${m.shooting_angle_deg}°` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-cv-navy/50 font-medium">Jump Height</p>
                          <p className="text-sm font-bold text-cv-navy mt-0.5">
                            {m.jump_height_cm !== undefined ? `${m.jump_height_cm} cm` : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-cv-navy/50 font-medium">Confidence</p>
                          <p className="text-sm font-bold text-cv-navy mt-0.5">
                            {s.classification_confidence
                              ? `${Math.round(s.classification_confidence * 100)}%`
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
