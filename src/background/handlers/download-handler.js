/**
 * @file download-handler.js
 * @description 下载处理程序，管理资源下载队列和下载操作
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES } from '../../config/constants.js';
import FileUtils from '../../utils/file-utils.js';
import URLUtils from '../../utils/url-utils.js';

/**
 * 下载处理程序类
 * @class DownloadHandler
 */
class DownloadHandler {
  /**
   * 创建下载处理程序实例
   * @param {Object} storageService - 存储服务实例
   */
  constructor(storageService) {
    this.storageService = storageService;
    this.downloadQueue = [];
    this.activeDownloads = 0;
    this.maxConcurrentDownloads = 2;
    this.downloadSpeedLimit = 0; // KB/s，0表示不限制
    this.downloadHistory = [];
    this.isProcessingQueue = false;
    this.downloadSettings = null;
    
    this._setupDownloadListeners();
  }
  
  /**
   * 初始化下载设置
   */
  async initialize() {
    try {
      if (this.storageService) {
        const settings = await this.storageService.getSettings();
        if (settings && settings.download) {
          this.downloadSettings = settings.download;
          this.maxConcurrentDownloads = settings.download.maxConcurrentDownloads || 2;
          this.downloadSpeedLimit = settings.download.downloadSpeedLimit || 0;
        }
        
        const history = await this.storageService.getDownloadHistory();
        if (history && Array.isArray(history)) {
          this.downloadHistory = history;
        }
      }
      
      console.log('下载处理程序已初始化');
    } catch (e) {
      console.error('初始化下载设置错误:', e);
    }
  }
  
  /**
   * 设置下载监听器
   * @private
   */
  _setupDownloadListeners() {
    try {
      chrome.downloads.onChanged.addListener(this._handleDownloadChanged.bind(this));
      
      chrome.downloads.onCreated.addListener(this._handleDownloadCreated.bind(this));
      
      chrome.downloads.onDeterminingFilename.addListener(this._handleDeterminingFilename.bind(this));
    } catch (e) {
      console.error('设置下载监听器错误:', e);
    }
  }
  
  /**
   * 处理下载状态变化
   * @param {Object} downloadDelta - 下载状态变化对象
   * @private
   */
  _handleDownloadChanged(downloadDelta) {
    try {
      const downloadId = downloadDelta.id;
      
      const queueItem = this.downloadQueue.find(item => item.downloadId === downloadId);
      if (!queueItem) return;
      
      if (downloadDelta.state) {
        queueItem.state = downloadDelta.state.current;
        
        if (downloadDelta.state.current === 'complete') {
          this._handleDownloadComplete(queueItem);
        } else if (downloadDelta.state.current === 'interrupted') {
          this._handleDownloadInterrupted(queueItem, downloadDelta.error);
        }
      }
      
      if (downloadDelta.bytesReceived) {
        queueItem.bytesReceived = downloadDelta.bytesReceived.current;
        this._notifyDownloadProgress(queueItem);
      }
    } catch (e) {
      console.warn('处理下载状态变化错误:', e);
    }
  }
  
  /**
   * 处理下载创建
   * @param {Object} downloadItem - 下载项对象
   * @private
   */
  _handleDownloadCreated(downloadItem) {
    try {
      const queueItem = this.downloadQueue.find(item => item.downloadId === downloadItem.id);
      if (!queueItem) return;
      
      queueItem.startTime = downloadItem.startTime;
      queueItem.filename = downloadItem.filename;
      queueItem.state = downloadItem.state;
      queueItem.bytesReceived = downloadItem.bytesReceived;
      queueItem.totalBytes = downloadItem.totalBytes;
      queueItem.fileSize = this._formatSize(downloadItem.totalBytes);
      
      this._notifyDownloadProgress(queueItem);
    } catch (e) {
      console.warn('处理下载创建错误:', e);
    }
  }
  
