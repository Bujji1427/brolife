import React, { useState, useEffect, useRef, createContext, useContext } from 'react';

// Toast Context for global notification management
const ToastContext = createContext();

// Toast Provider Component
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const addToast = (toast) => {
    const id = ++toastIdRef.current;
    const newToast = {
      id,
      timestamp: Date.now(),
      ...toast,
      // Set defaults
      type: toast.type || 'info',
      duration: toast.duration !== undefined ? toast.duration : (toast.type === 'error' ? 8000 : 5000),
      persistent: toast.persistent || false,
      action: toast.action || null
    };

    setToasts(prev => [...prev, newToast]);

    // Auto-remove if not persistent
    if (!newToast.persistent && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }

    return id;
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  const clearToasts = () => {
    setToasts([]);
  };

  const updateToast = (id, updates) => {
    setToasts(prev => prev.map(toast =>
      toast.id === id ? { ...toast, ...updates } : toast
    ));
  };

  // Convenience methods
  const success = (message, options = {}) => addToast({ type: 'success', message, ...options });
  const error = (message, options = {}) => addToast({ type: 'error', message, ...options });
  const warning = (message, options = {}) => addToast({ type: 'warning', message, ...options });
  const info = (message, options = {}) => addToast({ type: 'info', message, ...options });

  return (
    <ToastContext.Provider value={{
      toasts,
      addToast,
      removeToast,
      clearToasts,
      updateToast,
      success,
      error,
      warning,
      info
    }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

// Hook for using toast notifications
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Individual Toast Component
const Toast = ({ toast, onRemove }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const timeoutRef = useRef(null);
  const progressRef = useRef(null);

  useEffect(() => {
    // Animate in
    requestAnimationFrame(() => {
      setIsVisible(true);
    });

    // Progress bar animation
    if (toast.duration > 0 && !toast.persistent) {
      progressRef.current?.style.setProperty('--duration', `${toast.duration}ms`);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [toast.duration, toast.persistent]);

  const handleRemove = () => {
    if (isLeaving) return;

    setIsLeaving(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  };

  const handleAction = () => {
    if (toast.action?.handler) {
      toast.action.handler();
    }
    if (toast.action?.dismissOnClick !== false) {
      handleRemove();
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className={`toast toast-${toast.type} ${isVisible ? 'toast-visible' : ''} ${isLeaving ? 'toast-leaving' : ''}`}>
      <div className="toast-content">
        <div className="toast-icon">
          {getIcon()}
        </div>

        <div className="toast-body">
          {toast.title && (
            <div className="toast-title">{toast.title}</div>
          )}
          <div className="toast-message">
            {toast.message}
          </div>

          {toast.action && (
            <button className="toast-action" onClick={handleAction}>
              {toast.action.label}
            </button>
          )}
        </div>

        <button className="toast-close" onClick={handleRemove} aria-label="Close notification">
          ×
        </button>
      </div>

      {!toast.persistent && toast.duration > 0 && (
        <div className="toast-progress" ref={progressRef}>
          <div className="toast-progress-bar"></div>
        </div>
      )}
    </div>
  );
};

// Toast Container Component
const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      <div className="toast-list">
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            toast={toast}
            onRemove={removeToast}
          />
        ))}
      </div>
    </div>
  );
};

// Toast Types Configuration
export const ToastTypes = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

// Predefined toast configurations
export const ToastPresets = {
  // Success messages
  TIMETABLE_GENERATED: {
    type: 'success',
    title: 'Schedule Created!',
    message: 'Your personalized timetable has been generated successfully.',
    duration: 4000
  },
  SETTINGS_SAVED: {
    type: 'success',
    title: 'Settings Saved',
    message: 'Your preferences have been updated.',
    duration: 3000
  },
  GOAL_COMPLETED: {
    type: 'success',
    title: 'Goal Achieved! 🎉',
    message: 'Congratulations on completing your goal!',
    duration: 5000
  },

  // Error messages
  NETWORK_ERROR: {
    type: 'error',
    title: 'Connection Failed',
    message: 'I can\'t reach the server right now. Check your internet connection and try again.',
    duration: 8000,
    action: {
      label: 'Retry',
      handler: () => window.location.reload()
    }
  },
  API_ERROR: {
    type: 'error',
    title: 'Service Unavailable',
    message: 'The service is temporarily unavailable. I\'ll keep trying to reconnect.',
    persistent: true
  },
  VALIDATION_ERROR: {
    type: 'error',
    title: 'Invalid Input',
    message: 'Please check your input and try again.',
    duration: 5000
  },

  // Warning messages
  STORAGE_QUOTA: {
    type: 'warning',
    title: 'Storage Almost Full',
    message: 'Browser storage is nearly full. Consider clearing old data.',
    action: {
      label: 'Clear Data',
      handler: () => {
        // Trigger storage cleanup
        window.dispatchEvent(new CustomEvent('clearStorage'));
      }
    }
  },
  UNSAVED_CHANGES: {
    type: 'warning',
    title: 'Unsaved Changes',
    message: 'You have unsaved changes that will be lost.',
    action: {
      label: 'Save Now',
      handler: () => {
        // Trigger save action
        window.dispatchEvent(new CustomEvent('saveChanges'));
      }
    }
  },

  // Info messages
  OFFLINE_MODE: {
    type: 'info',
    title: 'Offline Mode',
    message: 'You\'re currently offline. Some features may be limited.',
    persistent: true
  },
  LOADING_LARGE_DATA: {
    type: 'info',
    title: 'Processing...',
    message: 'This might take a moment. Please be patient.',
    duration: 10000
  }
};

// Global toast helper for use outside React components
let globalToastContext = null;

export const setGlobalToastContext = (context) => {
  globalToastContext = context;
};

export const showToast = (config) => {
  if (globalToastContext) {
    return globalToastContext.addToast(config);
  }
  console.warn('Toast context not available. Make sure ToastProvider is rendered.');
};

export const showSuccessToast = (message, options) => {
  showToast({ type: 'success', message, ...options });
};

export const showErrorToast = (message, options) => {
  showToast({ type: 'error', message, ...options });
};

export const showWarningToast = (message, options) => {
  showToast({ type: 'warning', message, ...options });
};

export const showInfoToast = (message, options) => {
  showToast({ type: 'info', message, ...options });
};

export default ToastNotifications;