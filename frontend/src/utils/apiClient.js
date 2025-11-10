// Enhanced API Client with Retry Logic, Offline Support, and Error Handling

import { retryWithBackoff, classifyError, APIError, NetworkError } from './errorHandlers';
import { storageManager } from './storageManager';

class ApiClient {
  constructor(baseURL = '/api', options = {}) {
    this.baseURL = baseURL;
    this.defaultOptions = {
      timeout: 10000,
      retries: 3,
      retryDelay: 1000,
      enableCache: true,
      cacheTimeout: 300000, // 5 minutes
      ...options
    };

    this.cache = new Map();
    this.requestQueue = [];
    this.isOnline = navigator.onLine;
    this.requestInterceptors = [];
    this.responseInterceptors = [];

    this.initializeNetworkMonitoring();
  }

  initializeNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processRequestQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  addRequestInterceptor(interceptor) {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor) {
    this.responseInterceptors.push(interceptor);
  }

  async applyRequestInterceptors(config) {
    let processedConfig = { ...config };

    for (const interceptor of this.requestInterceptors) {
      processedConfig = await interceptor(processedConfig);
    }

    return processedConfig;
  }

  async applyResponseInterceptors(response) {
    let processedResponse = response;

    for (const interceptor of this.responseInterceptors) {
      processedResponse = await interceptor(processedResponse);
    }

    return processedResponse;
  }

  generateCacheKey(url, method, data) {
    return `${method}:${url}:${JSON.stringify(data || {})}`;
  }

