import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import BusinessDashboard from "./pages/BusinessDashboard";
import SpecialistDashboard from "./pages/SpecialistDashboard";
import LoginPage from "./pages/LoginPage";
import MissionReportPage from "./pages/MissionReportPage";

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="top-bar">
        <Link to="/" className="brand">
          CSS
        </Link>
        {user ? (
          <div className="top-actions">
            <span className="pill">{user.role}</span>
            <button type="button" className="btn ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        ) : null}
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "business") return <Navigate to="/business" replace />;
  return <Navigate to="/specialist" replace />;
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/business" element={<BusinessDashboard />} />
        <Route path="/business/missions/:id/report" element={<MissionReportPage />} />
        <Route path="/specialist" element={<SpecialistDashboard />} />
      </Routes>
    </Shell>
  );
}
