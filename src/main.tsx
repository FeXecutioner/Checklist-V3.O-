import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initPWAUpdates } from './utils/pwaUpdate';

// Initialize proactive PWA auto-update polling across desktop and mobile devices
initPWAUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
