"use client";

import { useRef, useState } from "react";

/**
 * PIN code -> city, against India Post's public directory.
 *
 * No key, no quota, CORS-enabled — and no SLA either, which is why every
 * failure path here leaves the city field editable rather than blocking the
 * form it sits in.
 *
 * Shared by checkout and the account page so the two cannot drift: the same
 * digit handling, the same stale-response guard, the same wording.
 */
const PIN_LOOKUP_URL = "https://api.postalpincode.in/pincode";

type PinApiResponse = {
  Status: string;
  PostOffice: { Name: string; District: string; State: string }[] | null;
}[];

export type PinLookup =
  | { status: "idle" | "loading" | "notFound" | "failed" }
  | { status: "found"; place: string };

export function usePinCity() {
  const [pinCode, setPinCode] = useState("");
  const [city, setCity] = useState("");
  const [pinState, setPinState] = useState<PinLookup>({ status: "idle" });

  // Someone correcting a typo fires a second lookup while the first is still
  // in flight; without this the slower response wins and overwrites the city
  // with the old PIN's district.
  const pinRequest = useRef<AbortController | null>(null);

  async function lookupPin(pin: string) {
    pinRequest.current?.abort();
    const request = new AbortController();
    pinRequest.current = request;
    setPinState({ status: "loading" });

    try {
      const response = await fetch(`${PIN_LOOKUP_URL}/${pin}`, {
        signal: request.signal,
      });
      const body = (await response.json()) as PinApiResponse;
      const office = body?.[0]?.PostOffice?.[0];

      if (!office) {
        setPinState({ status: "notFound" });
        return;
      }

      setCity(office.District);
      setPinState({
        status: "found",
        place: `${office.District}, ${office.State}`,
      });
    } catch {
      // An aborted request is a newer lookup taking over, not a failure —
      // leave whatever that one is about to set.
      if (request.signal.aborted) return;
      setPinState({ status: "failed" });
    }
  }

  function handlePinChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setPinCode(digits);
    if (digits.length === 6) {
      void lookupPin(digits);
    } else {
      pinRequest.current?.abort();
      setPinState({ status: "idle" });
    }
  }

  /** Seeds both fields from stored data without triggering a lookup. */
  function seed(pin: string, savedCity: string) {
    setPinCode(pin);
    setCity(savedCity);
    setPinState({ status: "idle" });
  }

  return {
    pinCode,
    city,
    setCity,
    pinState,
    handlePinChange,
    seed,
  };
}
