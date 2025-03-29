/**
 * @file monitoring-service.js
 * @description 实时监控服务，监控资源检测和下载状态
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

/**
 * 实时监控服务
 * @class MonitoringService
 */
class MonitoringService {
  /**
   * 创建监控服务实例
   */
  constructor() {
    this.metrics = {
      resourceDetection: {
        total: 0,
        byType: {},
        startTime: null,
        endTime: null,
        duration: 0,
        rate: 0
      },
      resourceAnalysis: {
        total: 0,
        byType: {},
        startTime: null,
        endTime: null,
        duration: 0,
        rate: 0
      },
      resourceDownload: {
        total: 0,
        completed: 0,
        failed: 0,
        inProgress: 0,
        byType: {},
        totalSize: 0,
        downloadedSize: 0,
        startTime: null,
        endTime: null,
        duration: 0,
        rate: 0
      },
      performance: {
        cpuUsage: [],
        memoryUsage: [],
        networkRequests: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      errors: []
    };
    
    this.listeners = new Map();
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.samplingRate = 1000; // 默认采样率1秒
  }
  
  /**
   * 开始监控
   * @param {Object} options - 监控选项
   */
  startMonitoring(options = {}) {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.samplingRate = options.samplingRate || this.samplingRate;
    
    this.resetMetrics();
    
    this.monitoringInterval = setInterval(() => {
      this.samplePerformance();
    }, this.samplingRate);
    
    this.notifyListeners('monitoringStarted', {
      timestamp: Date.now(),
      samplingRate: this.samplingRate
    });
    
    console.log('监控服务已启动');
  }
  
  /**
   * 停止监控
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.calculateFinalMetrics();
    
    this.notifyListeners('monitoringStopped', {
      timestamp: Date.now(),
      metrics: this.getMetrics()
    });
    
    console.log('监控服务已停止');
  }
  
  /**
   * 重置指标
   * @private
   */
  resetMetrics() {
    const now = Date.now();
    
    this.metrics = {
      resourceDetection: {
        total: 0,
        byType: {},
        startTime: now,
        endTime: null,
        duration: 0,
        rate: 0
      },
      resourceAnalysis: {
        total: 0,
        byType: {},
        startTime: now,
        endTime: null,
        duration: 0,
        rate: 0
      },
      resourceDownload: {
        total: 0,
        completed: 0,
        failed: 0,
        inProgress: 0,
        byType: {},
        totalSize: 0,
        downloadedSize: 0,
        startTime: now,
        endTime: null,
        duration: 0,
        rate: 0
      },
      performance: {
        cpuUsage: [],
        memoryUsage: [],
        networkRequests: 0,
        cacheHits: 0,
        cacheMisses: 0
      },
      errors: []
    };
  }
  
  /**
   * 采样性能指标
   * @private
   */
  samplePerformance() {
    if (!this.isMonitoring) return;
    
    if (typeof performance !== 'undefined') {
      if (performance.memory) {
        this.metrics.performance.memoryUsage.push({
          timestamp: Date.now(),
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        });
      }
      
      if (performance.getEntriesByType) {
        const resourceEntries = performance.getEntriesByType('resource');
        this.metrics.performance.networkRequests = resourceEntries.length;
      }
    }
    
    this.notifyListeners('performanceSample', {
      timestamp: Date.now(),
      performance: this.metrics.performance
    });
  }
  
  /**
   * 计算最终指标
   * @private
   */
  calculateFinalMetrics() {
    const now = Date.now();
    
    if (this.metrics.resourceDetection.total > 0) {
      this.metrics.resourceDetection.endTime = now;
      this.metrics.resourceDetection.duration = 
        this.metrics.resourceDetection.endTime - this.metrics.resourceDetection.startTime;
      this.metrics.resourceDetection.rate = 
        this.metrics.resourceDetection.total / (this.metrics.resourceDetection.duration / 1000);
    }
    
    if (this.metrics.resourceAnalysis.total > 0) {
      this.metrics.resourceAnalysis.endTime = now;
      this.metrics.resourceAnalysis.duration = 
        this.metrics.resourceAnalysis.endTime - this.metrics.resourceAnalysis.startTime;
      this.metrics.resourceAnalysis.rate = 
        this.metrics.resourceAnalysis.total / (this.metrics.resourceAnalysis.duration / 1000);
    }
    
    if (this.metrics.resourceDownload.total > 0) {
      this.metrics.resourceDownload.endTime = now;
      this.metrics.resourceDownload.duration = 
        this.metrics.resourceDownload.endTime - this.metrics.resourceDownload.startTime;
      
      if (this.metrics.resourceDownload.duration > 0) {
        this.metrics.resourceDownload.rate = 
          this.metrics.resourceDownload.downloadedSize / (this.metrics.resourceDownload.duration / 1000);
      }
    }
  }
  
  /**
   * 记录资源检测
   * @param {Object} data - 检测数据
   */
  recordResourceDetection(data) {
    if (!this.isMonitoring) return;
    
    const { resources, type } = data;
    const count = Array.isArray(resources) ? resources.length : 1;
    
    this.metrics.resourceDetection.total += count;
    
    if (type) {
      this.metrics.resourceDetection.byType[type] = 
        (this.metrics.resourceDetection.byType[type] || 0) + count;
    }
    
    if (Array.isArray(resources)) {
      resources.forEach(resource => {
        const resourceType = resource.type || 'unknown';
        this.metrics.resourceDetection.byType[resourceType] = 
          (this.metrics.resourceDetection.byType[resourceType] || 0) + 1;
      });
    }
    
    this.notifyListeners('resourceDetection', {
      timestamp: Date.now(),
      count: count,
      type: type,
      metrics: this.metrics.resourceDetection
    });
  }
  
  /**
   * 记录资源分析
   * @param {Object} data - 分析数据
   */
  recordResourceAnalysis(data) {
    if (!this.isMonitoring) return;
    
    const { resources, type } = data;
    const count = Array.isArray(resources) ? resources.length : 1;
    
    this.metrics.resourceAnalysis.total += count;
    
    if (type) {
      this.metrics.resourceAnalysis.byType[type] = 
        (this.metrics.resourceAnalysis.byType[type] || 0) + count;
    }
    
    if (Array.isArray(resources)) {
      resources.forEach(resource => {
        const resourceType = resource.type || 'unknown';
        this.metrics.resourceAnalysis.byType[resourceType] = 
          (this.metrics.resourceAnalysis.byType[resourceType] || 0) + 1;
      });
    }
    
    this.notifyListeners('resourceAnalysis', {
      timestamp: Date.now(),
      count: count,
      type: type,
      metrics: this.metrics.resourceAnalysis
    });
  }
  
  /**
   * 记录资源下载
   * @param {Object} data - 下载数据
   */
  recordResourceDownload(data) {
    if (!this.isMonitoring) return;
    
    const { resource, status, progress, error } = data;
    
    if (status === 'start') {
      this.metrics.resourceDownload.total += 1;
      this.metrics.resourceDownload.inProgress += 1;
      
      if (resource && resource.type) {
        this.metrics.resourceDownload.byType[resource.type] = 
          (this.metrics.resourceDownload.byType[resource.type] || 0) + 1;
      }
      
      if (resource && resource.size) {
        this.metrics.resourceDownload.totalSize += resource.size;
      }
    } else if (status === 'progress') {
      if (progress && progress.bytesDownloaded) {
        this.metrics.resourceDownload.downloadedSize = progress.bytesDownloaded;
      }
    } else if (status === 'complete') {
      this.metrics.resourceDownload.completed += 1;
      this.metrics.resourceDownload.inProgress -= 1;
      
      if (resource && resource.size) {
        this.metrics.resourceDownload.downloadedSize += resource.size;
      }
    } else if (status === 'error') {
      this.metrics.resourceDownload.failed += 1;
      this.metrics.resourceDownload.inProgress -= 1;
      
      if (error) {
        this.recordError({
          type: 'download',
          message: error.message || 'Download failed',
          resource: resource,
          timestamp: Date.now()
        });
      }
    }
    
    this.notifyListeners('resourceDownload', {
      timestamp: Date.now(),
      status: status,
      resource: resource,
      metrics: this.metrics.resourceDownload
    });
  }
  
  /**
   * 记录缓存命中
   * @param {Object} data - 缓存数据
   */
  recordCacheHit(data) {
    if (!this.isMonitoring) return;
    
    this.metrics.performance.cacheHits += 1;
    
    this.notifyListeners('cacheHit', {
      timestamp: Date.now(),
      data: data,
      metrics: {
        cacheHits: this.metrics.performance.cacheHits,
        cacheMisses: this.metrics.performance.cacheMisses
      }
    });
  }
  
  /**
   * 记录缓存未命中
   * @param {Object} data - 缓存数据
   */
  recordCacheMiss(data) {
    if (!this.isMonitoring) return;
    
    this.metrics.performance.cacheMisses += 1;
    
    this.notifyListeners('cacheMiss', {
      timestamp: Date.now(),
      data: data,
      metrics: {
        cacheHits: this.metrics.performance.cacheHits,
        cacheMisses: this.metrics.performance.cacheMisses
      }
    });
  }
  
  /**
   * 记录错误
   * @param {Object} error - 错误数据
   */
  recordError(error) {
    if (!this.isMonitoring) return;
    
    const errorWithTimestamp = {
      ...error,
      timestamp: error.timestamp || Date.now()
    };
    
    this.metrics.errors.push(errorWithTimestamp);
    
    this.notifyListeners('error', {
      timestamp: Date.now(),
      error: errorWithTimestamp,
      errorCount: this.metrics.errors.length
    });
  }
  
  /**
   * 获取监控指标
   * @returns {Object} 监控指标
   */
  getMetrics() {
    this.calculateFinalMetrics();
    
    return {
      ...this.metrics,
      timestamp: Date.now(),
      isMonitoring: this.isMonitoring
    };
  }
  
  /**
   * 添加监听器
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @returns {string} 监听器ID
   */
  addListener(event, callback) {
    if (typeof callback !== 'function') return null;
    
    const listenerId = `${event}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Map());
    }
    
    this.listeners.get(event).set(listenerId, callback);
    
    return listenerId;
  }
  
  /**
   * 移除监听器
   * @param {string} listenerId - 监听器ID
   * @returns {boolean} 是否成功移除
   */
  removeListener(listenerId) {
    if (!listenerId) return false;
    
    for (const [event, listeners] of this.listeners.entries()) {
      if (listeners.has(listenerId)) {
        listeners.delete(listenerId);
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 通知监听器
   * @private
   * @param {string} event - 事件名称
   * @param {Object} data - 事件数据
   */
  notifyListeners(event, data) {
    if (!this.listeners.has(event)) return;
    
    const listeners = this.listeners.get(event);
    
    for (const callback of listeners.values()) {
      try {
        callback(data);
      } catch (e) {
        console.error(`监听器错误 (${event}):`, e);
      }
    }
  }
}

const monitoringService = new MonitoringService();

export default monitoringService;
