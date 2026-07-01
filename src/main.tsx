import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import './i18n';
import { AccessibilityProvider } from './lib/accessibility';
import { AuthProvider } from './lib/auth';

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <AccessibilityProvider>
          <HashRouter>
            <App />
          </HashRouter>
        </AccessibilityProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
