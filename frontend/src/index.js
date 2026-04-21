import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './brand.css';
import './index.css';
import App from './App';
import Landing from './Landing';
import Privacy from './Privacy';
import Terms from './Terms';

// Suppress benign ResizeObserver loop errors from react-resizable-panels
const ro = window.addEventListener;
window.addEventListener = function(type, listener, options) {
  if (type === 'error') {
    const wrapped = function(event) {
      if (event.message?.includes?.('ResizeObserver loop')) {
        event.stopImmediatePropagation();
        return;
      }
      return listener.call(this, event);
    };
    return ro.call(this, type, wrapped, options);
  }
  return ro.call(this, type, listener, options);
};

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<App />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
