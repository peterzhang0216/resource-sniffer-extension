/**
 * @file protocol-adapter.js
 * @description 协议适配器服务，支持多种协议的资源检测和下载
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES } from '../config/constants.js';
import monitoringService from './monitoring-service.js';

/**
 * 协议适配器服务
 * @class ProtocolAdapterService
 */
class ProtocolAdapterService {
  /**
   * 创建协议适配器服务实例
   */
  constructor() {
    this.adapters = new Map();
    this.registerDefaultAdapters();
  }
  
  /**
   * 注册适配器
   * @param {string} id - 适配器ID
   * @param {Object} adapter - 适配器对象
   */
  registerAdapter(id, adapter) {
    if (!id || !adapter) return;
    
    this.adapters.set(id, adapter);
    
    monitoringService.recordResourceDetection({
      type: 'adapter_registered',
      resources: [{
        id: id,
        name: adapter.name,
        protocols: adapter.protocols
      }]
    });
    
    console.log(`协议适配器已注册: ${adapter.name}`);
  }
  
  /**
   * 注册默认适配器
   * @private
   */
  registerDefaultAdapters() {
    this.registerAdapter('http', {
      name: 'HTTP/HTTPS',
      protocols: ['http:', 'https:'],
      canHandle: (url) => url.startsWith('http:') || url.startsWith('https:'),
      
      fetchResource: async (url, options = {}) => {
        try {
          monitoringService.recordResourceDetection({
            type: 'fetch_start',
            resources: [{
              url: url,
              protocol: 'http',
              options: options
            }]
          });
          
          const startTime = Date.now();
          
          const response = await fetch(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
            credentials: options.credentials || 'same-origin',
            cache: options.cache || 'default',
            redirect: options.redirect || 'follow',
            referrerPolicy: options.referrerPolicy || 'no-referrer-when-downgrade',
            mode: options.mode || 'cors'
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
          }
          
          const data = options.responseType === 'blob' ? await response.blob() : 
                      options.responseType === 'json' ? await response.json() : 
                      options.responseType === 'text' ? await response.text() : null;
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          const result = {
            url: url,
            contentType: response.headers.get('content-type'),
            size: parseInt(response.headers.get('content-length') || '0'),
            status: response.status,
            headers: this.extractHeaders(response.headers),
            data: data,
            duration: duration,
            timestamp: endTime
          };
          
          monitoringService.recordResourceAnalysis({
            type: 'fetch_complete',
            resources: [result]
          });
          
          return result;
        } catch (e) {
          console.error('HTTP适配器获取资源错误:', e);
          
          monitoringService.recordError({
            type: 'fetch_error',
            url: url,
            message: e.message,
            stack: e.stack
          });
          
          throw e;
        }
      },
      
      getResourceInfo: async (url) => {
        try {
          const response = await fetch(url, {
            method: 'HEAD',
            mode: 'cors',
            cache: 'no-cache'
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
          }
          
          const contentType = response.headers.get('content-type') || '';
          const contentLength = parseInt(response.headers.get('content-length') || '0');
          
          let type = RESOURCE_TYPES.OTHER;
          if (contentType.startsWith('image/')) {
            type = RESOURCE_TYPES.IMAGE;
          } else if (contentType.startsWith('video/') || contentType.includes('mpegurl') || contentType.includes('dash+xml')) {
            type = RESOURCE_TYPES.VIDEO;
          } else if (contentType.startsWith('audio/')) {
            type = RESOURCE_TYPES.AUDIO;
          }
          
          return {
            url: url,
            type: type,
            contentType: contentType,
            size: contentLength,
            headers: this.extractHeaders(response.headers),
            available: true
          };
        } catch (e) {
          console.warn('HTTP适配器获取资源信息错误:', e);
          return {
            url: url,
            available: false,
            error: e.message
          };
        }
      },
      
      downloadResource: (url, options = {}) => {
        return new Promise((resolve, reject) => {
          try {
            monitoringService.recordResourceDownload({
              status: 'start',
              resource: {
                url: url,
                type: options.type || 'unknown',
                size: options.size || 0
              }
            });
            
            chrome.downloads.download({
              url: url,
              filename: options.filename,
              saveAs: options.saveAs || false,
              conflictAction: options.conflictAction || 'uniquify'
            }, (downloadId) => {
              if (chrome.runtime.lastError) {
                monitoringService.recordResourceDownload({
                  status: 'error',
                  resource: {
                    url: url,
                    type: options.type || 'unknown'
                  },
                  error: {
                    message: chrome.runtime.lastError.message
                  }
                });
                
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                const result = {
                  downloadId: downloadId,
                  url: url,
                  filename: options.filename,
                  timestamp: Date.now()
                };
                
                if (chrome.downloads && chrome.downloads.onChanged) {
                  const listener = (delta) => {
                    if (delta.id !== downloadId) return;
                    
                    if (delta.state) {
                      if (delta.state.current === 'complete') {
                        monitoringService.recordResourceDownload({
                          status: 'complete',
                          resource: {
                            url: url,
                            type: options.type || 'unknown',
                            size: options.size || 0
                          }
                        });
                        
                        chrome.downloads.onChanged.removeListener(listener);
                      } else if (delta.state.current === 'interrupted') {
                        monitoringService.recordResourceDownload({
                          status: 'error',
                          resource: {
                            url: url,
                            type: options.type || 'unknown'
                          },
                          error: {
                            message: 'Download interrupted'
                          }
                        });
                        
                        chrome.downloads.onChanged.removeListener(listener);
                      }
                    }
                    
                    if (delta.bytesReceived) {
                      monitoringService.recordResourceDownload({
                        status: 'progress',
                        resource: {
                          url: url,
                          type: options.type || 'unknown',
                          size: options.size || 0
                        },
                        progress: {
                          bytesDownloaded: delta.bytesReceived.current
                        }
                      });
                    }
                  };
                  
                  chrome.downloads.onChanged.addListener(listener);
                }
                
                resolve(result);
              }
            });
          } catch (e) {
            monitoringService.recordResourceDownload({
              status: 'error',
              resource: {
                url: url,
                type: options.type || 'unknown'
              },
              error: {
                message: e.message,
                stack: e.stack
              }
            });
            
            reject(e);
          }
        });
      }
    });
    
    this.registerAdapter('websocket', {
      name: 'WebSocket',
      protocols: ['ws:', 'wss:'],
      canHandle: (url) => url.startsWith('ws:') || url.startsWith('wss:'),
      
      fetchResource: async (url, options = {}) => {
        return new Promise((resolve, reject) => {
          try {
            monitoringService.recordResourceDetection({
              type: 'websocket_connect',
              resources: [{
                url: url,
                protocol: 'websocket',
                options: options
              }]
            });
            
            const startTime = Date.now();
            const ws = new WebSocket(url, options.protocols);
            
            ws.onopen = () => {
              const endTime = Date.now();
              
              monitoringService.recordResourceAnalysis({
                type: 'websocket_open',
                resources: [{
                  url: url,
                  protocol: 'websocket',
                  duration: endTime - startTime
                }]
              });
              
              if (options.checkOnly) {
                ws.close();
                
                resolve({
                  url: url,
                  contentType: 'application/websocket',
                  status: 101, // WebSocket协议切换
                  available: true,
                  duration: endTime - startTime,
                  timestamp: endTime
                });
              }
            };
            
            ws.onerror = (error) => {
              monitoringService.recordError({
                type: 'websocket_error',
                url: url,
                message: 'WebSocket connection error'
              });
              
              reject(new Error('WebSocket connection error'));
            };
            
            if (options.message) {
              ws.onmessage = (event) => {
                monitoringService.recordResourceAnalysis({
                  type: 'websocket_message',
                  resources: [{
                    url: url,
                    protocol: 'websocket',
                    size: event.data.length || 0
                  }]
                });
                
                resolve({
                  url: url,
                  contentType: 'application/websocket',
                  data: event.data,
                  status: 101,
                  available: true,
                  timestamp: Date.now()
                });
                
                ws.close();
              };
              
              ws.send(options.message);
            }
          } catch (e) {
            monitoringService.recordError({
              type: 'websocket_error',
              url: url,
              message: e.message,
              stack: e.stack
            });
            
            reject(e);
          }
        });
      },
      
      getResourceInfo: async (url) => {
        try {
          return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            
            ws.onopen = () => {
              ws.close();
              
              resolve({
                url: url,
                type: RESOURCE_TYPES.OTHER,
                contentType: 'application/websocket',
                available: true
              });
            };
            
            ws.onerror = () => {
              resolve({
                url: url,
                available: false,
                error: 'WebSocket connection error'
              });
            };
            
            setTimeout(() => {
              if (ws.readyState !== WebSocket.OPEN) {
                ws.close();
                resolve({
                  url: url,
                  available: false,
                  error: 'WebSocket connection timeout'
                });
              }
            }, 5000);
          });
        } catch (e) {
          return {
            url: url,
            available: false,
            error: e.message
          };
        }
      },
      
      downloadResource: () => {
        return Promise.reject(new Error('WebSocket资源不支持直接下载'));
      }
    });
    
