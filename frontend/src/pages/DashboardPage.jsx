import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { api } from "../services/api"
import { useAuth } from "../context/AuthContext"

// Helper for dynamic consistency badge colors
function getConsistencyBadgeClass(rating) {
  if (!rating) return ""
  if (rating.includes("Elite")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
  }
  if (rating.includes("High")) {
    return "bg-blue-50 text-blue-700 border-blue-200"
  }
  if (rating.includes("Moderate")) {
    return "bg-amber-50 text-amber-700 border-amber-200"
  }
  return "bg-orange-50 text-orange-700 border-orange-200"
}

// =========================================================
// 1. ATHLETE PERFORMANCE DASHBOARD
// =========================================================
function AthleteDashboard({ user }) {
  const [videos, setVideos] = useState([])
  const [metricsData, setMetricsData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [chartMetric, setChartMetric] = useState("jump") // 'jump' or 'angle'

  const fetchData = async () => {
    try {
      setLoading(true)
      const [videosRes, metricsRes] = await Promise.all([
        api.getVideos(),
        api.getAthleteMetrics("me").catch(() => null),
      ])
      setVideos(videosRes.videos || [])
      setMetricsData(metricsRes?.metrics || null)
    } catch (err) {
      setError(err.message || "Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (videoId) => {
    if (!window.confirm("Are you sure you want to delete this video?")) return
    try {
      await api.deleteVideo(videoId)
      setVideos(videos.filter((v) => v.id !== videoId))
      // Refresh metrics after deletion
      api.getAthleteMetrics("me").then((res) => setMetricsData(res?.metrics || null)).catch(() => {})
    } catch (err) {
      alert("Failed to delete video: " + err.message)
    }
  }

  const profile = user?.profile
  const completedVideos = videos.filter((v) => v.status === "completed")

  // Fallback calculations if metrics endpoint is empty
  const totalShots = metricsData?.total_shots ?? completedVideos.reduce((acc, v) => acc + (v.summary?.total_shots || 0), 0)
  const avgAngle = metricsData?.shooting_angle?.mean ?? null
  const stdAngle = metricsData?.shooting_angle?.std ?? null
  const consistencyRating = metricsData?.shooting_angle?.consistency_rating ?? null

  const avgJump = metricsData?.jump_height_cm?.mean ?? null
  const maxJump = metricsData?.jump_height_cm?.max ?? null
  const stdJump = metricsData?.jump_height_cm?.std ?? null

  const twoPointers = metricsData?.two_pointers ?? 0
  const threePointers = metricsData?.three_pointers ?? 0
  const twoPointPct = metricsData?.two_point_pct ?? 0
  const threePointPct = metricsData?.three_point_pct ?? 0

  // Historical timeline data for progression chart
  const timeline = metricsData?.timeline || []

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

      {/* Core Biomechanical Performance Cards (With Consistency Badges) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sessions & Shots */}
        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Total Shots Analyzed</p>
          <p className="text-2xl font-bold font-display text-cv-navy mt-1">
            {totalShots > 0 ? `${totalShots} Shots` : "0 Shots"}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">
            Across {completedVideos.length} completed session{completedVideos.length === 1 ? "" : "s"}
          </p>
        </div>

        {/* Shooting Angle with Consistency Rating */}
        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold uppercase text-cv-navy/50">Avg Release Angle</p>
            {consistencyRating && consistencyRating !== "No Data" && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getConsistencyBadgeClass(consistencyRating)}`}>
                {consistencyRating}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold font-display text-cv-orange mt-1">
            {avgAngle !== null ? `${avgAngle}°` : "—"}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">
            {stdAngle !== null ? `Consistency: ±${stdAngle}° standard dev` : "Elbow release angle"}
          </p>
        </div>

        {/* Jump Height with Max & Average */}
        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Max Jump Height</p>
          <p className="text-2xl font-bold font-display text-cv-navy mt-1">
            {maxJump !== null ? `${maxJump} cm` : "—"}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">
            {avgJump !== null ? `Average Jump: ${avgJump} cm (±${stdJump || 0} cm)` : "Elevation off ground"}
          </p>
        </div>

        {/* Shot Selection Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Shot Selection</p>
          <p className="text-2xl font-bold font-display text-cv-navy mt-1">
            {twoPointers} <span className="text-xs font-medium text-cv-navy/60">2pt</span> / {threePointers} <span className="text-xs font-medium text-cv-navy/60">3pt</span>
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">
            {totalShots > 0 ? `${twoPointPct}% 2-point • ${threePointPct}% 3-point` : "XGBoost Classification"}
          </p>
        </div>
      </div>

      {/* Historical Trend Progression Chart */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-cv-navy/10 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <span className="text-xs uppercase font-bold tracking-widest text-cv-orange">
              Biomechanical Progression
            </span>
            <h2 className="text-xl font-display font-bold text-cv-navy mt-0.5">
              Historical Performance Trajectory
            </h2>
          </div>

          {timeline.length > 1 && (
            <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setChartMetric("jump")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  chartMetric === "jump"
                    ? "bg-white text-cv-navy shadow-xs font-bold"
                    : "text-cv-navy/60 hover:text-cv-navy"
                }`}
              >
                🚀 Jump Height (cm)
              </button>
              <button
                onClick={() => setChartMetric("angle")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  chartMetric === "angle"
                    ? "bg-white text-cv-navy shadow-xs font-bold"
                    : "text-cv-navy/60 hover:text-cv-navy"
                }`}
              >
                📐 Release Angle (°)
              </button>
            </div>
          )}
        </div>

        {timeline.length <= 1 ? (
          <div className="py-12 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200 text-center space-y-2">
            <p className="text-sm font-semibold text-cv-navy">
              {timeline.length === 1
                ? "1 session recorded. Upload more drills to visualize your improvement trajectory over time!"
                : "No completed shooting drills yet. Upload your first clip to start tracking your development curve."}
            </p>
            <p className="text-xs text-cv-navy/50 max-w-sm mx-auto">
              Our computer vision pipeline automatically tracks session-by-session consistency and vertical explosiveness.
            </p>
          </div>
        ) : (
          <div className="pt-4">
            <TrendChart timeline={timeline} metricKey={chartMetric} />
          </div>
        )}
      </div>

      {/* Video Table & Session History */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-cv-navy/10 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-display font-bold text-cv-navy">
            My Recorded Sessions & Biomechanical History
          </h2>
          <button
            onClick={fetchData}
            className="text-xs font-semibold text-cv-orange hover:underline cursor-pointer"
          >
            ↻ Refresh
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
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Uploaded</th>
                  <th className="py-3 px-4">CV Status</th>
                  <th className="py-3 px-4">Performance Metrics</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {videos.map((vid) => {
                  const shotCount = vid.shots?.length || (vid.summary?.total_shots || 0)
                  return (
                    <tr key={vid.id} className="hover:bg-gray-50/80 transition">
                      <td className="py-3 px-4 font-semibold text-cv-navy">
                        <Link to={`/results?video_id=${vid.id}`} className="hover:text-cv-orange">
                          {vid.title}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-xs text-cv-navy/70">
                        {vid.duration_seconds ? `${vid.duration_seconds.toFixed(1)}s` : "—"}
                      </td>
                      <td className="py-3 px-4 text-xs text-cv-navy/70">
                        {new Date(vid.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase border ${
                            vid.status === "completed"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : vid.status === "processing"
                              ? "bg-amber-50 text-amber-800 border-amber-200 animate-pulse"
                              : vid.status === "failed"
                              ? "bg-red-50 text-red-800 border-red-200"
                              : "bg-gray-100 text-gray-700 border-gray-200"
                          }`}
                        >
                          ● {vid.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-cv-navy/80">
                        {vid.summary ? (
                          <span>
                            <strong>{shotCount} shots</strong> • Angle: {vid.summary.avg_shooting_angle || "—"}° • Jump: {vid.summary.max_jump_height || "—"} cm
                          </span>
                        ) : (
                          <span className="text-cv-navy/40">Processing...</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {vid.status === "completed" && (
                          <Link
                            to={`/results?video_id=${vid.id}`}
                            className="text-xs font-semibold text-cv-orange hover:underline inline-block"
                          >
                            View Analytics
                          </Link>
                        )}
                        <button
                          onClick={() => handleDelete(vid.id)}
                          className="text-xs font-semibold text-red-600 hover:underline inline-block cursor-pointer"
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

// SVG Historical Progression Line Chart
function TrendChart({ timeline, metricKey }) {
  if (!timeline || timeline.length === 0) return null

  const isJump = metricKey === "jump"
  const values = timeline.map((t) => (isJump ? t.avg_jump_height || 0 : t.avg_shooting_angle || 0))
  const dates = timeline.map((t) => t.created_at ? new Date(t.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Session")

  const minVal = Math.max(0, Math.floor(Math.min(...values) * 0.9))
  const maxVal = Math.ceil(Math.max(...values) * 1.1) || (isJump ? 60 : 150)
  const range = maxVal - minVal || 1

  const width = 600
  const height = 180
  const padX = 40
  const padY = 25

  const points = timeline.map((_, i) => {
    const x = padX + (i / (timeline.length - 1 || 1)) * (width - 2 * padX)
    const y = height - padY - ((values[i] - minVal) / range) * (height - 2 * padY)
    return { x, y, val: values[i], date: dates[i], title: timeline[i].title }
  })

  const polylineStr = points.map((p) => `${p.x},${p.y}`).join(" ")

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 select-none">
        {/* Y Grid lines */}
        {[0, 0.5, 1].map((ratio, idx) => {
          const y = height - padY - ratio * (height - 2 * padY)
          const valLabel = Math.round(minVal + ratio * range)
          return (
            <g key={idx}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="#E5E7EB" strokeDasharray="3 3" />
              <text x={padX - 8} y={y + 4} fontSize="9" fill="#9CA3AF" textAnchor="end">
                {valLabel}{isJump ? "cm" : "°"}
              </text>
            </g>
          )
        })}

        {/* Trend line */}
        <polyline
          fill="none"
          stroke={isJump ? "#E05A1B" : "#1B2A4A"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylineStr}
        />

        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#FFFFFF" stroke={isJump ? "#E05A1B" : "#1B2A4A"} strokeWidth="2.5" />
            <text x={p.x} y={p.y - 10} fontSize="10" fontWeight="bold" fill={isJump ? "#E05A1B" : "#1B2A4A"} textAnchor="middle">
              {p.val}{isJump ? "cm" : "°"}
            </text>
            <text x={p.x} y={height - 6} fontSize="9" fill="#6B7280" textAnchor="middle">
              {p.date}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}

// =========================================================
// 2. SCOUT TALENT DISCOVERY PORTAL
// =========================================================
function ScoutDashboard({ user }) {
  const [athletes, setAthletes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [countyFilter, setCountyFilter] = useState("")
  const [positionFilter, setPositionFilter] = useState("")
  const [minJumpFilter, setMinJumpFilter] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [page, setPage] = useState(1)
  const [paginationInfo, setPaginationInfo] = useState({ total: 0, total_pages: 1 })
  const [selectedAthlete, setSelectedAthlete] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const fetchAthletes = async () => {
    try {
      setLoading(true)
      const data = await api.getScoutAthletes({
        county: countyFilter,
        position: positionFilter,
        search: searchTerm,
        min_jump: minJumpFilter ? parseFloat(minJumpFilter) : undefined,
        page,
        per_page: 9,
      })
      setAthletes(data.athletes || [])
      setPaginationInfo({
        total: data.total || data.count || 0,
        total_pages: data.total_pages || 1,
      })
    } catch (err) {
      setError(err.message || "Failed to load athlete directory")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAthletes()
  }, [countyFilter, positionFilter, minJumpFilter, page])

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setPage(1)
    fetchAthletes()
  }

  const handleResetFilters = () => {
    setCountyFilter("")
    setPositionFilter("")
    setMinJumpFilter("")
    setSearchTerm("")
    setPage(1)
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

  const verifiedCount = athletes.filter((a) => a.performance?.total_shots > 0).length
  const jumps = athletes
    .map((a) => a.performance?.max_jump_height)
    .filter((j) => j !== null && j !== undefined)
  const topJump = jumps.length > 0 ? Math.max(...jumps).toFixed(1) : null

  const kenyaCounties = [
    "Nairobi", "Kisumu", "Mombasa", "Uasin Gishu", "Nakuru",
    "Kiambu", "Machakos", "Nyeri", "Kakamega", "Kilifi",
  ]

  const basketballPositions = [
    "Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center",
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
            Remote AI video scouting across all 47 Kenyan basketball regions
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
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Prospects in View</p>
          <p className="text-2xl font-bold font-display text-cv-navy mt-1">{paginationInfo.total}</p>
          <p className="text-xs text-cv-navy/60 mt-1">Matching search criteria</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Verified Shooters</p>
          <p className="text-2xl font-bold font-display text-emerald-600 mt-1">
            {verifiedCount}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">With extracted CV metrics</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Top Jump Height</p>
          <p className="text-2xl font-bold font-display text-cv-orange mt-1">
            {topJump ? `${topJump} cm` : "—"}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">Peak elevation in page</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
          <p className="text-xs font-semibold uppercase text-cv-navy/50">Regional Coverage</p>
          <p className="text-2xl font-bold font-display text-cv-navy mt-1">
            {new Set(athletes.map((a) => a.profile?.county).filter(Boolean)).size || "All"}
          </p>
          <p className="text-xs text-cv-navy/60 mt-1">Counties represented</p>
        </div>
      </div>

      {/* Multi-Parameter Search & Filter Panel */}
      <div className="bg-white rounded-3xl p-6 border border-cv-navy/10 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Keyword Search */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold uppercase text-cv-navy/60 mb-1">
              Search Athlete / School
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Name, school, club..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-cv-navy/20 rounded-xl text-sm focus:outline-cv-orange"
              />
              <button
                type="submit"
                className="bg-cv-navy text-white px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition cursor-pointer"
              >
                Search
              </button>
            </div>
          </div>

          {/* County Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase text-cv-navy/60 mb-1">
              County (Kenya)
            </label>
            <select
              value={countyFilter}
              onChange={(e) => { setCountyFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-cv-navy/20 rounded-xl text-sm focus:outline-cv-orange bg-white"
            >
              <option value="">All Counties</option>
              {kenyaCounties.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Position Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase text-cv-navy/60 mb-1">
              Position
            </label>
            <select
              value={positionFilter}
              onChange={(e) => { setPositionFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-cv-navy/20 rounded-xl text-sm focus:outline-cv-orange bg-white"
            >
              <option value="">All Positions</option>
              {basketballPositions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Min Jump Filter */}
          <div>
            <label className="block text-xs font-semibold uppercase text-cv-navy/60 mb-1">
              Min Jump Height
            </label>
            <select
              value={minJumpFilter}
              onChange={(e) => { setMinJumpFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-cv-navy/20 rounded-xl text-sm focus:outline-cv-orange bg-white"
            >
              <option value="">Any Height</option>
              <option value="35">35+ cm</option>
              <option value="45">45+ cm (Solid)</option>
              <option value="55">55+ cm (Explosive)</option>
              <option value="65">65+ cm (Elite)</option>
            </select>
          </div>
        </form>

        {(countyFilter || positionFilter || minJumpFilter || searchTerm) && (
          <div className="flex items-center gap-2 pt-1 text-xs text-cv-navy/60">
            <span>Active filters:</span>
            {countyFilter && <span className="bg-gray-100 px-2 py-0.5 rounded-lg">📍 {countyFilter}</span>}
            {positionFilter && <span className="bg-gray-100 px-2 py-0.5 rounded-lg">🏀 {positionFilter}</span>}
            {minJumpFilter && <span className="bg-gray-100 px-2 py-0.5 rounded-lg">🚀 {minJumpFilter}+ cm</span>}
            <button
              onClick={handleResetFilters}
              className="text-cv-orange hover:underline font-semibold ml-2 cursor-pointer"
            >
              Reset All
            </button>
          </div>
        )}
      </div>

      {/* Athlete Cards Directory */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-display font-bold text-cv-navy">
            Prospect Directory ({paginationInfo.total} Total)
          </h2>

          {/* Pagination controls */}
          {paginationInfo.total_pages > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
              >
                ← Prev
              </button>
              <span className="text-cv-navy/60 font-medium">
                Page {page} of {paginationInfo.total_pages}
              </span>
              <button
                disabled={page >= paginationInfo.total_pages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer"
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-sm text-cv-navy/60">
            Searching Kenyan basketball talent registry...
          </div>
        ) : athletes.length === 0 ? (
          <div className="py-16 bg-white rounded-3xl border border-cv-navy/10 text-center space-y-2">
            <p className="text-base font-bold text-cv-navy">No athletes found</p>
            <p className="text-xs text-cv-navy/50 max-w-sm mx-auto">
              No prospects match your current filter parameters. Try broadening your county, position, or jump height requirements.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-2 text-xs font-semibold text-cv-orange hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {athletes.map((athlete) => {
              const prof = athlete.profile || {}
              const perf = athlete.performance || {}
              const hasData = perf.total_shots > 0

              return (
                <div
                  key={athlete.id}
                  className="bg-white rounded-3xl p-6 border border-cv-navy/10 hover:border-cv-orange/40 hover:shadow-md transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-display font-bold text-cv-navy">
                          {athlete.full_name}
                        </h3>
                        <p className="text-xs text-cv-navy/60">
                          {prof.school_or_club || "School not specified"}
                        </p>
                      </div>

                      {hasData ? (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          ✓ Verified
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          Unverified
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {prof.county && (
                        <span className="bg-gray-100 text-cv-navy px-2.5 py-0.5 rounded-lg">
                          📍 {prof.county}
                        </span>
                      )}
                      {prof.position && (
                        <span className="bg-gray-100 text-cv-navy px-2.5 py-0.5 rounded-lg">
                          🏀 {prof.position}
                        </span>
                      )}
                      {prof.height_cm && (
                        <span className="bg-gray-100 text-cv-navy px-2.5 py-0.5 rounded-lg">
                          📏 {prof.height_cm}cm
                        </span>
                      )}
                    </div>

                    {/* Biomechanical CV Metrics Box */}
                    <div className="bg-[#FAFAF9] rounded-2xl p-3 border border-gray-100 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-cv-navy/60">Analyzed Shots:</span>
                        <span className="font-bold text-cv-navy">
                          {perf.total_shots || 0} ({perf.total_videos || 0} drills)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cv-navy/60">Avg Release Angle:</span>
                        <span className="font-bold text-cv-orange">
                          {perf.avg_shooting_angle ? `${perf.avg_shooting_angle}°` : "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-cv-navy/60">Max Jump Height:</span>
                        <span className="font-bold text-cv-navy">
                          {perf.max_jump_height ? `${perf.max_jump_height} cm` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleViewAthleteDetail(athlete.id)}
                      className="w-full bg-cv-navy text-white text-xs font-semibold py-2.5 rounded-xl hover:opacity-90 transition cursor-pointer"
                    >
                      View Scouting Profile →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Athlete Profile Detail Modal */}
      {selectedAthlete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs uppercase font-bold text-cv-orange tracking-widest">
                  M-PESA x Jr. NBA Verified Profile
                </span>
                <h2 className="text-2xl font-display font-bold text-cv-navy mt-1">
                  {selectedAthlete.full_name}
                </h2>
                <p className="text-xs text-cv-navy/60">
                  {selectedAthlete.email} • Registered {new Date(selectedAthlete.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedAthlete(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-cv-navy hover:bg-gray-200 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Profile Bio */}
            {selectedAthlete.profile && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl text-xs">
                <div>
                  <p className="text-cv-navy/50 font-medium">County</p>
                  <p className="font-bold text-cv-navy mt-0.5">{selectedAthlete.profile.county || "—"}</p>
                </div>
                <div>
                  <p className="text-cv-navy/50 font-medium">Position</p>
                  <p className="font-bold text-cv-navy mt-0.5">{selectedAthlete.profile.position || "—"}</p>
                </div>
                <div>
                  <p className="text-cv-navy/50 font-medium">Height</p>
                  <p className="font-bold text-cv-navy mt-0.5">{selectedAthlete.profile.height_cm ? `${selectedAthlete.profile.height_cm} cm` : "—"}</p>
                </div>
                <div>
                  <p className="text-cv-navy/50 font-medium">School / Club</p>
                  <p className="font-bold text-cv-navy mt-0.5">{selectedAthlete.profile.school_or_club || "—"}</p>
                </div>
              </div>
            )}

            {/* Performance Summary Metrics */}
            <div className="space-y-3">
              <h3 className="text-sm font-display font-bold text-cv-navy uppercase tracking-wider">
                Extracted Biomechanical Performance
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-orange-50/60 p-4 rounded-2xl border border-orange-100">
                  <p className="text-xs text-cv-navy/60">Total Shots</p>
                  <p className="text-xl font-bold font-display text-cv-orange mt-1">
                    {selectedAthlete.summary?.total_shots || 0}
                  </p>
                  <p className="text-[10px] text-cv-navy/50 mt-0.5">
                    {selectedAthlete.summary?.completed_videos || 0} drill videos
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                  <p className="text-xs text-cv-navy/60">Avg Release Angle</p>
                  <p className="text-xl font-bold font-display text-cv-navy mt-1">
                    {selectedAthlete.summary?.avg_shooting_angle ? `${selectedAthlete.summary.avg_shooting_angle}°` : "—"}
                  </p>
                  <p className="text-[10px] text-cv-navy/50 mt-0.5">
                    {selectedAthlete.summary?.std_shooting_angle ? `±${selectedAthlete.summary.std_shooting_angle}° variance` : "Elbow angle"}
                  </p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                  <p className="text-xs text-cv-navy/60">Max Jump Height</p>
                  <p className="text-xl font-bold font-display text-cv-navy mt-1">
                    {selectedAthlete.summary?.max_jump_height ? `${selectedAthlete.summary.max_jump_height} cm` : "—"}
                  </p>
                  <p className="text-[10px] text-cv-navy/50 mt-0.5">Peak height</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                  <p className="text-xs text-cv-navy/60">Shot Distribution</p>
                  <p className="text-xl font-bold font-display text-cv-navy mt-1">
                    {selectedAthlete.summary?.two_pointers || 0} <span className="text-xs font-normal">2pt</span> / {selectedAthlete.summary?.three_pointers || 0} <span className="text-xs font-normal">3pt</span>
                  </p>
                  <p className="text-[10px] text-cv-navy/50 mt-0.5">
                    {selectedAthlete.summary?.three_point_pct || 0}% from 3-point
                  </p>
                </div>
              </div>
            </div>

            {/* Recorded Videos List */}
            <div className="space-y-3">
              <h3 className="text-sm font-display font-bold text-cv-navy uppercase tracking-wider">
                Uploaded Drill Footage ({selectedAthlete.videos?.length || 0})
              </h3>
              <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto pr-1">
                {selectedAthlete.videos?.map((vid) => (
                  <div key={vid.id} className="py-2.5 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-semibold text-cv-navy">{vid.title}</p>
                      <p className="text-cv-navy/50">
                        {new Date(vid.created_at).toLocaleDateString()} • {vid.duration_seconds ? `${vid.duration_seconds.toFixed(1)}s` : ""} • {vid.shots?.length || 0} shots detected
                      </p>
                    </div>
                    <Link
                      to={`/results?video_id=${vid.id}`}
                      className="text-cv-orange hover:underline font-semibold"
                    >
                      View Analytics →
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedAthlete(null)}
                className="bg-cv-navy text-white text-xs font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =========================================================
// 3. ADMIN SYSTEM CONSOLE
// =========================================================
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

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user account? All their videos and metrics will be permanently deleted.")) {
      return
    }
    try {
      await api.deleteAdminUser(userId)
      setUsers(users.filter((u) => u.id !== userId))
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
              System Administration
            </h1>
            <span className="text-xs uppercase font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
              Admin Console
            </span>
          </div>
          <p className="text-sm text-cv-navy/60">
            {user.email} • Full System & Computer Vision Pipeline Governance
          </p>
        </div>

        <div>
          <button
            onClick={fetchData}
            className="border border-cv-navy/20 px-4 py-2.5 rounded-xl font-semibold text-xs text-cv-navy hover:bg-gray-50 transition"
          >
            ↻ Refresh System Metrics
          </button>
        </div>
      </div>

      {/* System Stats KPI Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-cv-navy/50">Total Users</p>
            <p className="text-2xl font-bold font-display text-cv-navy mt-1">
              {stats.users?.total || 0}
            </p>
            <p className="text-xs text-cv-navy/60 mt-1">
              {stats.users?.athletes || 0} athletes • {stats.users?.scouts || 0} scouts
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-cv-navy/50">Total Video Files</p>
            <p className="text-2xl font-bold font-display text-cv-navy mt-1">
              {stats.videos?.total || 0}
            </p>
            <p className="text-xs text-cv-navy/60 mt-1">
              {stats.videos?.storage_mb ? `${stats.videos.storage_mb} MB stored` : "0 MB"}
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-cv-navy/50">CV Pipeline Jobs</p>
            <p className="text-2xl font-bold font-display text-emerald-600 mt-1">
              {stats.jobs?.completed || 0}
            </p>
            <p className="text-xs text-cv-navy/60 mt-1">
              {stats.jobs?.failed || 0} failed • {stats.jobs?.pending || 0} in queue
            </p>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-cv-navy/10 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-cv-navy/50">Shots Identified</p>
            <p className="text-2xl font-bold font-display text-cv-orange mt-1">
              {stats.shots?.total_detected || 0}
            </p>
            <p className="text-xs text-cv-navy/60 mt-1">
              {stats.shots?.two_pointers || 0} 2pt / {stats.shots?.three_pointers || 0} 3pt
            </p>
          </div>
        </div>
      )}

      {/* User Directory Management Table */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-cv-navy/10 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <h2 className="text-xl font-display font-bold text-cv-navy">
            Platform Users & Access Control ({users.length})
          </h2>

          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Search user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-1.5 border border-cv-navy/20 rounded-xl text-xs focus:outline-cv-orange"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2 py-1.5 border border-cv-navy/20 rounded-xl text-xs focus:outline-cv-orange bg-white"
            >
              <option value="">All Roles</option>
              <option value="athlete">Athletes</option>
              <option value="scout">Scouts</option>
              <option value="admin">Admins</option>
            </select>
            <button
              type="submit"
              className="bg-cv-navy text-white px-3 py-1.5 rounded-xl text-xs font-semibold hover:opacity-90 cursor-pointer"
            >
              Filter
            </button>
          </form>
        </div>

        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-cv-navy/60">
            Loading system user registry...
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-cv-navy/60">
            No users match the search filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-semibold uppercase text-cv-navy/60">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Profile Metadata</th>
                  <th className="py-3 px-4">Registered</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/80 transition">
                    <td className="py-3 px-4 font-semibold text-cv-navy">
                      {u.full_name}
                    </td>
                    <td className="py-3 px-4 text-xs text-cv-navy/70">{u.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase border ${
                          u.role === "admin"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : u.role === "scout"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-orange-50 text-cv-orange border-orange-200"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-cv-navy/70">
                      {u.role === "athlete" && u.profile && (
                        <span>
                          {u.profile.county || "Kenya"} • {u.profile.position || "Player"} • {u.profile.height_cm ? `${u.profile.height_cm}cm` : ""}
                        </span>
                      )}
                      {u.role === "scout" && u.profile && (
                        <span>
                          {u.profile.organization || "Scouting Agency"} • {u.profile.title || "Scout"}
                        </span>
                      )}
                      {u.role === "admin" && (
                        <span className="text-cv-navy/40">Full Superuser</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-cv-navy/60">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.id !== user.id ? (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-xs font-semibold text-red-600 hover:underline cursor-pointer"
                        >
                          Delete User
                        </button>
                      ) : (
                        <span className="text-xs text-cv-navy/40 font-medium">You</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// =========================================================
// MAIN ROUTED DASHBOARD PAGE
// =========================================================
export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center py-20 bg-[#FAFAF9]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-cv-orange border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-cv-navy">Authenticating session...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 bg-[#FAFAF9]">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-cv-navy/10 text-center">
          <div className="w-12 h-12 mx-auto bg-orange-100 text-cv-orange rounded-2xl flex items-center justify-center text-2xl font-bold">
            🏀
          </div>
          <h2 className="mt-4 text-2xl font-display font-bold text-cv-navy">
            Session Expired
          </h2>
          <p className="mt-2 text-sm text-cv-navy/60">
            Please log in to access your talent dashboard and shooting analytics.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block w-full bg-cv-orange text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition shadow-xs"
          >
            Sign In to CourtVision
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
