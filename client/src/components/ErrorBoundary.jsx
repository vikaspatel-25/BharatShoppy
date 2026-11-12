import { Component } from "react";
import { Home, RefreshCw } from "lucide-react";

/** Catches a render error so one broken page doesn't blank the whole app. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Page render error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="panel-root flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-md p-8 text-center">
          <p className="text-sm font-semibold text-stone-500">Error</p>
          <h1 className="mt-1 text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-stone-600">This page couldn’t be shown. Reloading usually fixes it.</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">
              <RefreshCw size={16} aria-hidden="true" /> Reload page
            </button>
            <a href="/" className="btn btn-secondary">
              <Home size={16} aria-hidden="true" /> Go to homepage
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
