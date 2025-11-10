// Enhanced Error Handling Utilities for Brolife UI

export class AppError extends Error {
  constructor(message, type = 'general', statusCode = 500, originalError = null) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
  }
}

export class NetworkError extends AppError {
  constructor(message = 'Network connection failed', originalError = null) {
    super(message, 'network', 0, originalError);
    this.name = 'NetworkError';
  }
}

export class APIError extends AppError {
  constructor(message, statusCode = 500, originalError = null) {
    super(message, 'api', statusCode, originalError);
    this.name = 'APIError';
  }
}

export class StorageError extends AppError {
  constructor(message = 'Storage operation failed', originalError = null) {
    super(message, 'storage', 0, originalError);
    this.name = 'StorageError';
  }
}

export class ValidationError extends AppError {
  constructor(message, field = null, originalError = null) {
    super(message, 'validation', 400, originalError);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// Error Classification
export const classifyError = (error) => {
  if (!error) return 'general';

  // Network errors
  if (error.name === 'NetworkError' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('fetch') ||
      error.message?.includes('Failed to fetch') ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT') {
    return 'network';
  }

  // Storage errors
  if (error.name === 'StorageError' ||
      error.name === 'QuotaExceededError' ||
      error.message?.includes('localStorage') ||
      error.message?.includes('storage') ||
      error.message?.includes('Quota')) {
    return 'storage';
  }

  // API errors
  if (error.name === 'APIError' ||
      error.status >= 500 ||
      error.statusCode >= 500 ||
      error.message?.includes('API')) {
    return 'api';
  }

  // Validation errors
  if (error.name === 'ValidationError' ||
      error.status === 400 ||
      error.statusCode === 400) {
    return 'validation';
  }

  // Authentication errors
  if (error.status === 401 ||
      error.statusCode === 401 ||
      error.message?.includes('Unauthorized')) {
    return 'auth';
  }

  // Permission errors
  if (error.status === 403 ||
      error.statusCode === 403 ||
      error.message?.includes('Forbidden')) {
    return 'permission';
  }

  // Not found errors
  if (error.status === 404 ||
      error.statusCode === 404 ||
      error.message?.includes('Not found')) {
    return 'notfound';
  }

  return 'general';
};

// Error Message Templates
export const getErrorMessage = (error, context = '') => {
  const errorType = classifyError(error);

  const messages = {
    network: {
      default: "I can't reach the server right now. Check your internet connection and try again.",
      timeout: "The connection timed out. Please check your internet and try again.",
      offline: "You're currently offline. Please connect to the internet and try again."
    },
    storage: {
      default: "There's an issue with browser storage. Try clearing your browser cache or using a different browser.",
      quota: "Storage is almost full. Please clear some data to continue using all features.",
      disabled: "Storage is disabled in your browser. Some features may not work properly."
    },
    api: {
      default: "The service is temporarily unavailable. I'll keep trying to reconnect.",
      timeout: "The service is taking longer than expected. Please try again in a moment.",
      maintenance: "I'm currently performing maintenance. Please check back soon."
    },
    validation: {
      default: "Something doesn't look right with the input. Please check and try again.",
      required: "This field is required. Please fill it out to continue.",
      format: "The format doesn't look right. Please check your input."
    },
    auth: {
      default: "You need to sign in to continue. Please log in and try again.",
      expired: "Your session has expired. Please log in again."
    },
    permission: {
      default: "You don't have permission to perform this action."
    },
    notfound: {
      default: "The requested content wasn't found. It may have been moved or deleted."
    },
    general: {
      default: "Something went wrong. Please try again or contact support if the problem continues.",
      unexpected: "An unexpected error occurred. I'm sorry about this! Please try refreshing the page."
    }
  };

  const contextMessages = messages[errorType];

  // Check for specific error patterns
  if (error.message?.includes('timeout')) {
    return contextMessages.timeout || contextMessages.default;
  }

  if (error.message?.includes('quota')) {
    return messages.storage.quota;
  }

  if (error.message?.includes('disabled')) {
    return messages.storage.disabled;
  }

  // Add context-specific information
  let message = contextMessages.default;
  if (context) {
    message = `${context}: ${message}`;
  }

  return message;
};

// Retry Logic with Exponential Backoff
export const retryWithBackoff = async (
  fn,
  maxRetries = 3,
  delay = 1000,
  backoffMultiplier = 2
) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on certain error types
      const errorType = classifyError(error);
      if (errorType === 'validation' || errorType === 'auth' || errorType === 'permission') {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const currentDelay = delay * Math.pow(backoffMultiplier, attempt - 1);
      console.warn(`Retry attempt ${attempt} failed, retrying in ${currentDelay}ms:`, error);

      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
  }

  throw lastError;
};

// Error Recovery Suggestions
export const getRecoverySuggestions = (error) => {
  const errorType = classifyError(error);

  const suggestions = {
    network: [
      { action: 'Check Internet Connection', description: 'Make sure you\'re connected to the internet' },
      { action: 'Try Again', description: 'The connection might be temporarily unstable' },
      { action: 'Switch Networks', description: 'Try WiFi or cellular data' }
    ],
    storage: [
      { action: 'Clear Browser Cache', description: 'Free up space in your browser storage' },
      { action: 'Try Incognito Mode', description: 'Test if browser extensions are causing issues' },
      { action: 'Use Different Browser', description: 'Chrome, Firefox, or Safari often work better' }
    ],
    api: [
      { action: 'Wait and Retry', description: 'The service might be temporarily busy' },
      { action: 'Check Status', description: 'Visit our status page for updates' },
      { action: 'Contact Support', description: 'Let us know if the problem continues' }
    ],
    validation: [
      { action: 'Check Your Input', description: 'Make sure all fields are filled correctly' },
      { action: 'Try Different Format', description: 'Use standard formats (email, phone, etc.)' }
    ],
    auth: [
      { action: 'Sign In Again', description: 'Your session may have expired' },
      { action: 'Clear Cookies', description: 'Try signing out and back in' }
    ],
    general: [
      { action: 'Refresh Page', description: 'A simple reload often fixes temporary issues' },
      { action: 'Try Again', description: 'The problem might be temporary' },
      { action: 'Contact Support', description: 'We\'re here to help if the problem continues' }
    ]
  };

  return suggestions[errorType] || suggestions.general;
};

// Error Logging and Tracking
export const logError = (error, context = '', userId = null) => {
  const errorLog = {
    message: error.message,
    type: classifyError(error),
    statusCode: error.statusCode || error.status,
    stack: error.stack,
    context,
    userId,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    // Don't include sensitive information
    // Remove any potential passwords, tokens, etc.
    errorObject: JSON.parse(JSON.stringify(error, (key, value) => {
      if (typeof value === 'string' && (
        value.includes('password') ||
        value.includes('token') ||
        value.includes('secret') ||
        value.includes('key')
      )) {
        return '[REDACTED]';
      }
      return value;
    }))
  };

  console.group('🚨 Brolife Error Log');
  console.error('Error Details:', errorLog);
  console.error('Original Error:', error);
  console.groupEnd();

  // In production, send to error reporting service
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to Sentry, Bugsnag, or custom endpoint
    // errorReportingService.captureException(error, errorLog);
  }

