import { create } from "zustand";
import api from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator";
  lastLogin?: string | null;
  createdAt?: string;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  fetchMe: () => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,
  error: null,

  initAuth: async () => {
    if (typeof window === "undefined") return;

    try {
      const storedToken = localStorage.getItem("agentflow_token");
      const storedUserStr = localStorage.getItem("agentflow_user");

      if (!storedToken) {
        set({ isInitialized: true, isAuthenticated: false, user: null, token: null });
        return;
      }

      let cachedUser: User | null = null;
      if (storedUserStr) {
        try {
          cachedUser = JSON.parse(storedUserStr);
        } catch {
          // Ignore json parse error
        }
      }

      set({
        token: storedToken,
        user: cachedUser,
        isAuthenticated: true,
      });

      // Verify token with backend
      await get().fetchMe();
    } catch {
      // If fetching fails, clear invalid auth
      get().logout();
    } finally {
      set({ isInitialized: true });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post<AuthResponse>("/auth/login", {
        email,
        password,
      });

      if (response.data.success && response.data.token && response.data.user) {
        const { token, user } = response.data;

        if (typeof window !== "undefined") {
          localStorage.setItem("agentflow_token", token);
          localStorage.setItem("agentflow_user", JSON.stringify(user));
        }

        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        return true;
      }

      set({
        isLoading: false,
        error: response.data.message || "Login failed. Please check your credentials.",
      });
      return false;
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage =
        errorObj.response?.data?.message ||
        errorObj.message ||
        "Login failed. Please try again.";

      set({
        isLoading: false,
        error: errorMessage,
      });
      return false;
    }
  },

  register: async (name: string, email: string, password: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.post<AuthResponse>("/auth/register", {
        name,
        email,
        password,
      });

      if (response.data.success) {
        set({ isLoading: false, error: null });
        return true;
      }

      set({
        isLoading: false,
        error: response.data.message || "Registration failed. Please try again.",
      });
      return false;
    } catch (err: unknown) {
      const errorObj = err as {
        response?: {
          data?: {
            message?: string;
            errors?: Array<{ msg?: string; message?: string }>;
          };
        };
        message?: string;
      };

      let errorMessage = "Registration failed. Please try again.";

      if (errorObj.response?.data?.errors && errorObj.response.data.errors.length > 0) {
        errorMessage =
          errorObj.response.data.errors[0].msg ||
          errorObj.response.data.errors[0].message ||
          errorMessage;
      } else if (errorObj.response?.data?.message) {
        errorMessage = errorObj.response.data.message;
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }

      set({
        isLoading: false,
        error: errorMessage,
      });
      return false;
    }
  },

  fetchMe: async () => {
    try {
      const response = await api.get<{ success: boolean; user: User }>("/auth/me");
      if (response.data.success && response.data.user) {
        const user = response.data.user;
        if (typeof window !== "undefined") {
          localStorage.setItem("agentflow_user", JSON.stringify(user));
        }
        set({ user, isAuthenticated: true });
      }
    } catch {
      throw new Error("Failed to authenticate session");
    }
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("agentflow_token");
      localStorage.removeItem("agentflow_user");
    }
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
