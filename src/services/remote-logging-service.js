/**
 * @file remote-logging-service.js
 * @description 远程日志服务，用于将关键日志发送到远程服务器进行分析
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import loggingService, { LogLevel, LogCategory } from './logging-service.js';

/**
 * 远程日志服务
 * @class RemoteLoggingService
 */
class RemoteLoggingService {
  /**
   * 创建远程日志服务实例
   */
  constructor() {
    this.isEnabled = false;
    this.serverUrl = '';
    this.apiKey = '';
    this.minLevel = LogLevel.ERROR; // 默认只发送错误日志
    this.enabledCategories = Object.values(LogCategory);
    this.batchSize = 10;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5秒
    this.pendingLogs = [];
    this.isSending = false;
    this.sendInterval = null;
    this.sendIntervalTime = 60000; // 1分钟
    
    this._loadSettings();
  }
  
  /**
   * 加载远程日志设置
   * @private
   */
  async _loadSettings() {
    try {
      const storageService = (await import('./storage-service.js')).default;
      const settings = await storageService.get('remote_logging_settings');
      
      if (settings) {
        this.isEnabled = settings.isEnabled !== undefined ? settings.isEnabled : false;
        this.serverUrl = settings.serverUrl || '';
        this.apiKey = settings.apiKey || '';
        this.minLevel = settings.minLevel !== undefined ? settings.minLevel : LogLevel.ERROR;
        this.enabledCategories = settings.enabledCategories || Object.values(LogCategory);
        this.batchSize = settings.batchSize || 10;
        this.maxRetries = settings.maxRetries || 3;
        this.retryDelay = settings.retryDelay || 5000;
        this.sendIntervalTime = settings.sendIntervalTime || 60000;
      }
      
      if (this.isEnabled && this.serverUrl) {
        this._startSendInterval();
      }
    } catch (error) {
      console.error('加载远程日志设置失败:', error);
    }
  }
  
  /**
   * 保存远程日志设置
   * @private
   */
  async _saveSettings() {
    try {
      const storageService = (await import('./storage-service.js')).default;
      const settings = {
        isEnabled: this.isEnabled,
        serverUrl: this.serverUrl,
        apiKey: this.apiKey,
        minLevel: this.minLevel,
        enabledCategories: this.enabledCategories,
        batchSize: this.batchSize,
        maxRetries: this.maxRetries,
        retryDelay: this.retryDelay,
        sendIntervalTime: this.sendIntervalTime
      };
      
      await storageService.set('remote_logging_settings', settings);
    } catch (error) {
      console.error('保存远程日志设置失败:', error);
    }
  }
  
  /**
   * 启动定时发送
   * @private
   */
  _startSendInterval() {
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
    }
    
