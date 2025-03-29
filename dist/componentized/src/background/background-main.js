/**
 * @file background-main.js
 * @description 后台脚本主入口，负责初始化和协调各个处理程序
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import RequestHandler from './handlers/request-handler.js';
import ResourceHandler from './handlers/resource-handler.js';
import DownloadHandler from './handlers/download-handler.js';
import ContextMenuHandler from './handlers/context-menu-handler.js';
import ResourceService from '../services/resource-service.js';
import StorageService from '../services/storage-service.js';
import { MESSAGE_ACTIONS } from '../config/constants.js';

/**
 * 后台脚本主类
 * @class BackgroundMain
 */
class BackgroundMain {
  /**
   * 创建后台脚本实例
   */
  constructor() {
    this.storageService = new StorageService();
    this.resourceService = new ResourceService(this.storageService);
    
    this.requestHandler = new RequestHandler(this.resourceService);
    this.resourceHandler = new ResourceHandler(this.resourceService);
    this.downloadHandler = new DownloadHandler(this.storageService);
    this.contextMenuHandler = new ContextMenuHandler(this.resourceService, this.downloadHandler);
    
    this.messageHandlers = {};
    
    this.initialize();
  }
  
  /**
   * 初始化后台脚本
   */
  async initialize() {
    try {
      await this.storageService.initialize();
      
      await this.resourceService.initialize();
      
      await this.downloadHandler.initialize();
      
      this.contextMenuHandler.initialize();
      
      this._setupMessageHandlers();
      
      chrome.runtime.onMessage.addListener(this._handleMessage.bind(this));
      
      chrome.tabs.onRemoved.addListener(this._handleTabRemoved.bind(this));
      
      chrome.tabs.onUpdated.addListener(this._handleTabUpdated.bind(this));
      
      console.log('Resource Sniffer 后台脚本已初始化');
    } catch (e) {
      console.error('初始化后台脚本错误:', e);
    }
  }
  
  /**
   * 设置消息处理映射
   * @private
   */
  _setupMessageHandlers() {
    this.messageHandlers[MESSAGE_ACTIONS.ADD_RESOURCE] = this.resourceHandler.handleAddResource.bind(this.resourceHandler);
    this.messageHandlers[MESSAGE_ACTIONS.ADD_DOM_RESOURCES] = this.resourceHandler.handleAddDOMResources.bind(this.resourceHandler);
    this.messageHandlers[MESSAGE_ACTIONS.ADD_PREDICTED_RESOURCES] = this.resourceHandler.handleAddPredictedResources.bind(this.resourceHandler);
    this.messageHandlers[MESSAGE_ACTIONS.GET_RESOURCES] = this.resourceHandler.handleGetResources.bind(this.resourceHandler);
    this.messageHandlers[MESSAGE_ACTIONS.CLEAR_RESOURCES] = this.resourceHandler.handleClearResources.bind(this.resourceHandler);
    this.messageHandlers[MESSAGE_ACTIONS.ANALYZE_RESOURCE] = this.resourceHandler.handleAnalyzeResource.bind(this.resourceHandler);
    this.messageHandlers[MESSAGE_ACTIONS.PREDICT_RESOURCES] = this.resourceHandler.handlePredictResources.bind(this.resourceHandler);
    this.messageHandlers[MESSAGE_ACTIONS.GET_SIMILAR_RESOURCES] = this.resourceHandler.handleGetSimilarResources.bind(this.resourceHandler);
    this.messageHandlers[MESSAGE_ACTIONS.GET_RESOURCE_STATS] = this.resourceHandler.handleGetResourceStats.bind(this.resourceHandler);
    this.messageHandlers[MESSAGE_ACTIONS.CONTENT_SCRIPT_INITIALIZED] = this.resourceHandler.handleContentScriptInitialized.bind(this.resourceHandler);
    this.messageHandlers[MESSAGE_ACTIONS.STREAMING_RESOURCE] = this.resourceHandler.handleStreamingResource.bind(this.resourceHandler);
    
    this.messageHandlers[MESSAGE_ACTIONS.DOWNLOAD_RESOURCE] = this.downloadHandler.handleDownloadResource.bind(this.downloadHandler);
    this.messageHandlers[MESSAGE_ACTIONS.BATCH_DOWNLOAD_RESOURCES] = this.downloadHandler.handleBatchDownloadResources.bind(this.downloadHandler);
    this.messageHandlers[MESSAGE_ACTIONS.GET_DOWNLOAD_QUEUE] = this.downloadHandler.handleGetDownloadQueue.bind(this.downloadHandler);
    this.messageHandlers[MESSAGE_ACTIONS.GET_DOWNLOAD_HISTORY] = this.downloadHandler.handleGetDownloadHistory.bind(this.downloadHandler);
    this.messageHandlers[MESSAGE_ACTIONS.CLEAR_DOWNLOAD_HISTORY] = this.downloadHandler.handleClearDownloadHistory.bind(this.downloadHandler);
    this.messageHandlers[MESSAGE_ACTIONS.CANCEL_DOWNLOAD] = this.downloadHandler.handleCancelDownload.bind(this.downloadHandler);
    this.messageHandlers[MESSAGE_ACTIONS.PAUSE_DOWNLOAD] = this.downloadHandler.handlePauseDownload.bind(this.downloadHandler);
    this.messageHandlers[MESSAGE_ACTIONS.RESUME_DOWNLOAD] = this.downloadHandler.handleResumeDownload.bind(this.downloadHandler);
    this.messageHandlers[MESSAGE_ACTIONS.UPDATE_DOWNLOAD_SETTINGS] = this.downloadHandler.handleUpdateDownloadSettings.bind(this.downloadHandler);
  }
  
