import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { router } from 'expo-router';

import {
  API_BASE, // exported from client.ts so we don't hardcode the host here too
  ApiError,
  apiRequest,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from '@/services/api/client';

export type Role = 'hoi' | 'teacher' | 'student';

type SessionUser = Record<string, unknown>;

type AuthState = {
  token: string | null;
  role: Role | null;
  user: SessionUser | null;
  /** true while restoring a stored token on app launch */
  isLoading: boolean;
};

type AuthContextValue = AuthState & {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Maps each backend role to the screen it lands on after login.
// Adjust these paths if your actual route file names differ.
const ROLE_ROUTES: Record<Role, string> = {
  hoi: '/dashboard',
  teacher: '/teachers',
  student: '/students',
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({
    token: null,
    role: null,
    user: null,
    isLoading: true,
  });

  // On launch: is there a stored token, and is it still valid?
  useEffect(() => {
    (async () => {
      const token = await getStoredToken();
      if (!token) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }
      try {
        const data = await apiRequest<{ role: Role; user: SessionUser }>('/me.php');
        setState({ token, role: data.role, user: data.user, isLoading: false });
      } catch (err) {
        // FIX: only treat this as "the token is actually invalid" on a real
        // 401/403 from the server. Network errors, 404s, 500s, a redeploy
        // mid-flight, etc. are transient and say nothing about whether the
        // token is still good - clearing it on those silently and
        // permanently logs the user out on any cold-boot hiccup, which is
        // exactly what was happening here (a 404 during redeploy wiped a
        // perfectly valid token, and every request after that had no
        // Authorization header at all).
        const status = err instanceof ApiError ? err.status : undefined;
        if (status === 401 || status === 403) {
          await clearStoredToken();
          setState({ token: null, role: null, user: null, isLoading: false });
        } else {
          // Keep the token and keep the user logged in locally; just stop
          // the loading spinner. Individual screens will surface their own
          // errors if a specific request genuinely fails.
          setState((s) => ({ ...s, token, isLoading: false }));
        }
      }
    })();
  }, []);

  const login = async (username: string, password: string) => {
    // login.php expects identifier/passcode as form fields — "username"/"password"
    // here are just the generic param names LoginScreen uses for whatever the
    // active tab collects (Assessment Number + password for students, Email +
    // TSC Number for staff).
    //
    // IMPORTANT: this bypasses apiRequest() and sends
    // application/x-www-form-urlencoded directly, NOT JSON. This mirrors the
    // form-encoded approach used across the app's POST endpoints.
    const res = await fetch(`${API_BASE}/login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `identifier=${encodeURIComponent(username)}&passcode=${encodeURIComponent(password)}`,
    });

    let data: { success: boolean; message?: string; token?: string; role?: Role; user?: SessionUser };
    try {
      data = await res.json();
    } catch {
      throw new Error('Unexpected response from server. Please try again.');
    }

    if (!res.ok || !data.success || !data.token || !data.role) {
      throw new Error(data.message || 'Login failed. Please try again.');
    }

    await setStoredToken(data.token);
    setState({ token: data.token, role: data.role, user: data.user ?? null, isLoading: false });

    // Route to the right dashboard based on the role the backend returned.
    router.replace(ROLE_ROUTES[data.role]);
  };

  const logout = async () => {
    await clearStoredToken();
    setState({ token: null, role: null, user: null, isLoading: false });
    router.replace('/login');
  };

  const value = useMemo(() => ({ ...state, login, logout }), [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}