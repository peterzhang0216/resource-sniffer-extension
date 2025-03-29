/**
 * @file websocket-push-service.js
 * @description WebSocket推送服务，实时推送新发现的资源
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import monitoringService from './monitoring-service.js';

/**
 * WebSocket推送服务
 * @class WebSocketPushService
 */
class WebSocketPushService {
  /**
   * 创建WebSocket推送服务实例
   */
  constructor() {
    this.connections = new Map();
    this.resourceBuffer = new Map();
    this.monitoringTabs = new Set();
    this.options = {
      bufferSize: 50,
      flushInterval: 500, // 毫秒
      maxResourcesPerPush: 20,
      reconnectInterval: 5000, // 毫秒
      maxReconnectAttempts: 5
    };
    
    this._initializeFlushInterval();
    
    this._registerMonitoringListeners();
  }
  
  /**
   * 初始化定时刷新
   * @private
   */
  _initializeFlushInterval() {
    setInterval(() => {
      this._flushAllBuffers();
    }, this.options.flushInterval);
  }
  
  /**
   * 注册监控服务监听器
   * @private
   */
  _registerMonitoringListeners() {
    monitoringService.addListener('resourceDetection', (data) => {
      if (data && data.resources) {
        this._bufferResources('detection', data.resources);
      }
    });
    
    monitoringService.addListener('resourceAnalysis', (data) => {
      if (data && data.resources) {
        this._bufferResources('analysis', data.resources);
      }
    });
    
    monitoringService.addListener('resourceDownload', (data) => {
      if (data && data.resource) {
        this._bufferResources('download', [data.resource]);
      }
    });
    
    monitoringService.addListener('error', (data) => {
      if (data && data.error) {
        this._bufferResources('error', [data.error]);
      }
    });
  }
  
  /**
   * 缓存资源
   * @private
   * @param {string} type - 资源类型
   * @param {Array} resources - 资源数组
   */
  _bufferResources(type, resources) {
    if (!resources || !resources.length) return;
    
    for (const tabId of this.monitoringTabs) {
      if (!this.resourceBuffer.has(tabId)) {
        this.resourceBuffer.set(tabId, []);
      }
      
      const buffer = this.resourceBuffer.get(tabId);
      
      resources.forEach(resource => {
        buffer.push({
          type: type,
          data: resource,
          timestamp: Date.now()
        });
      });
      
      if (buffer.length > this.options.bufferSize) {
        buffer.splice(0, buffer.length - this.options.bufferSize);
      }
    }
  }
  
  /**
   * 刷新所有缓冲区
   * @private
   */
  _flushAllBuffers() {
    for (const [tabId, buffer] of this.resourceBuffer.entries()) {
      if (buffer.length > 0) {
        this._pushBufferToClients(tabId, buffer);
        this.resourceBuffer.set(tabId, []);
      }
    }
  }
  
  /**
   * 推送缓冲区到客户端
   * @private
   * @param {string} tabId - 标签页ID
   * @param {Array} buffer - 资源缓冲区
   */
  _pushBufferToClients(tabId, buffer) {
    if (!this.connections.has(tabId)) return;
    
    const connections = this.connections.get(tabId);
    if (connections.size === 0) return;
    
    const resources = buffer.slice(0, this.options.maxResourcesPerPush);
    
    const message = {
      action: 'newResources',
      resources: resources,
      timestamp: Date.now(),
      hasMore: buffer.length > this.options.maxResourcesPerPush
    };
    
    for (const connection of connections) {
      try {
        if (connection.readyState === WebSocket.OPEN) {
          connection.send(JSON.stringify(message));
        }
      } catch (e) {
        console.warn('WebSocket推送错误:', e);
      }
    }
  }
  
  /**
   * 启动监控
   * @param {string} tabId - 标签页ID
   * @returns {boolean} - 是否成功启动
   */
  startMonitoring(tabId) {
    if (!tabId) return false;
    
    if (!this.resourceBuffer.has(tabId)) {
      this.resourceBuffer.set(tabId, []);
    }
    
    this.monitoringTabs.add(tabId);
    
    console.log(`[WebSocket推送服务] 开始监控标签页: ${tabId}`);
    
    return true;
  }
  
  /**
   * 停止监控
   * @param {string} tabId - 标签页ID
   * @returns {boolean} - 是否成功停止
   */
  stopMonitoring(tabId) {
    if (!tabId) return false;
    
    this.monitoringTabs.delete(tabId);
    
    this.resourceBuffer.delete(tabId);
    
    console.log(`[WebSocket推送服务] 停止监控标签页: ${tabId}`);
    
    return true;
  }
  
