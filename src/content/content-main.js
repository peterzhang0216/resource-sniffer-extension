/**
 * @file content-main.js
 * @description 内容脚本主入口，协调各检测器模块和资源处理
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import DOMDetector from './detectors/dom-detector.js';
import CSSDetector from './detectors/css-detector.js';
import ShadowDetector from './detectors/shadow-detector.js';
import AttributeDetector from './detectors/attribute-detector.js';
import StreamingDetector from './detectors/streaming-detector.js';
import MessageHandler from './message-handler.js';
import { RESOURCE_TYPES, SOURCE_TYPES } from '../config/constants.js';

/**
 * 内容脚本主控制器
 * @class ContentMain
 */
class ContentMain {
  /**
   * 创建内容脚本主控制器实例
   */
  constructor() {
    this.resources = [];
    this.messageHandler = new MessageHandler();
    this.predictionWorker = null;
    this.streamingMonitorStop = null;
    this.initialized = false;
    this.pageUrl = window.location.href;
    this.hostname = window.location.hostname;
    
    this._setupMessageListeners();
  }
  
  /**
   * 初始化资源检测
   */
  initialize() {
    if (this.initialized) return;
    
    try {
      this.detectResources();
      
      this._initPredictionWorker();
      
      this._monitorStreamingResources();
      
      this._observeDOMChanges();
      
      this.initialized = true;
      
      this.messageHandler.sendMessage({
        action: 'contentScriptInitialized',
        url: this.pageUrl,
        hostname: this.hostname
      });
    } catch (e) {
      console.error('内容脚本初始化错误:', e);
    }
  }
  
  /**
   * 检测页面中的所有资源
   */
  detectResources() {
    try {
      const domResources = DOMDetector.extractResources(document);
      const cssResources = CSSDetector.detectAllCSSResources(document);
      const shadowResources = ShadowDetector.detectAllShadowResources(document);
      const attributeResources = AttributeDetector.detectAllAttributeResources(document);
      const streamingResources = StreamingDetector.detectAllStreamingResources(document);
      
      const newResources = [
        ...domResources,
        ...cssResources,
        ...shadowResources,
        ...attributeResources,
        ...streamingResources
      ];
      
      this._addResources(newResources);
      
      this._sendResourcesToBackground();
    } catch (e) {
      console.error('资源检测错误:', e);
    }
  }
  
  /**
   * 添加资源到资源列表
   * @param {Array} newResources - 新资源数组
   * @private
   */
  _addResources(newResources) {
    if (!newResources || newResources.length === 0) return;
    
    const existingUrls = new Set(this.resources.map(r => r.url));
    const uniqueNewResources = newResources.filter(r => r.url && !existingUrls.has(r.url));
    
    this.resources.push(...uniqueNewResources);
  }
  
  /**
   * 发送资源到后台脚本
   * @private
   */
  _sendResourcesToBackground() {
    if (this.resources.length === 0) return;
    
    this.messageHandler.sendMessage({
      action: 'addResources',
      resources: this.resources,
      url: this.pageUrl,
      hostname: this.hostname
    }).then(response => {
      if (response && response.success) {
        console.log(`已发送 ${this.resources.length} 个资源到后台脚本`);
      }
    }).catch(error => {
      console.warn('发送资源错误:', error);
    });
  }
  
  /**
   * 初始化资源预测Worker
   * @private
   */
  _initPredictionWorker() {
    try {
      if (window.Worker) {
        this.predictionWorker = new Worker(chrome.runtime.getURL('src/workers/resource-predictor.js'));
        
        this.predictionWorker.onmessage = (e) => {
          const { action, predictedResources } = e.data;
          
          if (action === 'predictionComplete' && predictedResources && predictedResources.length > 0) {
            predictedResources.forEach(resource => {
              resource.isPredicted = true;
              resource.source = SOURCE_TYPES.PREDICTED;
            });
            
            this._addResources(predictedResources);
            
            this.messageHandler.sendMessage({
              action: 'addPredictedResources',
              resources: predictedResources,
              url: this.pageUrl,
              hostname: this.hostname
            });
          }
        };
        
        this.predictionWorker.postMessage({
          action: 'predict',
          url: this.pageUrl,
          hostname: this.hostname,
          html: document.documentElement.outerHTML
        });
      }
    } catch (e) {
      console.warn('预测Worker初始化错误:', e);
    }
  }
  
  /**
   * 监听流媒体资源
   * @private
   */
  _monitorStreamingResources() {
    try {
      this.streamingMonitorStop = StreamingDetector.monitorNetworkRequests(resource => {
        this._addResources([resource]);
        
        this.messageHandler.sendMessage({
          action: 'addStreamingResource',
          resource: resource,
          url: this.pageUrl,
          hostname: this.hostname
        });
      });
    } catch (e) {
      console.warn('流媒体监听错误:', e);
    }
  }
  
  /**
   * 观察DOM变化
   * @private
   */
  _observeDOMChanges() {
    try {
      const observer = new MutationObserver(mutations => {
        let hasNewNodes = false;
        
        mutations.forEach(mutation => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            hasNewNodes = true;
          }
        });
        
        if (hasNewNodes) {
          setTimeout(() => {
            this.detectResources();
          }, 1000);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } catch (e) {
      console.warn('DOM观察错误:', e);
    }
  }
  
  /**
   * 设置消息监听器
   * @private
   */
  _setupMessageListeners() {
    this.messageHandler.setupMessageListeners({
      'detectResources': () => {
        this.detectResources();
        return { success: true };
      },
      
      'getResources': () => {
        return { 
          success: true, 
          resources: this.resources,
          count: this.resources.length
        };
      },
      
      'clearResources': () => {
        this.resources = [];
        return { success: true };
      },
      
      'getPageInfo': () => {
        return {
          success: true,
          url: this.pageUrl,
          hostname: this.hostname,
          title: document.title,
          resourceCount: this.resources.length
        };
      }
    });
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    try {
      if (this.streamingMonitorStop) {
        this.streamingMonitorStop();
      }
      
      if (this.predictionWorker) {
        this.predictionWorker.terminate();
      }
      
      this.resources = [];
      
      this.initialized = false;
    } catch (e) {
      console.warn('清理错误:', e);
    }
  }
}

const contentMain = new ContentMain();

window.addEventListener('load', () => {
  contentMain.initialize();
});

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    contentMain.detectResources();
  }, 500);
});

export default contentMain;
