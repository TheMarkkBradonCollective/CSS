import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { login } from "../api";
import { useAuth } from "../auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    return (
      <Navigate
        to={user.role === "business" ? "/business" : "/specialist"}
        replace
      />
    );
  }
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const next = await login({ email: email.trim(), password });
      setUser(next);
      navigate(next.role === "business" ? "/business" : "/specialist");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card stack">
      <h1>Sign in</h1>
      <p className="muted">Use the email and password you registered with.</p>
      <form className="stack" onSubmit={onSubmit}>
        <label className="field">
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="muted">
        No account? <Link to="/register">Create one</Link>
      </p>
    </section>
  );
}
