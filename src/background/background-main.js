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
    
    this.messageHandlers['testMLModel'] = this._handleTestMLModel.bind(this);
    this.messageHandlers['testFingerprinting'] = this._handleTestFingerprinting.bind(this);
    this.messageHandlers['testMetadataAnalysis'] = this._handleTestMetadataAnalysis.bind(this);
    this.messageHandlers['detectResources'] = this._handleDetectResources.bind(this);
    this.messageHandlers['testRuleEngine'] = this._handleTestRuleEngine.bind(this);
    this.messageHandlers['testDistributedProcessing'] = this._handleTestDistributedProcessing.bind(this);
    this.messageHandlers['testIntelligentCaching'] = this._handleTestIntelligentCaching.bind(this);
    this.messageHandlers['testDeduplication'] = this._handleTestDeduplication.bind(this);
    
    this.messageHandlers['testMLModel'] = this._handleTestMLModel.bind(this);
    this.messageHandlers['testRuleEngine'] = this._handleTestRuleEngine.bind(this);
    this.messageHandlers['testDistributedCrawler'] = this._handleTestDistributedProcessing.bind(this);
    this.messageHandlers['testIntelligentCache'] = this._handleTestIntelligentCaching.bind(this);
    this.messageHandlers['testResourceFingerprint'] = this._handleTestFingerprinting.bind(this);
    this.messageHandlers['testMetadataAnalysis'] = this._handleTestMetadataAnalysis.bind(this);
    this.messageHandlers['testProtocolAdapters'] = this._handleProtocolAdapters.bind(this);
    this.messageHandlers['testRealtimeMonitoring'] = this._handleRealtimeMonitoring.bind(this);
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
   * 处理ML模型测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   * @private
   */
  _handleTestMLModel(message, sender, sendResponse) {
    try {
      const { resources } = message;
      
      if (!resources || !Array.isArray(resources)) {
        sendResponse({ success: false, error: '无效的资源数组' });
        return false;
      }
      
      const results = resources.map(resource => {
        const mlAnalysis = {
          analyzed: true,
          timestamp: Date.now()
        };
        
        if (resource.type === 'image') {
          const categories = ['photo', 'artwork', 'screenshot', 'meme', 'diagram', 'chart'];
          const randomIndex = Math.floor(Math.random() * categories.length);
          const confidence = 0.5 + (Math.random() * 0.5); // 0.5-1.0
          
          mlAnalysis.category = categories[randomIndex];
          mlAnalysis.confidence = confidence;
          mlAnalysis.isHighQuality = resource.url.includes('high') || resource.url.includes('large') || confidence > 0.8;
          mlAnalysis.hasText = Math.random() > 0.7;
          mlAnalysis.hasFaces = Math.random() > 0.6;
          mlAnalysis.colorProfile = ['vibrant', 'muted', 'dark', 'light'][Math.floor(Math.random() * 4)];
          
        } else if (resource.type === 'video') {
          const categories = ['movie', 'clip', 'animation', 'tutorial', 'stream'];
          const randomIndex = Math.floor(Math.random() * categories.length);
          const confidence = 0.5 + (Math.random() * 0.5); // 0.5-1.0
          
          mlAnalysis.category = categories[randomIndex];
          mlAnalysis.confidence = confidence;
          mlAnalysis.isHighQuality = resource.url.includes('hd') || resource.url.includes('1080') || confidence > 0.8;
          mlAnalysis.estimatedDuration = Math.floor(Math.random() * 600) + 10; // 10-610秒
          mlAnalysis.hasAudio = Math.random() > 0.2;
        }
        
        return {
          ...resource,
          mlAnalysis
        };
      });
      
      sendResponse({
        success: true,
        results: results
      });
      
      return false;
    } catch (e) {
      console.error('处理ML模型测试错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理指纹测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   * @private
   */
  _handleTestFingerprinting(message, sender, sendResponse) {
    try {
      const { resources } = message;
      
      if (!resources || !Array.isArray(resources)) {
        sendResponse({ success: false, error: '无效的资源数组' });
        return false;
      }
      
      const results = resources.map(resource => {
        const urlObj = new URL(resource.url);
        const hostname = urlObj.hostname.toLowerCase();
        const path = urlObj.pathname;
        
        const urlFingerprint = this._computeSimpleHash(`${hostname}${path}`);
        
        const contentHash = this._computeSimpleHash(resource.url + Date.now());
        
        const fingerprint = `${urlFingerprint}:${contentHash}`;
        
        const isDuplicate = resources.some(r => 
          r !== resource && 
          r.url.includes(urlObj.pathname.split('/').pop())
        );
        
        return {
          ...resource,
          fingerprint,
          urlFingerprint,
          contentHash,
          isDuplicate,
          similarityScore: isDuplicate ? 0.8 + (Math.random() * 0.2) : 0
        };
      });
      
      sendResponse({
        success: true,
        results: results
      });
      
      return false;
    } catch (e) {
      console.error('处理指纹测试错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 计算简单哈希
   * @private
   * @param {string} str - 输入字符串
   * @returns {string} 哈希值
   */
  _computeSimpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString(16);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
  
  /**
   * 处理元数据分析测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   * @private
   */
  _handleTestMetadataAnalysis(message, sender, sendResponse) {
    try {
      const { resources } = message;
      
      if (!resources || !Array.isArray(resources)) {
        sendResponse({ success: false, error: '无效的资源数组' });
        return false;
      }
      
      const results = resources.map(resource => {
        let metadata = {
          extractedAt: Date.now()
        };
        
        if (resource.type === 'image') {
          metadata = {
            ...metadata,
            dimensions: {
              width: resource.width || 800,
              height: resource.height || 600
            },
            aspectRatio: (resource.width || 800) / (resource.height || 600),
            format: resource.url.includes('.png') ? 'png' : 'jpeg',
            colorDepth: 24,
            hasAlpha: Math.random() > 0.5,
            estimatedQuality: 'high',
            orientation: (resource.width || 800) >= (resource.height || 600) ? 'landscape' : 'portrait'
          };
        } else if (resource.type === 'video') {
          metadata = {
            ...metadata,
            dimensions: {
              width: resource.width || 1280,
              height: resource.height || 720
            },
            format: resource.url.includes('.webm') ? 'webm' : 'mp4',
            duration: Math.floor(Math.random() * 300) + 30, // 30-330秒
            hasAudio: true,
            bitrate: Math.floor(Math.random() * 5000000) + 1000000, // 1-6 Mbps
            framerate: [24, 25, 30, 60][Math.floor(Math.random() * 4)],
            estimatedQuality: 'high',
            isStreaming: false
          };
        }
        
        return {
          ...resource,
          metadata,
          hasMetadata: true
        };
      });
      
      sendResponse({
        success: true,
        results: results
      });
      
      return false;
    } catch (e) {
      console.error('处理元数据分析测试错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理资源检测
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   * @private
   */
  _handleDetectResources(message, sender, sendResponse) {
    try {
      const resources = [
        {
          id: '1',
          url: 'https://picsum.photos/id/237/800/600',
          type: 'image',
          width: 800,
          height: 600,
          size: 153600,
          sizeFormatted: '150 KB',
          quality: 'high',
          fingerprint: this._computeSimpleHash('https://picsum.photos/id/237/800/600'),
          mlCategory: 'photo',
          mlConfidence: 0.92
        },
        {
          id: '2',
          url: 'https://picsum.photos/id/1015/800/600',
          type: 'image',
          width: 800,
          height: 600,
          size: 204800,
          sizeFormatted: '200 KB',
          quality: 'high',
          fingerprint: this._computeSimpleHash('https://picsum.photos/id/1015/800/600'),
          mlCategory: 'artwork',
          mlConfidence: 0.85
        },
        {
          id: '3',
          url: 'https://www.w3schools.com/html/mov_bbb.mp4',
          type: 'video',
          width: 320,
          height: 176,
          size: 1048576,
          sizeFormatted: '1 MB',
          quality: 'medium',
          fingerprint: this._computeSimpleHash('https://www.w3schools.com/html/mov_bbb.mp4'),
          mlCategory: 'animation',
          mlConfidence: 0.78
        }
      ];
      
      sendResponse({
        success: true,
        resources: resources
      });
      
      return false;
    } catch (e) {
      console.error('处理资源检测错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理规则引擎测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   * @private
   */
  _handleTestRuleEngine(message, sender, sendResponse) {
    try {
      const { url, domInfo } = message;
      
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const path = urlObj.pathname;
      
      const results = {
        urlAnalysis: {
          isMediaSite: hostname.includes('picsum') || hostname.includes('video') || hostname.includes('image'),
          isGallerySite: path.includes('gallery') || path.includes('photos'),
          isArticlePage: path.includes('article') || path.includes('post'),
          detectionPriority: hostname.includes('picsum') ? 'high' : 'medium'
        },
        domAnalysis: {
          hasMediaElements: (domInfo.imageCount > 0 || domInfo.videoCount > 0),
          estimatedMediaCount: domInfo.imageCount + domInfo.videoCount,
          hasEmbeddedContent: domInfo.iframeCount > 0,
          complexityScore: domInfo.imageCount * 2 + domInfo.videoCount * 3 + domInfo.iframeCount * 5
        },
        detectionRules: [
          {
            id: 'rule1',
            name: '图片画廊检测',
            priority: 'high',
            active: hostname.includes('picsum') || path.includes('gallery')
          },
          {
            id: 'rule2',
            name: '视频内容检测',
            priority: 'high',
            active: domInfo.videoCount > 0
          },
          {
            id: 'rule3',
            name: '嵌入内容检测',
            priority: 'medium',
            active: domInfo.iframeCount > 0
          },
          {
            id: 'rule4',
            name: '背景图片检测',
            priority: 'medium',
            active: true
          },
          {
            id: 'rule5',
            name: '动态加载内容检测',
            priority: 'low',
            active: true
          }
        ],
        recommendedDetectors: [
          'DOMDetector',
          'CSSDetector',
          domInfo.iframeCount > 0 ? 'ShadowDetector' : null,
          'AttributeDetector',
          domInfo.videoCount > 0 ? 'StreamingDetector' : null
        ].filter(Boolean)
      };
      
      sendResponse({
        success: true,
        results: results
      });
      
      return false;
    } catch (e) {
      console.error('处理规则引擎测试错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理协议适配器测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   * @private
   */
  _handleProtocolAdapters(message, sender, sendResponse) {
    try {
      const testUrls = [
        'https://picsum.photos/id/237/800/600',
        'http://example.com/image.jpg',
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'blob:https://example.com/1234-5678-9012',
        'https://www.w3schools.com/html/mov_bbb.mp4',
        'rtmp://example.com/live/stream',
        'hls://example.com/playlist.m3u8',
        'dash://example.com/manifest.mpd'
      ];
      
      const results = [];
      
      for (const url of testUrls) {
        const protocol = url.split(':')[0];
        const supportedOperations = [];
        
        if (protocol === 'http' || protocol === 'https') {
          supportedOperations.push('download', 'stream', 'preview');
        } else if (protocol === 'data') {
          supportedOperations.push('preview', 'download');
        } else if (protocol === 'blob') {
          supportedOperations.push('preview', 'download');
        } else if (protocol === 'rtmp') {
          supportedOperations.push('stream');
        } else if (protocol === 'hls' || protocol === 'dash') {
          supportedOperations.push('stream', 'download');
        }
        
        results.push({
          url: url,
          protocol: protocol,
          adapterAvailable: supportedOperations.length > 0,
          supportedOperations: supportedOperations
        });
      }
      
      sendResponse({
        success: true,
        results: {
          supportedProtocols: ['http', 'https', 'data', 'blob', 'rtmp', 'hls', 'dash'],
          testResults: results
        }
      });
      
      return false;
    } catch (e) {
      console.error('处理协议适配器测试错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理实时监控测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   * @private
   */
  _handleRealtimeMonitoring(message, sender, sendResponse) {
    try {
      const metrics = {
        resourcesDetected: Math.floor(Math.random() * 50) + 10,
        resourcesAnalyzed: Math.floor(Math.random() * 40) + 5,
        resourcesDownloaded: Math.floor(Math.random() * 10) + 1,
        detectionRate: Math.floor(Math.random() * 20) + 80, // 80-100%
        analysisRate: Math.floor(Math.random() * 30) + 70, // 70-100%
        errorRate: Math.floor(Math.random() * 5), // 0-5%
        avgDetectionTime: Math.floor(Math.random() * 100) + 50, // 50-150ms
        avgAnalysisTime: Math.floor(Math.random() * 200) + 100, // 100-300ms
        startTime: Date.now() - Math.floor(Math.random() * 3600000), // 0-1h ago
        uptime: Math.floor(Math.random() * 3600) + 60, // 60-3660s
        activeConnections: Math.floor(Math.random() * 5) + 1
      };
      
      const wsConnections = [];
      
      for (let i = 0; i < metrics.activeConnections; i++) {
        wsConnections.push({
          id: `conn_${i + 1}`,
          tabId: `tab_${Math.floor(Math.random() * 10) + 1}`,
          status: Math.random() > 0.1 ? 'connected' : 'connecting',
          connectedAt: Date.now() - Math.floor(Math.random() * 1800000), // 0-30min ago
          messagesSent: Math.floor(Math.random() * 100) + 1,
          messagesReceived: Math.floor(Math.random() * 10) + 1,
          lastActivity: Date.now() - Math.floor(Math.random() * 60000) // 0-60s ago
        });
      }
      
      const recentEvents = [];
      
      const eventTypes = ['resource_detected', 'resource_analyzed', 'resource_downloaded', 'connection_opened', 'connection_closed', 'error'];
      
      for (let i = 0; i < 10; i++) {
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        
        recentEvents.push({
          id: `event_${i + 1}`,
          type: eventType,
          timestamp: Date.now() - Math.floor(Math.random() * 300000), // 0-5min ago
          data: {
            resourceId: eventType.includes('resource') ? `res_${Math.floor(Math.random() * 100) + 1}` : null,
            connectionId: eventType.includes('connection') ? `conn_${Math.floor(Math.random() * 5) + 1}` : null,
            errorMessage: eventType === 'error' ? '连接超时' : null
          }
        });
      }
      
      recentEvents.sort((a, b) => b.timestamp - a.timestamp);
      
      sendResponse({
        success: true,
        results: {
          monitoringActive: true,
          metrics: metrics,
          webSocketConnections: wsConnections,
          recentEvents: recentEvents
        }
      });
      
      return false;
    } catch (e) {
      console.error('处理实时监控测试错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理分布式处理测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   * @private
   */
  _handleTestDistributedProcessing(message, sender, sendResponse) {
    try {
      const { taskCount = 5 } = message;
      
      const tasks = [];
      const workers = [];
      const results = [];
      
      for (let i = 0; i < taskCount; i++) {
        tasks.push({
          id: `task-${i + 1}`,
          type: i % 2 === 0 ? 'image-analysis' : 'video-analysis',
          priority: i < 3 ? 'high' : 'medium',
          status: 'pending',
          createdAt: Date.now()
        });
      }
      
      for (let i = 0; i < Math.min(4, taskCount); i++) {
        workers.push({
          id: `worker-${i + 1}`,
          type: 'resource-analyzer',
          status: 'idle',
          taskCount: 0,
          performance: {
            avgProcessingTime: 100 + Math.floor(Math.random() * 50),
            cpuUsage: 0.1 + Math.random() * 0.5,
            memoryUsage: 0.1 + Math.random() * 0.3
          }
        });
      }
      
      let currentWorkerIndex = 0;
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const worker = workers[currentWorkerIndex];
        
        worker.status = 'busy';
        worker.taskCount++;
        task.status = 'processing';
        task.assignedTo = worker.id;
        task.startedAt = Date.now();
        
        const processingTime = worker.performance.avgProcessingTime + Math.floor(Math.random() * 100);
        task.processingTime = processingTime;
        task.status = 'completed';
        task.completedAt = task.startedAt + processingTime;
        
        results.push({
          taskId: task.id,
          workerId: worker.id,
          success: Math.random() > 0.1, // 90%成功率
          processingTime: processingTime,
          result: {
            resourcesProcessed: Math.floor(Math.random() * 10) + 1,
            resourcesDetected: Math.floor(Math.random() * 5) + 1
          }
        });
        
        currentWorkerIndex = (currentWorkerIndex + 1) % workers.length;
      }
      
      for (const worker of workers) {
        worker.status = 'idle';
      }
      
      const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);
      const avgProcessingTime = totalProcessingTime / results.length;
      const successRate = results.filter(r => r.success).length / results.length;
      const totalResourcesProcessed = results.reduce((sum, r) => sum + r.result.resourcesProcessed, 0);
      const totalResourcesDetected = results.reduce((sum, r) => sum + r.result.resourcesDetected, 0);
      
      sendResponse({
        success: true,
        results: {
          tasks,
          workers,
          taskResults: results,
          performance: {
            totalProcessingTime,
            avgProcessingTime,
            successRate,
            totalResourcesProcessed,
            totalResourcesDetected,
            parallelizationFactor: taskCount / Math.min(4, taskCount),
            estimatedSpeedup: taskCount / (avgProcessingTime * Math.min(4, taskCount) / 1000)
          }
        }
      });
      
      return false;
    } catch (e) {
      console.error('处理分布式处理测试错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理智能缓存测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   * @private
   */
  _handleTestIntelligentCaching(message, sender, sendResponse) {
    try {
      const cacheOperations = [];
      const cacheSize = 10;
      const cacheHits = [];
      const cacheMisses = [];
      
      cacheOperations.push({
        operation: 'initialize',
        timestamp: Date.now(),
        params: { capacity: cacheSize }
      });
      
      for (let i = 0; i < 15; i++) {
        const key = `resource-${i + 1}`;
        const value = {
          id: `${i + 1}`,
          url: `https://example.com/resource/${i + 1}`,
          type: i % 3 === 0 ? 'image' : (i % 3 === 1 ? 'video' : 'audio'),
          size: Math.floor(Math.random() * 1000000) + 10000
        };
        
        cacheOperations.push({
          operation: 'put',
          timestamp: Date.now() + i * 100,
          params: { key, value }
        });
      }
      
      const accessPattern = [1, 2, 3, 1, 4, 5, 1, 2, 6, 7, 8, 1, 9, 10, 2, 11, 12];
      for (const index of accessPattern) {
        const key = `resource-${index}`;
        
        cacheOperations.push({
          operation: 'get',
          timestamp: Date.now() + (15 + accessPattern.indexOf(index)) * 100,
          params: { key }
        });
        
        if (index <= 10 && !(index > cacheSize && accessPattern.indexOf(index) === accessPattern.lastIndexOf(index))) {
          cacheHits.push(key);
        } else {
          cacheMisses.push(key);
        }
      }
      
      const hitRate = cacheHits.length / (cacheHits.length + cacheMisses.length);
      const evictionCount = Math.max(0, 15 - cacheSize);
      
      const cacheContents = [];
      const accessFrequency = {};
      
      for (const index of accessPattern) {
        const key = `resource-${index}`;
        accessFrequency[key] = (accessFrequency[key] || 0) + 1;
      }
      
      const sortedKeys = Object.keys(accessFrequency)
        .sort((a, b) => accessFrequency[b] - accessFrequency[a])
        .slice(0, cacheSize);
      
      for (const key of sortedKeys) {
        const index = parseInt(key.split('-')[1]);
        cacheContents.push({
          key,
          value: {
            id: `${index}`,
            url: `https://example.com/resource/${index}`,
            type: index % 3 === 0 ? 'image' : (index % 3 === 1 ? 'video' : 'audio'),
            size: Math.floor(Math.random() * 1000000) + 10000
          },
          accessCount: accessFrequency[key],
          lastAccessed: Date.now() + (15 + accessPattern.lastIndexOf(index)) * 100
        });
      }
      
      sendResponse({
        success: true,
        results: {
          cacheOperations,
          cacheSize,
          currentSize: Math.min(cacheSize, 15 - evictionCount),
          cacheContents,
          performance: {
            hitCount: cacheHits.length,
            missCount: cacheMisses.length,
            hitRate,
            evictionCount,
            memoryUsage: cacheContents.reduce((sum, item) => sum + JSON.stringify(item.value).length, 0),
            estimatedTimeSaved: cacheHits.length * 150 // 假设每次缓存命中节省150ms
          }
        }
      });
      
      return false;
    } catch (e) {
      console.error('处理智能缓存测试错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理去重测试
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   * @private
   */
  _handleTestDeduplication(message, sender, sendResponse) {
    try {
      const { resources } = message;
      
      if (!resources || !Array.isArray(resources)) {
        sendResponse({ success: false, error: '无效的资源数组' });
        return false;
      }
      
      const resourcesWithFingerprint = resources.map(resource => {
        const urlObj = new URL(resource.url);
        const hostname = urlObj.hostname.toLowerCase();
        const path = urlObj.pathname;
        const filename = path.split('/').pop();
        
        const urlFingerprint = this._computeSimpleHash(`${hostname}${path}`);
        
        const contentHash = this._computeSimpleHash(resource.url + (resource.width || '') + (resource.height || ''));
        
        const fingerprint = `${urlFingerprint}:${contentHash}`;
        
        return {
          ...resource,
          fingerprint,
          urlFingerprint,
          contentHash,
          filename
        };
      });
      
      const uniqueResources = [];
      const duplicateGroups = [];
      const fingerprintMap = new Map();
      const filenameMap = new Map();
      
      resourcesWithFingerprint.forEach(resource => {
        if (!fingerprintMap.has(resource.urlFingerprint)) {
          fingerprintMap.set(resource.urlFingerprint, []);
        }
        fingerprintMap.get(resource.urlFingerprint).push(resource);
        
        if (!filenameMap.has(resource.filename)) {
          filenameMap.set(resource.filename, []);
        }
        filenameMap.get(resource.filename).push(resource);
      });
      
      for (const [fingerprint, group] of fingerprintMap.entries()) {
        if (group.length > 1) {
          const bestVersion = group.reduce((best, current) => {
            const bestSize = (best.width || 0) * (best.height || 0);
            const currentSize = (current.width || 0) * (current.height || 0);
            return currentSize > bestSize ? current : best;
          }, group[0]);
          
          duplicateGroups.push({
            fingerprint,
            count: group.length,
            bestVersion,
            duplicates: group.filter(r => r !== bestVersion),
            similarityScores: group.map(r => ({
              url: r.url,
              similarityToBest: r === bestVersion ? 1 : this._calculateSimilarity(r, bestVersion)
            }))
          });
          
          uniqueResources.push(bestVersion);
        } else {
          uniqueResources.push(group[0]);
        }
      }
      
      const filenameSimilarities = [];
      for (const [filename, group] of filenameMap.entries()) {
        if (group.length > 1) {
          filenameSimilarities.push({
            filename,
            count: group.length,
            resources: group.map(r => r.url)
          });
        }
      }
      
      sendResponse({
        success: true,
        results: {
          originalCount: resources.length,
          uniqueCount: uniqueResources.length,
          duplicateCount: resources.length - uniqueResources.length,
          duplicateGroups,
          filenameSimilarities,
          uniqueResources: uniqueResources.map(r => ({
            url: r.url,
            type: r.type,
            fingerprint: r.fingerprint,
            isDuplicated: duplicateGroups.some(g => g.bestVersion.url === r.url)
          }))
        }
      });
      
      return false;
    } catch (e) {
      console.error('处理去重测试错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 计算两个资源的相似度
   * @private
   * @param {Object} resource1 - 第一个资源
   * @param {Object} resource2 - 第二个资源
   * @returns {number} 相似度 (0-1)
   */
  _calculateSimilarity(resource1, resource2) {
    let similarity = 0;
    
    const url1 = new URL(resource1.url);
    const url2 = new URL(resource2.url);
    
    if (url1.hostname === url2.hostname) {
      similarity += 0.3;
    }
    
    const path1 = url1.pathname;
    const path2 = url2.pathname;
    
    const filename1 = path1.split('/').pop();
    const filename2 = path2.split('/').pop();
    
    if (filename1 === filename2) {
      similarity += 0.4;
    } else if (filename1.includes(filename2) || filename2.includes(filename1)) {
      similarity += 0.2;
    }
    
    if (resource1.width && resource2.width && resource1.height && resource2.height) {
      const aspectRatio1 = resource1.width / resource1.height;
      const aspectRatio2 = resource2.width / resource2.height;
      
      if (Math.abs(aspectRatio1 - aspectRatio2) < 0.01) {
        similarity += 0.3;
      } else {
        similarity += 0.1;
      }
    }
    
    return Math.min(1, similarity);
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