  return errorLog;
};

// User-Friendly Error Messages for Chat
export const getChatErrorMessage = (error, context = '') => {
  const errorType = classifyError(error);

  const chatMessages = {
    network: [
      "I'm having trouble connecting right now. Check your internet connection and let's try again!",
      "It seems like we've lost connection. Can you check if you're online?",
      "I can't reach the server at the moment. Please check your internet and try again."
    ],
    storage: [
      "I'm having trouble saving our conversation. Browser storage might be full.",
      "There's an issue with saving your preferences. Try clearing browser cache if this continues.",
      "I can't store some data right now. The conversation should still work though."
    ],
    api: [
      "I'm experiencing some technical difficulties right now. Please give me a moment to recover.",
      "The service is temporarily unavailable. I'll keep trying to reconnect for you.",
      "Something went wrong on my end. Let me try that again for you."
    ],
    general: [
      "I seem to have encountered an unexpected issue. Let's try that again!",
      "Something didn't go as planned. Can we try that one more time?",
      "I hit a small snag. Let's restart and try a different approach."
    ]
  };

  const messages = chatMessages[errorType] || chatMessages.general;
  return messages[Math.floor(Math.random() * messages.length)];
};

// Export all utilities
export default {
  AppError,
  NetworkError,
  APIError,
  StorageError,
  ValidationError,
  classifyError,
  getErrorMessage,
  retryWithBackoff,
  getRecoverySuggestions,
  logError,
  getChatErrorMessage
};