/**
 * @file resource-handler.js
 * @description 资源处理程序，处理从内容脚本接收到的资源
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { SOURCE_TYPES } from '../../config/constants.js';
import ResourceUtils from '../../utils/resource-utils.js';

/**
 * 资源处理程序类
 * @class ResourceHandler
 */
class ResourceHandler {
  /**
   * 创建资源处理程序实例
   * @param {Object} resourceService - 资源服务实例
   */
  constructor(resourceService) {
    this.resourceService = resourceService;
  }
  
  /**
   * 处理添加资源请求
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleAddResource(message, sender, sendResponse) {
    try {
      const tabId = sender.tab ? sender.tab.id.toString() : null;
      const resource = message.resource;
      
      if (!tabId || !resource) {
        sendResponse({ success: false, error: '无效的标签页ID或资源' });
        return false;
      }
      
      const added = this.resourceService.addResource(tabId, resource);
      
      sendResponse({ success: true, added: added });
      return false;
    } catch (e) {
      console.error('处理添加资源请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理添加DOM资源请求
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleAddDOMResources(message, sender, sendResponse) {
    try {
      const tabId = sender.tab ? sender.tab.id.toString() : null;
      const resources = message.resources;
      
      if (!tabId || !resources || !Array.isArray(resources)) {
        sendResponse({ success: false, error: '无效的标签页ID或资源' });
        return false;
      }
      
      const addedCount = this.resourceService.addResources(tabId, resources);
      
      sendResponse({ success: true, addedCount: addedCount });
      return false;
    } catch (e) {
      console.error('处理添加DOM资源请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理添加预测资源请求
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleAddPredictedResources(message, sender, sendResponse) {
    try {
      const tabId = sender.tab ? sender.tab.id.toString() : null;
      const resources = message.resources;
      
      if (!tabId || !resources || !Array.isArray(resources)) {
        sendResponse({ success: false, error: '无效的标签页ID或资源' });
        return false;
      }
      
      resources.forEach(resource => {
        resource.isPredicted = true;
        resource.source = SOURCE_TYPES.PREDICTED;
        
        if (!resource.score) {
          const scoreResult = ResourceUtils.calculateResourceScore(resource);
          resource.score = scoreResult.score;
          resource.scoreDetails = scoreResult.details;
        }
      });
      
      const addedCount = this.resourceService.addResources(tabId, resources);
      
      sendResponse({ success: true, addedCount: addedCount });
      return false;
    } catch (e) {
      console.error('处理添加预测资源请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理获取资源请求
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleGetResources(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || (sender.tab ? sender.tab.id.toString() : null);
      
      if (!tabId) {
        sendResponse({ success: false, error: '无效的标签页ID' });
        return false;
      }
      
      const resources = this.resourceService.getResources(tabId);
      
      const stats = this.resourceService.getResourceStats(tabId);
      
      sendResponse({ 
        success: true, 
        resources: resources,
        count: resources.length,
        stats: stats
      });
      return false;
    } catch (e) {
      console.error('处理获取资源请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理清除资源请求
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleClearResources(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || (sender.tab ? sender.tab.id.toString() : null);
      
      if (!tabId) {
        sendResponse({ success: false, error: '无效的标签页ID' });
        return false;
      }
      
      this.resourceService.clearResources(tabId);
      
      sendResponse({ success: true });
      return false;
    } catch (e) {
      console.error('处理清除资源请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理分析资源请求
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleAnalyzeResource(message, sender, sendResponse) {
    try {
      const resource = message.resource;
      
      if (!resource) {
        sendResponse({ success: false, error: '无效的资源' });
        return false;
      }
      
      const analysisResult = this._analyzeResource(resource);
      
      sendResponse({ 
        success: true, 
        result: analysisResult
      });
      return false;
    } catch (e) {
      console.error('处理分析资源请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理预测资源请求
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handlePredictResources(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || (sender.tab ? sender.tab.id.toString() : null);
      const url = message.url;
      const html = message.html;
      
      if (!tabId || !url) {
        sendResponse({ success: false, error: '无效的标签页ID或URL' });
        return false;
      }
      
      const worker = new Worker(chrome.runtime.getURL('src/workers/resource-predictor.js'));
      
      worker.onmessage = (e) => {
        const { action, predictedResources } = e.data;
        
        if (action === 'predictionComplete' && predictedResources && predictedResources.length > 0) {
          predictedResources.forEach(resource => {
            resource.isPredicted = true;
            resource.source = SOURCE_TYPES.PREDICTED;
            
            const scoreResult = ResourceUtils.calculateResourceScore(resource);
            resource.score = scoreResult.score;
            resource.scoreDetails = scoreResult.details;
          });
          
          const addedCount = this.resourceService.addResources(tabId, predictedResources);
          
          sendResponse({ 
            success: true, 
            resources: predictedResources,
            addedCount: addedCount
          });
          
          worker.terminate();
        }
      };
      
      worker.onerror = (e) => {
        console.error('预测Worker错误:', e);
        sendResponse({ success: false, error: e.message });
        worker.terminate();
      };
      
      worker.postMessage({
        action: 'predict',
        url: url,
        hostname: new URL(url).hostname,
        html: html
      });
      
      return true; // 异步响应
    } catch (e) {
      console.error('处理预测资源请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 分析资源
   * @param {Object} resource - 资源对象
   * @returns {Object} - 分析结果
   * @private
   */
  _analyzeResource(resource) {
    if (!resource) return null;
    
    try {
      const scoreResult = ResourceUtils.calculateResourceScore(resource);
      
      const quality = ResourceUtils.estimateQualityLevel(resource);
      
      const urlAnalysis = {
        filename: ResourceUtils.extractFilename(resource.url),
        extension: ResourceUtils.extractExtension(resource.url),
        domain: ResourceUtils.extractDomain(resource.url),
        isDataUrl: resource.url.startsWith('data:'),
        isBlobUrl: resource.url.startsWith('blob:')
      };
      
      return {
        score: scoreResult.score,
        scoreDetails: scoreResult.details,
        quality: quality,
        urlAnalysis: urlAnalysis,
        timestamp: Date.now()
      };
    } catch (e) {
      console.warn('分析资源错误:', e);
      return null;
    }
  }
  