    this.sendInterval = setInterval(() => {
      this._sendPendingLogs();
    }, this.sendIntervalTime);
  }
  
  /**
   * 停止定时发送
   * @private
   */
  _stopSendInterval() {
    if (this.sendInterval) {
      clearInterval(this.sendInterval);
      this.sendInterval = null;
    }
  }
  
  /**
   * 启用远程日志
   * @param {boolean} enabled - 是否启用
   */
  async setEnabled(enabled) {
    this.isEnabled = enabled;
    
    if (enabled && this.serverUrl) {
      this._startSendInterval();
    } else {
      this._stopSendInterval();
    }
    
    await this._saveSettings();
    
    loggingService.info(LogCategory.APP, `${enabled ? '启用' : '禁用'}远程日志服务`);
  }
  
  /**
   * 设置服务器URL
   * @param {string} url - 服务器URL
   */
  async setServerUrl(url) {
    this.serverUrl = url;
    
    if (this.isEnabled && url) {
      this._startSendInterval();
    } else {
      this._stopSendInterval();
    }
    
    await this._saveSettings();
    
    loggingService.info(LogCategory.APP, '设置远程日志服务器URL', { url });
  }
  
  /**
   * 设置API密钥
   * @param {string} apiKey - API密钥
   */
  async setApiKey(apiKey) {
    this.apiKey = apiKey;
    await this._saveSettings();
    
    loggingService.info(LogCategory.APP, '设置远程日志API密钥');
  }
  
  /**
   * 设置最小日志级别
   * @param {LogLevel} level - 日志级别
   */
  async setMinLevel(level) {
    this.minLevel = level;
    await this._saveSettings();
    
    loggingService.info(LogCategory.APP, '设置远程日志最小级别', { level });
  }
  
  /**
   * 设置启用的日志类别
   * @param {Array} categories - 日志类别数组
   */
  async setEnabledCategories(categories) {
    this.enabledCategories = categories;
    await this._saveSettings();
    
    loggingService.info(LogCategory.APP, '设置远程日志启用类别', { categories });
  }
  
  /**
   * 设置批量发送大小
   * @param {number} size - 批量大小
   */
  async setBatchSize(size) {
    this.batchSize = size;
    await this._saveSettings();
    
    loggingService.info(LogCategory.APP, '设置远程日志批量发送大小', { size });
  }
  
  /**
   * 设置发送间隔时间
   * @param {number} intervalMs - 间隔时间（毫秒）
   */
  async setSendInterval(intervalMs) {
    this.sendIntervalTime = intervalMs;
    
    if (this.isEnabled && this.serverUrl) {
      this._startSendInterval();
    }
    
    await this._saveSettings();
    
    loggingService.info(LogCategory.APP, '设置远程日志发送间隔', { intervalMs });
  }
  
  /**
   * 发送日志
   * @param {Object} logEntry - 日志条目
   * @returns {Promise<boolean>} - 是否成功
   */
  async sendLog(logEntry) {
    if (!this.isEnabled || !this.serverUrl || logEntry.level < this.minLevel || !this.enabledCategories.includes(logEntry.category)) {
      return false;
    }
    
    this.pendingLogs.push(this._sanitizeLogEntry(logEntry));
    
    if (this.pendingLogs.length >= this.batchSize) {
      this._sendPendingLogs();
    }
    
    return true;
  }
  
  /**
   * 发送待发送日志
   * @private
   */
  async _sendPendingLogs() {
    if (this.isSending || this.pendingLogs.length === 0 || !this.isEnabled || !this.serverUrl) {
      return;
    }
    
    this.isSending = true;
    
    try {
      const logsToSend = this.pendingLogs.slice(0, this.batchSize);
      
      const success = await this._sendToServer(logsToSend);
      
      if (success) {
        this.pendingLogs = this.pendingLogs.slice(logsToSend.length);
        
        loggingService.debug(LogCategory.APP, '远程日志发送成功', { count: logsToSend.length });
      }
    } catch (error) {
      console.error('发送远程日志失败:', error);
      loggingService.error(LogCategory.APP, '发送远程日志失败', { error: error.message });
    } finally {
      this.isSending = false;
    }
  }
  
  /**
   * 发送日志到服务器
   * @param {Array} logs - 日志数组
   * @returns {Promise<boolean>} - 是否成功
   * @private
   */
  async _sendToServer(logs) {
    let retries = 0;
    
    while (retries < this.maxRetries) {
      try {
        const response = await fetch(this.serverUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey
          },
          body: JSON.stringify({
            logs,
            clientInfo: {
              version: chrome.runtime.getManifest().version,
              userAgent: navigator.userAgent,
              timestamp: Date.now()
            }
          })
        });
        
        if (response.ok) {
          return true;
        }
        
        console.error('远程日志服务器响应错误:', response.status, response.statusText);
        
        if (response.status >= 500) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        } else {
          return false;
        }
      } catch (error) {
        console.error('发送远程日志请求失败:', error);
        
        retries++;
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
    
    return false;
  }
  
  /**
   * 清理日志条目，移除敏感信息
   * @param {Object} logEntry - 日志条目
   * @returns {Object} - 清理后的日志条目
   * @private
   */
  _sanitizeLogEntry(logEntry) {
    const sanitizedEntry = { ...logEntry };
    
    if (sanitizedEntry.data) {
      sanitizedEntry.data = this._sanitizeData(sanitizedEntry.data);
    }
    
    return sanitizedEntry;
  }
  
  /**
   * 清理数据，移除敏感信息
   * @param {Object} data - 数据对象
   * @returns {Object} - 清理后的数据对象
   * @private
   */
  _sanitizeData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const sanitizedData = Array.isArray(data) ? [...data] : { ...data };
    
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'auth', 'credential', 'cookie',
      'session', 'apiKey', 'api_key', 'accessToken', 'access_token'
    ];
    
    for (const key in sanitizedData) {
      if (Object.prototype.hasOwnProperty.call(sanitizedData, key)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
          sanitizedData[key] = '[REDACTED]';
        } else if (typeof sanitizedData[key] === 'object' && sanitizedData[key] !== null) {
          sanitizedData[key] = this._sanitizeData(sanitizedData[key]);
        }
      }
    }
    
    return sanitizedData;
  }
  
  /**
   * 立即发送所有待发送日志
   * @returns {Promise<boolean>} - 是否成功
   */
  async flushLogs() {
    if (this.pendingLogs.length === 0 || !this.isEnabled || !this.serverUrl) {
      return true;
    }
    
    try {
      while (this.pendingLogs.length > 0) {
        const logsToSend = this.pendingLogs.slice(0, this.batchSize);
        const success = await this._sendToServer(logsToSend);
        
        if (success) {
          this.pendingLogs = this.pendingLogs.slice(logsToSend.length);
        } else {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('刷新远程日志失败:', error);
      loggingService.error(LogCategory.APP, '刷新远程日志失败', { error: error.message });
      return false;
    }
  }
}

const remoteLoggingService = new RemoteLoggingService();
export default remoteLoggingService;
