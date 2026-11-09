import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { register } from "../api";
import { useAuth } from "../auth";
import { homePath, roleLabel, type PublicRegisterRole } from "../roles";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setUser, user } = useAuth();
  const [role, setRole] = useState<PublicRegisterRole>("business");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [level, setLevel] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    return (
      <Navigate to={homePath(user.role)} replace />
    );
  }
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const next = await register({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
        businessName: role === "business" ? businessName.trim() : undefined,
        specialistLevel: role === "specialist" ? level : undefined,
      });
      setUser(next);
      navigate(homePath(next.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card stack">
      <h1>Create account</h1>
      <p className="muted">Join CSS as a business or certified specialist.</p>
      <form className="stack" onSubmit={onSubmit}>
        <label className="field">
          I am a
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="business">{roleLabel("business")}</option>
            <option value="specialist">{roleLabel("specialist")}</option>
          </select>
        </label>
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
          Password (min 8 characters)
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Display name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>
        {role === "business" ? (
          <label className="field">
            Business name
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
            />
          </label>
        ) : (
          <label className="field">
            Specialist level (1–5)
            <input
              type="number"
              min={1}
              max={5}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
            />
          </label>
        )}
        {error ? <p className="error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="muted">
        Already registered? <Link to="/login">Sign in</Link>
      </p>
    </section>
  );
}
