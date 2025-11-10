import React, { useState, useEffect, useRef } from 'react';
import { chatAPI } from '../api/chatAPI';
import { ChatLoading } from './LoadingStates';
import { getChatErrorMessage, classifyError } from '../utils/errorHandlers';
import { useToast } from './ToastNotifications';

const ChatBox = ({ user, onTimetableGenerated, className = "" }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connected'); // connected, connecting, disconnected, retrying
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const messagesEndRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setConnectionStatus('connected');
      setShowConnectionStatus(false);
      setRetryAttempt(0);
    };

    const handleOffline = () => {
      setConnectionStatus('disconnected');
      setShowConnectionStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);
    setConnectionStatus('connecting');
    setShowConnectionStatus(false);

    // Add user message immediately for better UX
    const userMsgObj = {
      type: 'user',
      content: userMessage,
      timestamp: new Date(),
      id: `user-${Date.now()}`
    };

    setMessages(prev => [...prev, userMsgObj]);

    try {
      const response = await chatAPI.sendMessage({
        message: userMessage,
        user_id: user.user_id
      });

      const botMsgObj = {
        type: 'bot',
        content: response.response,
        timestamp: new Date(),
        bro_name: response.bro_name || user.bro_name,
        id: `bot-${Date.now()}`
      };

      setMessages(prev => [...prev, botMsgObj]);
      setConnectionStatus('connected');
      setRetryAttempt(0);

      // Trigger callback for timetable generation
      if (onTimetableGenerated && response.response.includes('timetable')) {
        onTimetableGenerated(response);
      }

    } catch (error) {
      const errorType = classifyError(error);
      setConnectionStatus('disconnected');
      setRetryAttempt(prev => prev + 1);

      // Log error for debugging
      console.error('Chat message failed:', error);

      const errorMessage = getChatErrorMessage(error);

      const errorMsgObj = {
        type: 'bot',
        content: errorMessage,
        timestamp: new Date(),
        isError: true,
        errorType,
        retryable: errorType === 'network' || errorType === 'api',
        id: `error-${Date.now()}`
      };

      setMessages(prev => [...prev, errorMsgObj]);

      // Show connection status for network errors
      if (errorType === 'network' || errorType === 'api') {
        setShowConnectionStatus(true);
      }

      // Show toast notification for errors
      if (errorType === 'network') {
        addToast({
          type: 'error',
          title: 'Connection Failed',
          message: 'I can\'t reach the server right now. Check your internet connection.',
          duration: 8000,
          action: {
            label: 'Retry',
            handler: () => {
              setInputMessage(userMessage);
              setTimeout(() => handleSendMessage(), 100);
            }
          }
        });
      } else if (errorType === 'api') {
        addToast({
          type: 'warning',
          title: 'Service Unavailable',
          message: 'The service is temporarily unavailable. I\'ll keep trying.',
          persistent: true
        });
      }

    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    // Find the last user message and retry it
    const lastUserMessage = [...messages]
      .reverse()
      .find(msg => msg.type === 'user');

    if (lastUserMessage) {
      setInputMessage(lastUserMessage.content);
      setTimeout(() => handleSendMessage(), 100);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    addToast({
      type: 'info',
      title: 'Chat Cleared',
      message: 'Your chat history has been cleared.',
      duration: 3000
    });
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return '🔴';
      case 'retrying':
        return '🔄';
      default:
        return '⚪';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'retrying':
        return 'Retrying...';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`chat-box ${className}`}>
      {/* Connection Status Header */}
      {(showConnectionStatus || connectionStatus !== 'connected') && (
        <div className={`connection-status ${connectionStatus}`}>
          <div className="connection-info">
            <span className="connection-icon">{getConnectionStatusIcon()}</span>
            <span className="connection-text">{getConnectionStatusText()}</span>
            {retryAttempt > 0 && (
              <span className="retry-count">(Attempt {retryAttempt})</span>
            )}
          </div>
          {connectionStatus === 'disconnected' && (
            <button className="retry-connection-btn" onClick={handleRetry}>
              🔄 Retry
            </button>
          )}
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <div className="welcome-content">
              <h2>Hey! I'm {user.bro_name} 👋</h2>
              <p>I'm your AI productivity companion. I'll help you:</p>
              <ul>
                <li>🎯 Create personalized daily timetables</li>
                <li>💪 Stay motivated and on track</li>
                <li>🚀 Achieve your goals consistently</li>
                <li>⚡ Balance side hustles with health</li>
              </ul>
              <p>What's on your mind today?</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type} ${message.isError ? 'error' : ''}`}>
            <div className="message-content">
              <div className="message-header">
                <span className="sender">
                  {message.type === 'user' ? '👤 You' : `🤖 ${message.bro_name || user.bro_name}`}
                </span>
                <span className="timestamp">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="message-text">
                {message.content}
                {message.isError && message.retryable && (
                  <div className="error-actions">
                    <button className="retry-btn" onClick={handleRetry}>
                      🔄 Try Again
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Enhanced Loading State */}
        {isLoading && (
          <div className="message bot loading-message">
            <div className="message-content">
              <div className="message-header">
                <span className="sender">🤖 {user.bro_name}</span>
              </div>
              <div className="message-text">
                <ChatLoading />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="input-container">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              connectionStatus === 'disconnected'
                ? 'You\'re offline. Messages will be sent when you reconnect.'
                : `Ask ${user.bro_name} anything about productivity...`
            }
            className="message-input"
            rows="1"
            disabled={isLoading || connectionStatus === 'disconnected'}
          />
          <button
            onClick={handleSendMessage}
            className="send-btn"
            disabled={isLoading || !inputMessage.trim() || connectionStatus === 'disconnected'}
          >
            {connectionStatus === 'disconnected' ? '📵' : '🚀'}
          </button>
        </div>

        {/* Chat Actions */}
        <div className="chat-actions">
          <button className="action-btn" onClick={clearChat} title="Clear chat">
            🗑️ Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;