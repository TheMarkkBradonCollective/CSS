import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  listStaff,
  removeStaff,
  updateStaffRole,
  type StaffAccount,
} from "../api";
import { useAuth } from "../auth";
import { homePath, roleLabel, roleRank, type ManagedRole } from "../roles";

export default function FounderDashboard() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ManagedRole>>({});
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== "founder") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    listStaff()
      .then((data) => {
        if (cancelled) return;
        setAccounts(data.accounts);
        setDrafts(Object.fromEntries(data.accounts.map((account) => [account.id, account.role])));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load accounts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "founder") return <Navigate to={homePath(user.role)} replace />;

  async function changeRole(account: StaffAccount) {
    const nextRole = drafts[account.id] ?? account.role;
    if (nextRole === account.role) return;
    setError(null);
    setMessage(null);
    setPendingId(account.id);
    try {
      const data = await updateStaffRole(account.id, nextRole);
      setAccounts((current) =>
        current.map((row) => (row.id === account.id ? data.account : row)),
      );
      setDrafts((current) => ({ ...current, [account.id]: data.account.role }));
      const verb = roleRank(nextRole) > roleRank(account.role) ? "promoted" : "demoted";
      setMessage(`${account.email} ${verb} to ${roleLabel(nextRole)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPendingId(null);
    }
  }

  async function onRemove(account: StaffAccount) {
    const label = roleLabel(account.role);
    if (!window.confirm(`Remove ${label} account ${account.email}?`)) return;
    setError(null);
    setMessage(null);
    setPendingId(account.id);
    try {
      await removeStaff(account.id);
      setAccounts((current) => current.filter((row) => row.id !== account.id));
      setMessage(`${account.email} removed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="card stack">
      <h1>Staff and admins</h1>
      <p className="muted">
        Promote, demote, or remove specialist staff and admin accounts. Founder
        accounts stay in place.
      </p>
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && accounts.length === 0 ? (
        <p className="muted">No staff or admin accounts yet.</p>
      ) : null}
      {accounts.length > 0 ? (
        <ul className="mission-list">
          {accounts.map((account) => {
            const draft = drafts[account.id] ?? account.role;
            const pending = pendingId === account.id;
            const delta = roleRank(draft) - roleRank(account.role);
            const action = delta > 0 ? "Promote" : delta < 0 ? "Demote" : "Update";
            return (
              <li key={account.id} className="mission-item">
                <div className="account-meta">
                  <strong>{account.displayName}</strong>
                  <span className="muted">{account.email}</span>
                  <span className="muted">Current role: {roleLabel(account.role)}</span>
                </div>
                <div className="row-actions">
                  <label className="inline-field">
                    Role
                    <select
                      className="role-select"
                      aria-label={`Role for ${account.email}`}
                      value={draft}
                      disabled={pending}
                      onChange={(e) =>
                        setDrafts((current) => ({
                          ...current,
                          [account.id]: e.target.value as ManagedRole,
                        }))
                      }
                    >
                      <option value="specialist">{roleLabel("specialist")}</option>
                      <option value="admin">{roleLabel("admin")}</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn small primary"
                    disabled={pending || delta === 0}
                    onClick={() => changeRole(account)}
                  >
                    {action}
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    disabled={pending}
                    onClick={() => onRemove(account)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
