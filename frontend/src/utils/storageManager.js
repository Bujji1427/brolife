// Enhanced Storage Manager with Fallbacks for Brolife UI

class StorageManager {
  constructor() {
    this.storageTypes = ['localStorage', 'sessionStorage', 'memory'];
    this.currentStorage = this.detectBestStorage();
    this.memoryStorage = new Map();
    this.quotaWarningThreshold = 0.9; // 90% of quota
    this.compressionEnabled = true;
    this.listeners = new Map();

    // Initialize storage monitoring
    this.initializeStorageMonitoring();
  }

  detectBestStorage() {
    // Try localStorage first
    if (this.isStorageAvailable('localStorage')) {
      return 'localStorage';
    }

    // Fall back to sessionStorage
    if (this.isStorageAvailable('sessionStorage')) {
      console.warn('localStorage not available, falling back to sessionStorage');
      return 'sessionStorage';
    }

    // Final fallback to memory
    console.warn('No persistent storage available, using in-memory storage');
    return 'memory';
  }

  isStorageAvailable(type) {
    try {
      const storage = window[type];
      const testKey = '__storage_test__';
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  initializeStorageMonitoring() {
    // Monitor storage quota
    this.checkStorageQuota();

    // Listen for storage events
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange.bind(this));
      window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }
  }

  handleStorageChange(event) {
    // Notify listeners of storage changes
    const listeners = this.listeners.get(event.key) || [];
    listeners.forEach(callback => {
      try {
        callback({
          key: event.key,
          oldValue: event.oldValue,
          newValue: event.newValue,
          storageArea: event.storageArea,
          url: event.url
        });
      } catch (error) {
        console.warn('Storage listener callback failed:', error);
      }
    });
  }

  handleBeforeUnload() {
    // Sync memory storage to persistent storage if possible
    if (this.currentStorage === 'memory' && this.isStorageAvailable('localStorage')) {
      this.syncMemoryToStorage();
    }
  }

  compressData(data) {
    if (!this.compressionEnabled) return data;

    try {
      // Simple compression for strings - remove unnecessary whitespace
      if (typeof data === 'string') {
        return data.replace(/\s+/g, ' ').trim();
      }

      // For objects, compress string values
      if (typeof data === 'object' && data !== null) {
        const compressed = {};
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string') {
            compressed[key] = value.replace(/\s+/g, ' ').trim();
          } else {
            compressed[key] = value;
          }
        }
        return compressed;
      }

