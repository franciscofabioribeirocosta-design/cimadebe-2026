import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { registrarServiceWorker } from './services/webPushService';

// Polyfill global robusto para prevenir TypeError: canvas.getBoundingClientRect is not a function em html2canvas
if (typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
  if (!HTMLCanvasElement.prototype.getBoundingClientRect) {
    HTMLCanvasElement.prototype.getBoundingClientRect = function () {
      return {
        width: this.width || 0,
        height: this.height || 0,
        top: 0,
        left: 0,
        bottom: this.height || 0,
        right: this.width || 0,
        x: 0,
        y: 0,
        toJSON: () => {}
      } as DOMRect;
    };
  }
}

// Registro automático do Service Worker para suporte a PUSH Notifications e Offline Cache
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registrarServiceWorker().catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
