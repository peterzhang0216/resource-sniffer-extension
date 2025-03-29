/**
 * @file download-service.js
 * @description 下载管理服务，处理资源下载、队列和历史
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { DEFAULT_DOWNLOAD_SETTINGS, FILENAME_FORMATS } from '../config/settings.js';
import FileUtils from '../utils/file-utils.js';
import URLUtils from '../utils/url-utils.js';

/**
 * 下载管理服务
 * @class DownloadService
 */
class DownloadService {
  /**
   * 创建下载服务实例
   */
  constructor() {
    this.downloadQueue = [];
    this.activeDownloads = {};
    this.downloadHistory = [];
    this.settings = DEFAULT_DOWNLOAD_SETTINGS;
    this.isProcessingQueue = false;
    this.listeners = {
      onProgress: [],
      onComplete: [],
      onError: [],
      onQueueChange: []
    };
    
    this._loadDownloadHistory();
  }
  
  /**
   * 添加资源到下载队列
   * @param {Object} resource - 资源对象
   * @param {Object} options - 下载选项
   * @returns {string} - 下载ID
   */
  addToQueue(resource, options = {}) {
    if (!resource || !resource.url) return null;
    
    const downloadId = 'download_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    this.downloadQueue.push({
      id: downloadId,
      resource: resource,
      options: options,
      status: 'queued',
      timestamp: Date.now()
    });
    
    this._triggerEvent('onQueueChange', this.downloadQueue);
    
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
    
    return downloadId;
  }
  
  /**
   * 批量添加资源到下载队列
   * @param {Array} resources - 资源数组
   * @param {Object} options - 下载选项
   * @returns {Array} - 下载ID数组
   */
  addBatchToQueue(resources, options = {}) {
    if (!resources || !Array.isArray(resources)) return [];
    
    const downloadIds = [];
    
    resources.forEach(resource => {
      const downloadId = this.addToQueue(resource, options);
      if (downloadId) {
        downloadIds.push(downloadId);
      }
    });
    
    return downloadIds;
  }
  
  /**
   * 处理下载队列
   */
  processQueue() {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    const processNext = () => {
      const activeCount = Object.keys(this.activeDownloads).length;
      
      if (activeCount >= this.settings.maxConcurrentDownloads) {
        setTimeout(processNext, 500);
        return;
      }
      
      const nextDownload = this.downloadQueue.find(item => item.status === 'queued');
      
      if (!nextDownload) {
        this.isProcessingQueue = false;
        return;
      }
      
      this._startDownload(nextDownload);
      
      setTimeout(processNext, 100);
    };
    
    processNext();
  }
  
  /**
   * 开始下载资源
   * @param {Object} downloadItem - 下载项
   * @private
   */
  _startDownload(downloadItem) {
    if (!downloadItem || !downloadItem.resource || !downloadItem.resource.url) return;
    
    const { resource, options, id } = downloadItem;
    
    downloadItem.status = 'downloading';
    downloadItem.startTime = Date.now();
    
    const filename = this._generateFilename(resource, options);
    
    const downloadOptions = {
      url: resource.url,
      filename: filename,
      conflictAction: 'uniquify',
      saveAs: options.saveAs || false
    };
    
    chrome.downloads.download(downloadOptions, (downloadId) => {
      if (chrome.runtime.lastError) {
        this._handleDownloadError(id, chrome.runtime.lastError.message);
        return;
      }
      
      this.activeDownloads[id] = {
        chromeDownloadId: downloadId,
        item: downloadItem,
        progress: 0,
        bytesReceived: 0,
        totalBytes: 0,
        filename: filename
      };
      
      this._addToHistory({
        id: id,
        url: resource.url,
        filename: filename,
        startTime: downloadItem.startTime,
        status: 'in_progress',
        type: resource.type,
        size: resource.size,
        chromeDownloadId: downloadId
      });
      
      this._triggerEvent('onQueueChange', this.downloadQueue);
    });
  }
  
  /**
   * 处理下载错误
   * @param {string} downloadId - 下载ID
   * @param {string} errorMessage - 错误信息
   * @private
   */
  _handleDownloadError(downloadId, errorMessage) {
    const downloadItem = this.downloadQueue.find(item => item.id === downloadId);
    
    if (downloadItem) {
      downloadItem.status = 'error';
      downloadItem.error = errorMessage;
      
      this._updateHistoryItem(downloadId, {
        status: 'error',
        error: errorMessage,
        endTime: Date.now()
      });
      
      this._triggerEvent('onError', {
        id: downloadId,
        error: errorMessage,
        item: downloadItem
      });
      
      delete this.activeDownloads[downloadId];
      
      this._triggerEvent('onQueueChange', this.downloadQueue);
    }
  }
  
  /**
   * 更新下载进度
   * @param {number} chromeDownloadId - Chrome下载ID
   * @param {Object} downloadDelta - 下载变化信息
   */
  updateDownloadProgress(chromeDownloadId, downloadDelta) {
    const downloadId = Object.keys(this.activeDownloads).find(
      id => this.activeDownloads[id].chromeDownloadId === chromeDownloadId
    );
    
    if (!downloadId) return;
    
    const activeDownload = this.activeDownloads[downloadId];
    
    if (downloadDelta.bytesReceived !== undefined) {
      activeDownload.bytesReceived = downloadDelta.bytesReceived;
    }
    
    if (downloadDelta.totalBytes !== undefined) {
      activeDownload.totalBytes = downloadDelta.totalBytes;
    }
    
    if (activeDownload.totalBytes > 0) {
      activeDownload.progress = Math.round((activeDownload.bytesReceived / activeDownload.totalBytes) * 100);
    }
    
    this._triggerEvent('onProgress', {
      id: downloadId,
      progress: activeDownload.progress,
      bytesReceived: activeDownload.bytesReceived,
      totalBytes: activeDownload.totalBytes,
      filename: activeDownload.filename
    });
    
    this._updateHistoryItem(downloadId, {
      progress: activeDownload.progress,
      bytesReceived: activeDownload.bytesReceived,
      totalBytes: activeDownload.totalBytes
    });
  }
  
  /**
   * 完成下载
   * @param {number} chromeDownloadId - Chrome下载ID
   * @param {Object} downloadItem - 下载项信息
   */
  completeDownload(chromeDownloadId, downloadItem) {
    const downloadId = Object.keys(this.activeDownloads).find(
      id => this.activeDownloads[id].chromeDownloadId === chromeDownloadId
    );
    
    if (!downloadId) return;
    
    const activeDownload = this.activeDownloads[downloadId];
    const queueItem = this.downloadQueue.find(item => item.id === downloadId);
    
    if (queueItem) {
      queueItem.status = 'complete';
      queueItem.endTime = Date.now();
      
      this._updateHistoryItem(downloadId, {
        status: 'complete',
        endTime: Date.now(),
        fileSize: downloadItem.fileSize,
        filename: downloadItem.filename
      });
      
      this._triggerEvent('onComplete', {
        id: downloadId,
        item: queueItem,
        filename: downloadItem.filename,
        fileSize: downloadItem.fileSize
      });
      
      delete this.activeDownloads[downloadId];
      
      this._triggerEvent('onQueueChange', this.downloadQueue);
    }
  }
  
  /**
   * 取消下载
   * @param {string} downloadId - 下载ID
   * @returns {boolean} - 是否成功取消
   */
  cancelDownload(downloadId) {
    const activeDownload = this.activeDownloads[downloadId];
    
    if (!activeDownload) {
      const queueIndex = this.downloadQueue.findIndex(item => item.id === downloadId && item.status === 'queued');
      
      if (queueIndex !== -1) {
        this.downloadQueue.splice(queueIndex, 1);
        
        this._triggerEvent('onQueueChange', this.downloadQueue);
        
        return true;
      }
      
      return false;
    }
    
    chrome.downloads.cancel(activeDownload.chromeDownloadId, () => {
      if (chrome.runtime.lastError) {
        console.error('取消下载失败:', chrome.runtime.lastError);
        return;
      }
      
      const queueItem = this.downloadQueue.find(item => item.id === downloadId);
      if (queueItem) {
        queueItem.status = 'cancelled';
      }
      
      this._updateHistoryItem(downloadId, {
        status: 'cancelled',
        endTime: Date.now()
      });
      
      delete this.activeDownloads[downloadId];
      
      this._triggerEvent('onQueueChange', this.downloadQueue);
    });
    
    return true;
  }
  
  /**
   * 暂停下载
   * @param {string} downloadId - 下载ID
   * @returns {boolean} - 是否成功暂停
   */
  pauseDownload(downloadId) {
    const activeDownload = this.activeDownloads[downloadId];
    
    if (!activeDownload) return false;
    
    chrome.downloads.pause(activeDownload.chromeDownloadId, () => {
      if (chrome.runtime.lastError) {
        console.error('暂停下载失败:', chrome.runtime.lastError);
        return;
      }
      
      const queueItem = this.downloadQueue.find(item => item.id === downloadId);
      if (queueItem) {
        queueItem.status = 'paused';
      }
      
      this._updateHistoryItem(downloadId, {
        status: 'paused'
      });
      
      this._triggerEvent('onQueueChange', this.downloadQueue);
    });
    
    return true;
  }
  
  /**
   * 恢复下载
   * @param {string} downloadId - 下载ID
   * @returns {boolean} - 是否成功恢复
   */
  resumeDownload(downloadId) {
    const historyItem = this.downloadHistory.find(item => item.id === downloadId);
    
    if (!historyItem || historyItem.status !== 'interrupted') return false;
    
    chrome.downloads.resume(historyItem.chromeDownloadId, () => {
      if (chrome.runtime.lastError) {
        console.error('恢复下载失败:', chrome.runtime.lastError);
        return;
      }
      
      this._updateHistoryItem(downloadId, {
        status: 'in_progress'
      });
      
      this.activeDownloads[downloadId] = {
        chromeDownloadId: historyItem.chromeDownloadId,
        item: {
          id: downloadId,
          resource: { url: historyItem.url },
          status: 'downloading',
          startTime: Date.now()
        },
        progress: historyItem.progress || 0,
        bytesReceived: historyItem.bytesReceived || 0,
        totalBytes: historyItem.totalBytes || 0,
        filename: historyItem.filename
      };
      
      this.downloadQueue.push(this.activeDownloads[downloadId].item);
      
      this._triggerEvent('onQueueChange', this.downloadQueue);
    });
    
    return true;
  }
  
  /**
   * 获取下载历史
   * @returns {Array} - 下载历史数组
   */
  getDownloadHistory() {
    return this.downloadHistory;
  }
  
  /**
   * 清除下载历史
   */
  clearDownloadHistory() {
    this.downloadHistory = [];
    this._saveDownloadHistory();
  }
  
  /**
   * 获取下载队列
   * @returns {Array} - 下载队列数组
   */
  getDownloadQueue() {
    return this.downloadQueue;
  }
  
  /**
   * 获取活跃下载
   * @returns {Object} - 活跃下载对象
   */
  getActiveDownloads() {
    return this.activeDownloads;
  }
  
  /**
   * 更新设置
   * @param {Object} newSettings - 新设置
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }
  
  /**
   * 添加事件监听器
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   */
  addEventListener(eventName, callback) {
    if (this.listeners[eventName] && typeof callback === 'function') {
      this.listeners[eventName].push(callback);
    }
  }
  
  /**
   * 移除事件监听器
   * @param {string} eventName - 事件名称
   * @param {Function} callback - 回调函数
   */
  removeEventListener(eventName, callback) {
    if (this.listeners[eventName]) {
      this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback);
    }
  }
  
  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {*} data - 事件数据
   * @private
   */
  _triggerEvent(eventName, data) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件监听器错误 (${eventName}):`, error);
        }
      });
    }
  }
  
  /**
   * 生成文件名
   * @param {Object} resource - 资源对象
   * @param {Object} options - 选项
   * @returns {string} - 文件名
   * @private
   */
  _generateFilename(resource, options = {}) {
    const filenameFormat = options.filenameFormat || FILENAME_FORMATS.ORIGINAL;
    const customFormat = options.customFormat || '{site}_{type}_{timestamp}';
    const siteName = options.siteName || 'site';
    const downloadPath = options.downloadPath || this.settings.defaultPath || '';
    
    return FileUtils.generateSmartFilename(resource, {
      format: filenameFormat === FILENAME_FORMATS.CUSTOM ? customFormat : filenameFormat,
      siteName: siteName,
      downloadPath: downloadPath
    });
  }
  
  /**
   * 添加到下载历史
   * @param {Object} historyItem - 历史项
   * @private
   */
  _addToHistory(historyItem) {
    this.downloadHistory.push(historyItem);
    this._saveDownloadHistory();
  }
  
  /**
   * 更新历史项
   * @param {string} downloadId - 下载ID
   * @param {Object} updateData - 更新数据
   * @private
   */
  _updateHistoryItem(downloadId, updateData) {
    const historyItem = this.downloadHistory.find(item => item.id === downloadId);
    
    if (historyItem) {
      Object.assign(historyItem, updateData);
      this._saveDownloadHistory();
    }
  }
  
  /**
   * 保存下载历史
   * @private
   */
  _saveDownloadHistory() {
    chrome.storage.local.set({ 'download_history': this.downloadHistory });
  }
  
  /**
   * 加载下载历史
   * @private
   */
  _loadDownloadHistory() {
    chrome.storage.local.get('download_history', (result) => {
      if (result.download_history) {
        this.downloadHistory = result.download_history;
      }
    });
  }
}

export default DownloadService;
