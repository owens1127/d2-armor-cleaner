import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';
import { i18n, initManifestLocaleSync } from '@/i18n';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { migrateStorage } from '@/lib/storage/migrate';
import { APP_TITLE } from '@/lib/site';
import App from './App';
import './index.css';

async function bootstrap() {
  document.title = APP_TITLE;
  await migrateStorage();
  initManifestLocaleSync();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <AppErrorBoundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AppErrorBoundary>
      </I18nextProvider>
    </StrictMode>,
  );
}

void bootstrap();
