/**
 * @file app-state-logger.js
 * @description 应用状态日志记录服务，记录应用状态变化和关键事件
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import loggingService, { LogLevel, LogCategory } from './logging-service.js';

/**
 * 应用状态日志记录服务
 * @class AppStateLogger
 */
class AppStateLogger {
  /**
   * 创建应用状态日志记录服务实例
   */
  constructor() {
    this.extensionInfo = null;
    this.startTime = Date.now();
    this.performanceMetrics = {
      resourceDetectionTime: [],
      downloadTime: [],
      renderTime: []
    };
    
    this._initializeExtensionInfo();
  }
  
  /**
   * 初始化扩展信息
   * @private
   */
  async _initializeExtensionInfo() {
    try {
      this.extensionInfo = {
        version: chrome.runtime.getManifest().version,
        name: chrome.runtime.getManifest().name,
        id: chrome.runtime.id,
        startTime: this.startTime
      };
      
      this.logExtensionStartup();
    } catch (error) {
      console.error('初始化扩展信息失败:', error);
    }
  }
  
  /**
   * 记录扩展启动
   */
  logExtensionStartup() {
    loggingService.info(LogCategory.APP, '扩展已启动', {
      ...this.extensionInfo,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录扩展关闭
   */
  logExtensionShutdown() {
    const runTime = Date.now() - this.startTime;
    
    loggingService.info(LogCategory.APP, '扩展已关闭', {
      ...this.extensionInfo,
      runTime: runTime,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录配置更新
   * @param {Object} settings - 更新后的设置
   */
  logSettingsUpdated(settings) {
    loggingService.info(LogCategory.APP, '设置已更新', {
      timestamp: Date.now(),
      settings: {
        ...settings,
        defaultPath: settings.defaultPath ? '(路径已隐藏)' : undefined
      }
    });
  }
  
  /**
   * 记录标签页变化
   * @param {number} tabId - 标签页ID
   * @param {string} url - 标签页URL
   */
  logTabChange(tabId, url) {
    if (!url) return;
    
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    loggingService.debug(LogCategory.APP, '标签页已变化', {
      tabId,
      domain,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录资源检测开始
   * @param {number} tabId - 标签页ID
   * @param {Object} options - 检测选项
   */
  logDetectionStarted(tabId, options = {}) {
    const detectionId = `detection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    loggingService.info(LogCategory.DETECTION, '资源检测开始', {
      detectionId,
      tabId,
      options,
      startTime: Date.now()
    });
    
    return detectionId;
  }
  
  /**
   * 记录资源检测完成
   * @param {string} detectionId - 检测ID
   * @param {number} resourceCount - 资源数量
   * @param {Object} stats - 检测统计信息
   */
  logDetectionCompleted(detectionId, resourceCount, stats = {}) {
    const endTime = Date.now();
    
    loggingService.info(LogCategory.DETECTION, '资源检测完成', {
      detectionId,
      resourceCount,
      stats,
      endTime,
      duration: stats.startTime ? (endTime - stats.startTime) : null
    });
    
    if (stats.startTime) {
      this.performanceMetrics.resourceDetectionTime.push({
        detectionId,
        duration: endTime - stats.startTime,
        resourceCount,
        timestamp: endTime
      });
      
      if (this.performanceMetrics.resourceDetectionTime.length > 20) {
        this.performanceMetrics.resourceDetectionTime.shift();
      }
    }
  }
  
  /**
   * 记录资源过滤
   * @param {Object} filterOptions - 过滤选项
   * @param {number} beforeCount - 过滤前数量
   * @param {number} afterCount - 过滤后数量
   */
  logResourceFiltered(filterOptions, beforeCount, afterCount) {
    loggingService.debug(LogCategory.RESOURCE, '资源已过滤', {
      filterOptions,
      beforeCount,
      afterCount,
      filteredCount: beforeCount - afterCount,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录资源排序
   * @param {string} sortMethod - 排序方法
   * @param {number} resourceCount - 资源数量
   */
  logResourceSorted(sortMethod, resourceCount) {
    loggingService.debug(LogCategory.RESOURCE, '资源已排序', {
      sortMethod,
      resourceCount,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录UI渲染
   * @param {string} componentName - 组件名称
   * @param {number} renderTime - 渲染时间(毫秒)
   */
  logUIRendered(componentName, renderTime) {
    loggingService.debug(LogCategory.UI, 'UI组件已渲染', {
      componentName,
      renderTime,
      timestamp: Date.now()
    });
    
    this.performanceMetrics.renderTime.push({
      componentName,
      duration: renderTime,
      timestamp: Date.now()
    });
    
    if (this.performanceMetrics.renderTime.length > 20) {
      this.performanceMetrics.renderTime.shift();
    }
  }
  
  /**
   * 记录用户交互
   * @param {string} action - 交互动作
   * @param {Object} details - 交互详情
   */
  logUserInteraction(action, details = {}) {
    loggingService.debug(LogCategory.UI, '用户交互', {
      action,
      ...details,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录错误
   * @param {string} source - 错误来源
   * @param {Error} error - 错误对象
   * @param {Object} context - 错误上下文
   */
  logError(source, error, context = {}) {
    loggingService.error(LogCategory.APP, `错误: ${source}`, {
      message: error.message,
      stack: error.stack,
      ...context,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录警告
   * @param {string} source - 警告来源
   * @param {string} message - 警告消息
   * @param {Object} context - 警告上下文
   */
  logWarning(source, message, context = {}) {
    loggingService.warn(LogCategory.APP, `警告: ${source}`, {
      message,
      ...context,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录网络请求
   * @param {string} url - 请求URL
   * @param {string} method - 请求方法
   * @param {number} status - 状态码
   * @param {number} duration - 请求时长(毫秒)
   */
  logNetworkRequest(url, method, status, duration) {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    
    loggingService.debug(LogCategory.NETWORK, '网络请求', {
      domain,
      path,
      method,
      status,
      duration,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录性能指标
   * @param {string} metricName - 指标名称
   * @param {number} value - 指标值
   * @param {Object} context - 上下文信息
   */
  logPerformanceMetric(metricName, value, context = {}) {
    loggingService.debug(LogCategory.APP, '性能指标', {
      metricName,
      value,
      ...context,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录扩展更新
   * @param {string} previousVersion - 之前的版本
   * @param {string} currentVersion - 当前版本
   */
  logExtensionUpdated(previousVersion, currentVersion) {
    loggingService.info(LogCategory.APP, '扩展已更新', {
      previousVersion,
      currentVersion,
      timestamp: Date.now()
    });
  }
  
  /**
   * 记录存储操作
   * @param {string} operation - 操作类型 (get, set, remove)
   * @param {string} key - 存储键
   * @param {boolean} success - 是否成功
   */
  logStorageOperation(operation, key, success) {
    loggingService.debug(LogCategory.APP, '存储操作', {
      operation,
      key,
      success,
      timestamp: Date.now()
    });
  }
  
  /**
   * 获取性能指标摘要
   * @returns {Object} - 性能指标摘要
   */
  getPerformanceMetricsSummary() {
    const calculateAverage = (arr, property) => {
      if (!arr || arr.length === 0) return 0;
      return arr.reduce((sum, item) => sum + item[property], 0) / arr.length;
    };
    
    return {
      averageDetectionTime: calculateAverage(this.performanceMetrics.resourceDetectionTime, 'duration'),
      averageDownloadTime: calculateAverage(this.performanceMetrics.downloadTime, 'duration'),
      averageRenderTime: calculateAverage(this.performanceMetrics.renderTime, 'duration'),
      detectionSamples: this.performanceMetrics.resourceDetectionTime.length,
      downloadSamples: this.performanceMetrics.downloadTime.length,
      renderSamples: this.performanceMetrics.renderTime.length,
      uptime: Date.now() - this.startTime
    };
  }
  
  /**
   * 记录性能指标摘要
   */
  logPerformanceMetricsSummary() {
    const summary = this.getPerformanceMetricsSummary();
    
    loggingService.info(LogCategory.APP, '性能指标摘要', {
      ...summary,
      timestamp: Date.now()
    });
  }
}

const appStateLogger = new AppStateLogger();

export default appStateLogger;
