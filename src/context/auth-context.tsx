"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { clearPendingCartAdd } from "@/lib/pending-cart";

type AuthResult = { error: string | null };

type AuthContextValue = {
  user: User | null;
  /** True until the initial session check settles — gate UI on this. */
  loading: boolean;
  /** False when Supabase env vars are missing; the modal explains the setup. */
  configured: boolean;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  sendOtp: (phone: string) => Promise<AuthResult>;
  verifyOtp: (phone: string, token: string) => Promise<AuthResult>;
  signInWithGoogle: (redirectPath?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Supabase errors are developer-facing; map the common ones to plain English. */
function friendlyError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid") && lower.includes("token")) {
    return "That code is not right. Check it and try again.";
  }
  if (lower.includes("expired")) {
    return "That code has expired. Request a new one.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (lower.includes("sms") || lower.includes("provider")) {
    return "SMS sending is not set up on this store yet.";
  }
  // Supabase says "Phone logins are disabled" / "Unsupported provider" when the
  // provider is switched off in the dashboard.
  if (
    lower.includes("not enabled") ||
    lower.includes("disabled") ||
    lower.includes("unsupported")
  ) {
    return "That sign-in method is not enabled for this store yet.";
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    // INITIAL_SESSION always fires, so this doubles as the initial load.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      // Sign-in succeeded (or a session was restored) — dismiss the modal.
      if (session?.user) setAuthOpen(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const openAuth = useCallback(() => setAuthOpen(true), []);

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    // The user backed out, so drop the item they were trying to add.
    clearPendingCartAdd();
  }, []);

  const sendOtp = useCallback(async (phone: string): Promise<AuthResult> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { error: "Sign-in is not configured yet." };

    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error: error ? friendlyError(error.message) : null };
  }, []);

  const verifyOtp = useCallback(
    async (phone: string, token: string): Promise<AuthResult> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Sign-in is not configured yet." };

      const { error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
      return { error: error ? friendlyError(error.message) : null };
    },
    []
  );

  const signInWithGoogle = useCallback(
    async (redirectPath?: string): Promise<AuthResult> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Sign-in is not configured yet." };

      const next = redirectPath ?? window.location.pathname;
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", next);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      });
      return { error: error ? friendlyError(error.message) : null };
    },
    []
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured: isSupabaseConfigured,
      authOpen,
      openAuth,
      closeAuth,
      sendOtp,
      verifyOtp,
      signInWithGoogle,
      signOut,
    }),
    [
      user,
      loading,
      authOpen,
      openAuth,
      closeAuth,
      sendOtp,
      verifyOtp,
      signInWithGoogle,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

/** Display name for the header: Google name, else phone, else email. */
export function displayNameFor(user: User) {
  const meta = user.user_metadata ?? {};
  const name = (meta.full_name ?? meta.name) as string | undefined;
  return name || user.phone || user.email || "Account";
}
