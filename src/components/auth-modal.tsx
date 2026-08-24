"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  DEFAULT_DIAL_CODE,
  DIAL_CODES,
  digitsOnly,
  formatPhoneForDisplay,
  isValidNationalNumber,
  toE164,
} from "@/lib/phone";

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

/**
 * Mounts the dialog only while it is open, so every open starts from a clean
 * slate without a reset effect.
 */
export function AuthModal() {
  const { authOpen } = useAuth();
  if (!authOpen) return null;
  return <AuthDialog />;
}

function AuthDialog() {
  const {
    closeAuth,
    configured,
    sendOtp,
    verifyOtp,
    signInWithEmail,
    signInWithGoogle,
  } = useAuth();

  const [step, setStep] = useState<"phone" | "otp" | "email">("phone");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL_CODE);
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const e164 = toE164(dialCode, national);
  const phoneValid = isValidNationalNumber(dialCode, national);

  // Resend cooldown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  // Escape to dismiss, and lock the page scrolling behind the modal.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAuth();
    }
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeAuth]);

  async function handleSendOtp(isResend = false) {
    if (!phoneValid || busy) return;
    setBusy(true);
    setError(null);

    const { error: sendError } = await sendOtp(e164);
    setBusy(false);

    if (sendError) {
      setError(sendError);
      return;
    }
    if (!isResend) setStep("otp");
    setCode("");
    setResendIn(RESEND_SECONDS);
  }

  async function handleVerify() {
    if (code.length !== OTP_LENGTH || busy) return;
    setBusy(true);
    setError(null);

    const { error: verifyError } = await verifyOtp(e164, code);
    // On success the provider closes this modal, so only failure needs handling.
    if (verifyError) {
      setError(verifyError);
      setBusy(false);
      setCode("");
    }
  }

  async function handleEmail() {
    if (busy || !email || !password) return;
    setBusy(true);
    setError(null);

    const { error: emailError } = await signInWithEmail(email, password);
    // On success the provider closes this modal, so only failure needs handling.
    if (emailError) {
      setError(emailError);
      setBusy(false);
    }
  }

  async function handleGoogle() {
    if (busy) return;
    setBusy(true);
    setError(null);

    const { error: googleError } = await signInWithGoogle();
    // Success navigates away to Google, so there is nothing to do there.
    if (googleError) {
      setError(googleError);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeAuth();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="w-full max-w-sm rounded-t-2xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15 sm:rounded-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="auth-modal-title" className="text-lg font-semibold">
              {step === "otp"
                ? "Enter the code"
                : step === "email"
                  ? "Sign in with email"
                  : "Sign in to add to cart"}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {step === "otp"
                ? `Sent to ${formatPhoneForDisplay(e164)}`
                : "We keep your cart and orders tied to your account."}
            </p>
          </div>
          <button
            type="button"
            onClick={closeAuth}
            aria-label="Close sign in"
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {!configured && (
          <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            Sign-in is not configured. Add{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="font-mono">.env.local</code>, then restart the dev
            server.
          </p>
        )}

        {step === "phone" ? (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy || !configured}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-black/15 font-medium transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
              or
              <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />
            </div>

            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSendOtp();
              }}
            >
              <label htmlFor="auth-phone" className="text-sm font-medium">
                Mobile number
              </label>
              <div className="flex gap-2">
                <select
                  aria-label="Country dial code"
                  value={dialCode}
                  onChange={(event) => setDialCode(event.target.value)}
                  className="rounded-md border border-black/15 bg-transparent px-2 py-2 text-sm dark:border-white/20"
                >
                  {DIAL_CODES.map((entry) => (
                    <option
                      key={entry.code}
                      value={entry.code}
                      className="text-black"
                    >
                      {entry.label}
                    </option>
                  ))}
                </select>
                <input
                  id="auth-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  autoFocus
                  placeholder="93846 26894"
                  value={national}
                  onChange={(event) => {
                    setNational(digitsOnly(event.target.value).slice(0, 14));
                    setError(null);
                  }}
                  className="min-w-0 flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
                />
              </div>

              {error && <ErrorText>{error}</ErrorText>}

              <button
                type="submit"
                disabled={!phoneValid || busy || !configured}
                className="mt-1 flex h-12 w-full items-center justify-center rounded-full bg-accent font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Sending..." : "Send code"}
              </button>
            </form>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                setError(null);
              }}
              className="text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Use email and password instead
            </button>
          </div>
        ) : step === "email" ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleEmail();
            }}
          >
            <label htmlFor="auth-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
              }}
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
            />

            <label htmlFor="auth-password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
              }}
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
            />

            {error && <ErrorText>{error}</ErrorText>}

            <button
              type="submit"
              disabled={busy || !configured || !email || !password}
              className="mt-1 flex h-12 w-full items-center justify-center rounded-full bg-accent font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError(null);
              }}
              className="text-sm text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Back to other sign-in options
            </button>
          </form>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleVerify();
            }}
          >
            <label htmlFor="auth-otp" className="text-sm font-medium">
              {OTP_LENGTH}-digit code
            </label>
            <input
              id="auth-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="------"
              value={code}
              onChange={(event) => {
                setCode(digitsOnly(event.target.value).slice(0, OTP_LENGTH));
                setError(null);
              }}
              className="rounded-md border border-black/15 bg-transparent px-3 py-2 text-center text-lg tracking-[0.5em] dark:border-white/20"
            />

            {error && <ErrorText>{error}</ErrorText>}

            <button
              type="submit"
              disabled={code.length !== OTP_LENGTH || busy}
              className="mt-1 flex h-12 w-full items-center justify-center rounded-full bg-accent font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Verifying..." : "Verify & continue"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setError(null);
                }}
                className="text-zinc-600 underline-offset-2 hover:underline dark:text-zinc-400"
              >
                Change number
              </button>
              <button
                type="button"
                onClick={() => void handleSendOtp(true)}
                disabled={resendIn > 0 || busy}
                className="text-accent underline-offset-2 hover:underline disabled:text-zinc-500 disabled:no-underline"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {children}
    </p>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 18 18" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.34A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.09l3.01-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