  /**
   * 处理流媒体资源
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleStreamingResource(message, sender, sendResponse) {
    try {
      const tabId = sender.tab ? sender.tab.id.toString() : null;
      const resource = message.resource;
      
      if (!tabId || !resource) {
        sendResponse({ success: false, error: '无效的标签页ID或资源' });
        return false;
      }
      
      resource.isStream = true;
      
      const added = this.resourceService.addResource(tabId, resource);
      
      sendResponse({ success: true, added: added });
      return false;
    } catch (e) {
      console.error('处理流媒体资源请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理内容脚本初始化消息
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleContentScriptInitialized(message, sender, sendResponse) {
    try {
      const tabId = sender.tab ? sender.tab.id.toString() : null;
      const url = message.url;
      const hostname = message.hostname;
      
      if (!tabId || !url) {
        sendResponse({ success: false, error: '无效的标签页ID或URL' });
        return false;
      }
      
      console.log(`内容脚本已初始化: 标签页 ${tabId}, URL: ${url}`);
      
      
      sendResponse({ success: true });
      return false;
    } catch (e) {
      console.error('处理内容脚本初始化消息错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理获取相似资源请求
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleGetSimilarResources(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || (sender.tab ? sender.tab.id.toString() : null);
      const resourceUrl = message.resourceUrl;
      
      if (!tabId || !resourceUrl) {
        sendResponse({ success: false, error: '无效的标签页ID或资源URL' });
        return false;
      }
      
      const similarResources = this.resourceService.getSimilarResources(tabId, resourceUrl);
      
      sendResponse({ 
        success: true, 
        resources: similarResources,
        count: similarResources.length
      });
      return false;
    } catch (e) {
      console.error('处理获取相似资源请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
  
  /**
   * 处理获取资源统计信息请求
   * @param {Object} message - 消息对象
   * @param {Object} sender - 发送者信息
   * @param {Function} sendResponse - 回复函数
   * @returns {boolean} - 是否需要异步响应
   */
  handleGetResourceStats(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || (sender.tab ? sender.tab.id.toString() : null);
      
      if (!tabId) {
        sendResponse({ success: false, error: '无效的标签页ID' });
        return false;
      }
      
      const stats = this.resourceService.getResourceStats(tabId);
      
      sendResponse({ 
        success: true, 
        stats: stats
      });
      return false;
    } catch (e) {
      console.error('处理获取资源统计信息请求错误:', e);
      sendResponse({ success: false, error: e.message });
      return false;
    }
  }
}

export default ResourceHandler;