  getCachedResponse(cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.defaultOptions.cacheTimeout) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(cacheKey);
    }
    return null;
  }

  setCachedResponse(cacheKey, data) {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
  }

  async buildRequest(url, options = {}) {
    const {
      method = 'GET',
      data = null,
      headers = {},
      timeout = this.defaultOptions.timeout,
      enableCache = this.defaultOptions.enableCache
    } = options;

    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    const cacheKey = this.generateCacheKey(fullUrl, method, data);

    // Check cache for GET requests
    if (method === 'GET' && enableCache) {
      const cachedResponse = this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        return {
          cached: true,
          data: cachedResponse
        };
      }
    }

    const requestConfig = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      }
    };

    if (data && method !== 'GET') {
      requestConfig.body = JSON.stringify(data);
    }

    // Add query parameters for GET requests
    if (data && method === 'GET') {
      const params = new URLSearchParams();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          params.append(key, value);
        }
      });
      const queryString = params.toString();
      if (queryString) {
        fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
      }
    }

    // Apply request interceptors
    const processedConfig = await this.applyRequestInterceptors({
      url: fullUrl,
      ...requestConfig
    });

    return {
      url: processedConfig.url,
      config: {
        ...requestConfig,
        ...processedConfig,
        signal: AbortSignal.timeout(timeout)
      }
    };
  }

  async makeRequest(url, options = {}) {
    const {
      retries = this.defaultOptions.retries,
      retryDelay = this.defaultOptions.retryDelay,
      enableRetry = true,
      queueIfOffline = true
    } = options;

    // Queue request if offline
    if (!this.isOnline && queueIfOffline) {
      return this.queueRequest(url, options);
    }

    const requestFn = async () => {
      const { url: fullUrl, config } = await this.buildRequest(url, options);

      let response;
      try {
        response = await fetch(fullUrl, config);
      } catch (error) {
        throw new NetworkError(`Network request failed: ${error.message}`, error);
      }

      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response);
        throw new APIError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData
        );
      }

      const data = await response.json();

      // Apply response interceptors
      const processedResponse = await this.applyResponseInterceptors({
        data,
        status: response.status,
        headers: response.headers,
        url: fullUrl
      });

      // Cache GET responses
      if (options.method === 'GET' || !options.method) {
        const cacheKey = this.generateCacheKey(fullUrl, 'GET', options.data);
        this.setCachedResponse(cacheKey, processedResponse.data);
      }

      return processedResponse.data;
    };

    // Retry logic
    if (enableRetry && retries > 0) {
      return retryWithBackoff(requestFn, retries, retryDelay);
    }

    return requestFn();
  }

  async parseErrorResponse(response) {
    try {
      return await response.json();
    } catch {
      return {
        message: response.statusText || 'Unknown error occurred',
        status: response.status
      };
    }
  }

  async queueRequest(url, options) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        url,
        options,
        resolve,
        reject,
        timestamp: Date.now()
      });

      // Store queued requests in persistent storage
      storageManager.setItem('brolife_queued_requests', this.requestQueue);
    });
  }

  async processRequestQueue() {
    const queuedRequests = [...this.requestQueue];
    this.requestQueue = [];

    for (const request of queuedRequests) {
      try {
        const result = await this.makeRequest(request.url, {
          ...request.options,
          queueIfOffline: false
        });
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }

    // Clear queued requests from storage
    storageManager.removeItem('brolife_queued_requests');
  }

  // RESTful API methods
  async get(url, params = {}, options = {}) {
    return this.makeRequest(url, {
      method: 'GET',
      data: params,
      ...options
    });
  }

  async post(url, data = {}, options = {}) {
    return this.makeRequest(url, {
      method: 'POST',
      data,
      ...options
    });
  }

  async put(url, data = {}, options = {}) {
    return this.makeRequest(url, {
      method: 'PUT',
      data,
      ...options
    });
  }

  async patch(url, data = {}, options = {}) {
    return this.makeRequest(url, {
      method: 'PATCH',
      data,
      ...options
    });
  }

  async delete(url, options = {}) {
    return this.makeRequest(url, {
      method: 'DELETE',
      ...options
    });
  }

  // File upload
  async upload(url, file, options = {}) {
    const formData = new FormData();
    formData.append('file', file);

    const {
      onProgress = null,
      timeout = 30000,
      ...otherOptions
    } = options;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            const processedResponse = await this.applyResponseInterceptors({
              data,
              status: xhr.status,
              headers: xhr.getAllResponseHeaders(),
              url
            });
            resolve(processedResponse.data);
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        } else {
          reject(new APIError(`HTTP ${xhr.status}: ${xhr.statusText}`, xhr.status));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new NetworkError('Upload failed'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });

      xhr.timeout = timeout;
      xhr.open('POST', `${this.baseURL}${url}`);
      xhr.send(formData);
    });
  }

  // Batch requests
  async batch(requests) {
    const promises = requests.map(({ url, options = {} }) =>
      this.makeRequest(url, options)
    );

    try {
      return await Promise.all(promises);
    } catch (error) {
      // If any request fails, all fail
      throw error;
    }
  }

  // Parallel requests with error handling
  async parallel(requests) {
    const promises = requests.map(async ({ url, options = {} }) => {
      try {
        return { success: true, data: await this.makeRequest(url, options), url };
      } catch (error) {
        return { success: false, error, url };
      }
    });

    return Promise.all(promises);
  }

  // Health check
  async healthCheck(url = '/health') {
    try {
      const startTime = Date.now();
      await this.get(url);
      const endTime = Date.now();
      return {
        healthy: true,
        responseTime: endTime - startTime
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }

  // Get client status
  getStatus() {
    return {
      online: this.isOnline,
      cachedRequests: this.cache.size,
      queuedRequests: this.requestQueue.length,
      baseURL: this.baseURL
    };
  }

  // Restore queued requests from storage
  async restoreQueuedRequests() {
    try {
      const queued = await storageManager.getItem('brolife_queued_requests');
      if (queued && Array.isArray(queued)) {
        // Filter out old requests (older than 1 hour)
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        this.requestQueue = queued.filter(req => req.timestamp > oneHourAgo);
      }
    } catch (error) {
      console.warn('Failed to restore queued requests:', error);
    }
  }
}

// Create default instance
const apiClient = new ApiClient();

// Add default request interceptor for authentication
apiClient.addRequestInterceptor(async (config) => {
  // Add auth token if available
  const token = await storageManager.getItem('brolife_auth_token');
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return config;
});

// Add default response interceptor for error handling
apiClient.addResponseInterceptor(async (response) => {
  // Handle token refresh if needed
  if (response.status === 401) {
    // Token expired, try to refresh
    try {
      const refreshToken = await storageManager.getItem('brolife_refresh_token');
      if (refreshToken) {
        const refreshResponse = await apiClient.post('/auth/refresh', {
          refresh_token: refreshToken
        }, { enableRetry: false });

        if (refreshResponse.token) {
          await storageManager.setItem('brolife_auth_token', refreshResponse.token);

          // Retry original request with new token
          response.config.headers['Authorization'] = `Bearer ${refreshResponse.token}`;
          return apiClient.makeRequest(response.url, response.config);
        }
      }
    } catch (error) {
      console.warn('Token refresh failed:', error);
    }
  }
  return response;
});

// Initialize client
apiClient.restoreQueuedRequests();

export { ApiClient };
export default apiClient;