  /**
   * 处理确定文件名
   * @param {Object} downloadItem - 下载项对象
   * @param {Object} suggest - 建议函数
   * @private
   */
  _handleDeterminingFilename(downloadItem, suggest) {
    try {
      const queueItem = this.downloadQueue.find(item => item.downloadId === downloadItem.id);
      if (!queueItem) {
        suggest();
        return;
      }
      
      const settings = this.downloadSettings || {};
      
      let downloadPath = '';
      
      if (settings.categorizeByWebsite && queueItem.hostname) {
        downloadPath += queueItem.hostname + '/';
      }
      
      if (settings.categorizeByType && queueItem.resource && queueItem.resource.type) {
        const typeFolder = queueItem.resource.type.toLowerCase() + 's';
        downloadPath += typeFolder + '/';
      }
      
      let filename = queueItem.suggestedFilename || downloadItem.filename || '';
      
      suggest({ filename: downloadPath + filename });
    } catch (e) {
      console.warn('处理确定文件名错误:', e);
      suggest();
    }
  }
  
  /**
   * 处理下载完成
   * @param {Object} queueItem - 下载队列项
   * @private
   */
  _handleDownloadComplete(queueItem) {
    try {
      queueItem.state = 'complete';
      queueItem.endTime = new Date();
      queueItem.success = true;
      
      this._addToDownloadHistory(queueItem);
      
      this._removeFromQueue(queueItem);
      
      this._notifyDownloadComplete(queueItem);
      
      this.activeDownloads--;
      this._processQueue();
    } catch (e) {
      console.warn('处理下载完成错误:', e);
    }
  }
  
  /**
   * 处理下载中断
   * @param {Object} queueItem - 下载队列项
   * @param {Object} error - 错误对象
   * @private
   */
  _handleDownloadInterrupted(queueItem, error) {
    try {
      queueItem.state = 'interrupted';
      queueItem.endTime = new Date();
      queueItem.success = false;
      queueItem.error = error;
      
      this._addToDownloadHistory(queueItem);
      
      this._removeFromQueue(queueItem);
      
      this._notifyDownloadFailed(queueItem, error);
      
      this.activeDownloads--;
      this._processQueue();
    } catch (e) {
      console.warn('处理下载中断错误:', e);
    }
  }
  
  /**
   * 添加到下载历史
   * @param {Object} queueItem - 下载队列项
   * @private
   */
  _addToDownloadHistory(queueItem) {
    try {
      const historyItem = {
        url: queueItem.url,
        filename: queueItem.filename,
        fileSize: queueItem.fileSize,
        startTime: queueItem.startTime,
        endTime: queueItem.endTime,
        success: queueItem.success,
        error: queueItem.error,
        resourceType: queueItem.resource ? queueItem.resource.type : 'unknown',
        downloadId: queueItem.downloadId
      };
      
      this.downloadHistory.unshift(historyItem);
      
      if (this.downloadHistory.length > 100) {
        this.downloadHistory = this.downloadHistory.slice(0, 100);
      }
      
      if (this.storageService) {
        this.storageService.saveDownloadHistory(this.downloadHistory);
      }
    } catch (e) {
      console.warn('添加到下载历史错误:', e);
    }
  }
  
  /**
   * 从队列中移除下载项
   * @param {Object} queueItem - 下载队列项
   * @private
   */
  _removeFromQueue(queueItem) {
    try {
      const index = this.downloadQueue.findIndex(item => item.id === queueItem.id);
      if (index !== -1) {
        this.downloadQueue.splice(index, 1);
      }
    } catch (e) {
      console.warn('从队列中移除下载项错误:', e);
    }
  }
  
  /**
   * 通知下载进度
   * @param {Object} queueItem - 下载队列项
   * @private
   */
  _notifyDownloadProgress(queueItem) {
    try {
      if (queueItem.totalBytes > 0) {
        queueItem.progress = Math.round((queueItem.bytesReceived / queueItem.totalBytes) * 100);
      }
      
      chrome.runtime.sendMessage({
        action: 'downloadProgress',
        queueItem: queueItem
      });
    } catch (e) {
      console.warn('通知下载进度错误:', e);
    }
  }
  
