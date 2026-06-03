import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LOG_PREFIX } from '@/lib/storage/keys';
import { APP_TITLE } from '@/lib/site';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

class AppErrorBoundaryInner extends Component<
  Props & { t: (key: string, options?: { appName: string }) => string },
  State
> {
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
    const { t, children } = this.props;
    if (!error) return children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-surface text-white">
        <div className="max-w-md w-full border border-border rounded-xl bg-surface-2 p-6 space-y-4">
          <h1 className="text-xl font-bold text-danger">{t('boundary.title')}</h1>
          <p className="text-sm text-muted">{t('boundary.body', { appName: APP_TITLE })}</p>
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
              {t('boundary.reload')}
            </button>
            <Link
              to="/"
              className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-white/5"
              onClick={() => this.setState({ error: null })}
            >
              {t('boundary.goHome')}
            </Link>
          </div>
        </div>
      </div>
    );
  }
}

function AppErrorBoundaryWithI18n({ children }: Props) {
  const { t } = useTranslation('errors');
  const translate = (key: string, options?: { appName: string }) =>
    t(key as 'boundary.title', options);
  return <AppErrorBoundaryInner t={translate}>{children}</AppErrorBoundaryInner>;
}

export const AppErrorBoundary = AppErrorBoundaryWithI18n;
