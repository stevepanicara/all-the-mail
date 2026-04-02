import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

const ICONS = { success: CheckCircle2, error: AlertCircle, info: Info };

const Toast = ({ message, type = 'error', onDismiss }) => {
  useEffect(() => {
    if (type !== 'error') {
      const timer = setTimeout(onDismiss, 5000);
      return () => clearTimeout(timer);
    }
  }, [type, onDismiss]);

  if (!message) return null;
  const Icon = ICONS[type] || AlertCircle;

  return (
    <div className={`toast toast--${type}`} role="alert">
      <Icon size={16} style={{ flexShrink: 0 }} />
      <span>{message}</span>
      <button onClick={onDismiss} className="toast-x" title="Dismiss"><X size={14} /></button>
    </div>
  );
};

export default Toast;
