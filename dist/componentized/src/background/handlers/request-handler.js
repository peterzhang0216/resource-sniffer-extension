/**
 * @file request-handler.js
 * @description 网络请求处理程序，监听和处理浏览器网络请求
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES } from '../../config/constants.js';
import URLUtils from '../../utils/url-utils.js';

/**
 * 网络请求处理程序类
 * @class RequestHandler
 */
class RequestHandler {
  /**
   * 创建网络请求处理程序实例
   * @param {Object} resourceService - 资源服务实例
   */
  constructor(resourceService) {
    this.resourceService = resourceService;
    this.mediaTypes = {
      image: [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
        'image/svg+xml', 'image/bmp', 'image/tiff', 'image/x-icon'
      ],
      video: [
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 
        'video/x-msvideo', 'video/x-matroska', 'video/x-flv', 'video/3gpp'
      ],
      audio: [
        'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 
        'audio/aac', 'audio/flac', 'audio/x-m4a'
      ],
      streaming: [
        'application/x-mpegURL', 'application/vnd.apple.mpegurl', 
        'application/dash+xml', 'application/vnd.ms-sstr+xml'
      ]
    };
    
    this._setupRequestListeners();
  }
  
  /**
   * 设置网络请求监听器
   * @private
   */
  _setupRequestListeners() {
    try {
      chrome.webRequest.onCompleted.addListener(
        this._handleCompletedRequest.bind(this),
        { urls: ["<all_urls>"] },
        ["responseHeaders"]
      );
      
      chrome.webRequest.onHeadersReceived.addListener(
        this._handleHeadersReceived.bind(this),
        { urls: ["<all_urls>"] },
        ["responseHeaders"]
      );
      
      console.log('网络请求监听器已设置');
    } catch (e) {
      console.error('设置网络请求监听器错误:', e);
    }
  }
  
  /**
   * 处理已完成的网络请求
   * @param {Object} details - 请求详情
   * @private
   */
  _handleCompletedRequest(details) {
    try {
      if (details.initiator && details.initiator.startsWith('chrome-extension://')) {
        return;
      }
      
      const contentType = this._getContentTypeFromHeaders(details.responseHeaders);
      if (!contentType || !this._isMediaContentType(contentType)) {
        return;
      }
      
      const resource = this._createResourceFromRequest(details, contentType);
      
      if (resource) {
        this.resourceService.addResource(details.tabId.toString(), resource);
      }
    } catch (e) {
      console.warn('处理已完成请求错误:', e);
    }
  }
  
  /**
   * 处理接收到的响应头
   * @param {Object} details - 请求详情
   * @private
   */
  _handleHeadersReceived(details) {
    try {
      if (details.initiator && details.initiator.startsWith('chrome-extension://')) {
        return;
      }
      
      const contentType = this._getContentTypeFromHeaders(details.responseHeaders);
      if (!contentType || !this._isStreamingContentType(contentType)) {
        return;
      }
      
      const resource = this._createResourceFromRequest(details, contentType);
      
      if (resource) {
        resource.isStream = true;
        resource.streamType = this._getStreamTypeFromContentType(contentType);
        this.resourceService.addResource(details.tabId.toString(), resource);
      }
    } catch (e) {
      console.warn('处理响应头错误:', e);
    }
  }
  