    this.registerAdapter('data', {
      name: 'Data URL',
      protocols: ['data:'],
      canHandle: (url) => url.startsWith('data:'),
      
      fetchResource: async (url) => {
        try {
          const matches = url.match(/^data:([^;]+);([^,]+),(.*)$/);
          if (!matches) {
            throw new Error('无效的数据URL');
          }
          
          const contentType = matches[1];
          const encoding = matches[2];
          const data = matches[3];
          
          let blob;
          if (encoding === 'base64') {
            const byteString = atob(data);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            
            blob = new Blob([ab], { type: contentType });
          } else {
            blob = new Blob([decodeURIComponent(data)], { type: contentType });
          }
          
          return {
            url: url,
            contentType: contentType,
            size: blob.size,
            data: blob
          };
        } catch (e) {
          console.error('数据URL适配器获取资源错误:', e);
          throw e;
        }
      },
      
      getResourceInfo: async (url) => {
        try {
          const matches = url.match(/^data:([^;]+);([^,]+),(.*)$/);
          if (!matches) {
            throw new Error('无效的数据URL');
          }
          
          const contentType = matches[1];
          const encoding = matches[2];
          const data = matches[3];
          
          let size = 0;
          if (encoding === 'base64') {
            size = Math.floor((data.length * 3) / 4);
          } else {
            size = decodeURIComponent(data).length;
          }
          
          let type = RESOURCE_TYPES.OTHER;
          if (contentType.startsWith('image/')) {
            type = RESOURCE_TYPES.IMAGE;
          } else if (contentType.startsWith('video/')) {
            type = RESOURCE_TYPES.VIDEO;
          } else if (contentType.startsWith('audio/')) {
            type = RESOURCE_TYPES.AUDIO;
          }
          
          return {
            url: url,
            type: type,
            contentType: contentType,
            size: size,
            available: true
          };
        } catch (e) {
          console.warn('数据URL适配器获取资源信息错误:', e);
          return {
            url: url,
            available: false,
            error: e.message
          };
        }
      },
      
      downloadResource: async (url, options = {}) => {
        try {
          const resource = await this.fetchResource(url);
          const blobUrl = URL.createObjectURL(resource.data);
          
          return new Promise((resolve, reject) => {
            chrome.downloads.download({
              url: blobUrl,
              filename: options.filename,
              saveAs: options.saveAs || false,
              conflictAction: options.conflictAction || 'uniquify'
            }, (downloadId) => {
              URL.revokeObjectURL(blobUrl);
              
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve({
                  downloadId: downloadId,
                  url: url,
                  filename: options.filename
                });
              }
            });
          });
        } catch (e) {
          console.error('数据URL适配器下载资源错误:', e);
          throw e;
        }
      }
    });
    
    this.registerAdapter('blob', {
      name: 'Blob URL',
      protocols: ['blob:'],
      canHandle: (url) => url.startsWith('blob:'),
      
      fetchResource: async (url) => {
        try {
          const response = await fetch(url);
          
          if (!response.ok) {
            throw new Error(`Blob URL fetch error: ${response.status}`);
          }
          
          const blob = await response.blob();
          
          return {
            url: url,
            contentType: blob.type,
            size: blob.size,
            data: blob
          };
        } catch (e) {
          console.error('Blob URL适配器获取资源错误:', e);
          throw e;
        }
      },
      
      getResourceInfo: async (url) => {
        try {
          const response = await fetch(url, {
            method: 'HEAD'
          });
          
          if (!response.ok) {
            throw new Error(`Blob URL fetch error: ${response.status}`);
          }
          
          const contentType = response.headers.get('content-type') || '';
          
          let type = RESOURCE_TYPES.OTHER;
          if (contentType.startsWith('image/')) {
            type = RESOURCE_TYPES.IMAGE;
          } else if (contentType.startsWith('video/')) {
            type = RESOURCE_TYPES.VIDEO;
          } else if (contentType.startsWith('audio/')) {
            type = RESOURCE_TYPES.AUDIO;
          }
          
          return {
            url: url,
            type: type,
            contentType: contentType,
            available: true
          };
        } catch (e) {
          console.warn('Blob URL适配器获取资源信息错误:', e);
          return {
            url: url,
            available: false,
            error: e.message
          };
        }
      },
      
      downloadResource: async (url, options = {}) => {
        try {
          return new Promise((resolve, reject) => {
            chrome.downloads.download({
              url: url,
              filename: options.filename,
              saveAs: options.saveAs || false,
              conflictAction: options.conflictAction || 'uniquify'
            }, (downloadId) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve({
                  downloadId: downloadId,
                  url: url,
                  filename: options.filename
                });
              }
            });
          });
        } catch (e) {
          console.error('Blob URL适配器下载资源错误:', e);
          throw e;
        }
      }
    });
  }
  
  /**
   * 提取HTTP头信息
   * @private
   * @param {Headers} headers - HTTP头
   * @returns {Object} 头信息对象
   */
  extractHeaders(headers) {
    const result = {};
    
    if (headers && typeof headers.forEach === 'function') {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    }
    
    return result;
  }
  
  /**
   * 获取适配器
   * @param {string} url - 资源URL
   * @returns {Object|null} 适配器对象
   */
  getAdapter(url) {
    if (!url) return null;
    
    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle && adapter.canHandle(url)) {
        return adapter;
      }
    }
    
    return null;
  }
  
  /**
   * 获取资源
   * @param {string} url - 资源URL
   * @param {Object} options - 获取选项
   * @returns {Promise<Object>} 资源对象
   */
  async fetchResource(url, options = {}) {
    const adapter = this.getAdapter(url);
    
    if (!adapter) {
      throw new Error(`没有适配器可以处理URL: ${url}`);
    }
    
    return adapter.fetchResource(url, options);
  }
  
  /**
   * 获取资源信息
   * @param {string} url - 资源URL
   * @returns {Promise<Object>} 资源信息
   */
  async getResourceInfo(url) {
    const adapter = this.getAdapter(url);
    
    if (!adapter) {
      return {
        url: url,
        available: false,
        error: '没有适配器可以处理此URL'
      };
    }
    
    return adapter.getResourceInfo(url);
  }
  
  /**
   * 下载资源
   * @param {string} url - 资源URL
   * @param {Object} options - 下载选项
   * @returns {Promise<Object>} 下载结果
   */
  async downloadResource(url, options = {}) {
    const adapter = this.getAdapter(url);
    
    if (!adapter) {
      throw new Error(`没有适配器可以处理URL: ${url}`);
    }
    
    if (!adapter.downloadResource) {
      throw new Error(`适配器 ${adapter.name} 不支持下载`);
    }
    
    return adapter.downloadResource(url, options);
  }
  
  /**
   * 检查URL是否可用
   * @param {string} url - 资源URL
   * @returns {Promise<boolean>} 是否可用
   */
  async isUrlAvailable(url) {
    try {
      const info = await this.getResourceInfo(url);
      return info.available === true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * 获取所有支持的协议
   * @returns {Array} 协议列表
   */
  getSupportedProtocols() {
    const protocols = [];
    
    this.adapters.forEach(adapter => {
      if (adapter.protocols && Array.isArray(adapter.protocols)) {
        protocols.push(...adapter.protocols);
      }
    });
    
    return [...new Set(protocols)]; // 去重
  }
}

const protocolAdapterService = new ProtocolAdapterService();

export default protocolAdapterService;
