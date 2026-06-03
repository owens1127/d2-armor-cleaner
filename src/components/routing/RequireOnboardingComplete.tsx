import { Navigate, Outlet } from 'react-router-dom';
import {
  getOnboardingResumePath,
  needsOnboardingRedirect,
} from '@/lib/onboarding/storage';

/** Send incomplete onboarding users to the correct resume step. */
export function RequireOnboardingComplete() {
  if (needsOnboardingRedirect()) {
    return <Navigate to={getOnboardingResumePath(false)} replace />;
  }
  return <Outlet />;
}
