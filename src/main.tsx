import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { migrateStorage } from '@/lib/storage/migrate';
import App from './App';
import './index.css';

async function bootstrap() {
  await migrateStorage();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AppErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
