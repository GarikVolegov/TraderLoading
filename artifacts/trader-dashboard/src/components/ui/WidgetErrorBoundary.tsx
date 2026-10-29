import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureError } from "@/lib/observability";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  title?: string;
  children: ReactNode;
  fallbackHeight?: string | number;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Granular error boundary for individual dashboard and cockpit widgets.
 * Prevents a single isolated widget failure from black-screening the entire page.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[WidgetErrorBoundary] Error in widget "${this.props.title || "unnamed"}":`, error, info.componentStack);
    captureError(error, { widget: this.props.title, componentStack: info.componentStack });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { title = "Modulo Operativo", fallbackHeight = "160px" } = this.props;

    return (
      <div
        role="alert"
        className="w-full rounded-xl border border-[#C5A059]/20 bg-[#07080b] p-4 flex flex-col items-center justify-center text-center gap-2.5 transition-all"
        style={{ minHeight: fallbackHeight }}
      >
        <div className="w-8 h-8 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/30 flex items-center justify-center text-[#ef4444]">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#F4F4F6]">
            {title} Non Disponibile
          </h4>
          <p className="text-[11px] font-mono text-[#94a3b8] mt-0.5 max-w-xs">
            Si è verificato un errore imprevisto nel caricamento dei dati di questo modulo.
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#C5A059]/15 border border-[#C5A059]/40 hover:bg-[#C5A059]/25 text-[#E8C56A] text-[11px] font-mono font-bold tracking-wider uppercase transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Riprova Modulo</span>
        </button>
      </div>
    );
  }
}
