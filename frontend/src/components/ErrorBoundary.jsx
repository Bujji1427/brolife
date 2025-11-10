import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorType: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Classify error type based on error message or properties
    let errorType = 'component';

    if (error.message?.includes('Network Error') || error.message?.includes('fetch')) {
      errorType = 'network';
    } else if (error.message?.includes('localStorage') || error.message?.includes('storage')) {
      errorType = 'storage';
    } else if (error.message?.includes('API') || error.status >= 500) {
      errorType = 'api';
    }

    return {
      hasError: true,
      errorType,
      retryCount: 0
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo
    });

    // Log error context for debugging
    console.group('🚨 Error Boundary - Component Crash Report');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Error Type:', this.state.errorType);
    console.groupEnd();

    // Could send error reporting service here
    this.reportError(error, errorInfo);
  }

  reportError = (error, errorInfo) => {
    // In a production app, this would send to an error reporting service
    try {
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      console.warn('Error Report:', errorReport);
      // Send to error reporting service in production
      // fetch('/api/errors', { method: 'POST', body: JSON.stringify(errorReport) });
    } catch (reportingError) {
      console.warn('Failed to report error:', reportingError);
    }
  };

  handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        errorType: null,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  handleRefresh = () => {
    window.location.reload();
  };

  handleContactSupport = () => {
    window.open('mailto:support@brolife.app?subject=Bug Report&body=' +
      encodeURIComponent(`I encountered an error:\n\n${this.state.error?.message || 'Unknown error'}\n\n` +
      `Time: ${new Date().toISOString()}\n` +
      `Page: ${window.location.href}\n\n` +
      `Steps to reproduce:\n`));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-container">
            <div className="error-icon">
              {this.getErrorIcon()}
            </div>

            <h2 className="error-title">
              {this.getErrorTitle()}
            </h2>

            <p className="error-message">
              {this.getErrorMessage()}
            </p>

            {this.state.retryCount > 0 && (
              <div className="retry-info">
                <small>Retry attempt {this.state.retryCount} of 3</small>
              </div>
            )}

            <div className="error-actions">
              {this.state.retryCount < 3 && (
                <button
                  className="retry-btn"
                  onClick={this.handleRetry}
                >
                  🔄 Try Again
                </button>
              )}

              <button
                className="refresh-btn"
                onClick={this.handleRefresh}
              >
                🔄 Refresh Page
              </button>

              <button
                className="support-btn"
                onClick={this.handleContactSupport}
              >
                📧 Contact Support
              </button>
            </div>

            <div className="error-details">
              <button
                className="toggle-details"
                onClick={() => this.setState(prev => ({
                  showDetails: !prev.showDetails
                }))}
              >
                📋 {this.state.showDetails ? 'Hide' : 'Show'} Technical Details
              </button>

              {this.state.showDetails && (
                <div className="technical-details">
                  <div className="error-type">
                    <strong>Error Type:</strong> {this.state.errorType}
                  </div>
                  {this.state.error && (
                    <div className="error-stack">
                      <strong>Error:</strong> {this.state.error.message}
                    </div>
                  )}
                  {this.state.errorInfo && (
                    <div className="component-stack">
                      <strong>Component Stack:</strong>
                      <pre>{this.state.errorInfo.componentStack}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }

  getErrorIcon = () => {
    switch (this.state.errorType) {
      case 'network':
        return '🌐';
      case 'storage':
        return '💾';
      case 'api':
        return '🔌';
      default:
        return '⚠️';
    }
  };

  getErrorTitle = () => {
    switch (this.state.errorType) {
      case 'network':
        return 'Network Connection Issue';
      case 'storage':
        return 'Storage Problem';
      case 'api':
        return 'Service Temporarily Unavailable';
      default:
        return 'Something Went Wrong';
    }
  };

  getErrorMessage = () => {
    switch (this.state.errorType) {
      case 'network':
        return 'I can\'t connect to the server right now. Check your internet connection and try again.';
      case 'storage':
        return 'There\'s an issue with browser storage. Try clearing your browser cache or using a different browser.';
      case 'api':
        return 'The service is temporarily unavailable. I\'m working on fixing this - please try again in a few minutes.';
      default:
        return 'An unexpected error occurred. I\'m sorry about this! Please try refreshing the page.';
    }
  };
}

export default ErrorBoundary;