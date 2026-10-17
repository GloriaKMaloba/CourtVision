import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { api } from "../services/api"

// ---------------------------------------------------------
// 1. ATHLETE DASHBOARD
// ---------------------------------------------------------
function AthleteDashboard({ user }) {
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchVideos = async () => {
    try {
      setLoading(true)
      const data = await api.getVideos()
      setVideos(data.videos || [])
    } catch (err) {
      setError(err.message || "Failed to load uploaded videos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVideos()
  }, [])

  const handleDelete = async (videoId) => {
    if (!window.confirm("Are you sure you want to delete this video?")) return
    try {
      await api.deleteVideo(videoId)
      setVideos(videos.filter((v) => v.id !== videoId))
    } catch (err) {
      alert("Failed to delete video: " + err.message)
    }
  }

  const profile = user?.profile

  // Aggregate stats across completed videos strictly from actual data (NO fallback defaults!)
  const completedVideos = videos.filter((v) => v.status === "completed" && v.summary)
  const totalShots = completedVideos.reduce((acc, v) => acc + (v.summary?.total_shots || 0), 0)
  const allAngles = completedVideos
    .map((v) => v.summary?.avg_shooting_angle)
    .filter((a) => a !== null && a !== undefined)
  const overallAvgAngle = allAngles.length > 0 ? (allAngles.reduce((a, b) => a + b, 0) / allAngles.length).toFixed(1) : null
  const allJumps = completedVideos
    .map((v) => v.summary?.max_jump_height)
    .filter((j) => j !== null && j !== undefined)
  const overallMaxJump = allJumps.length > 0 ? Math.max(...allJumps).toFixed(1) : null

  return (
    <div className="space-y-8">
      {/* Athlete Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-cv-navy/10 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-cv-navy">
              {user.full_name}
            </h1>
            <span className="text-xs uppercase font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 text-cv-orange border border-orange-200">
              Athlete
            </span>
          </div>
          <p className="text-sm text-cv-navy/60">
            {user.email} • M-PESA x Jr. NBA Grassroots Talent Portal
          </p>

          {profile && (
            <div className="flex flex-wrap gap-2 pt-2">
              {profile.county && (
                <span className="text-xs font-medium bg-gray-100 text-cv-navy px-3 py-1 rounded-xl">
                  📍 {profile.county}
                </span>
              )}
              {profile.position && (
                <span className="text-xs font-medium bg-gray-100 text-cv-navy px-3 py-1 rounded-xl">
                  🏀 {profile.position}
                </span>
              )}
              {profile.height_cm && (
                <span className="text-xs font-medium bg-gray-100 text-cv-navy px-3 py-1 rounded-xl">
                  📏 {profile.height_cm} cm
                </span>
              )}
              {profile.dominant_hand && (
                <span className="text-xs font-medium bg-gray-100 text-cv-navy px-3 py-1 rounded-xl">
                  ✋ {profile.dominant_hand}-handed
                </span>
              )}
              {profile.school_or_club && (
                <span className="text-xs font-medium bg-gray-100 text-cv-navy px-3 py-1 rounded-xl">
                  🏫 {profile.school_or_club}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/upload"
            className="bg-cv-orange text-white px-6 py-3 rounded-xl font-semibold text-sm hover:opacity-90 shadow-sm transition flex items-center gap-2"
          >
            <span>+</span> Upload New Footage
          </Link>
        </div>
      </div>

      {/* Overview Stats (Clean 0 / Empty states for new athletes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Total Uploads</p>
          <p className="text-2xl font-bold font-display text-cv-navy mt-1">{videos.length}</p>
          <p className="text-xs text-cv-navy/60 mt-1">Recorded video sessions</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Shots Analyzed</p>
          <p className="text-2xl font-bold font-display text-cv-orange mt-1">
            {totalShots > 0 ? `${totalShots} Shots` : "0 Shots"}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">Identified via MediaPipe & YOLO</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Avg Release Angle</p>
          <p className="text-2xl font-bold font-display text-cv-navy mt-1">
            {overallAvgAngle ? `${overallAvgAngle}°` : "—"}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">Elbow release angle</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Max Vertical Leap</p>
          <p className="text-2xl font-bold font-display text-cv-navy mt-1">
            {overallMaxJump ? `${overallMaxJump} cm` : "—"}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">Peak jump elevation</p>
        </div>
      </div>

      {/* Video Table & Session History */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-cv-navy/10 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-display font-bold text-cv-navy">
            My Recorded Sessions & Biomechanical History
          </h2>
          <button
            onClick={fetchVideos}
            className="text-xs font-semibold text-cv-orange hover:underline cursor-pointer"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-cv-navy/60">
            Loading your shooting sessions...
          </div>
        ) : videos.length === 0 ? (
          <div className="py-12 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-orange-50 text-cv-orange rounded-3xl flex items-center justify-center text-3xl shadow-2xs">
              🏀
            </div>
            <div>
              <p className="text-base font-bold text-cv-navy">Welcome to CourtVision, {user.full_name}!</p>
              <p className="text-sm text-cv-navy/60 max-w-md mx-auto mt-1">
                You haven&apos;t uploaded any shooting videos yet. Upload a short smartphone clip (1 to 10 shots) to have our AI analyze your shooting angle and jump height for Jr. NBA scouts.
              </p>
            </div>
            <div>
              <Link
                to="/upload"
                className="inline-block bg-cv-orange text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition shadow-xs"
              >
                Upload Your First Video
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-cv-navy/60">
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4">CV Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {videos.map((vid) => {
                  const isCompleted = vid.status === "completed"
                  const shotCount = vid.shots?.length || (vid.summary?.total_shots || 0)

                  return (
                    <tr key={vid.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3.5 px-4 font-semibold text-cv-navy">
                        <div>{vid.title}</div>
                        {vid.summary && (
                          <div className="text-[11px] text-cv-navy/50 font-normal">
                            {vid.summary.total_shots} shots ({vid.summary.two_pointers} 2pt / {vid.summary.three_pointers} 3pt) • Avg Angle: {vid.summary.avg_shooting_angle}° • Jump: {vid.summary.avg_jump_height}cm
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-xs text-cv-navy/70">
                        {vid.original_filename}
                      </td>
                      <td className="py-3.5 px-4 text-cv-navy/70">{vid.file_size_mb} MB</td>
                      <td className="py-3.5 px-4 text-xs text-cv-navy/60">
                        {new Date(vid.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isCompleted
                              ? "bg-emerald-100 text-emerald-800"
                              : vid.status === "processing"
                              ? "bg-blue-100 text-blue-800 animate-pulse"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {isCompleted ? `✓ COMPLETED (${shotCount} shots)` : vid.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {isCompleted ? (
                          <Link
                            to={`/results?video_id=${vid.id}`}
                            className="inline-block px-3 py-1 bg-cv-orange text-white rounded-lg text-xs font-semibold hover:opacity-90 transition"
                          >
                            View Analytics 📊
                          </Link>
                        ) : (
                          <Link
                            to={`/results?video_id=${vid.id}`}
                            className="text-xs text-cv-orange font-semibold hover:underline"
                          >
                            Check Status
                          </Link>
                        )}
                        <button
                          onClick={() => handleDelete(vid.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-800 transition ml-2 cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------
// 2. SCOUT TALENT DISCOVERY PORTAL
// ---------------------------------------------------------
function ScoutDashboard({ user }) {
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [countyFilter, setCountyFilter] = useState("")
  const [positionFilter, setPositionFilter] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchAthletes = async () => {
    try {
      setLoading(true)
      const data = await api.getScoutAthletes({
        county: countyFilter,
        position: positionFilter,
        search: searchTerm,
      })
      setAthletes(data.athletes || [])
    } catch (err) {
      setError(err.message || "Failed to load athlete directory")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAthletes()
  }, [countyFilter, positionFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchAthletes()
  }

  const handleViewAthleteDetail = async (athleteId) => {
    try {
      setLoadingDetail(true)
      const res = await api.getScoutAthlete(athleteId)
      setSelectedAthlete(res.athlete)
    } catch (err) {
      alert("Failed to load athlete details: " + err.message)
    } finally {
      setLoadingDetail(false)
    }
  }

  const verifiedAthletes = athletes.filter((a) => a.performance?.total_shots > 0)
  const jumps = athletes
    .map((a) => a.performance?.max_jump_height)
    .filter((j) => j !== null && j !== undefined)
  const topJump = jumps.length > 0 ? Math.max(...jumps).toFixed(1) : null

  const kenyaCounties = [
    "Nairobi",
    "Kisumu",
    "Mombasa",
    "Uasin Gishu",
    "Nakuru",
    "Kiambu",
    "Machakos",
    "Nyeri",
    "Kakamega",
  ]

  const basketballPositions = [
    "Point Guard",
    "Shooting Guard",
    "Small Forward",
    "Power Forward",
    "Center",
  ]

  return (
    <div className="space-y-8">
      {/* Scout Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-cv-navy/10 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-cv-navy">
              {user.full_name}
            </h1>
            <span className="text-xs uppercase font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              Scout Portal
            </span>
          </div>
          <p className="text-sm text-cv-navy/60">
            {user.email} • {user.profile?.organization || "Jr. NBA Kenya"} • {user.profile?.title || "Regional Talent Scout"}
          </p>
          <div className="pt-2 text-xs text-cv-navy/70 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Live talent pipeline monitoring Kenyan grassroots basketball prospects
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchAthletes}
            className="border border-cv-navy/20 px-4 py-2.5 rounded-xl font-semibold text-xs text-cv-navy hover:bg-gray-50 transition"
          >
            ↻ Refresh Directory
          </button>
        </div>
      </div>

      {/* Scout KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Prospects in Directory</p>
          <p className="text-2xl font-bold font-display text-cv-navy mt-1">{athletes.length}</p>
          <p className="text-xs text-cv-navy/60 mt-1">Registered Kenyan athletes</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Verified Shooters</p>
          <p className="text-2xl font-bold font-display text-emerald-600 mt-1">
            {verifiedAthletes.length}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">Footage analyzed & classified</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Highest Vertical Leap</p>
          <p className="text-2xl font-bold font-display text-cv-orange mt-1">
            {topJump ? `${topJump} cm` : "—"}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">Peak prospect elevation</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Counties Covered</p>
          <p className="text-2xl font-bold font-display text-cv-navy mt-1">
            {new Set(athletes.map((a) => a.profile?.county).filter(Boolean)).size || "All"}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">Regional coverage</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-6 border border-cv-navy/10 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-xs font-semibold uppercase text-cv-navy/60 mb-1">
              Search Athlete / School
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by name, school, club..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-cv-navy/20 rounded-xl text-sm focus:outline-cv-orange"
              />
              <button
                type="submit"
                className="bg-cv-navy text-white px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition"
              >
                Search
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-cv-navy/60 mb-1">
              Filter by County
            </label>
            <select
              value={countyFilter}
              onChange={(e) => setCountyFilter(e.target.value)}
              className="w-full px-3 py-2 border border-cv-navy/20 rounded-xl text-sm focus:outline-cv-orange bg-white"
            >
              <option value="">All Counties (Kenya)</option>
              {kenyaCounties.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-cv-navy/60 mb-1">
              Filter by Position
            </label>
            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-cv-navy/20 rounded-xl text-sm focus:outline-cv-orange bg-white"
            >
              <option value="">All Positions</option>
              {basketballPositions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </form>
      </div>

      {/* Athlete Cards Directory */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-display font-bold text-cv-navy">
            Prospect Roster ({athletes.length} Athletes)
          </h2>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center text-sm text-cv-navy/60 border border-cv-navy/10">
            Searching grassroots athlete database...
          </div>
        ) : athletes.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center text-sm text-cv-navy/60 border border-cv-navy/10 space-y-2">
            <p className="font-semibold text-cv-navy">No athletes matched your filters</p>
            <p className="text-xs text-cv-navy/50">Try clearing the county or position filter to expand your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {athletes.map((ath) => {
              const hasShots = ath.performance?.total_shots > 0
              return (
                <div
                  key={ath.id}
                  className="bg-white rounded-3xl p-6 border border-cv-navy/10 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-bold font-display text-cv-navy leading-tight">
                          {ath.full_name}
                        </h3>
                        <p className="text-xs text-cv-navy/50">{ath.email}</p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full ${
                          hasShots
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-gray-100 text-gray-600 border border-gray-200"
                        }`}
                      >
                        {hasShots ? "Verified" : "New Prospect"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ath.profile?.county && (
                        <span className="text-[11px] font-medium bg-orange-50 text-cv-orange px-2.5 py-0.5 rounded-lg border border-orange-100">
                          📍 {ath.profile.county}
                        </span>
                      )}
                      {ath.profile?.position && (
                        <span className="text-[11px] font-medium bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-lg border border-blue-100">
                          🏀 {ath.profile.position}
                        </span>
                      )}
                      {ath.profile?.height_cm && (
                        <span className="text-[11px] font-medium bg-gray-100 text-cv-navy px-2.5 py-0.5 rounded-lg">
                          📏 {ath.profile.height_cm} cm
                        </span>
                      )}
                    </div>

                    {ath.profile?.school_or_club && (
                      <p className="text-xs text-cv-navy/70">
                        🏫 <span className="font-medium">{ath.profile.school_or_club}</span>
                      </p>
                    )}

                    {/* Biometrics Card */}
                    <div className="bg-gray-50/80 rounded-2xl p-3 border border-gray-100 grid grid-cols-3 gap-2 text-center mt-2">
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-cv-navy/50">Shots</p>
                        <p className="text-sm font-bold text-cv-navy mt-0.5">
                          {ath.performance?.total_shots || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-cv-navy/50">Release</p>
                        <p className="text-sm font-bold text-cv-orange mt-0.5">
                          {ath.performance?.avg_shooting_angle ? `${ath.performance.avg_shooting_angle}°` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-cv-navy/50">Max Jump</p>
                        <p className="text-sm font-bold text-cv-navy mt-0.5">
                          {ath.performance?.max_jump_height ? `${ath.performance.max_jump_height}cm` : "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-5 border-t border-gray-100 mt-4 flex items-center justify-between">
                    <span className="text-[11px] text-cv-navy/50">
                      {ath.performance?.total_videos || 0} videos uploaded
                    </span>
                    <button
                      onClick={() => handleViewAthleteDetail(ath.id)}
                      className="px-4 py-2 bg-cv-navy text-white text-xs font-semibold rounded-xl hover:opacity-90 transition cursor-pointer"
                    >
                      View Profile & Videos →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Athlete Detail Modal */}
      {selectedAthlete && (
        <div className="fixed inset-0 z-50 bg-cv-navy/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 shadow-xl border border-cv-navy/10 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs uppercase font-semibold text-cv-orange tracking-wider">
                  Prospect Profile
                </span>
                <h3 className="text-2xl font-display font-bold text-cv-navy">
                  {selectedAthlete.full_name}
                </h3>
                <p className="text-xs text-cv-navy/60">{selectedAthlete.email}</p>
              </div>
              <button
                onClick={() => setSelectedAthlete(null)}
                className="text-gray-400 hover:text-cv-navy text-2xl font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Profile info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl text-xs">
              <div>
                <p className="text-cv-navy/50 font-semibold uppercase text-[10px]">County</p>
                <p className="font-bold text-cv-navy">{selectedAthlete.profile?.county || "Kenya"}</p>
              </div>
              <div>
                <p className="text-cv-navy/50 font-semibold uppercase text-[10px]">Position</p>
                <p className="font-bold text-cv-navy">{selectedAthlete.profile?.position || "—"}</p>
              </div>
              <div>
                <p className="text-cv-navy/50 font-semibold uppercase text-[10px]">Height</p>
                <p className="font-bold text-cv-navy">
                  {selectedAthlete.profile?.height_cm ? `${selectedAthlete.profile.height_cm} cm` : "—"}
                </p>
              </div>
              <div>
                <p className="text-cv-navy/50 font-semibold uppercase text-[10px]">School / Club</p>
                <p className="font-bold text-cv-navy">{selectedAthlete.profile?.school_or_club || "—"}</p>
              </div>
            </div>

            {/* Recorded Videos List */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold font-display uppercase tracking-wider text-cv-navy">
                Recorded Video Sessions ({selectedAthlete.videos?.length || 0})
              </h4>
              {selectedAthlete.videos && selectedAthlete.videos.length > 0 ? (
                <div className="space-y-2">
                  {selectedAthlete.videos.map((vid) => (
                    <div
                      key={vid.id}
                      className="border border-gray-200 rounded-2xl p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:bg-gray-50/50 transition"
                    >
                      <div>
                        <p className="font-semibold text-sm text-cv-navy">{vid.title}</p>
                        <p className="text-xs text-cv-navy/50">
                          {vid.original_filename} • {vid.file_size_mb} MB • {new Date(vid.created_at).toLocaleDateString()}
                        </p>
                        {vid.summary && (
                          <p className="text-xs text-cv-orange mt-1 font-medium">
                            {vid.summary.total_shots} shots ({vid.summary.two_pointers} 2pt / {vid.summary.three_pointers} 3pt) • Avg Angle: {vid.summary.avg_shooting_angle}° • Jump: {vid.summary.avg_jump_height}cm
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {vid.status === "completed" ? (
                          <Link
                            to={`/results?video_id=${vid.id}`}
                            className="bg-cv-orange text-white text-xs px-4 py-2 rounded-xl font-semibold hover:opacity-90 transition"
                          >
                            Analyze Shots 📊
                          </Link>
                        ) : (
                          <span className="text-xs px-3 py-1 bg-amber-100 text-amber-800 rounded-lg font-medium">
                            {vid.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-cv-navy/50 italic py-4 text-center">
                  This athlete has not uploaded any shooting drill videos yet.
                </p>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedAthlete(null)}
                className="px-5 py-2.5 bg-gray-200 text-cv-navy text-xs font-semibold rounded-xl hover:bg-gray-300 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------
// 3. ADMIN SYSTEM CONSOLE
// ---------------------------------------------------------
function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [search, setSearch] = useState("")

  const fetchData = async () => {
    try {
      setLoading(true)
      const [statsRes, usersRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers({ role: roleFilter, search }),
      ])
      setStats(statsRes)
      setUsers(usersRes.users || [])
    } catch (err) {
      setError(err.message || "Failed to load admin console data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [roleFilter])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    fetchData()
  }

  const handleDeleteUser = async (targetUser) => {
    if (targetUser.id === user.id) {
      alert("You cannot delete your own admin account.")
      return
    }

    if (!window.confirm(`Are you sure you want to permanently delete user '${targetUser.full_name}' (${targetUser.email}) and all their associated footage/metrics?`)) {
      return
    }

    try {
      await api.deleteAdminUser(targetUser.id)
      setUsers(users.filter((u) => u.id !== targetUser.id))
      // Refresh stats
      const statsRes = await api.getAdminStats()
      setStats(statsRes)
    } catch (err) {
      alert("Failed to delete user: " + err.message)
    }
  }

  return (
    <div className="space-y-8">
      {/* Admin Header Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-cv-navy/10 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-cv-navy">
              {user.full_name}
            </h1>
            <span className="text-xs uppercase font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Admin Console
            </span>
          </div>
          <p className="text-sm text-cv-navy/60">
            {user.email} • CourtVision™ Platform & Pipeline Management
          </p>
          <div className="pt-2 text-xs text-cv-navy/70 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            System Health: Operational (MediaPipe Pose + YOLOv8 + XGBoost Biomechanical Engine)
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="border border-cv-navy/20 px-4 py-2.5 rounded-xl font-semibold text-xs text-cv-navy hover:bg-gray-50 transition"
          >
            ↻ Refresh System Stats
          </button>
        </div>
      </div>

      {/* System KPI Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-cv-navy/50">Total Users</p>
            <p className="text-2xl font-bold font-display text-cv-navy mt-1">{stats.users.total}</p>
            <p className="text-xs text-cv-navy/60 mt-1">
              {stats.users.athletes} athletes • {stats.users.scouts} scouts • {stats.users.admins} admins
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-cv-navy/50">Video Uploads</p>
            <p className="text-2xl font-bold font-display text-cv-navy mt-1">{stats.videos.total}</p>
            <p className="text-xs text-emerald-600 mt-1">
              {stats.videos.completed} completed ({stats.videos.pending} queued)
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-cv-navy/50">Shots Classified</p>
            <p className="text-2xl font-bold font-display text-cv-orange mt-1">{stats.shots.total}</p>
            <p className="text-xs text-cv-navy/60 mt-1">
              Avg angle: {stats.shots.avg_shooting_angle ? `${stats.shots.avg_shooting_angle}°` : "—"}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-cv-navy/50">Peak Recorded Jump</p>
            <p className="text-2xl font-bold font-display text-purple-700 mt-1">
              {stats.shots.max_jump_height ? `${stats.shots.max_jump_height} cm` : "—"}
            </p>
            <p className="text-xs text-cv-navy/60 mt-1">Across all athlete sessions</p>
          </div>
        </div>
      )}

      {/* User Management Section */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-cv-navy/10 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-display font-bold text-cv-navy">
              User & Access Management ({users.length})
            </h2>
            <p className="text-xs text-cv-navy/60 mt-0.5">
              View and manage registered athletes, scouts, and system administrator accounts.
            </p>
          </div>

          <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-cv-navy/20 rounded-xl text-xs focus:outline-cv-orange"
            />
            <button
              type="submit"
              className="bg-cv-navy text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90"
            >
              Search
            </button>
          </form>
        </div>

        {/* Role Filter Tabs */}
        <div className="flex gap-2 border-b border-gray-100 pb-3">
          {[
            { label: "All Roles", value: "" },
            { label: "Athletes", value: "athlete" },
            { label: "Scouts", value: "scout" },
            { label: "Admins", value: "admin" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setRoleFilter(tab.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                roleFilter === tab.value
                  ? "bg-cv-navy text-white"
                  : "bg-gray-100 text-cv-navy/70 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-cv-navy/60">
            Loading user directory...
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-cv-navy/60">
            No users match the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-cv-navy/60">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Profile Details</th>
                  <th className="py-3 px-4">Uploads</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const isCurrent = u.id === user.id
                  return (
                    <tr key={u.id} className="hover:bg-gray-50/60 transition">
                      <td className="py-3.5 px-4 font-semibold text-cv-navy">
                        <div>
                          {u.full_name} {isCurrent && <span className="text-[10px] text-cv-orange">(You)</span>}
                        </div>
                        <div className="text-xs text-cv-navy/50 font-normal">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full ${
                            u.role === "admin"
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : u.role === "scout"
                              ? "bg-blue-100 text-blue-800 border border-blue-200"
                              : "bg-orange-100 text-cv-orange border border-orange-200"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-cv-navy/70">
                        {u.role === "athlete" && u.profile && (
                          <span>
                            {u.profile.county || "Kenya"} • {u.profile.position || "Athlete"} • {u.profile.school_or_club || "School"}
                          </span>
                        )}
                        {u.role === "scout" && u.profile && (
                          <span>
                            {u.profile.organization || "Jr. NBA Kenya"} ({u.profile.title || "Scout"})
                          </span>
                        )}
                        {u.role === "admin" && (
                          <span className="text-gray-400">System Administrator</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-semibold text-cv-navy">
                        {u.video_count || 0}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-cv-navy/60">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isCurrent && (
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="text-xs font-medium text-red-600 hover:text-red-800 transition cursor-pointer"
                          >
                            Delete User
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------
// MAIN EXPORT: Role-Based Dashboard Switcher
// ---------------------------------------------------------
export default function DashboardPage() {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-[#FAFAF9]">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-cv-navy/10 text-center">
          <h2 className="text-2xl font-display font-bold text-cv-navy">Dashboard Access</h2>
          <p className="mt-2 text-sm text-cv-navy/60">
            Please log in to view your profile, footage, and scouting directory.
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

  return (
    <div className="min-h-[calc(100vh-80px)] py-10 px-4 sm:px-6 lg:px-8 bg-[#FAFAF9]">
      <div className="max-w-6xl mx-auto">
        {user.role === "scout" ? (
          <ScoutDashboard user={user} />
        ) : user.role === "admin" ? (
          <AdminDashboard user={user} />
        ) : (
          <AthleteDashboard user={user} />
        )}
      </div>
    </div>
  )
}