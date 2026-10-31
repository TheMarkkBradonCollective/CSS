import { FormEvent, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch, getApiBase, getToken } from "../api";
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
  businessName?: string;
};

type Assignment = {
  id: string;
  mission_id: string;
  specialist_id: string;
  status: string;
};

export default function SpecialistDashboard() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [summary, setSummary] = useState("Overall experience was positive.");
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "specialist") return <Navigate to="/business" replace />;

  async function loadMissions() {
    const data = await apiFetch<{ missions: Mission[] }>("/missions/available");
    setMissions(data.missions);
  }

  useEffect(() => {
    loadMissions().catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load"),
    );
  }, []);

  async function acceptMission(mission: Mission) {
    setError(null);
    try {
      const data = await apiFetch<{ assignment: Assignment }>(
        `/missions/${mission.id}/accept`,
        { method: "POST", body: "{}" },
      );
      setAssignment(data.assignment);
      setActiveMission(mission);
      setMessage(`Accepted: ${mission.title}`);
      await loadMissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Accept failed");
    }
  }

  async function submitReport(e: FormEvent) {
    e.preventDefault();
    if (!assignment || !photo) return;
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.append("summary", summary);
    form.append("findings", JSON.stringify({ score: 4, notes: "Friendly staff" }));
    form.append("photo", photo);

    const token = getToken();
    const res = await fetch(
      `${getApiBase()}/assignments/${assignment.id}/report`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      },
    );
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Submit failed");
      return;
    }
    setMessage("Report submitted with photo.");
    setAssignment(null);
    setActiveMission(null);
    setPhoto(null);
  }

  return (
    <div className="stack gap-lg">
      <section className="card stack">
        <h1>Available missions</h1>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="success">{message}</p> : null}
        {missions.length === 0 ? (
          <p className="muted">No open missions match your level.</p>
        ) : (
          <ul className="mission-list">
            {missions.map((m) => (
              <li key={m.id} className="mission-item">
                <div>
                  <strong>{m.title}</strong>
                  <p className="muted">
                    {m.businessName} · Level {m.minSpecialistLevel}+ · $
                    {(m.paymentCents / 100).toFixed(2)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn primary small"
                  onClick={() => acceptMission(m)}
                  disabled={!!assignment}
                >
                  Accept
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {assignment && activeMission ? (
        <section className="card stack">
          <h2>Submit report — {activeMission.title}</h2>
          <form className="stack" onSubmit={submitReport}>
            <label className="field">
              Summary
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                required
              />
            </label>
            <label className="field">
              Photo evidence
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                required
              />
            </label>
            <button className="btn primary" type="submit" disabled={!photo}>
              Submit report
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
