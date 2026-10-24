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
        <div style={{ fontSize: "2.5rem", lineHeight: 1 }}>⚠️</div>
        <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, fontFamily: "'Cinzel', serif", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Errore Imprevisto
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: "32rem",
            color: "#8E8E99",
            lineHeight: 1.6,
            fontSize: "0.95rem",
          }}
        >
          Si è verificato un errore imprevisto durante l'esecuzione del protocollo.
          Ricaricare la pagina di solito risolve il problema. Se persiste, contatta il supporto.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            cursor: "pointer",
            border: "none",
            borderRadius: "0.5rem",
            padding: "0.75rem 1.75rem",
            fontWeight: 700,
            fontSize: "0.95rem",
            background: "#C5A059",
            color: "#0A0A0C",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            boxShadow: "0 4px 16px rgba(197, 160, 89, 0.25)",
          }}
        >
          Ricarica
        </button>
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