  /**
   * 从请求创建资源对象
   * @param {Object} details - 请求详情
   * @param {string} contentType - 内容类型
   * @returns {Object|null} - 资源对象或null
   * @private
   */
  _createResourceFromRequest(details, contentType) {
    try {
      const url = details.url;
      
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        return null;
      }
      
      const type = this._getResourceTypeFromContentType(contentType);
      if (!type) {
        return null;
      }
      
      const contentLength = this._getContentLengthFromHeaders(details.responseHeaders);
      
      const resource = {
        url: url,
        type: type,
        contentType: contentType,
        source: SOURCE_TYPES.NETWORK,
        timestamp: Date.now(),
        size: contentLength || 0,
        sizeFormatted: this._formatSize(contentLength || 0),
        filename: URLUtils.getFileName(url) || 'network-resource',
        quality: 'unknown',
        requestId: details.requestId
      };
      
      return resource;
    } catch (e) {
      console.warn('创建资源对象错误:', e);
      return null;
    }
  }
  
  /**
   * 从响应头获取内容类型
   * @param {Array} headers - 响应头数组
   * @returns {string|null} - 内容类型或null
   * @private
   */
  _getContentTypeFromHeaders(headers) {
    if (!headers || !Array.isArray(headers)) {
      return null;
    }
    
    const contentTypeHeader = headers.find(header => 
      header.name.toLowerCase() === 'content-type'
    );
    
    if (contentTypeHeader && contentTypeHeader.value) {
      return contentTypeHeader.value.split(';')[0].trim().toLowerCase();
    }
    
    return null;
  }
  
  /**
   * 从响应头获取内容长度
   * @param {Array} headers - 响应头数组
   * @returns {number|null} - 内容长度或null
   * @private
   */
  _getContentLengthFromHeaders(headers) {
    if (!headers || !Array.isArray(headers)) {
      return null;
    }
    
    const contentLengthHeader = headers.find(header => 
      header.name.toLowerCase() === 'content-length'
    );
    
    if (contentLengthHeader && contentLengthHeader.value) {
      return parseInt(contentLengthHeader.value, 10);
    }
    
    return null;
  }
  
  /**
   * 检查是否是媒体内容类型
   * @param {string} contentType - 内容类型
   * @returns {boolean} - 是否是媒体内容类型
   * @private
   */
  _isMediaContentType(contentType) {
    if (!contentType) return false;
    
    const lowerContentType = contentType.toLowerCase();
    
    return this.mediaTypes.image.includes(lowerContentType) || 
           this.mediaTypes.video.includes(lowerContentType) || 
           this.mediaTypes.audio.includes(lowerContentType) ||
           this.mediaTypes.streaming.includes(lowerContentType);
  }
  
  /**
   * 检查是否是流媒体内容类型
   * @param {string} contentType - 内容类型
   * @returns {boolean} - 是否是流媒体内容类型
   * @private
   */
  _isStreamingContentType(contentType) {
    if (!contentType) return false;
    
    const lowerContentType = contentType.toLowerCase();
    
    return this.mediaTypes.streaming.includes(lowerContentType);
  }
  
  /**
   * 从内容类型获取资源类型
   * @param {string} contentType - 内容类型
   * @returns {string|null} - 资源类型或null
   * @private
   */
  _getResourceTypeFromContentType(contentType) {
    if (!contentType) return null;
    
    const lowerContentType = contentType.toLowerCase();
    
    if (this.mediaTypes.image.includes(lowerContentType)) {
      return RESOURCE_TYPES.IMAGE;
    }
    
    if (this.mediaTypes.video.includes(lowerContentType)) {
      return RESOURCE_TYPES.VIDEO;
    }
    
    if (this.mediaTypes.audio.includes(lowerContentType)) {
      return RESOURCE_TYPES.AUDIO;
    }
    
    if (this.mediaTypes.streaming.includes(lowerContentType)) {
      return RESOURCE_TYPES.VIDEO;
    }
    
    return RESOURCE_TYPES.OTHER;
  }
  
  /**
   * 从内容类型获取流类型
   * @param {string} contentType - 内容类型
   * @returns {string} - 流类型
   * @private
   */
  _getStreamTypeFromContentType(contentType) {
    if (!contentType) return 'unknown';
    
    const lowerContentType = contentType.toLowerCase();
    
    if (lowerContentType === 'application/x-mpegurl' || 
        lowerContentType === 'application/vnd.apple.mpegurl') {
      return 'hls';
    }
    
    if (lowerContentType === 'application/dash+xml') {
      return 'dash';
    }
    
    if (lowerContentType === 'application/vnd.ms-sstr+xml') {
      return 'smooth';
    }
    
    return 'unknown';
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
      chrome.webRequest.onCompleted.removeListener(this._handleCompletedRequest);
      chrome.webRequest.onHeadersReceived.removeListener(this._handleHeadersReceived);
    } catch (e) {
      console.warn('清理网络请求处理程序错误:', e);
    }
  }
}

export default RequestHandler;
