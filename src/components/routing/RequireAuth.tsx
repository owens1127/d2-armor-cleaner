import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getBungieAccessToken } from '@/lib/bungie/client';
import { hasActiveSession, restoreMembership } from '@/lib/bungie/loadVault';
import { useAuthStore } from '@/stores';

/** Redirect signed-out users; show a short wait while session restore runs. */
export function RequireAuth() {
  const { t } = useTranslation(['common', 'onboarding']);
  const location = useLocation();
  const { membership, setMembership } = useAuthStore();

  useEffect(() => {
    if (membership) return;
    const restored = restoreMembership();
    if (restored && getBungieAccessToken()) {
      setMembership(restored);
    }
  }, [membership, setMembership]);

  if (!membership) {
    const mayRestore = Boolean(getBungieAccessToken()) || hasActiveSession();
    if (mayRestore) {
      return (
        <div className="py-20 text-center">
          <p className="text-lg mb-2">{t('onboarding:restoringSession')}</p>
          <p className="text-sm text-muted">{t('pleaseWait')}</p>
        </div>
      );
    }
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
