import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { apiFetch } from "../api";
import { useAuth } from "../auth";

type Mission = {
  id: string;
  title: string;
  description: string;
  missionType: string;
  location: string | null;
  paymentCents: number;
  minSpecialistLevel: number;
  status: string;
  createdAt: string;
};

export default function BusinessDashboard() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [title, setTitle] = useState("Mystery shop — front counter");
  const [description, setDescription] = useState(
    "Evaluate greeting, wait time, and upsell.",
  );
  const [paymentCents, setPaymentCents] = useState(7500);
  const [location, setLocation] = useState("Downtown");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "business") return <Navigate to="/specialist" replace />;

  async function load() {
    const data = await apiFetch<{ missions: Mission[] }>("/missions/mine");
    setMissions(data.missions);
  }

  useEffect(() => {
    load().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load"),
    );
  }, []);

  async function createMission(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/missions", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          missionType: "mystery_shopping",
          location,
          paymentCents,
          minSpecialistLevel: 2,
        }),
      });
      setMessage("Mission posted.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="stack gap-lg">
      <section className="card stack">
        <h1>Business missions</h1>
        <p className="muted">Post paid CX missions for certified specialists.</p>
        <form className="stack" onSubmit={createMission}>
          <label className="field">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="field">
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>
          <label className="field">
            Location
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </label>
          <label className="field">
            Payment (USD cents)
            <input
              type="number"
              value={paymentCents}
              onChange={(e) => setPaymentCents(Number(e.target.value))}
            />
          </label>
          {message ? <p className="success">{message}</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <button className="btn primary" type="submit">
            Post mission
          </button>
        </form>
      </section>

      <section className="card stack">
        <h2>Your missions</h2>
        {missions.length === 0 ? (
          <p className="muted">No missions yet.</p>
        ) : (
          <ul className="mission-list">
            {missions.map((m) => (
              <li key={m.id} className="mission-item">
                <div>
                  <strong>{m.title}</strong>
                  <p className="muted">{m.status} · ${(m.paymentCents / 100).toFixed(2)}</p>
                </div>
                {m.status === "completed" ? (
                  <Link className="btn small" to={`/business/missions/${m.id}/report`}>
                    View report
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
