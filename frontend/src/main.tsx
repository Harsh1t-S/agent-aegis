import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Brand fonts are self-hosted: the CSP in vercel.json allows only 'self' for
// styles and fonts, so a Google Fonts stylesheet is blocked in production.
// Keep the per-weight files: they carry unicode-range, so browsers fetch only
// the subsets a page needs. The latin-400.css style files carry none.
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import App from './App.tsx';
import { installDeploymentRecovery } from '@/lib/deployment-recovery';
import './index.css';

installDeploymentRecovery();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
