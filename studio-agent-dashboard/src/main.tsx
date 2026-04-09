import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { PeriodProvider } from './hooks/usePeriod';
import { getMsalApp, msalEnabled } from './msalConfig';

if (typeof window !== 'undefined') {
  (window as any).__STUDIO_AGENT_ENV__ = {
    hubApiBase: import.meta.env.VITE_HUB_API_BASE ?? '',
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
    azureAdClientId: import.meta.env.VITE_AZURE_AD_CLIENT_ID ?? '',
    azureAdTenantId: import.meta.env.VITE_AZURE_AD_TENANT_ID ?? '',
    azureAdApiScope: import.meta.env.VITE_AZURE_AD_API_SCOPE ?? '',
    azureAdRedirectUri: import.meta.env.VITE_AZURE_AD_REDIRECT_URI ?? '',
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
  },
});

async function bootstrap() {
  if (msalEnabled) {
    await getMsalApp();
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <PeriodProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </PeriodProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

bootstrap();
