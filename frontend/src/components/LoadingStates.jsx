import React from 'react';

// Enhanced Loading States for Brolife UI

export const ChatLoading = ({ message = "Thinking...", step = 1 }) => {
  const loadingSteps = [
    "Thinking about your request...",
    "Analyzing your goals and preferences...",
    "Generating personalized recommendations..."
  ];

  const currentMessage = step <= loadingSteps.length ? loadingSteps[step - 1] : message;

  return (
    <div className="chat-loading">
      <div className="loading-avatar">🤖</div>
      <div className="loading-content">
        <div className="loading-message">{currentMessage}</div>
        <div className="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="loading-steps">
          <div className={`step ${step >= 1 ? 'active' : ''}`}>💭 Thinking</div>
          <div className={`step ${step >= 2 ? 'active' : ''}`}>🔍 Analyzing</div>
          <div className={`step ${step >= 3 ? 'active' : ''}`}>✨ Creating</div>
        </div>
      </div>
    </div>
  );
};

export const TimetableLoading = ({ progress = 0, estimatedTime = 15 }) => {
  const steps = [
    { label: 'Understanding your goals', icon: '🎯', progress: 20 },
    { label: 'Analyzing your preferences', icon: '⚙️', progress: 40 },
    { label: 'Optimizing your schedule', icon: '📊', progress: 60 },
    { label: 'Adding productivity tips', icon: '💡', progress: 80 },
    { label: 'Finalizing your timetable', icon: '✅', progress: 100 }
  ];

  const currentStep = steps.find(step => progress <= step.progress) || steps[steps.length - 1];

  return (
    <div className="timetable-loading">
      <div className="loading-header">
        <div className="loading-icon">📅</div>
        <h3>Creating Your Personalized Schedule</h3>
      </div>

      <div className="progress-container">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <div className="progress-text">{progress}% Complete</div>
      </div>

      <div className="loading-steps">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`loading-step ${progress >= step.progress ? 'completed' : 'active'}`}
          >
            <div className="step-icon">{step.icon}</div>
            <div className="step-label">{step.label}</div>
          </div>
        ))}
      </div>

      <div className="loading-estimate">
        <small>⏱️ Estimated time remaining: {estimatedTime}s</small>
      </div>
    </div>
  );
};

