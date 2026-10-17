import { Link, useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import cvLogo from "../assets/cvLogo.png"

function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()

  const links = [
    { path: "/", label: "Home" },
    { path: "/upload", label: "Upload" },
    { path: "/dashboard", label: "Dashboard" },
  ]

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  const getRoleBadge = (role) => {
    switch (role) {
      case "scout":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "admin":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-orange-100 text-cv-orange border-orange-200"
    }
  }

  return (
    <nav className="w-full flex items-center justify-between px-6 md:px-10 py-4 border-b border-cv-border bg-white shadow-xs">
      <Link to="/" className="flex items-center gap-3">
        <img src={cvLogo} alt="CourtVision Logo" className="h-9 w-9 rounded-lg object-cover" />
        <div>
          <span className="gradient-heading text-xl font-bold tracking-tight">CourtVision</span>
          <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-wider text-cv-navy/60 bg-cv-navy/5 px-2 py-0.5 rounded-full">
            Kenya Grassroots
          </span>
        </div>
      </Link>

      <div className="hidden md:flex gap-8 items-center">
        {links.map((link) => (
          <Link
            key={link.path}
            to={link.path}
            className={`text-sm font-medium transition ${
              location.pathname === link.path
                ? "text-cv-orange font-semibold"
                : "text-cv-navy/70 hover:text-cv-orange"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
        {isAuthenticated && user ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-cv-navy leading-tight">{user.full_name}</p>
              <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize ${getRoleBadge(user.role)}`}>
                {user.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold px-3.5 py-2 rounded-xl border border-cv-navy/20 text-cv-navy hover:bg-cv-navy/5 transition"
            >
              Log Out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="bg-cv-orange text-white px-5 py-2 rounded-xl font-semibold text-sm hover:opacity-90 shadow-xs transition"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar