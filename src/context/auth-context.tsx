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

export type UserRole = "customer" | "admin";

type AuthContextValue = {
  user: User | null;
  /**
   * Role from public.profiles. Null until it has been fetched — check
   * `loading` before treating null as "not an admin".
   */
  role: UserRole | null;
  isAdmin: boolean;
  /** True until the initial session check settles — gate UI on this. */
  loading: boolean;
  /** False when Supabase env vars are missing; the modal explains the setup. */
  configured: boolean;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  sendOtp: (phone: string) => Promise<AuthResult>;
  verifyOtp: (phone: string, token: string) => Promise<AuthResult>;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: (redirectPath?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Supabase errors are developer-facing; map the common ones to plain English. */
function friendlyError(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "That email or password is not right.";
  }
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
  const [fetchedRole, setFetchedRole] = useState<{
    userId: string;
    role: UserRole;
  } | null>(null);
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

  // Role lives in the database, not the JWT, so it needs its own fetch. RLS
  // limits this select to the caller's own profile row.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // Nothing to fetch when signed out — `role` below already reads as null.
    if (!supabase || !user) return;

    let cancelled = false;
    void supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        // Default to the least privileged role if the row is missing.
        setFetchedRole({
          userId: user.id,
          role: (data?.role as UserRole | undefined) ?? "customer",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Derived, not stored: a fetched role belongs to the account it was fetched
  // for. Reading it back through the current user id means signing out — or
  // switching accounts — cannot leave the previous account’s role in place
  // while the next fetch is still in flight.
  const role =
    user && fetchedRole?.userId === user.id ? fetchedRole.role : null;

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

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return { error: "Sign-in is not configured yet." };

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
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
      role,
      isAdmin: role === "admin",
      loading,
      configured: isSupabaseConfigured,
      authOpen,
      openAuth,
      closeAuth,
      sendOtp,
      verifyOtp,
      signInWithEmail,
      signInWithGoogle,
      signOut,
    }),
    [
      user,
      role,
      loading,
      authOpen,
      openAuth,
      closeAuth,
      sendOtp,
      verifyOtp,
      signInWithEmail,
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

/** Provider profile picture, when the sign-in method supplied one. */
export function avatarUrlFor(user: User) {
  const meta = user.user_metadata ?? {};
  const url = (meta.avatar_url ?? meta.picture) as string | undefined;
  return url || null;
}

/** Up to two initials, for the avatar fallback when there is no picture. */
export function initialsFor(user: User) {
  const words = displayNameFor(user).trim().split(/\s+/).filter(Boolean);
  // A phone number or email has no words to work with, so take one character.
  if (words.length < 2) return (words[0]?.[0] ?? "?").toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
