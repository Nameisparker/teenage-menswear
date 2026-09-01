import type { PinLookup } from "@/lib/use-pin-city";

/**
 * The line under a PIN field that reports what the lookup found.
 *
 * A failed lookup is deliberately not an error style: nothing is blocked, the
 * city field is still there to type into.
 */
export function PinHint({ state }: { state: PinLookup }) {
  if (state.status === "idle") return null;

  return (
    <p
      className={`-mt-2 text-xs ${
        state.status === "found"
          ? "text-zinc-500 dark:text-zinc-400"
          : "text-amber-700 dark:text-amber-500"
      }`}
    >
      {state.status === "loading" && "Looking up PIN code…"}
      {state.status === "found" && state.place}
      {state.status === "notFound" &&
        "We couldn’t find that PIN code. Enter your city manually."}
      {state.status === "failed" &&
        "PIN lookup is unavailable right now. Enter your city manually."}
    </p>
  );
}
