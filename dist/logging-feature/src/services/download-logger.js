/**
 * @file download-logger.js
 * @description 下载状态日志记录服务，跟踪和记录资源下载事件
 * @version 1.0.0
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
    
    this._setupDownloadListeners();
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
