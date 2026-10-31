export type UserRole = "business" | "specialist" | "admin";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
};

const TOKEN_KEY = "css_auth_token";
const USER_KEY = "css_auth_user";

export function getApiBase(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:8787";
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  return data;
}

export async function stubLogin(input: {
  email: string;
  displayName: string;
  role: "business" | "specialist";
  businessName?: string;
  specialistLevel?: number;
}) {
  const data = await apiFetch<{ token: string; user: AuthUser }>(
    "/auth/stub",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  setSession(data.token, data.user);
  return data.user;
}