  /**
   * 处理来自内容脚本和弹出窗口的消息
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   * @private
   */
  _handleMessage(message, sender, sendResponse) {
    try {
      if (!message || !message.action) {
        sendResponse({ success: false, error: '无效的消息' });
        return false;
      }
      
      const { action } = message;
      
      const handler = this.messageHandlers[action];
      
      if (handler) {
        return handler(message, sender, sendResponse);
      } else {
        console.warn('未知消息操作:', action);
        sendResponse({ success: false, error: '未知消息操作' });
        return false;
      }
    } catch (e) {
      console.error('处理消息错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理标签页关闭
   * @param {number} tabId - 标签页ID
   * @param {Object} removeInfo - 移除信息
   * @private
   */
  _handleTabRemoved(tabId, removeInfo) {
    try {
      this.resourceService.clearResources(tabId.toString());
      
      console.log(`标签页 ${tabId} 已关闭，资源已清除`);
    } catch (e) {
      console.warn('处理标签页关闭错误:', e);
    }
  }
  
  /**
   * 处理标签页更新
   * @param {number} tabId - 标签页ID
   * @param {Object} changeInfo - 变更信息
   * @param {Object} tab - 标签页信息
   * @private
   */
  _handleTabUpdated(tabId, changeInfo, tab) {
    try {
      if (changeInfo.status === 'complete') {
        chrome.tabs.sendMessage(tabId, {
          action: MESSAGE_ACTIONS.PAGE_LOADED,
          url: tab.url
        }, response => {
          if (chrome.runtime.lastError) {
            return;
          }
        });
      }
    } catch (e) {
      console.warn('处理标签页更新错误:', e);
    }
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    try {
      this.requestHandler.cleanup();
      this.contextMenuHandler.cleanup();
      this.downloadHandler.cleanup();
      
      chrome.runtime.onMessage.removeListener(this._handleMessage);
      
      chrome.tabs.onRemoved.removeListener(this._handleTabRemoved);
      chrome.tabs.onUpdated.removeListener(this._handleTabUpdated);
      
      console.log('Resource Sniffer 后台脚本已清理');
    } catch (e) {
      console.warn('清理后台脚本错误:', e);
    }
  }
}

const backgroundMain = new BackgroundMain();

export default backgroundMain;
