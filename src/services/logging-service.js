/**
 * @file logging-service.js
 * @description 本地日志服务，记录应用状态和下载状态
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import storageService from './storage-service.js';

/**
 * 日志级别枚举
 * @enum {number}
 */
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARNING: 2,
  ERROR: 3
};

/**
 * 日志类别枚举
 * @enum {string}
 */
const LogCategory = {
  APP: 'app',
  DETECTION: 'detection',
  DOWNLOAD: 'download',
  RESOURCE: 'resource',
  NETWORK: 'network',
  WORKER: 'worker',
  UI: 'ui'
};

/**
 * 本地日志服务
 * @class LoggingService
 */
class LoggingService {
  /**
   * 创建日志服务实例
   */
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.isEnabled = true;
    this.minLevel = LogLevel.INFO;
    this.enabledCategories = Object.values(LogCategory);
    this.listeners = [];
    this.storageKey = 'resource_sniffer_logs';
    
    this._loadSettings();
  }
  
  /**
   * 加载日志设置
   * @private
   */
  async _loadSettings() {
    try {
      const settings = await storageService.get('logging_settings');
      if (settings) {
        this.isEnabled = settings.isEnabled !== undefined ? settings.isEnabled : true;
        this.minLevel = settings.minLevel !== undefined ? settings.minLevel : LogLevel.INFO;
        this.enabledCategories = settings.enabledCategories || Object.values(LogCategory);
        this.maxLogs = settings.maxLogs || 1000;
      }
      
      const savedLogs = await storageService.get(this.storageKey);
      if (savedLogs && Array.isArray(savedLogs)) {
        this.logs = savedLogs.slice(-this.maxLogs);
      }
    } catch (error) {
      console.error('加载日志设置失败:', error);
    }
  }
  
  /**
   * 保存日志设置
   * @private
   */
  async _saveSettings() {
    try {
      const settings = {
        isEnabled: this.isEnabled,
        minLevel: this.minLevel,
        enabledCategories: this.enabledCategories,
        maxLogs: this.maxLogs
      };
      
      await storageService.set('logging_settings', settings);
    } catch (error) {
      console.error('保存日志设置失败:', error);
    }
  }
  
  /**
   * 保存日志到存储
   * @private
   */
  async _saveLogs() {
    if (!this.isEnabled) return;
    
    try {
      await storageService.set(this.storageKey, this.logs.slice(-this.maxLogs));
    } catch (error) {
      console.error('保存日志失败:', error);
    }
  }
  
  /**
   * 添加日志
   * @param {LogLevel} level - 日志级别
   * @param {LogCategory} category - 日志类别
   * @param {string} message - 日志消息
   * @param {Object} [data] - 附加数据
   * @returns {Object} - 日志条目
   */
  _addLog(level, category, message, data = null) {
    if (!this.isEnabled || level < this.minLevel || !this.enabledCategories.includes(category)) {
      return null;
    }
    
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      data
    };
    
    this.logs.push(logEntry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    this._notifyListeners(logEntry);
    
    this._saveLogs();
    
    return logEntry;
  }
  
  /**
   * 通知所有监听器
   * @param {Object} logEntry - 日志条目
   * @private
   */
  _notifyListeners(logEntry) {
    this.listeners.forEach(listener => {
      try {
        listener(logEntry);
      } catch (error) {
        console.error('通知日志监听器失败:', error);
      }
    });
  }
  
  /**
   * 记录调试日志
   * @param {LogCategory} category - 日志类别
   * @param {string} message - 日志消息
   * @param {Object} [data] - 附加数据
   * @returns {Object} - 日志条目
   */
  debug(category, message, data = null) {
    return this._addLog(LogLevel.DEBUG, category, message, data);
  }
  
  /**
   * 记录信息日志
   * @param {LogCategory} category - 日志类别
   * @param {string} message - 日志消息
   * @param {Object} [data] - 附加数据
   * @returns {Object} - 日志条目
   */
  info(category, message, data = null) {
    return this._addLog(LogLevel.INFO, category, message, data);
  }
  
  /**
   * 记录警告日志
   * @param {LogCategory} category - 日志类别
   * @param {string} message - 日志消息
   * @param {Object} [data] - 附加数据
   * @returns {Object} - 日志条目
   */
  warn(category, message, data = null) {
    return this._addLog(LogLevel.WARNING, category, message, data);
  }
  
  /**
   * 记录错误日志
   * @param {LogCategory} category - 日志类别
   * @param {string} message - 日志消息
   * @param {Object} [data] - 附加数据
   * @returns {Object} - 日志条目
   */
  error(category, message, data = null) {
    return this._addLog(LogLevel.ERROR, category, message, data);
  }
  
  /**
   * 获取所有日志
   * @param {Object} [filters] - 过滤条件
   * @returns {Array} - 日志列表
   */
  getLogs(filters = {}) {
    let filteredLogs = [...this.logs];
    
    if (filters.level !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.level >= filters.level);
    }
    
    if (filters.category) {
      filteredLogs = filteredLogs.filter(log => log.category === filters.category);
    }
    
    if (filters.startTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startTime);
    }
    
    if (filters.endTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endTime);
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchLower) || 
        (log.data && JSON.stringify(log.data).toLowerCase().includes(searchLower))
      );
    }
    
    if (filters.limit) {
      filteredLogs = filteredLogs.slice(-filters.limit);
    }
    
    return filteredLogs;
  }
  
  /**
   * 清除所有日志
   */
  async clearLogs() {
    this.logs = [];
    await this._saveLogs();
    this._notifyListeners({ type: 'clear' });
  }
  
  /**
   * 启用日志
   * @param {boolean} enabled - 是否启用
   */
  async setEnabled(enabled) {
    this.isEnabled = enabled;
    await this._saveSettings();
    this._notifyListeners({ type: 'settings_changed' });
  }
  
  /**
   * 设置最小日志级别
   * @param {LogLevel} level - 日志级别
   */
  async setMinLevel(level) {
    this.minLevel = level;
    await this._saveSettings();
    this._notifyListeners({ type: 'settings_changed' });
  }
  
  /**
   * 设置启用的日志类别
   * @param {Array} categories - 日志类别数组
   */
  async setEnabledCategories(categories) {
    this.enabledCategories = categories;
    await this._saveSettings();
    this._notifyListeners({ type: 'settings_changed' });
  }
  
  /**
   * 设置最大日志数量
   * @param {number} maxLogs - 最大日志数量
   */
  async setMaxLogs(maxLogs) {
    this.maxLogs = maxLogs;
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    await this._saveSettings();
    await this._saveLogs();
    this._notifyListeners({ type: 'settings_changed' });
  }
  
  /**
   * 添加日志监听器
   * @param {Function} listener - 监听器函数
   */
  addListener(listener) {
    if (typeof listener === 'function' && !this.listeners.includes(listener)) {
      this.listeners.push(listener);
    }
  }
  
  /**
   * 移除日志监听器
   * @param {Function} listener - 监听器函数
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * 导出日志
   * @param {string} [format='json'] - 导出格式
   * @returns {string} - 导出的日志
   */
  exportLogs(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    } else if (format === 'csv') {
      const header = 'ID,Timestamp,Level,Category,Message,Data\n';
      const rows = this.logs.map(log => {
        const timestamp = new Date(log.timestamp).toISOString();
        const level = ['DEBUG', 'INFO', 'WARNING', 'ERROR'][log.level];
        const message = log.message.replace(/"/g, '""');
        const data = log.data ? JSON.stringify(log.data).replace(/"/g, '""') : '';
        
        return `"${log.id}","${timestamp}","${level}","${log.category}","${message}","${data}"`;
      });
      
      return header + rows.join('\n');
    } else if (format === 'text') {
      return this.logs.map(log => {
        const timestamp = new Date(log.timestamp).toISOString();
        const level = ['DEBUG', 'INFO', 'WARNING', 'ERROR'][log.level];
        const data = log.data ? JSON.stringify(log.data) : '';
        
        return `[${timestamp}] [${level}] [${log.category}] ${log.message} ${data ? '- ' + data : ''}`;
      }).join('\n');
    }
    
    return '';
  }
  
  /**
   * 获取日志统计信息
   * @returns {Object} - 统计信息
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {
        [LogLevel.DEBUG]: 0,
        [LogLevel.INFO]: 0,
        [LogLevel.WARNING]: 0,
        [LogLevel.ERROR]: 0
      },
      byCategory: {}
    };
    
    Object.values(LogCategory).forEach(category => {
      stats.byCategory[category] = 0;
    });
    
    this.logs.forEach(log => {
      stats.byLevel[log.level]++;
      
      if (stats.byCategory[log.category] !== undefined) {
        stats.byCategory[log.category]++;
      }
    });
    
    return stats;
  }
}

export { LogLevel, LogCategory };

const loggingService = new LoggingService();

export default loggingService;
