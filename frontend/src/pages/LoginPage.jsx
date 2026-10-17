import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

const COUNTIES = [
  "Nairobi",
  "Kisumu",
  "Mombasa",
  "Eldoret / Uasin Gishu",
  "Nakuru",
  "Kiambu",
  "Machakos",
  "Kilifi",
  "Kakamega",
  "Nyeri",
  "Other County",
]

const POSITIONS = [
  "Point Guard (PG)",
  "Shooting Guard (SG)",
  "Small Forward (SF)",
  "Power Forward (PF)",
  "Center (C)",
]

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [role, setRole] = useState("athlete") // 'athlete' or 'scout'
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    county: "Nairobi",
    school_or_club: "",
    height_cm: "",
    position: "Shooting Guard (SG)",
    dominant_hand: "Right",
    organization: "M-PESA x Jr. NBA Kenya",
    title: "Regional Scout",
    phone: "",
  })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || "/dashboard"

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
    setError("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (isRegister) {
        await register({
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role,
          ...(role === "athlete"
            ? {
                county: formData.county,
                school_or_club: formData.school_or_club,
                height_cm: formData.height_cm ? parseFloat(formData.height_cm) : null,
                position: formData.position,
                dominant_hand: formData.dominant_hand,
              }
            : {
                organization: formData.organization,
                title: formData.title,
                phone: formData.phone,
              }),
        })
      } else {
        await login(formData.email, formData.password)
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || "Authentication failed. Please check your details.")
    } finally {
      setLoading(false)
    }
  }

  const handleQuickDemo = async (demoEmail, demoPassword) => {
    setError("")
    setLoading(true)
    try {
      await login(demoEmail, demoPassword)
      navigate("/dashboard")
    } catch (err) {
      setError(err.message || "Failed to log in with demo account")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#FAFAF9]">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-sm border border-cv-navy/10">
        <div>
          <div className="text-center">
            <span className="text-xs uppercase font-bold tracking-widest text-cv-orange">
              CourtVision Access
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-cv-navy tracking-tight font-display">
              {isRegister ? "Create an account" : "Sign in to CourtVision"}
            </h2>
            <p className="mt-2 text-sm text-cv-navy/60 font-body">
              {isRegister
                ? "Register as an athlete or scout to start tracking metrics"
                : "Enter your credentials or use a one-click demo profile"}
            </p>
          </div>
        </div>

        {/* Demo Accounts Quick-Select */}
        {!isRegister && (
          <div className="bg-orange-50/70 border border-orange-200/80 rounded-2xl p-4">
            <p className="text-xs font-semibold text-cv-navy/80 mb-2.5">
              🚀 Fast Testing Demo Accounts:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo("athlete@courtvision.ke", "password123")}
                className="text-xs py-2 px-3 bg-white text-cv-navy border border-orange-200 rounded-xl hover:border-cv-orange hover:text-cv-orange font-medium text-left transition shadow-2xs"
              >
                🏀 <span className="font-semibold">Athlete</span> (Kisumu)
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo("scout@courtvision.ke", "password123")}
                className="text-xs py-2 px-3 bg-white text-cv-navy border border-orange-200 rounded-xl hover:border-cv-orange hover:text-cv-orange font-medium text-left transition shadow-2xs"
              >
                📋 <span className="font-semibold">Scout</span> (Jr. NBA)
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
            {error}
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            className={`w-1/2 py-2.5 font-medium text-sm text-center border-b-2 transition ${
              !isRegister
                ? "border-cv-orange text-cv-orange font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => {
              setIsRegister(false)
              setError("")
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`w-1/2 py-2.5 font-medium text-sm text-center border-b-2 transition ${
              isRegister
                ? "border-cv-orange text-cv-orange font-semibold"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => {
              setIsRegister(true)
              setError("")
            }}
          >
            Register
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {isRegister && (
            <>
              {/* Role selector */}
              <div>
                <label className="block text-xs font-semibold uppercase text-cv-navy/70 mb-1">
                  Account Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("athlete")}
                    className={`py-2 text-xs font-semibold rounded-xl border text-center transition ${
                      role === "athlete"
                        ? "bg-cv-orange text-white border-cv-orange"
                        : "bg-white text-cv-navy border-gray-200 hover:border-cv-orange"
                    }`}
                  >
                    🏀 Athlete / Player
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("scout")}
                    className={`py-2 text-xs font-semibold rounded-xl border text-center transition ${
                      role === "scout"
                        ? "bg-cv-orange text-white border-cv-orange"
                        : "bg-white text-cv-navy border-gray-200 hover:border-cv-orange"
                    }`}
                  >
                    📋 Scout / Coach
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="full_name"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  placeholder="e.g. Kevin Otieno"
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange"
                />
              </div>

              {role === "athlete" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
                        County
                      </label>
                      <select
                        name="county"
                        value={formData.county}
                        onChange={handleChange}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange bg-white"
                      >
                        {COUNTIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
                        Position
                      </label>
                      <select
                        name="position"
                        value={formData.position}
                        onChange={handleChange}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange bg-white"
                      >
                        {POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
                        School / Club
                      </label>
                      <input
                        type="text"
                        name="school_or_club"
                        value={formData.school_or_club}
                        onChange={handleChange}
                        placeholder="e.g. Kisumu Boys"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
                        Height (cm)
                      </label>
                      <input
                        type="number"
                        name="height_cm"
                        value={formData.height_cm}
                        onChange={handleChange}
                        placeholder="e.g. 188"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
                      Organization
                    </label>
                    <input
                      type="text"
                      name="organization"
                      value={formData.organization}
                      onChange={handleChange}
                      placeholder="e.g. Jr. NBA Kenya"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
                      Scout Title
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      placeholder="e.g. Talent Scout"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              placeholder="you@domain.com"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-cv-navy/80 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cv-orange/20 focus:border-cv-orange"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-cv-orange text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-50 shadow-sm cursor-pointer"
          >
            {loading ? "Processing..." : isRegister ? "Create Account" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  )
}