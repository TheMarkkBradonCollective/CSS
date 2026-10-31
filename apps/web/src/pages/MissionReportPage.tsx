import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { apiFetch, getApiBase } from "../api";
import { useAuth } from "../auth";

type ReportPayload = {
  report: {
    id: string;
    summary: string;
    findings: Record<string, unknown>;
    submittedAt: string;
    photos: Array<{ id: string; url: string; contentType: string }>;
  };
};

export default function MissionReportPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [report, setReport] = useState<ReportPayload["report"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "business") return <Navigate to="/specialist" replace />;

  useEffect(() => {
    if (!id) return;
    apiFetch<ReportPayload>(`/missions/${id}/report`)
      .then((data) => setReport(data.report))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load report"),
      );
  }, [id]);

  return (
    <section className="card stack">
      <Link to="/business" className="muted">
        ← Back to missions
      </Link>
      <h1>Mission report</h1>
      {error ? <p className="error">{error}</p> : null}
      {!report && !error ? <p className="muted">Loading…</p> : null}
      {report ? (
        <>
          <p>{report.summary}</p>
          <pre className="code">{JSON.stringify(report.findings, null, 2)}</pre>
          <p className="muted">
            Submitted {new Date(report.submittedAt).toLocaleString()}
          </p>
          <div className="photo-grid">
            {report.photos.map((p) => (
              <img
                key={p.id}
                src={`${getApiBase()}${p.url}`}
                alt="Report evidence"
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
