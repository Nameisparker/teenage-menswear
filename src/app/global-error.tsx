"use client";

/**
 * Last line of defence: an error thrown by the root layout itself.
 *
 * This is not hypothetical here. The layout awaits getStoreSettings() and
 * getCategories() to render the header, and both throw when the catalog is
 * unreachable — so a database outage breaks the layout, and error.tsx cannot
 * help because it renders *inside* that layout. Only global-error.tsx is
 * mounted above it, which is why it has to supply its own <html> and <body>.
 *
 * Deliberately self-contained: no fonts, no providers, no database. Everything
 * this file might import is exactly what could be broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ededed",
          fontFamily: "Arial, Helvetica, sans-serif",
          padding: "2rem",
        }}
      >
        <main style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 0.75rem" }}>
            The store is temporarily unavailable
          </h1>
          <p style={{ color: "#a1a1aa", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
            We&apos;re having trouble reaching our systems. Please try again in
            a few moments.
          </p>
          {error.digest && (
            <p
              style={{
                color: "#71717a",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                margin: "0 0 1.5rem",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#d97706",
              color: "#fff",
              border: 0,
              borderRadius: "9999px",
              padding: "0.75rem 1.5rem",
              font: "inherit",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