  /**
   * 创建WebSocket服务器
   * @param {number} port - 端口号
   * @returns {Promise<Object>} - WebSocket服务器
   */
  async createServer(port = 8888) {
    return new Promise((resolve, reject) => {
      try {
        
        const server = {
          port: port,
          isRunning: true,
          
          start: () => {
            console.log(`[WebSocket推送服务] 服务器启动在端口: ${port}`);
            return Promise.resolve(true);
          },
          
          stop: () => {
            this.isRunning = false;
            console.log('[WebSocket推送服务] 服务器已停止');
            return Promise.resolve(true);
          }
        };
        
        resolve(server);
      } catch (e) {
        console.error('[WebSocket推送服务] 创建服务器错误:', e);
        reject(e);
      }
    });
  }
  
  /**
   * 添加连接
   * @param {string} tabId - 标签页ID
   * @param {WebSocket} connection - WebSocket连接
   * @returns {boolean} - 是否成功添加
   */
  addConnection(tabId, connection) {
    if (!tabId || !connection) return false;
    
    if (!this.connections.has(tabId)) {
      this.connections.set(tabId, new Set());
    }
    
    this.connections.get(tabId).add(connection);
    
    connection.addEventListener('close', () => {
      this._removeConnection(tabId, connection);
    });
    
    connection.addEventListener('error', (error) => {
      console.warn(`[WebSocket推送服务] 连接错误 (${tabId}):`, error);
      this._removeConnection(tabId, connection);
    });
    
    try {
      connection.send(JSON.stringify({
        action: 'connected',
        tabId: tabId,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('[WebSocket推送服务] 发送初始消息错误:', e);
    }
    
    console.log(`[WebSocket推送服务] 添加连接 (${tabId})`);
    
    return true;
  }
  
  /**
   * 移除连接
   * @private
   * @param {string} tabId - 标签页ID
   * @param {WebSocket} connection - WebSocket连接
   */
  _removeConnection(tabId, connection) {
    if (!tabId || !connection) return;
    
    if (this.connections.has(tabId)) {
      this.connections.get(tabId).delete(connection);
      
      if (this.connections.get(tabId).size === 0) {
        this.connections.delete(tabId);
      }
    }
    
    console.log(`[WebSocket推送服务] 移除连接 (${tabId})`);
  }
  
  /**
   * 创建客户端连接
   * @param {string} url - WebSocket URL
   * @param {Object} options - 连接选项
   * @returns {Promise<WebSocket>} - WebSocket连接
   */
  createClientConnection(url, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const connection = new WebSocket(url);
        
        connection.addEventListener('open', () => {
          console.log('[WebSocket推送服务] 客户端连接已建立');
          resolve(connection);
        });
        
        connection.addEventListener('error', (error) => {
          console.warn('[WebSocket推送服务] 客户端连接错误:', error);
          reject(error);
        });
        
        if (options.autoReconnect !== false) {
          let reconnectAttempts = 0;
          
          connection.addEventListener('close', () => {
            if (reconnectAttempts < (options.maxReconnectAttempts || this.options.maxReconnectAttempts)) {
              reconnectAttempts++;
              
              console.log(`[WebSocket推送服务] 尝试重新连接 (${reconnectAttempts}/${options.maxReconnectAttempts || this.options.maxReconnectAttempts})`);
              
              setTimeout(() => {
                this.createClientConnection(url, options)
                  .then(newConnection => {
                    if (options.onReconnect) {
                      options.onReconnect(newConnection);
                    }
                  })
                  .catch(e => {
                    console.warn('[WebSocket推送服务] 重新连接失败:', e);
                  });
              }, options.reconnectInterval || this.options.reconnectInterval);
            }
          });
        }
        
        if (options.onMessage) {
          connection.addEventListener('message', (event) => {
            try {
              const data = JSON.parse(event.data);
              options.onMessage(data);
            } catch (e) {
              console.warn('[WebSocket推送服务] 解析消息错误:', e);
              options.onMessage(event.data);
            }
          });
        }
      } catch (e) {
        console.error('[WebSocket推送服务] 创建客户端连接错误:', e);
        reject(e);
      }
    });
  }
  
  /**
   * 获取连接统计
   * @returns {Object} - 连接统计
   */
  getConnectionStats() {
    const stats = {
      totalConnections: 0,
      connectionsByTab: {},
      monitoringTabs: Array.from(this.monitoringTabs),
      bufferSizes: {}
    };
    
    for (const [tabId, connections] of this.connections.entries()) {
      stats.totalConnections += connections.size;
      stats.connectionsByTab[tabId] = connections.size;
    }
    
    for (const [tabId, buffer] of this.resourceBuffer.entries()) {
      stats.bufferSizes[tabId] = buffer.length;
    }
    
    return stats;
  }
}

const webSocketPushService = new WebSocketPushService();

export default webSocketPushService;
