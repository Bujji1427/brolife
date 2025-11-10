import { useState, useRef, useEffect } from 'react';
import { chatAPI } from '../api';
import { getChatErrorMessage, classifyError, logError } from '../utils/errorHandlers';
import { storageManager } from '../utils/storageManager';
import { useToast } from '../components/ToastNotifications';

export const useChat = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected'); // connected, connecting, disconnected, retrying
  const [retryCount, setRetryCount] = useState(0);
  const messagesEndRef = useRef(null);
  const { addToast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load chat history from storage on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const storedMessages = await storageManager.getItem('brolife_chat_messages');
        if (storedMessages && Array.isArray(storedMessages)) {
          setMessages(storedMessages);
        }
      } catch (error) {
        console.warn('Failed to load chat history from storage:', error);
      }
    };

    loadChatHistory();
  }, []);

  // Save messages to storage when they change
  useEffect(() => {
    if (messages.length > 0) {
      storageManager.setItem('brolife_chat_messages', messages, {
        compress: true,
        persistent: true
      }).catch(error => {
        console.warn('Failed to save chat history to storage:', error);
      });
    }
  }, [messages]);

  const sendMessage = async (message, userId) => {
    try {
      setIsLoading(true);
      setError(null);
      setConnectionStatus('connecting');

      // Add user message immediately for better UX
      const userMessage = {
        type: 'user',
        content: message,
        timestamp: new Date(),
        id: `user-${Date.now()}`
      };

      setMessages(prev => [...prev, userMessage]);

      // Show optimistic loading message
      const loadingId = `loading-${Date.now()}`;
      const loadingMessage = {
        type: 'bot',
        content: 'Thinking about your request...',
        timestamp: new Date(),
        id: loadingId,
        isLoading: true
      };

      setMessages(prev => [...prev, loadingMessage]);

      const response = await chatAPI.sendMessage({
        message,
        user_id: userId
      });

      // Remove loading message and add actual response
      setMessages(prev => prev.filter(msg => msg.id !== loadingId));

      const botMessage = {
        type: 'bot',
        content: response.response,
        timestamp: new Date(),
        bro_name: response.bro_name,
        id: `bot-${Date.now()}`
      };

      setMessages(prev => [...prev, botMessage]);
      setConnectionStatus('connected');
      setRetryCount(0);

      // Show success toast for important interactions
      if (message.toLowerCase().includes('timetable') && response.response.includes('timetable')) {
        addToast({
          type: 'success',
          title: 'Schedule Created!',
          message: 'Your personalized timetable has been generated.',
          duration: 4000
        });
      }

      return response;
    } catch (err) {
      const errorType = classifyError(err);
      setConnectionStatus('disconnected');

      // Remove loading message
      setMessages(prev => prev.filter(msg => !msg.isLoading));

      // Log error for debugging
      logError(err, 'useChat.sendMessage', userId);

      // Get user-friendly error message
      const errorMessage = getChatErrorMessage(err);

      // Add error message to chat
      const errorMessageObj = {
        type: 'bot',
        content: errorMessage,
        timestamp: new Date(),
        isError: true,
        errorType,
        retryable: errorType === 'network' || errorType === 'api',
        id: `error-${Date.now()}`
      };

      setMessages(prev => [...prev, errorMessageObj]);
      setError(err);

      // Show appropriate toast notification
      if (errorType === 'network') {
        addToast({
          type: 'error',
          title: 'Connection Failed',
          message: 'I can\'t reach the server right now. Check your internet connection.',
          duration: 8000,
          action: {
            label: 'Retry',
            handler: () => sendMessage(message, userId)
          }
        });
      } else if (errorType === 'api') {
        addToast({
          type: 'warning',
          title: 'Service Unavailable',
          message: 'The service is temporarily unavailable. I\'ll keep trying.',
          persistent: true
        });
      } else {
        addToast({
          type: 'error',
          title: 'Something Went Wrong',
          message: 'I encountered an unexpected error. Let\'s try that again!',
          duration: 6000
        });
      }

      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const retryLastMessage = async (userId) => {
    // Find the last user message and retry it
    const lastUserMessage = [...messages]
      .reverse()
      .find(msg => msg.type === 'user' && !msg.isRetry);

    if (lastUserMessage) {
      setRetryCount(prev => prev + 1);

      // Mark as retry to prevent infinite loops
      setMessages(prev => prev.map(msg =>
        msg.id === lastUserMessage.id
          ? { ...msg, isRetry: true }
          : msg
      ));

      return sendMessage(lastUserMessage.content, userId);
    }
  };

  const addMessage = (message) => {
    const messageWithId = {
      ...message,
      id: `manual-${Date.now()}`,
      timestamp: message.timestamp || new Date()
    };
    setMessages(prev => [...prev, messageWithId]);
  };

  const clearMessages = async () => {
    try {
      setMessages([]);
      await storageManager.removeItem('brolife_chat_messages');

      addToast({
        type: 'info',
        title: 'Chat Cleared',
        message: 'Your chat history has been cleared.',
        duration: 3000
      });
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      addToast({
        type: 'error',
        title: 'Failed to Clear Chat',
        message: 'Could not clear chat history. Please try again.',
        duration: 4000
      });
    }
  };

  const getChatHistory = async (userId, limit = 20) => {
    try {
      setConnectionStatus('connecting');
      const data = await chatAPI.getChatHistory(userId, limit);

      // Convert API response to our message format
      const formattedMessages = data.history.map((msg, index) => ({
        ...msg,
        id: `history-${Date.now()}-${index}`,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date()
      }));

      setMessages(formattedMessages);
      setConnectionStatus('connected');
      return formattedMessages;
    } catch (err) {
      const errorType = classifyError(err);
      setConnectionStatus('disconnected');
      logError(err, 'useChat.getChatHistory', userId);

      addToast({
        type: 'warning',
        title: 'Could Not Load History',
        message: 'Chat history is temporarily unavailable. You can continue chatting normally.',
        duration: 5000
      });

      throw err;
    }
  };

  const exportChatHistory = async () => {
    try {
      const chatData = {
        messages: messages,
        exportDate: new Date().toISOString(),
        messageCount: messages.length
      };

      const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `brolife-chat-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        title: 'Chat Exported',
        message: `Exported ${messages.length} messages to your downloads.`,
        duration: 4000
      });
    } catch (error) {
      console.error('Failed to export chat history:', error);
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Could not export chat history. Please try again.',
        duration: 4000
      });
    }
  };

  return {
    messages,
    isLoading,
    error,
    connectionStatus,
    retryCount,
    messagesEndRef,
    sendMessage,
    retryLastMessage,
    addMessage,
    clearMessages,
    getChatHistory,
    exportChatHistory,
    setMessages
  };
};