      return data;
    } catch (error) {
      console.warn('Data compression failed:', error);
      return data;
    }
  }

  decompressData(data) {
    // Data is stored in decompressed form, so this is mainly for consistency
    return data;
  }

  async setItem(key, value, options = {}) {
    const {
      compress = this.compressionEnabled,
      persistent = true,
      ttl = null // Time to live in milliseconds
    } = options;

    try {
      let processedValue = value;

      // Compress if enabled and value is compressible
      if (compress && (typeof value === 'string' || typeof value === 'object')) {
        processedValue = this.compressData(value);
      }

      const storageData = {
        value: processedValue,
        timestamp: Date.now(),
        persistent,
        compress,
        ttl
      };

      const serializedData = JSON.stringify(storageData);

      // Check quota before setting
      if (!this.checkStorageQuota(serializedData.length)) {
        throw new Error('Storage quota exceeded');
      }

      switch (this.currentStorage) {
        case 'localStorage':
          localStorage.setItem(key, serializedData);
          break;
        case 'sessionStorage':
          sessionStorage.setItem(key, serializedData);
          break;
        case 'memory':
          this.memoryStorage.set(key, storageData);
          break;
        default:
          throw new Error('No valid storage available');
      }

      return true;
    } catch (error) {
      console.error('Failed to set storage item:', error);

      // Try fallback storage
      if (this.currentStorage !== 'memory') {
        console.warn('Attempting fallback to memory storage');
        this.currentStorage = 'memory';
        return this.setItem(key, value, { ...options, persistent: false });
      }

      throw new StorageError(`Failed to store item: ${error.message}`, error);
    }
  }

  async getItem(key, options = {}) {
    const { decompress = this.compressionEnabled } = options;

    try {
      let rawData;

      switch (this.currentStorage) {
        case 'localStorage':
          rawData = localStorage.getItem(key);
          break;
        case 'sessionStorage':
          rawData = sessionStorage.getItem(key);
          break;
        case 'memory':
          const memoryData = this.memoryStorage.get(key);
          if (memoryData) {
            return this.processStoredData(memoryData, decompress);
          }
          return null;
        default:
          throw new Error('No valid storage available');
      }

      if (!rawData) return null;

      const storageData = JSON.parse(rawData);
      return this.processStoredData(storageData, decompress);
    } catch (error) {
      console.error('Failed to get storage item:', error);

      // Try fallback storage
      if (this.currentStorage !== 'memory') {
        const fallbackData = this.memoryStorage.get(key);
        if (fallbackData) {
          return this.processStoredData(fallbackData, decompress);
        }
      }

      throw new StorageError(`Failed to retrieve item: ${error.message}`, error);
    }
  }

  processStoredData(storageData, decompress) {
    // Check TTL
    if (storageData.ttl && Date.now() - storageData.timestamp > storageData.ttl) {
      this.removeItem(storageData.key);
      return null;
    }

    let value = storageData.value;

    // Decompress if needed
    if (decompress && storageData.compress) {
      value = this.decompressData(value);
    }

    return value;
  }

  async removeItem(key) {
    try {
      switch (this.currentStorage) {
        case 'localStorage':
          localStorage.removeItem(key);
          break;
        case 'sessionStorage':
          sessionStorage.removeItem(key);
          break;
        case 'memory':
          this.memoryStorage.delete(key);
          break;
        default:
          throw new Error('No valid storage available');
      }

      return true;
    } catch (error) {
      console.error('Failed to remove storage item:', error);
      throw new StorageError(`Failed to remove item: ${error.message}`, error);
    }
  }

  async clear(options = {}) {
    const { persistent = false } = options;

    try {
      switch (this.currentStorage) {
        case 'localStorage':
          if (persistent) {
            localStorage.clear();
          } else {
            // Only clear app-specific keys
            this.clearAppKeys(localStorage);
          }
          break;
        case 'sessionStorage':
          if (persistent) {
            sessionStorage.clear();
          } else {
            this.clearAppKeys(sessionStorage);
          }
          break;
        case 'memory':
          this.memoryStorage.clear();
          break;
        default:
          throw new Error('No valid storage available');
      }

      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw new StorageError(`Failed to clear storage: ${error.message}`, error);
    }
  }

  clearAppKeys(storage) {
    const keysToRemove = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && (key.startsWith('brolife_') || key.startsWith('brolife-'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => storage.removeItem(key));
  }

  checkStorageQuota(additionalBytes = 0) {
    try {
      if (this.currentStorage === 'memory') {
        return true; // Memory has effectively unlimited quota for our purposes
      }

      const storage = this.currentStorage === 'localStorage' ? localStorage : sessionStorage;
      let totalSize = 0;

      for (let key in storage) {
        if (storage.hasOwnProperty(key)) {
          totalSize += storage[key].length + key.length;
        }
      }

      // Add additional bytes to simulate new item
      totalSize += additionalBytes;

      // Estimated quota limits (these vary by browser)
      const quotaLimit = this.currentStorage === 'localStorage' ? 5 * 1024 * 1024 : 5 * 1024 * 1024; // 5MB
      const usageRatio = totalSize / quotaLimit;

      // Emit warning if approaching limit
      if (usageRatio > this.quotaWarningThreshold) {
        this.emitStorageWarning(usageRatio, quotaLimit - totalSize);
      }

      return usageRatio < 0.95; // Leave 5% buffer
    } catch (error) {
      console.warn('Failed to check storage quota:', error);
      return false;
    }
  }

  emitStorageWarning(usageRatio, remainingBytes) {
    const warning = {
      type: 'quota_warning',
      usageRatio: Math.round(usageRatio * 100),
      remainingBytes,
      message: `Storage quota ${Math.round(usageRatio * 100)}% full. Consider clearing old data.`
    };

    console.warn('Storage quota warning:', warning);

    // Dispatch custom event for UI components to handle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('storageWarning', { detail: warning }));
    }
  }

  async cleanup() {
    // Remove expired items
    try {
      const storage = this.currentStorage === 'localStorage' ? localStorage :
                    this.currentStorage === 'sessionStorage' ? sessionStorage : null;

      if (storage) {
        const keysToRemove = [];

        for (let key in storage) {
          if (storage.hasOwnProperty(key)) {
            try {
              const data = JSON.parse(storage[key]);
              if (data.ttl && Date.now() - data.timestamp > data.ttl) {
                keysToRemove.push(key);
              }
            } catch (e) {
              // Invalid JSON, remove the key
              keysToRemove.push(key);
            }
          }
        }

        keysToRemove.forEach(key => storage.removeItem(key));
      }

      // Clean memory storage
      for (const [key, data] of this.memoryStorage.entries()) {
        if (data.ttl && Date.now() - data.timestamp > data.ttl) {
          this.memoryStorage.delete(key);
        }
      }
    } catch (error) {
      console.error('Storage cleanup failed:', error);
    }
  }

  async backup() {
    // Create backup of current storage data
    const backup = {
      timestamp: Date.now(),
      version: '1.0',
      data: {}
    };

    try {
      if (this.currentStorage !== 'memory') {
        const storage = this.currentStorage === 'localStorage' ? localStorage : sessionStorage;

        for (let key in storage) {
          if (storage.hasOwnProperty(key) && (key.startsWith('brolife_') || key.startsWith('brolife-'))) {
            backup.data[key] = storage[key];
          }
        }
      }

      // Add memory storage data
      for (const [key, value] of this.memoryStorage.entries()) {
        backup.data[key] = JSON.stringify(value);
      }

      return backup;
    } catch (error) {
      console.error('Storage backup failed:', error);
      throw new StorageError(`Failed to create backup: ${error.message}`, error);
    }
  }

  async restore(backup) {
    try {
      if (!backup || !backup.data) {
        throw new Error('Invalid backup data');
      }

      for (const [key, value] of Object.entries(backup.data)) {
        await this.setItem(key, JSON.parse(value));
      }

      return true;
    } catch (error) {
      console.error('Storage restore failed:', error);
      throw new StorageError(`Failed to restore backup: ${error.message}`, error);
    }
  }

  syncMemoryToStorage() {
    if (this.currentStorage === 'memory' && this.isStorageAvailable('localStorage')) {
      try {
        for (const [key, value] of this.memoryStorage.entries()) {
          if (value.persistent) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        }
        console.log('Synced memory storage to localStorage');
      } catch (error) {
        console.warn('Failed to sync memory to localStorage:', error);
      }
    }
  }

  // Event listeners for storage changes
  addEventListener(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
  }

  removeEventListener(key, callback) {
    const listeners = this.listeners.get(key);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Storage statistics
  getStorageInfo() {
    try {
      const info = {
        type: this.currentStorage,
        available: this.isStorageAvailable(this.currentStorage),
        quotaUsed: 0,
        itemCount: 0
      };

      if (this.currentStorage !== 'memory') {
        const storage = this.currentStorage === 'localStorage' ? localStorage : sessionStorage;

        for (let key in storage) {
          if (storage.hasOwnProperty(key)) {
            info.quotaUsed += storage[key].length + key.length;
            info.itemCount++;
          }
        }
      } else {
        info.itemCount = this.memoryStorage.size;
        // Rough estimate of memory usage
        for (const [key, value] of this.memoryStorage.entries()) {
          info.quotaUsed += JSON.stringify(value).length + key.length;
        }
      }

      return info;
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return { type: this.currentStorage, available: false, error: error.message };
    }
  }
}

// Custom error class for storage operations
class StorageError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'StorageError';
    this.originalError = originalError;
  }
}

// Create singleton instance
const storageManager = new StorageManager();

// Export the singleton and class
export { storageManager, StorageManager, StorageError };
export default storageManager;