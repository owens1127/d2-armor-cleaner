import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AppBootstrap } from '@/components/AppBootstrap';
import { HomePage } from '@/pages/HomePage';
import { RulesOnboardingPage } from '@/pages/RulesOnboardingPage';
import { InventorySnapshotPage } from '@/pages/InventorySnapshotPage';
import { CalibratePage } from '@/pages/CalibratePage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DuelPage } from '@/pages/DuelPage';
import { ReviewPage } from '@/pages/ReviewPage';
import { AutoFiltersPage } from '@/pages/AutoFiltersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { BrowsePage } from '@/pages/BrowsePage';
import { BuildPage } from '@/pages/BuildPage';
import { BROWSE_REDUNDANT_QUERY } from '@/lib/nav';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { settingsPath } from '@/lib/nav';
import { useSessionStore } from '@/stores';

function LegacyCleanRedirect() {
  const { class: classParam } = useParams<{ class: string }>();
  const location = useLocation();
  return <Navigate to={`/duel/${classParam ?? 'hunter'}${location.search}`} replace />;
}

function SettingsRedirect() {
  const activeNavClass = useSessionStore((s) => s.activeNavClass);
  return <Navigate to={settingsPath(activeNavClass)} replace />;
}

function LegacyBuildRedirect() {
  const { class: classParam } = useParams<{ class: string }>();
  const location = useLocation();
  const hash = location.hash === '#desired-builds' ? '#combos' : location.hash;
  return (
    <Navigate
      to={`/combos/${classParam ?? 'hunter'}${hash}${location.search}`}
      replace
    />
  );
}

function LegacyDismantleRedirect() {
  const { class: classParam } = useParams<{ class: string }>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set(BROWSE_REDUNDANT_QUERY, '1');
  const query = params.toString();
  return (
    <Navigate to={`/browse/${classParam ?? 'hunter'}?${query}`} replace />
  );
}

export default function App() {
  return (
    <>
      <AppBootstrap />
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/home" element={<HomePage />} />
      <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
      <Route path="/onboarding/rules" element={<RulesOnboardingPage />} />
      <Route path="/onboarding/inventory" element={<InventorySnapshotPage />} />
      <Route path="/onboarding/calibrate" element={<CalibratePage />} />
      <Route path="/dashboard/:class" element={<DashboardPage />} />
      <Route path="/duel/:class" element={<DuelPage />} />
      <Route path="/clean/:class" element={<LegacyCleanRedirect />} />
      <Route path="/browse/:class" element={<BrowsePage />} />
      <Route path="/combos/:class" element={<BuildPage />} />
      <Route path="/build/:class" element={<LegacyBuildRedirect />} />
      <Route path="/dismantle/:class" element={<LegacyDismantleRedirect />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="/auto-filters" element={<AutoFiltersPage />} />
      <Route path="/settings" element={<SettingsRedirect />} />
      <Route path="/settings/:class" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
