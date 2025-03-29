/**
 * @file download-logger.js
 * @description 下载状态日志记录服务，跟踪和记录资源下载事件
 * @version 2.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import loggingService, { LogLevel, LogCategory } from './logging-service.js';

/**
 * 下载状态日志记录服务
 * @class DownloadLogger
 */
class DownloadLogger {
  /**
   * 创建下载状态日志记录服务实例
   */
  constructor() {
    this.activeDownloads = new Map();
    this.downloadHistory = [];
    this.downloadStats = {
      totalDownloads: 0,
      successfulDownloads: 0,
      failedDownloads: 0,
      totalBytes: 0,
      averageSpeed: 0
    };
    
    this.downloadQueue = [];
    
    this.priorityConfig = {
      fileType: {
        'image': 1.2,
        'video': 1.5,
        'audio': 1.3,
        'document': 1.0,
        'archive': 0.8,
        'other': 0.7
      },
      fileSize: {
        small: 1.3,  // < 1MB
        medium: 1.0, // 1-10MB
        large: 0.7   // > 10MB
      },
      networkCondition: {
        good: 1.2,    // > 5Mbps
        average: 1.0, // 1-5Mbps
        poor: 0.5     // < 1Mbps
      }
    };
    
    this.networkSpeedHistory = {
      hourly: {},     // 按小时统计
      daily: {},      // 按天统计
      weekly: {}      // 按周统计
    };
    
    this.resumableDownloads = new Map();
    
    this._setupDownloadListeners();
    this._loadNetworkSpeedHistory();
    this._loadResumableDownloads();
  }
  
  /**
   * 设置下载事件监听器
   * @private
   */
  _setupDownloadListeners() {
    try {
      chrome.downloads.onCreated.addListener(this._handleDownloadCreated.bind(this));
      
      chrome.downloads.onChanged.addListener(this._handleDownloadChanged.bind(this));
      
      chrome.downloads.onDeterminingFilename.addListener(this._handleDownloadFilename.bind(this));
      
      loggingService.debug(LogCategory.DOWNLOAD, '下载监听器已设置');
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '设置下载监听器失败', {
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * 处理下载创建事件
   * @private
   * @param {Object} downloadItem - 下载项
   */
  _handleDownloadCreated(downloadItem) {
    try {
      const downloadId = downloadItem.id;
      const url = downloadItem.url;
      const startTime = Date.now();
      
      this.activeDownloads.set(downloadId, {
        id: downloadId,
        url: url,
        startTime: startTime,
        filename: downloadItem.filename || '未知文件名',
        fileSize: downloadItem.fileSize || 0,
        mime: downloadItem.mime || '未知类型',
        estimatedEndTime: downloadItem.estimatedEndTime,
        state: downloadItem.state || 'in_progress',
        progress: 0,
        bytesReceived: 0,
        speed: 0,
        error: null
      });
      
      loggingService.info(LogCategory.DOWNLOAD, '下载已开始', {
        downloadId: downloadId,
        url: this._sanitizeUrl(url),
        filename: this._getFilenameFromPath(downloadItem.filename || ''),
        fileSize: this._formatFileSize(downloadItem.fileSize),
        mime: downloadItem.mime,
        startTime: startTime
      });
      
      this.downloadStats.totalDownloads++;
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '处理下载创建事件失败', {
        error: error.message,
        downloadId: downloadItem?.id,
        url: this._sanitizeUrl(downloadItem?.url || '')
      });
    }
  }
  
  /**
   * 处理下载变化事件
   * @private
   * @param {Object} downloadDelta - 下载变化信息
   */
  _handleDownloadChanged(downloadDelta) {
    try {
      const downloadId = downloadDelta.id;
      
      if (!this.activeDownloads.has(downloadId)) {
        return;
      }
      
      const downloadInfo = this.activeDownloads.get(downloadId);
      const currentTime = Date.now();
      
      if (downloadDelta.state) {
        const newState = downloadDelta.state.current;
        const oldState = downloadInfo.state;
        
        downloadInfo.state = newState;
        
        loggingService.debug(LogCategory.DOWNLOAD, '下载状态已变化', {
          downloadId: downloadId,
          filename: this._getFilenameFromPath(downloadInfo.filename),
          oldState: oldState,
          newState: newState,
          elapsedTime: currentTime - downloadInfo.startTime
        });
        
        if (newState === 'complete') {
          this._handleDownloadComplete(downloadId, downloadInfo, currentTime);
        }
        
        if (newState === 'interrupted') {
          this._handleDownloadInterrupted(downloadId, downloadInfo, downloadDelta, currentTime);
        }
      }
      
      if (downloadDelta.filename) {
        const newFilename = downloadDelta.filename.current;
        const oldFilename = downloadInfo.filename;
        
        downloadInfo.filename = newFilename;
        
        loggingService.debug(LogCategory.DOWNLOAD, '下载文件名已变化', {
          downloadId: downloadId,
          oldFilename: this._getFilenameFromPath(oldFilename),
          newFilename: this._getFilenameFromPath(newFilename)
        });
      }
      
      if (downloadDelta.bytesReceived) {
        const bytesReceived = downloadDelta.bytesReceived.current;
        const oldBytesReceived = downloadInfo.bytesReceived;
        const deltaBytes = bytesReceived - oldBytesReceived;
        const deltaTime = currentTime - (downloadInfo.lastUpdateTime || downloadInfo.startTime);
        
        const speed = deltaTime > 0 ? (deltaBytes / (deltaTime / 1000)) : 0;
        
        downloadInfo.bytesReceived = bytesReceived;
        downloadInfo.lastUpdateTime = currentTime;
        downloadInfo.speed = speed;
        
        if (downloadInfo.fileSize > 0) {
          downloadInfo.progress = Math.min(100, Math.round((bytesReceived / downloadInfo.fileSize) * 100));
        }
        
        if (Math.floor(downloadInfo.progress / 10) > Math.floor(((oldBytesReceived / downloadInfo.fileSize) * 100) / 10)) {
          loggingService.debug(LogCategory.DOWNLOAD, '下载进度更新', {
            downloadId: downloadId,
            filename: this._getFilenameFromPath(downloadInfo.filename),
            progress: `${downloadInfo.progress}%`,
            bytesReceived: this._formatFileSize(bytesReceived),
            totalSize: this._formatFileSize(downloadInfo.fileSize),
            speed: this._formatSpeed(speed),
            elapsedTime: this._formatTime(currentTime - downloadInfo.startTime)
          });
        }
      }
      
      this.activeDownloads.set(downloadId, downloadInfo);
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '处理下载变化事件失败', {
        error: error.message,
        downloadId: downloadDelta?.id
      });
    }
  }
  
  /**
   * 处理下载文件名确定事件
   * @private
   * @param {Object} downloadItem - 下载项
   * @param {string} suggestedFilename - 建议的文件名
   */
  _handleDownloadFilename(downloadItem, suggestedFilename) {
    try {
      const downloadId = downloadItem.id;
      
      if (!this.activeDownloads.has(downloadId)) {
        return;
      }
      
      const downloadInfo = this.activeDownloads.get(downloadId);
      
      downloadInfo.suggestedFilename = suggestedFilename;
      
      loggingService.debug(LogCategory.DOWNLOAD, '下载文件名已确定', {
        downloadId: downloadId,
        filename: suggestedFilename,
        url: this._sanitizeUrl(downloadInfo.url)
      });
      
      this.activeDownloads.set(downloadId, downloadInfo);
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '处理下载文件名确定事件失败', {
        error: error.message,
        downloadId: downloadItem?.id
      });
    }
  }
  
