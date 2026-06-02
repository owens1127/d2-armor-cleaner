import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LOG_PREFIX } from '@/lib/storage/keys';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error(`${LOG_PREFIX} UI error`, error, info.componentStack);
    }
  }

  private reload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface text-white">
        <div className="max-w-md w-full border border-border rounded-xl bg-surface-2 p-6 space-y-4">
          <h1 className="text-xl font-bold text-danger">Something went wrong</h1>
          <p className="text-sm text-muted">
            D2 Armor Cleaner hit an unexpected error. Your preferences and queued tags in local
            storage are usually unaffected.
          </p>
          {import.meta.env.DEV && (
            <pre className="text-xs text-muted bg-surface border border-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
              {error.message}
            </pre>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.reload}
              className="px-4 py-2 rounded-lg bg-accent text-surface font-medium text-sm"
            >
              Reload app
            </button>
            <Link
              to="/"
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-white/5"
              onClick={() => this.setState({ error: null })}
            >
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
