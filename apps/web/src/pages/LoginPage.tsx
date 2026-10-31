import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { stubLogin } from "../api";
import { useAuth } from "../auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [role, setRole] = useState<"business" | "specialist">("business");
  const [email, setEmail] = useState("demo@css.app");
  const [displayName, setDisplayName] = useState("Demo User");
  const [businessName, setBusinessName] = useState("Acme Retail");
  const [level, setLevel] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await stubLogin({
        email,
        displayName,
        role,
        businessName: role === "business" ? businessName : undefined,
        specialistLevel: role === "specialist" ? level : undefined,
      });
      setUser(user);
      navigate(role === "business" ? "/business" : "/specialist");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card stack">
      <h1>Sign in (stub)</h1>
      <p className="muted">
        Creates or reuses a demo user in Neon. Token is the user UUID sent as
        Bearer auth.
      </p>
      <form className="stack" onSubmit={onSubmit}>
        <label className="field">
          Role
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
            <option value="business">Business</option>
            <option value="specialist">Specialist</option>
          </select>
        </label>
        <label className="field">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} required />
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
          {loading ? "Signing in…" : "Continue"}
        </button>
      </form>
    </section>
  );
}
