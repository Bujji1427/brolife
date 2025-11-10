import { useState, useEffect, useCallback } from 'react';
import { storageManager } from '../utils/storageManager';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState({
    enableSuccess: true,
    enableError: true,
    enableWarning: true,
    enableInfo: true,
    enableSound: false,
    enableDesktop: false,
    duration: {
      success: 4000,
      error: 8000,
      warning: 6000,
      info: 5000
    }
  });

  // Load preferences from storage on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const storedPrefs = await storageManager.getItem('brolife_notification_preferences');
        if (storedPrefs) {
          setPreferences(prev => ({ ...prev, ...storedPrefs }));
        }
      } catch (error) {
        console.warn('Failed to load notification preferences:', error);
      }
    };

    loadPreferences();
  }, []);

  // Save preferences to storage when they change
  useEffect(() => {
    storageManager.setItem('brolife_notification_preferences', preferences, {
      persistent: true
    }).catch(error => {
      console.warn('Failed to save notification preferences:', error);
    });
  }, [preferences]);

  // Request desktop notification permission
  const requestDesktopPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }, []);

  // Show desktop notification
  const showDesktopNotification = useCallback((title, options = {}) => {
    if (!preferences.enableDesktop || !('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
  }, [preferences.enableDesktop]);

  // Play notification sound
  const playNotificationSound = useCallback((type) => {
    if (!preferences.enableSound) return;

    try {
      const audio = new Audio();
      switch (type) {
        case 'success':
          audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
          break;
        case 'error':
          audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
          break;
        case 'warning':
          audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
          break;
        default:
          audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT';
      }
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore errors from sound playback (browser may block)
      });
    } catch (error) {
      // Ignore sound errors
    }
  }, [preferences.enableSound]);

  // Add notification
  const addNotification = useCallback((notification) => {
    if (!preferences[`enable${notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}`]) {
      return;
    }

    const newNotification = {
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      read: false,
      ...notification,
      duration: notification.duration || preferences.duration[notification.type] || 5000
    };

    setNotifications(prev => {
      // Remove duplicate notifications of same type within last 30 seconds
      const thirtySecondsAgo = Date.now() - 30000;
      const filtered = prev.filter(n =>
        !(n.type === notification.type && n.message === notification.message && n.timestamp > thirtySecondsAgo)
      );
      return [newNotification, ...filtered];
    });

    // Show desktop notification if enabled
    showDesktopNotification(notification.title || notification.message, {
      body: notification.message,
      icon: notification.type === 'error' ? '/error-icon.png' : '/success-icon.png'
    });

    // Play sound if enabled
    playNotificationSound(notification.type);

    // Auto-remove if duration is set
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, newNotification.duration);
    }

    return newNotification.id;
  }, [preferences, showDesktopNotification, playNotificationSound]);

  // Remove notification
  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((id) => {
    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, read: true } : n
    ));
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Get unread count
  const getUnreadCount = useCallback(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  // Update preferences
  const updatePreferences = useCallback((newPrefs) => {
    setPreferences(prev => ({ ...prev, ...newPrefs }));
  }, []);

  // Request desktop permission on first use
  const enableDesktopNotifications = useCallback(async () => {
    const granted = await requestDesktopPermission();
    if (granted) {
      updatePreferences({ enableDesktop: true });
    }
    return granted;
  }, [requestDesktopPermission, updatePreferences]);

  // Group similar notifications
  const getGroupedNotifications = useCallback(() => {
    const grouped = {};

    notifications.forEach(notification => {
      const key = `${notification.type}:${notification.title || notification.message}`;
      if (!grouped[key]) {
        grouped[key] = {
          ...notification,
          count: 0,
          notifications: []
        };
      }
      grouped[key].count++;
      grouped[key].notifications.push(notification);
      grouped[key].timestamp = Math.max(grouped[key].timestamp, notification.timestamp);
    });

    return Object.values(grouped);
  }, [notifications]);

  // Export notifications history
  const exportNotifications = useCallback(async () => {
    try {
      const exportData = {
        notifications,
        preferences,
        exportDate: new Date().toISOString(),
        totalNotifications: notifications.length,
        unreadCount: getUnreadCount()
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brolife-notifications-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return true;
    } catch (error) {
      console.error('Failed to export notifications:', error);
      return false;
    }
  }, [notifications, preferences, getUnreadCount]);

  // Auto-cleanup old notifications (older than 24 hours)
  useEffect(() => {
    const cleanup = () => {
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      setNotifications(prev => prev.filter(n => n.timestamp > twentyFourHoursAgo));
    };

    const interval = setInterval(cleanup, 60 * 60 * 1000); // Run every hour
    return () => clearInterval(interval);
  }, []);

  // Listen for storage changes (sync across tabs)
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === 'brolife_notification_preferences') {
        try {
          const newPrefs = JSON.parse(event.newValue);
          setPreferences(prev => ({ ...prev, ...newPrefs }));
        } catch (error) {
          // Ignore parsing errors
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    notifications,
    preferences,
    unreadCount: getUnreadCount(),
    groupedNotifications: getGroupedNotifications(),
    addNotification,
    removeNotification,
    markAsRead,
    markAllAsRead,
    clearAllNotifications,
    updatePreferences,
    enableDesktopNotifications,
    exportNotifications
  };
};