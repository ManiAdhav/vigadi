import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const shouldReload = window.confirm(
      'A new version of Vígadi is available. Reload now to get the latest changes?'
    );
    if (shouldReload) updateSW(true);
  },
  onOfflineReady() {
    console.info('[Vígadi] App ready to work offline');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
