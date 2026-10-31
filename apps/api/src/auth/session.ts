export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function bytesToB64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateSessionToken(): string {
  return bytesToB64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return bytesToB64Url(new Uint8Array(digest));
}

export function sessionExpiresAt(from = Date.now()): Date {
  return new Date(from + SESSION_TTL_MS);
}
