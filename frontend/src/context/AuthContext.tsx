"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { User, UserRole } from "@/types";
import { api, tokenStorage, ApiTokenResponse } from "@/lib/api";

interface AuthResult {
  success: boolean;
  role?: UserRole;
  error?: string;
  user?: User;
}

interface AuthContextType {
  user: User | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithCredentials: (identifier: string, password: string) => Promise<AuthResult>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "gkce_exam_cell_auth_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const storedToken = tokenStorage.get();
      const storedUser = localStorage.getItem(STORAGE_KEY);

      if (storedToken && storedUser) {
        try {
          // Verify JWT with backend
          const me = await api.auth.getMe();
          const parsed = JSON.parse(storedUser) as User;
          setUser({
            ...parsed,
            id: String(me.id),
            name: me.full_name,
            email: me.email,
            role: me.role,
          });
        } catch {
          // Token invalid or expired
          console.warn("Session token expired or unreachable, clearing auth.");
          tokenStorage.clear();
          localStorage.removeItem(STORAGE_KEY);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    }

    restoreSession();
  }, []);

  const loginWithCredentials = async (
    identifier: string,
    password: string
  ): Promise<AuthResult> => {
    setIsLoading(true);

    try {
      const res: ApiTokenResponse = await api.auth.login(identifier.trim(), password);

      tokenStorage.set(res.access_token);

      const authenticatedUser: User = {
        id: String(res.user_id),
        name: res.full_name,
        email: res.email,
        role: res.role,
        metadata: {
          rollNumber: res.role === "STUDENT" ? res.identifier : undefined,
          employeeId: res.role === "INVIGILATOR" ? res.identifier : undefined,
          designation: res.role === "ROOT" ? "Controller of Examinations" : undefined,
        },
      };

      setUser(authenticatedUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authenticatedUser));
      setIsLoading(false);

      return {
        success: true,
        role: res.role,
        user: authenticatedUser,
      };
    } catch (err: unknown) {
      setIsLoading(false);
      const errMsg = err instanceof Error ? err.message : "Authentication failed.";
      return {
        success: false,
        error: errMsg,
      };
    }
  };

  const logout = () => {
    tokenStorage.clear();
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const switchRole = (_newRole: UserRole) => {
    // In authentic authentication, role switching requires logging in as an account with that role
    logout();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isAuthenticated: !!user,
        isLoading,
        loginWithCredentials,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