  /**
   * 通知下载完成
   * @param {Object} queueItem - 下载队列项
   * @private
   */
  _notifyDownloadComplete(queueItem) {
    try {
      chrome.runtime.sendMessage({
        action: 'downloadComplete',
        queueItem: queueItem
      });
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: '下载完成',
        message: `${queueItem.filename || queueItem.url} 已下载完成`
      });
    } catch (e) {
      console.warn('通知下载完成错误:', e);
    }
  }
  
  /**
   * 通知下载失败
   * @param {Object} queueItem - 下载队列项
   * @param {Object} error - 错误对象
   * @private
   */
  _notifyDownloadFailed(queueItem, error) {
    try {
      chrome.runtime.sendMessage({
        action: 'downloadFailed',
        queueItem: queueItem,
        error: error
      });
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: '下载失败',
        message: `${queueItem.filename || queueItem.url} 下载失败: ${error ? error.current || '未知错误' : '未知错误'}`
      });
    } catch (e) {
      console.warn('通知下载失败错误:', e);
    }
  }
  
  /**
   * 处理下载资源请求
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleDownloadResource(message, sender, sendResponse) {
    try {
      const resource = message.resource;
      const tabId = message.tabId || (sender.tab ? sender.tab.id.toString() : null);
      
      if (!resource || !resource.url) {
        sendResponse({ success: false, error: '无效的资源' });
        return false;
      }
      
      const queueItem = this.addToDownloadQueue(resource, tabId);
      
      sendResponse({ 
        success: true, 
        queueItem: queueItem,
        queuePosition: this.downloadQueue.indexOf(queueItem) + 1,
        queueLength: this.downloadQueue.length
      });
      return false;
    } catch (e) {
      console.error('处理下载资源请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理批量下载资源请求
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleBatchDownloadResources(message, sender, sendResponse) {
    try {
      const resources = message.resources;
      const tabId = message.tabId || (sender.tab ? sender.tab.id.toString() : null);
      
      if (!resources || !Array.isArray(resources) || resources.length === 0) {
        sendResponse({ success: false, error: '无效的资源数组' });
        return false;
      }
      
      const queueItems = [];
      
      resources.forEach(resource => {
        if (resource && resource.url) {
          const queueItem = this.addToDownloadQueue(resource, tabId);
          queueItems.push(queueItem);
        }
      });
      
      sendResponse({ 
        success: true, 
        queueItems: queueItems,
        queueLength: this.downloadQueue.length,
        addedCount: queueItems.length
      });
      return false;
    } catch (e) {
      console.error('处理批量下载资源请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 添加到下载队列
   * @param {Object} resource - 资源对象
   * @param {string} tabId - 标签页ID
   * @returns {Object} - 下载队列项
   */
  addToDownloadQueue(resource, tabId) {
    try {
      const queueItem = {
        id: this._generateId(),
        url: resource.url,
        resource: resource,
        tabId: tabId,
        state: 'queued',
        addedTime: new Date(),
        startTime: null,
        endTime: null,
        bytesReceived: 0,
        totalBytes: 0,
        progress: 0,
        downloadId: null,
        filename: null,
        fileSize: null,
        suggestedFilename: this._getSuggestedFilename(resource),
        hostname: this._getHostnameFromUrl(resource.url)
      };
      
      this.downloadQueue.push(queueItem);
      
      this._processQueue();
      
      return queueItem;
    } catch (e) {
      console.error('添加到下载队列错误:', e);
      throw e;
    }
  }
  
  /**
   * 处理下载队列
   * @private
   */
  _processQueue() {
    try {
      if (this.isProcessingQueue) return;
      
      this.isProcessingQueue = true;
      
      const waitingItems = this.downloadQueue.filter(item => item.state === 'queued');
      
      while (waitingItems.length > 0 && this.activeDownloads < this.maxConcurrentDownloads) {
        const nextItem = waitingItems.shift();
        this._startDownload(nextItem);
        this.activeDownloads++;
      }
      
      this.isProcessingQueue = false;
    } catch (e) {
      console.warn('处理下载队列错误:', e);
      this.isProcessingQueue = false;
    }
  }
  
  /**
   * 开始下载
   * @param {Object} queueItem - 下载队列项
   * @private
   */
  _startDownload(queueItem) {
    try {
      queueItem.state = 'starting';
      
      const downloadOptions = {
        url: queueItem.url,
        filename: queueItem.suggestedFilename,
        saveAs: false
      };
      
      chrome.downloads.download(downloadOptions, downloadId => {
        if (chrome.runtime.lastError) {
          console.warn('开始下载错误:', chrome.runtime.lastError);
          this._handleDownloadError(queueItem, chrome.runtime.lastError);
        } else {
          queueItem.downloadId = downloadId;
          queueItem.state = 'in_progress';
          this._notifyDownloadStarted(queueItem);
        }
      });
    } catch (e) {
      console.warn('开始下载错误:', e);
      this._handleDownloadError(queueItem, e);
    }
  }
  
  /**
   * 通知下载开始
   * @param {Object} queueItem - 下载队列项
   * @private
   */
  _notifyDownloadStarted(queueItem) {
    try {
      chrome.runtime.sendMessage({
        action: 'downloadStarted',
        queueItem: queueItem
      });
    } catch (e) {
      console.warn('通知下载开始错误:', e);
    }
  }
  
  /**
   * 处理下载错误
   * @param {Object} queueItem - 下载队列项
   * @param {Error} error - 错误对象
   * @private
   */
  _handleDownloadError(queueItem, error) {
    try {
      queueItem.state = 'error';
      queueItem.error = error.message || '未知错误';
      queueItem.endTime = new Date();
      queueItem.success = false;
      
      this._addToDownloadHistory(queueItem);
      
      this._removeFromQueue(queueItem);
      
      this._notifyDownloadFailed(queueItem, error);
      
      this.activeDownloads--;
      this._processQueue();
    } catch (e) {
      console.warn('处理下载错误错误:', e);
    }
  }
  
  /**
   * 获取建议的文件名
   * @param {Object} resource - 资源对象
   * @returns {string} - 建议的文件名
   * @private
   */
  _getSuggestedFilename(resource) {
    try {
      let filename = FileUtils.getValidFilename(resource.url);
      
      if (resource.filename) {
        filename = FileUtils.getValidFilename(resource.filename);
      }
      
      if (!filename || filename === '') {
        const timestamp = Date.now();
        const type = resource.type || RESOURCE_TYPES.OTHER;
        const extension = this._getExtensionFromUrl(resource.url) || this._getExtensionFromType(type);
        
        filename = `${type.toLowerCase()}_${timestamp}${extension ? '.' + extension : ''}`;
      }
      
      return filename;
    } catch (e) {
      console.warn('获取建议的文件名错误:', e);
      return `resource_${Date.now()}`;
    }
  }
  
  /**
   * 从URL中获取扩展名
   * @param {string} url - URL
   * @returns {string|null} - 扩展名或null
   * @private
   */
  _getExtensionFromUrl(url) {
    try {
      return URLUtils.getExtension(url);
    } catch (e) {
      console.warn('从URL中获取扩展名错误:', e);
      return null;
    }
  }
  
  /**
   * 从资源类型获取扩展名
   * @param {string} type - 资源类型
   * @returns {string} - 扩展名
   * @private
   */
  _getExtensionFromType(type) {
    switch (type) {
      case RESOURCE_TYPES.IMAGE:
        return 'jpg';
      case RESOURCE_TYPES.VIDEO:
        return 'mp4';
      case RESOURCE_TYPES.AUDIO:
        return 'mp3';
      default:
        return 'bin';
    }
  }
  
  /**
   * 从URL中获取主机名
   * @param {string} url - URL
   * @returns {string} - 主机名
   * @private
   */
  _getHostnameFromUrl(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      console.warn('从URL中获取主机名错误:', e);
      return '';
    }
  }
  
  /**
   * 生成唯一ID
   * @returns {string} - 唯一ID
   * @private
   */
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  /**
   * 格式化大小
   * @param {number} bytes - 字节数
   * @returns {string} - 格式化后的大小
   * @private
   */
  _formatSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + units[i];
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    try {
      chrome.downloads.onChanged.removeListener(this._handleDownloadChanged);
      chrome.downloads.onCreated.removeListener(this._handleDownloadCreated);
      chrome.downloads.onDeterminingFilename.removeListener(this._handleDeterminingFilename);
    } catch (e) {
      console.warn('清理下载处理程序错误:', e);
    }
  }
}

export default DownloadHandler;
