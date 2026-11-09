import { hashSessionToken, sessionExpiresAt } from "../src/auth/session";
import type { UserRole } from "../src/types";

export type MockUser = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  password_hash: string | null;
  created_at: string;
};

type MockSession = {
  token_hash: string;
  user_id: string;
  expires_at: Date;
};

export type MockBusiness = { user_id: string; name: string };
export type MockSpecialist = { user_id: string; level: number };

const ROLE_RANK: Record<UserRole, number> = {
  business: 0,
  specialist: 1,
  admin: 2,
  founder: 3,
};

export function createMockSqlState() {
  const users: MockUser[] = [];
  const sessions: MockSession[] = [];
  const businesses: MockBusiness[] = [];
  const specialists: MockSpecialist[] = [];
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

    if (
      query.includes("select id, role, password_hash") &&
      query.includes("from users") &&
      query.includes("where email")
    ) {
      const email = values[0] as string;
      const found = users.find((u) => u.email === email);
      return found
        ? [{ id: found.id, role: found.role, password_hash: found.password_hash }]
        : [];
    }

    if (
      query.includes("insert into users") &&
      query.includes("password_hash")
    ) {
      const [email, displayName, role, passwordHash] = values as [
        string,
        string,
        UserRole,
        string,
      ];
      const user: MockUser = {
        id: nextId(),
        email,
        display_name: displayName,
        role,
        password_hash: passwordHash,
        created_at: new Date().toISOString(),
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
      query.startsWith("update users") &&
      query.includes("password_hash")
    ) {
      const [passwordHash, displayName, id] = values as [string, string, string];
      const user = users.find((u) => u.id === id);
      if (!user) return [];
      user.password_hash = passwordHash;
      user.display_name = displayName;
      return [
        {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          role: user.role,
        },
      ];
    }

    if (query.startsWith("update users") && query.includes("set role")) {
      const [role, id] = values as [UserRole, string];
      const user = users.find((u) => u.id === id);
      if (!user) return [];
      user.role = role;
      return [
        {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          role: user.role,
          created_at: user.created_at,
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

    if (
      query.includes("from users") &&
      query.includes("where role in")
    ) {
      return users
        .filter((u) => u.role === "specialist" || u.role === "admin")
        .sort((a, b) => {
          const byRole = ROLE_RANK[b.role] - ROLE_RANK[a.role];
          if (byRole !== 0) return byRole;
          return a.email.localeCompare(b.email);
        })
        .map((user) => ({
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          role: user.role,
          created_at: user.created_at,
        }));
    }

    if (
      query.includes("select id, email, display_name, role, created_at") &&
      query.includes("where id")
    ) {
      const id = values[0] as string;
      const user = users.find((u) => u.id === id);
      return user
        ? [
            {
              id: user.id,
              email: user.email,
              display_name: user.display_name,
              role: user.role,
              created_at: user.created_at,
            },
          ]
        : [];
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

    if (query.startsWith("delete from sessions where user_id")) {
      const userId = values[0] as string;
      for (let i = sessions.length - 1; i >= 0; i -= 1) {
        if (sessions[i].user_id === userId) sessions.splice(i, 1);
      }
      return [];
    }

    if (query.startsWith("delete from users")) {
      const id = values[0] as string;
      const idx = users.findIndex((u) => u.id === id);
      if (idx < 0) return [];
      users.splice(idx, 1);
      return [{ id }];
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
      const [userId, name] = values as [string, string];
      businesses.push({ user_id: userId, name });
      return [];
    }
    if (query.includes("insert into specialists")) {
      const [userId, level] = values as [string, number, string | null];
      if (!specialists.some((row) => row.user_id === userId)) {
        specialists.push({ user_id: userId, level });
      }
      return [];
    }

    throw new Error(`Unhandled mock SQL: ${query}`);
  };

  return { sql, users, sessions, businesses, specialists };
}

export const testDbState = createMockSqlState();

export function resetTestDb() {
  testDbState.users.length = 0;
  testDbState.sessions.length = 0;
  testDbState.businesses.length = 0;
  testDbState.specialists.length = 0;
}

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
