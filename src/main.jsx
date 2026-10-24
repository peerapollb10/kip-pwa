import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { KipProvider } from './context/KipContext.jsx';
import './lib/install.js'; // capture `beforeinstallprompt` before any page mounts
import './index.css';

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <KipProvider>
        <App />
      </KipProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