export const ApiLoading = ({ attempt = 1, maxAttempts = 5, message = "Connecting..." }) => {
  const progress = (attempt / maxAttempts) * 100;
  const currentDelay = Math.min(1000 * Math.pow(2, attempt - 1), 16000); // Exponential backoff, max 16s

  return (
    <div className="api-loading">
      <div className="connection-status">
        <div className="status-icon">
          {attempt <= 2 ? '🔄' : attempt <= 4 ? '⚠️' : '❌'}
        </div>
        <div className="status-message">
          <div className="main-message">{message}</div>
          <div className="retry-info">Retry attempt {attempt} of {maxAttempts}</div>
        </div>
      </div>

      <div className="connection-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="connection-tips">
        {attempt === 1 && <small>Checking connection...</small>}
        {attempt === 2 && <small>Still trying to connect...</small>}
        {attempt === 3 && <small>Taking a bit longer than expected...</small>}
        {attempt >= 4 && <small>Connection is taking very long. You might want to check your internet.</small>}
      </div>

      {attempt >= 3 && (
        <div className="connection-actions">
          <button className="cancel-btn" onClick={() => window.dispatchEvent(new CustomEvent('cancel-loading'))}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export const SkeletonLoader = ({
  type = 'card',
  count = 1,
  showAvatar = false,
  lines = 3,
  className = ''
}) => {
  const renderSkeleton = (index) => {
    switch (type) {
      case 'message':
        return (
          <div key={index} className="skeleton-message">
            {showAvatar && <div className="skeleton-avatar"></div>}
            <div className="skeleton-content">
              <div className="skeleton-header">
                <div className="skeleton-name"></div>
                <div className="skeleton-time"></div>
              </div>
              <div className="skeleton-text">
                {Array.from({ length: lines }).map((_, i) => (
                  <div key={i} className="skeleton-line" style={{ width: `${70 + Math.random() * 30}%` }}></div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'tracker':
        return (
          <div key={index} className="skeleton-tracker">
            <div className="skeleton-header">
              <div className="skeleton-icon"></div>
              <div className="skeleton-title"></div>
            </div>
            <div className="skeleton-stats">
              <div className="skeleton-stat"></div>
              <div className="skeleton-stat"></div>
            </div>
            <div className="skeleton-progress">
              <div className="skeleton-progress-bar"></div>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div key={index} className="skeleton-profile">
            <div className="skeleton-avatar-large"></div>
            <div className="skeleton-info">
              <div className="skeleton-name-large"></div>
              <div className="skeleton-email"></div>
            </div>
          </div>
        );

      case 'card':
      default:
        return (
          <div key={index} className="skeleton-card">
            <div className="skeleton-card-header">
              <div className="skeleton-title"></div>
              <div className="skeleton-badge"></div>
            </div>
            <div className="skeleton-card-body">
              {Array.from({ length: lines }).map((_, i) => (
                <div key={i} className="skeleton-line" style={{ width: `${60 + Math.random() * 40}%` }}></div>
              ))}
            </div>
            <div className="skeleton-card-footer">
              <div className="skeleton-button"></div>
              <div className="skeleton-button"></div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`skeleton-loader ${className}`}>
      {Array.from({ length: count }).map((_, index) => renderSkeleton(index))}
    </div>
  );
};

export const LoadingSpinner = ({
  size = 'medium',
  message = '',
  inline = false,
  color = 'primary'
}) => {
  const sizeClasses = {
    small: 'spinner-small',
    medium: 'spinner-medium',
    large: 'spinner-large'
  };

  const colorClasses = {
    primary: 'spinner-primary',
    secondary: 'spinner-secondary',
    white: 'spinner-white'
  };

  return (
    <div className={`loading-spinner ${inline ? 'inline' : ''}`}>
      <div className={`spinner ${sizeClasses[size]} ${colorClasses[color]}`}>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {message && <div className="spinner-message">{message}</div>}
    </div>
  );
};

export const LoadingOverlay = ({
  isVisible,
  message = 'Loading...',
  showCancel = false,
  onCancel = null,
  progress = null
}) => {
  if (!isVisible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-overlay-content">
        <LoadingSpinner size="large" message={message} />
        {progress !== null && (
          <div className="loading-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="progress-text">{Math.round(progress)}%</div>
          </div>
        )}
        {showCancel && onCancel && (
          <button className="cancel-overlay-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

// Specialized loading components for different contexts
export const MessageLoading = ({ isTyping = true }) => (
  <div className="message-loading">
    <div className="message-avatar">🤖</div>
    <div className="message-content">
      <div className="message-header">
        <span className="sender">🤖 Assistant</span>
        <span className="timestamp">Loading...</span>
      </div>
      <div className="message-text">
        {isTyping ? (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        ) : (
          <LoadingSpinner size="small" inline />
        )}
      </div>
    </div>
  </div>
);

export const PageLoading = ({ title = "Loading Brolife..." }) => (
  <div className="page-loading">
    <div className="page-loading-content">
      <div className="loading-logo">💪</div>
      <h2>{title}</h2>
      <LoadingSpinner size="large" />
      <p className="loading-subtitle">Preparing your productivity companion...</p>
    </div>
  </div>
);

export const ContentLoading = ({
  type = 'card',
  count = 3,
  message = 'Loading content...'
}) => (
  <div className="content-loading">
    <div className="loading-header">
      <h3>{message}</h3>
    </div>
    <SkeletonLoader type={type} count={count} />
  </div>
);

export default {
  ChatLoading,
  TimetableLoading,
  ApiLoading,
  SkeletonLoader,
  LoadingSpinner,
  LoadingOverlay,
  MessageLoading,
  PageLoading,
  ContentLoading
};