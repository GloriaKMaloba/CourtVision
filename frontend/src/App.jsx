import { BrowserRouter, Routes, Route } from "react-router-dom"
import { AuthProvider } from "./context/AuthContext"
import Navbar from "./components/Navbar"
import LandingPage from "./pages/LandingPage"
import LoginPage from "./pages/LoginPage"
import UploadPage from "./pages/UploadPage"
import ResultsPage from "./pages/ResultsPage"
import DashboardPage from "./pages/DashboardPage"

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App