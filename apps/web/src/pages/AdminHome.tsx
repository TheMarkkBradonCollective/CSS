import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiFetch, type AuthUser } from "../api";
import { useAuth } from "../auth";
import { hasAdminAccess, homePath, roleLabel } from "../roles";

export default function AdminHome() {
  const { user } = useAuth();
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !hasAdminAccess(user.role)) return;
    let cancelled = false;
    apiFetch<{ user: AuthUser; adminAccess: boolean }>("/admin/me")
      .then((data) => {
        if (!cancelled) setConfirmed(data.adminAccess);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Admin check failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;
  if (!hasAdminAccess(user.role)) return <Navigate to={homePath(user.role)} replace />;

  return (
    <section className="card stack">
      <h1>{roleLabel(user.role)}</h1>
      {user.role === "founder" ? (
        <p className="muted">Founder includes every admin permission.</p>
      ) : (
        <p className="muted">
          Staff and admin accounts are managed by a Founder.
        </p>
      )}
      {confirmed ? <p className="success">Admin access confirmed.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {user.role === "founder" ? (
        <Link className="btn primary" to="/founder">
          Manage staff and admins
        </Link>
      ) : null}
    </section>
  );
}
