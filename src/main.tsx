import './i18n';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import { EntryApp } from './EntryApp';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <EntryApp />
  </HelmetProvider>
);
