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
import { DismantlePage } from '@/pages/DismantlePage';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';

function LegacyCleanRedirect() {
  const { class: classParam } = useParams<{ class: string }>();
  const location = useLocation();
  return <Navigate to={`/duel/${classParam ?? 'hunter'}${location.search}`} replace />;
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
      <Route path="/dismantle/:class" element={<DismantlePage />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="/auto-filters" element={<AutoFiltersPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
