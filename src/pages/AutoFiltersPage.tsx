import { Navigate } from 'react-router-dom';
import { AutoFilterRulesSection } from '@/components/AutoFilterRulesSection';
import { Layout } from '@/components/Layout';
import { useScrollToLocationHash } from '@/lib/nav/useScrollToLocationHash';
import { useAuthStore } from '@/stores';

export function AutoFiltersPage() {
  useScrollToLocationHash();
  const { membership } = useAuthStore();

  if (!membership) return <Navigate to="/" replace />;

  return (
    <Layout>
      <h1 className="text-2xl font-bold mb-2">Auto filters</h1>
      <p className="text-muted text-sm mb-6 max-w-xl">
        Queue junk tags automatically when your vault loads or refreshes. Keeps and favorites are
        never auto-tagged.
      </p>
      <AutoFilterRulesSection />
    </Layout>
  );
}
