import './i18n';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './app/App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