  /**
   * 处理下载完成事件
   * @private
   * @param {number} downloadId - 下载ID
   * @param {Object} downloadInfo - 下载信息
   * @param {number} currentTime - 当前时间
   */
  _handleDownloadComplete(downloadId, downloadInfo, currentTime) {
    try {
      const elapsedTime = currentTime - downloadInfo.startTime;
      const averageSpeed = elapsedTime > 0 ? (downloadInfo.bytesReceived / (elapsedTime / 1000)) : 0;
      
      loggingService.info(LogCategory.DOWNLOAD, '下载已完成', {
        downloadId: downloadId,
        filename: this._getFilenameFromPath(downloadInfo.filename),
        fileSize: this._formatFileSize(downloadInfo.fileSize),
        elapsedTime: this._formatTime(elapsedTime),
        averageSpeed: this._formatSpeed(averageSpeed),
        url: this._sanitizeUrl(downloadInfo.url),
        mime: downloadInfo.mime
      });
      
      this.downloadStats.successfulDownloads++;
      this.downloadStats.totalBytes += downloadInfo.bytesReceived;
      
      const totalSuccessful = this.downloadStats.successfulDownloads;
      this.downloadStats.averageSpeed = (this.downloadStats.averageSpeed * (totalSuccessful - 1) + averageSpeed) / totalSuccessful;
      
      this.downloadHistory.push({
        id: downloadId,
        url: downloadInfo.url,
        filename: downloadInfo.filename,
        fileSize: downloadInfo.fileSize,
        mime: downloadInfo.mime,
        startTime: downloadInfo.startTime,
        endTime: currentTime,
        elapsedTime: elapsedTime,
        averageSpeed: averageSpeed,
        status: 'complete'
      });
      
      if (this.downloadHistory.length > 100) {
        this.downloadHistory.shift();
      }
      
      this.activeDownloads.delete(downloadId);
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '处理下载完成事件失败', {
        error: error.message,
        downloadId: downloadId
      });
    }
  }
  
  /**
   * 处理下载中断事件
   * @private
   * @param {number} downloadId - 下载ID
   * @param {Object} downloadInfo - 下载信息
   * @param {Object} downloadDelta - 下载变化信息
   * @param {number} currentTime - 当前时间
   */
  _handleDownloadInterrupted(downloadId, downloadInfo, downloadDelta, currentTime) {
    try {
      const elapsedTime = currentTime - downloadInfo.startTime;
      const error = downloadDelta.error ? downloadDelta.error.current : '未知错误';
      
      loggingService.warn(LogCategory.DOWNLOAD, '下载已中断', {
        downloadId: downloadId,
        filename: this._getFilenameFromPath(downloadInfo.filename),
        error: error,
        elapsedTime: this._formatTime(elapsedTime),
        bytesReceived: this._formatFileSize(downloadInfo.bytesReceived),
        totalSize: this._formatFileSize(downloadInfo.fileSize),
        progress: `${downloadInfo.progress}%`,
        url: this._sanitizeUrl(downloadInfo.url)
      });
      
      this.downloadStats.failedDownloads++;
      
      this.downloadHistory.push({
        id: downloadId,
        url: downloadInfo.url,
        filename: downloadInfo.filename,
        fileSize: downloadInfo.fileSize,
        mime: downloadInfo.mime,
        startTime: downloadInfo.startTime,
        endTime: currentTime,
        elapsedTime: elapsedTime,
        bytesReceived: downloadInfo.bytesReceived,
        error: error,
        status: 'interrupted'
      });
      
      if (this.downloadHistory.length > 100) {
        this.downloadHistory.shift();
      }
      
      this.activeDownloads.delete(downloadId);
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '处理下载中断事件失败', {
        error: error.message,
        downloadId: downloadId
      });
    }
  }
  
  /**
   * 记录下载开始
   * @param {Object} resource - 资源对象
   * @returns {string} - 下载ID
   */
  logDownloadStart(resource) {
    try {
      const downloadId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      loggingService.info(LogCategory.DOWNLOAD, '手动下载已开始', {
        downloadId: downloadId,
        url: this._sanitizeUrl(resource.url),
        type: resource.type,
        size: resource.size,
        dimensions: resource.dimensions,
        quality: resource.quality,
        startTime: Date.now()
      });
      
      return downloadId;
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '记录下载开始失败', {
        error: error.message,
        resource: resource
      });
      return null;
    }
  }
  
  /**
   * 记录批量下载开始
   * @param {Array} resources - 资源数组
   * @returns {string} - 批量下载ID
   */
  logBatchDownloadStart(resources) {
    try {
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      loggingService.info(LogCategory.DOWNLOAD, '批量下载已开始', {
        batchId: batchId,
        resourceCount: resources.length,
        types: this._countResourceTypes(resources),
        totalSize: this._calculateTotalSize(resources),
        startTime: Date.now()
      });
      
      return batchId;
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '记录批量下载开始失败', {
        error: error.message,
        resourceCount: resources?.length
      });
      return null;
    }
  }
  
  /**
   * 记录批量下载完成
   * @param {string} batchId - 批量下载ID
   * @param {Object} stats - 下载统计信息
   */
  logBatchDownloadComplete(batchId, stats) {
    try {
      const endTime = Date.now();
      
      loggingService.info(LogCategory.DOWNLOAD, '批量下载已完成', {
        batchId: batchId,
        successCount: stats.successCount,
        failedCount: stats.failedCount,
        totalSize: this._formatFileSize(stats.totalBytes),
        elapsedTime: this._formatTime(endTime - stats.startTime),
        endTime: endTime
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '记录批量下载完成失败', {
        error: error.message,
        batchId: batchId
      });
    }
  }
  
  /**
   * 记录下载错误
   * @param {string} downloadId - 下载ID
   * @param {Object} resource - 资源对象
   * @param {Error} error - 错误对象
   */
  logDownloadError(downloadId, resource, error) {
    try {
      loggingService.error(LogCategory.DOWNLOAD, '下载错误', {
        downloadId: downloadId,
        url: this._sanitizeUrl(resource.url),
        type: resource.type,
        error: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
      
      this.downloadStats.failedDownloads++;
    } catch (err) {
      loggingService.error(LogCategory.DOWNLOAD, '记录下载错误失败', {
        error: err.message,
        originalError: error?.message,
        downloadId: downloadId
      });
    }
  }
  
  /**
   * 记录下载取消
   * @param {string} downloadId - 下载ID
   * @param {Object} resource - 资源对象
   */
  logDownloadCancelled(downloadId, resource) {
    try {
      loggingService.info(LogCategory.DOWNLOAD, '下载已取消', {
        downloadId: downloadId,
        url: this._sanitizeUrl(resource.url),
        type: resource.type,
        timestamp: Date.now()
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '记录下载取消失败', {
        error: error.message,
        downloadId: downloadId
      });
    }
  }
  
  /**
   * 记录下载暂停
   * @param {string} downloadId - 下载ID
   */
  logDownloadPaused(downloadId) {
    try {
      if (!this.activeDownloads.has(downloadId)) {
        return;
      }
      
      const downloadInfo = this.activeDownloads.get(downloadId);
      
      loggingService.info(LogCategory.DOWNLOAD, '下载已暂停', {
        downloadId: downloadId,
        filename: this._getFilenameFromPath(downloadInfo.filename),
        progress: `${downloadInfo.progress}%`,
        bytesReceived: this._formatFileSize(downloadInfo.bytesReceived),
        totalSize: this._formatFileSize(downloadInfo.fileSize),
        elapsedTime: this._formatTime(Date.now() - downloadInfo.startTime),
        timestamp: Date.now()
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '记录下载暂停失败', {
        error: error.message,
        downloadId: downloadId
      });
    }
  }
  
  /**
   * 记录下载恢复
   * @param {string} downloadId - 下载ID
   */
  logDownloadResumed(downloadId) {
    try {
      if (!this.activeDownloads.has(downloadId)) {
        return;
      }
      
      const downloadInfo = this.activeDownloads.get(downloadId);
      
      loggingService.info(LogCategory.DOWNLOAD, '下载已恢复', {
        downloadId: downloadId,
        filename: this._getFilenameFromPath(downloadInfo.filename),
        progress: `${downloadInfo.progress}%`,
        bytesReceived: this._formatFileSize(downloadInfo.bytesReceived),
        totalSize: this._formatFileSize(downloadInfo.fileSize),
        timestamp: Date.now()
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '记录下载恢复失败', {
        error: error.message,
        downloadId: downloadId
      });
    }
  }
  
  /**
   * 获取下载统计信息
   * @returns {Object} - 下载统计信息
   */
  getDownloadStats() {
    return {
      ...this.downloadStats,
      activeDownloads: this.activeDownloads.size,
      historySize: this.downloadHistory.length,
      averageSpeed: this._formatSpeed(this.downloadStats.averageSpeed),
      totalBytes: this._formatFileSize(this.downloadStats.totalBytes),
      successRate: this.downloadStats.totalDownloads > 0 
        ? ((this.downloadStats.successfulDownloads / this.downloadStats.totalDownloads) * 100).toFixed(2) + '%' 
        : '0%'
    };
  }
  
  /**
   * 获取活动下载
   * @returns {Array} - 活动下载数组
   */
  getActiveDownloads() {
    return Array.from(this.activeDownloads.values()).map(download => ({
      id: download.id,
      filename: this._getFilenameFromPath(download.filename),
      progress: download.progress,
      speed: this._formatSpeed(download.speed),
      bytesReceived: this._formatFileSize(download.bytesReceived),
      totalSize: this._formatFileSize(download.fileSize),
      elapsedTime: this._formatTime(Date.now() - download.startTime),
      state: download.state,
      mime: download.mime
    }));
  }
  
  /**
   * 获取下载历史
   * @param {number} limit - 限制数量
   * @returns {Array} - 下载历史数组
   */
  getDownloadHistory(limit = 20) {
    return this.downloadHistory.slice(-limit).map(download => ({
      id: download.id,
      filename: this._getFilenameFromPath(download.filename),
      fileSize: this._formatFileSize(download.fileSize),
      elapsedTime: this._formatTime(download.elapsedTime),
      averageSpeed: this._formatSpeed(download.averageSpeed),
      startTime: new Date(download.startTime).toLocaleString(),
      endTime: new Date(download.endTime).toLocaleString(),
      status: download.status,
      mime: download.mime
    }));
  }
  
  /**
   * 记录下载统计信息
   */
  logDownloadStats() {
    try {
      const stats = this.getDownloadStats();
      
      loggingService.info(LogCategory.DOWNLOAD, '下载统计信息', {
        ...stats,
        timestamp: Date.now()
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '记录下载统计信息失败', {
        error: error.message
      });
    }
  }
  
  /**
   * 清除下载历史
   */
  clearDownloadHistory() {
    try {
      const historySize = this.downloadHistory.length;
      
      this.downloadHistory = [];
      
      loggingService.info(LogCategory.DOWNLOAD, '下载历史已清除', {
        clearedEntries: historySize,
        timestamp: Date.now()
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '清除下载历史失败', {
        error: error.message
      });
    }
  }
  
  /**
   * 添加下载到优先级队列
   * @param {Object} downloadItem - 下载项
   * @returns {number} - 队列中的位置
   */
  addToDownloadQueue(downloadItem) {
    try {
      const priority = this._calculateDownloadPriority(downloadItem);
      const queueItem = {
        item: downloadItem,
        priority,
        addedTime: Date.now()
      };
      
      this.downloadQueue.push(queueItem);
      this._sortDownloadQueue();
      
      const position = this.downloadQueue.findIndex(item => 
        item.item.id === downloadItem.id
      );
      
      loggingService.info(LogCategory.DOWNLOAD, '下载已添加到队列', {
        downloadId: downloadItem.id,
        filename: this._getFilenameFromPath(downloadItem.filename || ''),
        priority: priority.toFixed(2),
        queuePosition: position + 1,
        queueLength: this.downloadQueue.length
      });
      
      return position;
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '添加下载到队列失败', {
        error: error.message,
        downloadId: downloadItem?.id
      });
      return -1;
    }
  }
  
  /**
   * 获取下载队列
   * @returns {Array} - 下载队列
   */
  getDownloadQueue() {
    return this.downloadQueue.map((item, index) => ({
      id: item.item.id,
      filename: this._getFilenameFromPath(item.item.filename || ''),
      priority: item.priority.toFixed(2),
      position: index + 1,
      fileSize: this._formatFileSize(item.item.fileSize),
      type: item.item.mime,
      addedTime: new Date(item.addedTime).toLocaleString()
    }));
  }
  
  /**
   * 获取下一个要下载的项
   * @returns {Object|null} - 下载项
   */
  getNextDownload() {
    if (this.downloadQueue.length === 0) {
      return null;
    }
    
    const nextItem = this.downloadQueue.shift();
    
    loggingService.info(LogCategory.DOWNLOAD, '从队列获取下一个下载', {
      downloadId: nextItem.item.id,
      filename: this._getFilenameFromPath(nextItem.item.filename || ''),
      priority: nextItem.priority.toFixed(2),
      remainingInQueue: this.downloadQueue.length
    });
    
    return nextItem.item;
  }
  
  /**
   * 计算下载优先级
   * @private
   * @param {Object} downloadItem - 下载项
   * @returns {number} - 优先级值
   */
  _calculateDownloadPriority(downloadItem) {
    try {
      let priority = 1.0;
      
      const mimeType = downloadItem.mime || '';
      let fileTypeFactor = this.priorityConfig.fileType.other;
      
      if (mimeType.startsWith('image/')) {
        fileTypeFactor = this.priorityConfig.fileType.image;
      } else if (mimeType.startsWith('video/')) {
        fileTypeFactor = this.priorityConfig.fileType.video;
      } else if (mimeType.startsWith('audio/')) {
        fileTypeFactor = this.priorityConfig.fileType.audio;
      } else if (mimeType.startsWith('application/pdf') || 
                mimeType.startsWith('text/') || 
                mimeType.includes('document')) {
        fileTypeFactor = this.priorityConfig.fileType.document;
      } else if (mimeType.includes('zip') || 
                mimeType.includes('rar') || 
                mimeType.includes('tar') || 
                mimeType.includes('7z')) {
        fileTypeFactor = this.priorityConfig.fileType.archive;
      }
      
      priority *= fileTypeFactor;
      
      const fileSize = downloadItem.fileSize || 0;
      let fileSizeFactor = this.priorityConfig.fileSize.medium;
      
      if (fileSize < 1024 * 1024) { // 小于1MB
        fileSizeFactor = this.priorityConfig.fileSize.small;
      } else if (fileSize > 10 * 1024 * 1024) { // 大于10MB
        fileSizeFactor = this.priorityConfig.fileSize.large;
      }
      
      priority *= fileSizeFactor;
      
      const networkSpeed = this._getCurrentNetworkSpeed();
      let networkFactor = this.priorityConfig.networkCondition.average;
      
      if (networkSpeed > 5 * 1024 * 1024) { // 大于5Mbps
        networkFactor = this.priorityConfig.networkCondition.good;
      } else if (networkSpeed < 1024 * 1024) { // 小于1Mbps
        networkFactor = this.priorityConfig.networkCondition.poor;
      }
      
      priority *= networkFactor;
      
      return priority;
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '计算下载优先级失败', {
        error: error.message,
        downloadId: downloadItem?.id
      });
      return 1.0;
    }
  }
  
  /**
   * 排序下载队列
   * @private
   */
  _sortDownloadQueue() {
    this.downloadQueue.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * 获取当前网络速度
   * @private
   * @returns {number} - 当前网络速度（字节/秒）
   */
  _getCurrentNetworkSpeed() {
    try {
      const recentDownloads = this.downloadHistory
        .filter(download => download.status === 'complete')
        .slice(-5);
      
      if (recentDownloads.length === 0) {
        return 1024 * 1024; // 默认1Mbps
      }
      
      const totalSpeed = recentDownloads.reduce((sum, download) => 
        sum + download.averageSpeed, 0);
      
      return totalSpeed / recentDownloads.length;
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '获取当前网络速度失败', {
        error: error.message
      });
      return 1024 * 1024; // 默认1Mbps
    }
  }
  
  /**
   * 记录网络速度
   * @private
   * @param {number} speed - 网络速度（字节/秒）
   * @param {number} timestamp - 时间戳
   */
  _recordNetworkSpeed(speed, timestamp = Date.now()) {
    try {
      const date = new Date(timestamp);
      
      const hourKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${date.getHours()}`;
      if (!this.networkSpeedHistory.hourly[hourKey]) {
        this.networkSpeedHistory.hourly[hourKey] = {
          speeds: [],
          average: 0,
          count: 0
        };
      }
      
      this.networkSpeedHistory.hourly[hourKey].speeds.push(speed);
      this.networkSpeedHistory.hourly[hourKey].count++;
      this.networkSpeedHistory.hourly[hourKey].average = 
        this.networkSpeedHistory.hourly[hourKey].speeds.reduce((sum, s) => sum + s, 0) / 
        this.networkSpeedHistory.hourly[hourKey].count;
      
      const dayKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      if (!this.networkSpeedHistory.daily[dayKey]) {
        this.networkSpeedHistory.daily[dayKey] = {
          speeds: [],
          average: 0,
          count: 0
        };
      }
      
      this.networkSpeedHistory.daily[dayKey].speeds.push(speed);
      this.networkSpeedHistory.daily[dayKey].count++;
      this.networkSpeedHistory.daily[dayKey].average = 
        this.networkSpeedHistory.daily[dayKey].speeds.reduce((sum, s) => sum + s, 0) / 
        this.networkSpeedHistory.daily[dayKey].count;
      
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = `${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
      
      if (!this.networkSpeedHistory.weekly[weekKey]) {
        this.networkSpeedHistory.weekly[weekKey] = {
          speeds: [],
          average: 0,
          count: 0
        };
      }
      
      this.networkSpeedHistory.weekly[weekKey].speeds.push(speed);
      this.networkSpeedHistory.weekly[weekKey].count++;
      this.networkSpeedHistory.weekly[weekKey].average = 
        this.networkSpeedHistory.weekly[weekKey].speeds.reduce((sum, s) => sum + s, 0) / 
        this.networkSpeedHistory.weekly[weekKey].count;
      
      this._saveNetworkSpeedHistory();
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '记录网络速度失败', {
        error: error.message,
        speed
      });
    }
  }
  
  /**
   * 保存网络速度历史
   * @private
   */
  _saveNetworkSpeedHistory() {
    try {
      const limitHistorySize = (history, maxEntries = 24) => {
        const keys = Object.keys(history).sort();
        if (keys.length > maxEntries) {
          const keysToRemove = keys.slice(0, keys.length - maxEntries);
          keysToRemove.forEach(key => {
            delete history[key];
          });
        }
      };
      
      limitHistorySize(this.networkSpeedHistory.hourly, 24); // 保留24小时
      limitHistorySize(this.networkSpeedHistory.daily, 30);  // 保留30天
      limitHistorySize(this.networkSpeedHistory.weekly, 12); // 保留12周
      
      chrome.storage.local.set({
        'networkSpeedHistory': this.networkSpeedHistory
      }, () => {
        if (chrome.runtime.lastError) {
          loggingService.error(LogCategory.DOWNLOAD, '保存网络速度历史失败', {
            error: chrome.runtime.lastError.message
          });
        }
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '保存网络速度历史失败', {
        error: error.message
      });
    }
  }
  
  /**
   * 加载网络速度历史
   * @private
   */
  _loadNetworkSpeedHistory() {
    try {
      chrome.storage.local.get('networkSpeedHistory', (result) => {
        if (chrome.runtime.lastError) {
          loggingService.error(LogCategory.DOWNLOAD, '加载网络速度历史失败', {
            error: chrome.runtime.lastError.message
          });
          return;
        }
        
        if (result.networkSpeedHistory) {
          this.networkSpeedHistory = result.networkSpeedHistory;
          loggingService.debug(LogCategory.DOWNLOAD, '网络速度历史已加载');
        }
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '加载网络速度历史失败', {
        error: error.message
      });
    }
  }
  
  /**
   * 获取网络速度分析
   * @returns {Object} - 网络速度分析结果
   */
  getNetworkSpeedAnalysis() {
    try {
      const hourlyData = this.networkSpeedHistory.hourly;
      const hourlyKeys = Object.keys(hourlyData);
      
      if (hourlyKeys.length === 0) {
        return {
          bestDownloadTime: '暂无数据',
          averageSpeed: this._formatSpeed(this._getCurrentNetworkSpeed()),
          speedTrend: '稳定',
          recommendations: ['暂无足够数据提供建议']
        };
      }
      
      const hourlyAverages = {};
      hourlyKeys.forEach(key => {
        const hour = parseInt(key.split('-')[3]);
        if (!hourlyAverages[hour]) {
          hourlyAverages[hour] = {
            total: 0,
            count: 0
          };
        }
        
        hourlyAverages[hour].total += hourlyData[key].average;
        hourlyAverages[hour].count++;
      });
      
      let bestHour = 0;
      let bestSpeed = 0;
      
      Object.keys(hourlyAverages).forEach(hour => {
        const avgSpeed = hourlyAverages[hour].total / hourlyAverages[hour].count;
        if (avgSpeed > bestSpeed) {
          bestSpeed = avgSpeed;
          bestHour = parseInt(hour);
        }
      });
      
      const recentKeys = hourlyKeys.slice(-24).sort();
      let speedTrend = '稳定';
      
      if (recentKeys.length >= 3) {
        const recentSpeeds = recentKeys.map(key => hourlyData[key].average);
        const firstHalf = recentSpeeds.slice(0, Math.floor(recentSpeeds.length / 2));
        const secondHalf = recentSpeeds.slice(Math.floor(recentSpeeds.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, speed) => sum + speed, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, speed) => sum + speed, 0) / secondHalf.length;
        
        const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
        
        if (changePercent > 10) {
          speedTrend = '上升';
        } else if (changePercent < -10) {
          speedTrend = '下降';
        }
      }
      
      const recommendations = [];
      
      if (bestSpeed > 0) {
        recommendations.push(`最佳下载时间为每天${bestHour}:00-${bestHour + 1}:00，平均速度${this._formatSpeed(bestSpeed)}`);
      }
      
      if (speedTrend === '下降') {
        recommendations.push('网络速度呈下降趋势，建议检查网络连接或选择网速较好的时段下载');
      }
      
      const currentSpeed = this._getCurrentNetworkSpeed();
      if (currentSpeed < 512 * 1024) { // 小于512KB/s
        recommendations.push('当前网络速度较慢，建议优先下载小文件，大文件稍后下载');
      }
      
      return {
        bestDownloadTime: bestHour !== null ? `${bestHour}:00-${bestHour + 1}:00` : '暂无数据',
        averageSpeed: this._formatSpeed(this._getCurrentNetworkSpeed()),
        speedTrend,
        recommendations: recommendations.length > 0 ? recommendations : ['网络状况良好，可以正常下载']
      };
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '获取网络速度分析失败', {
        error: error.message
      });
      
      return {
        bestDownloadTime: '分析失败',
        averageSpeed: this._formatSpeed(this._getCurrentNetworkSpeed()),
        speedTrend: '未知',
        recommendations: ['网络分析出错，请稍后再试']
      };
    }
  }
  
  /**
   * 保存可恢复下载
   * @param {Object} downloadItem - 下载项
   */
  saveResumableDownload(downloadItem) {
    try {
      const downloadId = downloadItem.id;
      const resumableInfo = {
        id: downloadId,
        url: downloadItem.url,
        filename: downloadItem.filename,
        fileSize: downloadItem.fileSize,
        bytesReceived: downloadItem.bytesReceived || 0,
        mime: downloadItem.mime,
        timestamp: Date.now()
      };
      
      this.resumableDownloads.set(downloadId, resumableInfo);
      
      this._saveResumableDownloads();
      
      loggingService.info(LogCategory.DOWNLOAD, '已保存可恢复下载', {
        downloadId,
        filename: this._getFilenameFromPath(downloadItem.filename),
        progress: downloadItem.bytesReceived ? 
          `${Math.round((downloadItem.bytesReceived / downloadItem.fileSize) * 100)}%` : '0%'
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '保存可恢复下载失败', {
        error: error.message,
        downloadId: downloadItem?.id
      });
    }
  }
  
  /**
   * 获取可恢复下载列表
   * @returns {Array} - 可恢复下载列表
   */
  getResumableDownloads() {
    return Array.from(this.resumableDownloads.values()).map(download => ({
      id: download.id,
      filename: this._getFilenameFromPath(download.filename),
      fileSize: this._formatFileSize(download.fileSize),
      bytesReceived: this._formatFileSize(download.bytesReceived),
      progress: download.fileSize ? 
        `${Math.round((download.bytesReceived / download.fileSize) * 100)}%` : '0%',
      mime: download.mime,
      savedTime: new Date(download.timestamp).toLocaleString()
    }));
  }
  
  /**
   * 恢复下载
   * @param {string} downloadId - 下载ID
   * @returns {Promise<Object>} - 新的下载信息
   */
  async resumeDownload(downloadId) {
    try {
      if (!this.resumableDownloads.has(downloadId)) {
        throw new Error('找不到可恢复的下载');
      }
      
      const resumableInfo = this.resumableDownloads.get(downloadId);
      
      loggingService.info(LogCategory.DOWNLOAD, '正在恢复下载', {
        downloadId,
        filename: this._getFilenameFromPath(resumableInfo.filename),
        bytesReceived: this._formatFileSize(resumableInfo.bytesReceived),
        totalSize: this._formatFileSize(resumableInfo.fileSize)
      });
      
      return new Promise((resolve, reject) => {
        const options = {
          url: resumableInfo.url,
          filename: this._getFilenameFromPath(resumableInfo.filename),
          conflictAction: 'uniquify',
          headers: [
            {
              name: 'Range',
              value: `bytes=${resumableInfo.bytesReceived}-`
            }
          ]
        };
        
        chrome.downloads.download(options, (newDownloadId) => {
          if (chrome.runtime.lastError) {
            loggingService.error(LogCategory.DOWNLOAD, '恢复下载失败', {
              error: chrome.runtime.lastError.message,
              originalDownloadId: downloadId
            });
            reject(chrome.runtime.lastError);
            return;
          }
          
          this.resumableDownloads.delete(downloadId);
          this._saveResumableDownloads();
          
          loggingService.info(LogCategory.DOWNLOAD, '下载已恢复', {
            originalDownloadId: downloadId,
            newDownloadId,
            filename: this._getFilenameFromPath(resumableInfo.filename)
          });
          
          resolve({
            originalId: downloadId,
            newId: newDownloadId,
            filename: resumableInfo.filename,
            bytesReceived: resumableInfo.bytesReceived,
            fileSize: resumableInfo.fileSize
          });
        });
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '恢复下载失败', {
        error: error.message,
        downloadId
      });
      throw error;
    }
  }
  
  /**
   * 删除可恢复下载
   * @param {string} downloadId - 下载ID
   */
  removeResumableDownload(downloadId) {
    try {
      if (!this.resumableDownloads.has(downloadId)) {
        return;
      }
      
      const resumableInfo = this.resumableDownloads.get(downloadId);
      
      this.resumableDownloads.delete(downloadId);
      this._saveResumableDownloads();
      
      loggingService.info(LogCategory.DOWNLOAD, '已删除可恢复下载', {
        downloadId,
        filename: this._getFilenameFromPath(resumableInfo.filename)
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '删除可恢复下载失败', {
        error: error.message,
        downloadId
      });
    }
  }
  
  /**
   * 保存可恢复下载列表
   * @private
   */
  _saveResumableDownloads() {
    try {
      const resumableArray = Array.from(this.resumableDownloads.values());
      
      chrome.storage.local.set({
        'resumableDownloads': resumableArray
      }, () => {
        if (chrome.runtime.lastError) {
          loggingService.error(LogCategory.DOWNLOAD, '保存可恢复下载列表失败', {
            error: chrome.runtime.lastError.message
          });
        }
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '保存可恢复下载列表失败', {
        error: error.message
      });
    }
  }
  
  /**
   * 加载可恢复下载列表
   * @private
   */
  _loadResumableDownloads() {
    try {
      chrome.storage.local.get('resumableDownloads', (result) => {
        if (chrome.runtime.lastError) {
          loggingService.error(LogCategory.DOWNLOAD, '加载可恢复下载列表失败', {
            error: chrome.runtime.lastError.message
          });
          return;
        }
        
        if (result.resumableDownloads && Array.isArray(result.resumableDownloads)) {
          this.resumableDownloads = new Map();
          
          result.resumableDownloads.forEach(download => {
            this.resumableDownloads.set(download.id, download);
          });
          
          loggingService.debug(LogCategory.DOWNLOAD, '可恢复下载列表已加载', {
            count: this.resumableDownloads.size
          });
        }
      });
    } catch (error) {
      loggingService.error(LogCategory.DOWNLOAD, '加载可恢复下载列表失败', {
        error: error.message
      });
    }
  }
  
  /**
   * 从路径中获取文件名
   * @private
   * @param {string} path - 文件路径
   * @returns {string} - 文件名
   */
  _getFilenameFromPath(path) {
    if (!path) return '未知文件名';
    
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  }
  
  /**
   * 格式化文件大小
   * @private
   * @param {number} bytes - 字节数
   * @returns {string} - 格式化后的文件大小
   */
  _formatFileSize(bytes) {
    if (bytes === undefined || bytes === null) return '未知大小';
    
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
  }
  
  /**
   * 格式化速度
   * @private
   * @param {number} bytesPerSecond - 每秒字节数
   * @returns {string} - 格式化后的速度
   */
  _formatSpeed(bytesPerSecond) {
    if (bytesPerSecond === undefined || bytesPerSecond === null) return '未知速度';
    
    if (bytesPerSecond === 0) return '0 B/s';
    
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(1024));
    
    return (bytesPerSecond / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
  }
  
  /**
   * 格式化时间
   * @private
   * @param {number} milliseconds - 毫秒数
   * @returns {string} - 格式化后的时间
   */
  _formatTime(milliseconds) {
    if (milliseconds === undefined || milliseconds === null) return '未知时间';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}小时 ${minutes % 60}分钟 ${seconds % 60}秒`;
    } else if (minutes > 0) {
      return `${minutes}分钟 ${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }
  
  /**
   * 净化URL
   * @private
   * @param {string} url - URL
   * @returns {string} - 净化后的URL
   */
  _sanitizeUrl(url) {
    if (!url) return '未知URL';
    
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch (error) {
      return url;
    }
  }
  
  /**
   * 统计资源类型
   * @private
   * @param {Array} resources - 资源数组
   * @returns {Object} - 类型统计
   */
  _countResourceTypes(resources) {
    const types = {};
    
    resources.forEach(resource => {
      const type = resource.type || '未知类型';
      types[type] = (types[type] || 0) + 1;
    });
    
    return types;
  }
  
  /**
   * 计算总大小
   * @private
   * @param {Array} resources - 资源数组
   * @returns {string} - 总大小
   */
  _calculateTotalSize(resources) {
    let totalBytes = 0;
    
    resources.forEach(resource => {
      if (resource.size) {
        const sizeMatch = resource.size.match(/(\d+(\.\d+)?)\s*(B|KB|MB|GB|TB)?/i);
        
        if (sizeMatch) {
          const value = parseFloat(sizeMatch[1]);
          const unit = (sizeMatch[3] || 'B').toUpperCase();
          
          const unitMultipliers = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024,
            'TB': 1024 * 1024 * 1024 * 1024
          };
          
          totalBytes += value * (unitMultipliers[unit] || 1);
        }
      }
    });
    
    return this._formatFileSize(totalBytes);
  }
}

const downloadLogger = new DownloadLogger();

export default downloadLogger;
