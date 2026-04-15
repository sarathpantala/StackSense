"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import type { LoginRequest, SignupRequest, TokenResponse, User } from "@/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function setTokens(tokens: TokenResponse) {
  localStorage.setItem("access_token", tokens.access_token);
  localStorage.setItem("refresh_token", tokens.refresh_token);
}

function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setState({ user: null, isLoading: false, isAuthenticated: false });
        return;
      }
      const user = await api.get<User>("/auth/me");
      setState({ user, isLoading: false, isAuthenticated: true });
    } catch {
      clearTokens();
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (data: LoginRequest) => {
      const tokens = await api.post<TokenResponse>("/auth/login", data);
      setTokens(tokens);
      await refreshUser();
      router.push("/dashboard");
    },
    [refreshUser, router],
  );

  const signup = useCallback(
    async (data: SignupRequest) => {
      const tokens = await api.post<TokenResponse>("/auth/signup", data);
      setTokens(tokens);
      await refreshUser();
      router.push("/dashboard");
    },
    [refreshUser, router],
  );

  const logout = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        await api.post("/auth/logout", { refresh_token: refreshToken });
      }
    } catch {
      // Logout even if server call fails
    } finally {
      clearTokens();
      setState({ user: null, isLoading: false, isAuthenticated: false });
      router.push("/login");
    }
  }, [router]);

  const value = useMemo(
    () => ({ ...state, login, signup, logout, refreshUser }),
    [state, login, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
