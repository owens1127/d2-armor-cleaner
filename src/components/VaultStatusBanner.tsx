import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { settingsPath } from '@/lib/nav';
import { vaultErrorHint } from '@/lib/vault/errors';
import { useSessionStore, useVaultStore } from '@/stores';

function isAuthVaultError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('invalid_grant')
  );
}

export function VaultStatusBanner() {
  const { t } = useTranslation(['vault', 'common']);
  const activeNavClass = useSessionStore((s) => s.activeNavClass);
  const { vaultError, vaultLoading, vaultRefreshing, clearVaultError, loadLiveVault } =
    useVaultStore();

  if (!vaultError) return null;

  const hint = vaultErrorHint(vaultError);

  return (
    <div className="bg-danger/10 border-b border-danger/30 px-4 py-2">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <span className="text-danger">{vaultError}</span>
          {hint && <p className="text-xs text-muted mt-0.5">{hint}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={vaultLoading || vaultRefreshing}
            onClick={() => {
              clearVaultError();
              loadLiveVault({ force: true });
            }}
            className="text-xs px-2 py-1 rounded border border-danger/40 hover:bg-danger/10 disabled:opacity-50"
          >
            {vaultLoading || vaultRefreshing ? t('common:retrying') : t('vault:retryVaultLoad')}
          </button>
          {isAuthVaultError(vaultError) && (
            <Link
              to={settingsPath(activeNavClass)}
              className="text-xs px-2 py-1 rounded border border-border hover:bg-white/5"
            >
              {t('vault:signOutInSettings')}
            </Link>
          )}
          <button
            type="button"
            onClick={clearVaultError}
            className="text-xs px-2 py-1 rounded text-muted hover:text-white"
          >
            {t('vault:dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
