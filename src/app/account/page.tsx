"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { digitsOnly } from "@/lib/phone";
import { usePinCity } from "@/lib/use-pin-city";
import { PinHint } from "@/components/pin-hint";
import type { AddressRow, ProfileRow } from "@/lib/supabase/database.types";

/**
 * Edit profile — the customer's own name, contact email, and delivery address.
 *
 * Client-side rather than a Server Function because everything here is the
 * signed-in user's own row: the browser client carries their session, and the
 * RLS policies on `profiles` and `addresses` ("owner only") are what authorise
 * the write. No server code needs to re-check who they are.
 *
 * The address is kept as the single default row in `public.addresses`, which
 * already had the table and the policy but no UI.
 */

const inputClass =
  "rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20 dark:bg-transparent";

type Status = { kind: "idle" | "saving" } | { kind: "saved" | "error"; message: string };

export default function AccountPage() {
  const { user, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const { pinCode, city, setCity, pinState, handlePinChange, seed } =
    usePinCity();

  const [addressId, setAddressId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Load the stored values once the session resolves. Both rows may be absent
  // — a customer who has never checked out has no address, and the profile
  // row can be missing if the signup trigger did not fire — so every field
  // falls back to what auth already knows.
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    // Everything, including the signed-out early exit, runs inside the async
    // callback: a setState in the effect body itself renders twice before the
    // first paint, which the lint rule rightly objects to.
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!user || !supabase) {
        if (!cancelled) setLoadingData(false);
        return;
      }

      const [profileResult, addressResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, phone, email")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("addresses")
          .select("id, user_id, full_name, phone, line1, city, pin_code, is_default")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const profile = profileResult.data as ProfileRow | null;
      const address = addressResult.data as AddressRow | null;
      const meta = user.user_metadata ?? {};

      setFullName(
        profile?.full_name ??
          ((meta.full_name ?? meta.name) as string | undefined) ??
          ""
      );
      setEmail(profile?.email ?? user.email ?? "");
      setPhone(
        digitsOnly(profile?.phone ?? user.phone ?? "").slice(-10)
      );

      if (address) {
        setAddressId(address.id);
        setLine1(address.line1);
        seed(address.pin_code, address.city);
      }

      setLoadingData(false);
    })();

    return () => {
      cancelled = true;
    };
    // seed is stable for the life of the hook; re-running on every render
    // would refetch on each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const addressFields = [line1, city, pinCode];
  const addressStarted = addressFields.some((value) => value.trim() !== "");
  const addressComplete =
    addressFields.every((value) => value.trim() !== "") &&
    /^[0-9]{6}$/.test(pinCode) &&
    phone.trim() !== "";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === "saving") return;

    const supabase = getSupabaseBrowserClient();
    if (!user || !supabase) {
      setStatus({ kind: "error", message: "You are not signed in." });
      return;
    }

    // The addresses table has every column NOT NULL, so a half-filled address
    // cannot be saved. Say so rather than letting Postgres reject it.
    if (addressStarted && !addressComplete) {
      setStatus({
        kind: "error",
        message:
          "Fill in the address, city, 6-digit PIN and phone number — or clear all of them to save just your details.",
      });
      return;
    }

    setStatus({ kind: "saving" });

    // UPDATE then INSERT, deliberately NOT upsert.
    //
    // public.profiles has no table-wide insert/update grant — that is the
    // escalation guard in 20260824000005, which grants back only
    // insert(id, full_name, phone, email) and update(full_name, phone, email)
    // so a customer can never write their own `role`. An upsert compiles to
    // INSERT ... ON CONFLICT DO UPDATE, whose update arm also touches `id`,
    // a column with no update privilege — Postgres rejects the whole
    // statement with "permission denied for table profiles" (42501).
    const details = {
      full_name: fullName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
    };

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update(details)
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    // No row came back: the signup trigger never created one, so make it now.
    let profileError = updateError;
    if (!updateError && !updated) {
      ({ error: profileError } = await supabase
        .from("profiles")
        .insert({ id: user.id, ...details }));
    }

    if (profileError) {
      console.error("profile save failed", profileError);
      setStatus({
        kind: "error",
        message: "We couldn’t save your details. Please try again.",
      });
      return;
    }

    if (addressComplete) {
      const row = {
        user_id: user.id,
        // The address needs a name and number of its own — the courier reads
        // these, not the account.
        full_name: fullName.trim() || "Customer",
        phone: phone.trim(),
        line1: line1.trim(),
        city: city.trim(),
        pin_code: pinCode,
        is_default: true,
      };

      // The id of a freshly inserted row has to be kept: saving twice in one
      // visit would otherwise insert a second default address, which the
      // one-default-per-user unique index rejects.
      let addressError = null;
      if (addressId) {
        ({ error: addressError } = await supabase
          .from("addresses")
          .update(row)
          .eq("id", addressId));
      } else {
        const inserted = await supabase
          .from("addresses")
          .insert(row)
          .select("id")
          .single();
        addressError = inserted.error;
        if (inserted.data) setAddressId((inserted.data as { id: string }).id);
      }

      if (addressError) {
        console.error("address save failed", addressError);
        setStatus({
          kind: "error",
          message: "Your details were saved, but the address was not.",
        });
        return;
      }
    }

    setStatus({ kind: "saved", message: "Saved." });
  }

  if (authLoading || loadingData) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <p className="text-zinc-500 dark:text-zinc-400">Loading your profile…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 px-4 py-16 sm:px-6">
        <h1 className="text-2xl font-semibold">Sign in to edit your profile</h1>
        <Link
          href="/"
          className="flex h-12 items-center justify-center rounded-full bg-black px-6 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
        >
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold">Edit profile</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        Used to fill in your checkout and to reach you about an order.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-8">
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-sm font-semibold">Your details</legend>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Full name
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Contact email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
            {/* Editing this cannot change how they sign in: the login email
                lives in auth.users and changing it needs a confirmation
                round-trip. Saying so here avoids a lockout scare. */}
            <span className="font-normal text-xs text-zinc-500 dark:text-zinc-400">
              Where order updates go. Your sign-in method does not change.
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Phone number
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]{10}"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(event) =>
                setPhone(digitsOnly(event.target.value).slice(0, 10))
              }
              className={inputClass}
            />
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-2 text-sm font-semibold">
            Delivery address
          </legend>

          <label className="flex flex-col gap-1 text-sm font-medium">
            Address
            <textarea
              rows={3}
              value={line1}
              onChange={(event) => setLine1(event.target.value)}
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium">
              PIN code
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="6-digit PIN"
                value={pinCode}
                onChange={(event) => handlePinChange(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              City
              <input
                type="text"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder={
                  pinState.status === "loading" ? "Looking up…" : undefined
                }
                className={inputClass}
              />
            </label>
          </div>

          <PinHint state={pinState} />
        </fieldset>

        {status.kind === "error" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {status.message}
          </p>
        )}
        {status.kind === "saved" && (
          <p role="status" className="text-sm font-medium text-emerald-600">
            {status.message}
          </p>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={status.kind === "saving"}
            className="flex h-12 items-center justify-center rounded-full bg-accent px-6 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {status.kind === "saving" ? "Saving…" : "Save changes"}
          </button>
          <Link
            href="/orders"
            className="text-sm font-medium text-accent hover:underline"
          >
            My orders
          </Link>
        </div>
      </form>
    </div>
  );
}
