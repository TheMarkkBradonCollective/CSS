import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type AuthUser,
  clearSession,
  getStoredUser,
  getToken,
} from "./api";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(() => getStoredUser());
  const [token, setToken] = useState<string | null>(() => getToken());

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      setUser: (next) => {
        setUserState(next);
        setToken(next ? getToken() : null);
      },
      logout: () => {
        clearSession();
        setUserState(null);
        setToken(null);
      },
    }),
    [user, token],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
