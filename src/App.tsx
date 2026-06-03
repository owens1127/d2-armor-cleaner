import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AppBootstrap } from '@/components/AppBootstrap';
import { PageFallback } from '@/components/PageFallback';
import { RequireAuth } from '@/components/routing/RequireAuth';
import { RequireOnboardingComplete } from '@/components/routing/RequireOnboardingComplete';
import { HomePage } from '@/pages/HomePage';
import { OAuthCallbackPage } from '@/pages/OAuthCallbackPage';
import { BROWSE_REDUNDANT_QUERY } from '@/lib/nav';
import { settingsPath } from '@/lib/nav';
import { useSessionStore } from '@/stores';

const RulesOnboardingPage = lazy(() =>
  import('@/pages/RulesOnboardingPage').then((m) => ({ default: m.RulesOnboardingPage })),
);
const InventorySnapshotPage = lazy(() =>
  import('@/pages/InventorySnapshotPage').then((m) => ({ default: m.InventorySnapshotPage })),
);
const CalibratePage = lazy(() =>
  import('@/pages/CalibratePage').then((m) => ({ default: m.CalibratePage })),
);
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const DuelPage = lazy(() =>
  import('@/pages/DuelPage').then((m) => ({ default: m.DuelPage })),
);
const ReviewPage = lazy(() =>
  import('@/pages/ReviewPage').then((m) => ({ default: m.ReviewPage })),
);
const AutoFiltersPage = lazy(() =>
  import('@/pages/AutoFiltersPage').then((m) => ({ default: m.AutoFiltersPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const BrowsePage = lazy(() =>
  import('@/pages/BrowsePage').then((m) => ({ default: m.BrowsePage })),
);
const BuildPage = lazy(() =>
  import('@/pages/BuildPage').then((m) => ({ default: m.BuildPage })),
);

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

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
        <Route element={<RequireAuth />}>
          <Route
            path="/onboarding/rules"
            element={
              <LazyPage>
                <RulesOnboardingPage />
              </LazyPage>
            }
          />
          <Route
            path="/onboarding/inventory"
            element={
              <LazyPage>
                <InventorySnapshotPage />
              </LazyPage>
            }
          />
          <Route
            path="/onboarding/calibrate"
            element={
              <LazyPage>
                <CalibratePage />
              </LazyPage>
            }
          />
          <Route element={<RequireOnboardingComplete />}>
            <Route
              path="/dashboard/:class"
              element={
                <LazyPage>
                  <DashboardPage />
                </LazyPage>
              }
            />
            <Route
              path="/duel/:class"
              element={
                <LazyPage>
                  <DuelPage />
                </LazyPage>
              }
            />
            <Route path="/clean/:class" element={<LegacyCleanRedirect />} />
            <Route
              path="/browse/:class"
              element={
                <LazyPage>
                  <BrowsePage />
                </LazyPage>
              }
            />
            <Route
              path="/combos/:class"
              element={
                <LazyPage>
                  <BuildPage />
                </LazyPage>
              }
            />
            <Route path="/build/:class" element={<LegacyBuildRedirect />} />
            <Route path="/dismantle/:class" element={<LegacyDismantleRedirect />} />
            <Route
              path="/review"
              element={
                <LazyPage>
                  <ReviewPage />
                </LazyPage>
              }
            />
            <Route
              path="/auto-filters"
              element={
                <LazyPage>
                  <AutoFiltersPage />
                </LazyPage>
              }
            />
            <Route path="/settings" element={<SettingsRedirect />} />
            <Route
              path="/settings/:class"
              element={
                <LazyPage>
                  <SettingsPage />
                </LazyPage>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
