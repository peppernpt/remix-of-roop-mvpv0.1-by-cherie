import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Last-resort error boundary: a render error in one page must show a friendly
 * recovery screen instead of white-screening the whole app.
 */
class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[roop] render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="max-w-md w-full text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            ROOP
          </p>
          <h1 className="text-xl font-semibold mt-3">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mt-2">
            The page hit an unexpected error. Your bookings and data are safe — reloading usually
            fixes it.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 px-5 rounded-lg bg-foreground text-background text-sm font-medium"
            >
              Reload page
            </button>
            <a
              href="/"
              className="h-10 px-5 rounded-lg border border-border text-sm font-medium inline-flex items-center"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
