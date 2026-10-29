import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureError } from "../lib/observability";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Without it, any throw during render (most commonly
 * ClerkProvider rejecting a missing/invalid publishable key on a misconfigured
 * deploy) unmounts the whole tree and leaves only the near-black <body>
 * background — the "tutto nero" blank screen. This renders a readable, self
 * contained fallback instead, using inline styles so it survives even if the
 * stylesheet failed to load.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a raw console error so the failure is diagnosable from any browser's
    // devtools even in production builds where overlays are stripped.
    console.error("App crashed:", error, info.componentStack);
    // Report to Sentry (no-op unless VITE_SENTRY_DSN is configured) so production
    // render crashes are visible to the team, not just whoever opens devtools.
    captureError(error, { componentStack: info.componentStack });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <div
        role="alert"
        data-root-error-boundary
        style={{
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "1.5rem",
          background: "#0A0A0C",
          color: "#F4F4F6",
          fontFamily:
            "'Space Grotesk', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>🏛️</div>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, fontFamily: "'Cinzel', serif", letterSpacing: "0.04em", textTransform: "uppercase", color: "#C5A059" }}>
          Anomalia al Varco
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: "32rem",
            color: "#94a3b8",
            lineHeight: 1.6,
            fontSize: "0.95rem",
          }}
        >
          L'integrità del protocollo ha intercettato un'eccezione imprevista.
          Puoi riavviare la sessione o eseguire l'auto-curazione per spazzare lo stato volatile corrotto.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.75rem 1.5rem",
              fontWeight: 700,
              fontSize: "0.9rem",
              background: "#C5A059",
              color: "#07080b",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              boxShadow: "0 4px 16px rgba(197, 160, 89, 0.25)",
            }}
          >
            Ricarica Sessione
          </button>
          <button
            type="button"
            onClick={() => {
              try {
                // Self-healing: clear transient cache without touching credentials
                sessionStorage.clear();
                for (const key of Object.keys(localStorage)) {
                  if (key.startsWith("REACT_QUERY_") || key.startsWith("aureus_cache_") || key.startsWith("limen_cache_")) {
                    localStorage.removeItem(key);
                  }
                }
              } catch {
                // ignore storage access errors
              }
              window.location.href = "/";
            }}
            style={{
              cursor: "pointer",
              border: "1px solid rgba(197, 160, 89, 0.4)",
              borderRadius: "0.5rem",
              padding: "0.75rem 1.5rem",
              fontWeight: 700,
              fontSize: "0.9rem",
              background: "rgba(197, 160, 89, 0.1)",
              color: "#E8C56A",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Auto-Curazione & Purga Cache
          </button>
        </div>
        {isDev && (
          <pre
            style={{
              maxWidth: "min(48rem, 90vw)",
              overflow: "auto",
              textAlign: "left",
              background: "#141418",
              border: "1px solid #26262E",
              borderRadius: "0.5rem",
              padding: "1rem",
              fontSize: "0.75rem",
              color: "#fca5a5",
            }}
          >
            {error.stack ?? error.message}
          </pre>
        )}
      </div>
    );
  }
}
