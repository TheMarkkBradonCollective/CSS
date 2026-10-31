import { hashSessionToken, sessionExpiresAt } from "../src/auth/session";

type MockUser = {
  id: string;
  email: string;
  display_name: string;
  role: "business" | "specialist" | "admin";
  password_hash: string | null;
};

type MockSession = {
  token_hash: string;
  user_id: string;
  expires_at: Date;
};

export function createMockSqlState() {
  const users: MockUser[] = [];
  const sessions: MockSession[] = [];
  let counter = 0;

  const nextId = () => {
    counter += 1;
    return `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`;
  };

  const sql = async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<Record<string, unknown>[]> => {
    const query = strings.join(" ").replace(/\s+/g, " ").trim().toLowerCase();

    if (query.startsWith("select id from users where email")) {
      const email = values[0] as string;
      const found = users.find((u) => u.email === email);
      return found ? [{ id: found.id }] : [];
    }

    if (
      query.includes("insert into users") &&
      query.includes("password_hash")
    ) {
      const [email, displayName, role, passwordHash] = values as [
        string,
        string,
        "business" | "specialist",
        string,
      ];
      const user: MockUser = {
        id: nextId(),
        email,
        display_name: displayName,
        role,
        password_hash: passwordHash,
      };
      users.push(user);
      return [
        {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          role: user.role,
        },
      ];
    }

    if (
      query.includes("select id, email, display_name, role, password_hash") &&
      query.includes("from users") &&
      query.includes("where email")
    ) {
      const email = values[0] as string;
      const user = users.find((u) => u.email === email);
      return user ? [{ ...user }] : [];
    }

    if (query.includes("insert into sessions")) {
      const [userId, tokenHash, expiresAt] = values as [string, string, string];
      sessions.push({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: new Date(expiresAt),
      });
      return [];
    }

    if (query.startsWith("delete from sessions where token_hash")) {
      const tokenHash = values[0] as string;
      const idx = sessions.findIndex((s) => s.token_hash === tokenHash);
      if (idx >= 0) sessions.splice(idx, 1);
      return [];
    }

    if (
      query.includes("from sessions s") &&
      query.includes("inner join users u")
    ) {
      const tokenHash = values[0] as string;
      const session = sessions.find(
        (s) => s.token_hash === tokenHash && s.expires_at.getTime() > Date.now(),
      );
      if (!session) return [];
      const user = users.find((u) => u.id === session.user_id);
      return user
        ? [
            {
              id: user.id,
              email: user.email,
              display_name: user.display_name,
              role: user.role,
            },
          ]
        : [];
    }

    if (query.includes("insert into businesses")) {
      return [];
    }
    if (query.includes("insert into specialists")) {
      return [];
    }

    throw new Error(`Unhandled mock SQL: ${query}`);
  };

  return { sql, users, sessions };
}

export const testDbState = createMockSqlState();

export async function loginTokenForUser(
  sql: ReturnType<typeof createMockSqlState>["sql"],
  userId: string,
): Promise<string> {
  const token = "test-session-token-" + userId;
  const tokenHash = await hashSessionToken(token);
  await sql`
    INSERT INTO sessions (user_id, token_hash, expires_at)
    VALUES (${userId}::uuid, ${tokenHash}, ${sessionExpiresAt().toISOString()}::timestamptz)
  `;
  return token;
}
