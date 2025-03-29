/**
 * @file message-handler.js
 * @description 内容脚本消息处理，负责与后台脚本通信
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

/**
 * 消息处理类
 * @class MessageHandler
 */
class MessageHandler {
  /**
   * 创建消息处理实例
   */
  constructor() {
    this.messageListeners = {};
    this.setupChromeMessageListener();
  }
  
  /**
   * 设置Chrome消息监听器
   */
  setupChromeMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || !message.action) return false;
      
      const { action } = message;
      
      if (this.messageListeners[action]) {
        try {
          const result = this.messageListeners[action](message, sender);
          
          if (result instanceof Promise) {
            result
              .then(response => {
                try {
                  sendResponse(response);
                } catch (e) {
                  console.warn(`发送异步响应错误 (${action}):`, e);
                }
              })
              .catch(error => {
                console.warn(`处理消息错误 (${action}):`, error);
                try {
                  sendResponse({ error: error.message || '未知错误' });
                } catch (e) {
                  console.warn(`发送错误响应错误 (${action}):`, e);
                }
              });
            
            return true; // 保持消息通道开放以进行异步响应
          } else {
            sendResponse(result);
            return false;
          }
        } catch (e) {
          console.warn(`处理消息异常 (${action}):`, e);
          try {
            sendResponse({ error: e.message || '未知错误' });
          } catch (sendError) {
            console.warn(`发送错误响应异常 (${action}):`, sendError);
          }
          return false;
        }
      }
      
      return false;
    });
  }
  
  /**
   * 设置消息监听器
   * @param {Object} handlers - 消息处理函数映射
   */
  setupMessageListeners(handlers) {
    if (!handlers || typeof handlers !== 'object') return;
    
    this.messageListeners = {
      ...this.messageListeners,
      ...handlers
    };
  }
  
  /**
   * 移除消息监听器
   * @param {string} action - 消息动作
   */
  removeMessageListener(action) {
    if (action && this.messageListeners[action]) {
      delete this.messageListeners[action];
    }
  }
  
  /**
   * 清除所有消息监听器
   */
  clearMessageListeners() {
    this.messageListeners = {};
  }
  
  /**
   * 发送消息到后台脚本
   * @param {Object} message - 要发送的消息对象
   * @returns {Promise} - 消息响应的Promise
   */
  sendMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(message, response => {
          if (chrome.runtime.lastError) {
            console.warn('消息发送错误:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        console.warn('消息发送异常:', e);
        reject(e);
      }
    });
  }
  
  /**
   * 发送消息到指定标签页
   * @param {number} tabId - 标签页ID
   * @param {Object} message - 要发送的消息对象
   * @returns {Promise} - 消息响应的Promise
   */
  sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.sendMessage(tabId, message, response => {
          if (chrome.runtime.lastError) {
            console.warn(`发送消息到标签页 ${tabId} 错误:`, chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        console.warn(`发送消息到标签页 ${tabId} 异常:`, e);
        reject(e);
      }
    });
  }
  
  /**
   * 广播消息到所有标签页
   * @param {Object} message - 要发送的消息对象
   * @returns {Promise<Array>} - 所有标签页响应的Promise
   */
  broadcastMessage(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query({}, tabs => {
          const responses = [];
          let completedCount = 0;
          
          if (!tabs || tabs.length === 0) {
            resolve([]);
            return;
          }
          
          tabs.forEach(tab => {
            try {
              chrome.tabs.sendMessage(tab.id, message, response => {
                completedCount++;
                
                if (!chrome.runtime.lastError) {
                  responses.push({
                    tabId: tab.id,
                    response: response
                  });
                }
                
                if (completedCount === tabs.length) {
                  resolve(responses);
                }
              });
            } catch (e) {
              completedCount++;
              console.warn(`向标签页 ${tab.id} 广播消息异常:`, e);
              
              if (completedCount === tabs.length) {
                resolve(responses);
              }
            }
          });
        });
      } catch (e) {
        console.warn('广播消息异常:', e);
        reject(e);
      }
    });
  }
  
  /**
   * 发送消息到当前活动标签页
   * @param {Object} message - 要发送的消息对象
   * @returns {Promise} - 消息响应的Promise
   */
  sendMessageToActiveTab(message) {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (!tabs || tabs.length === 0) {
            reject(new Error('没有活动标签页'));
            return;
          }
          
          const activeTab = tabs[0];
          
          chrome.tabs.sendMessage(activeTab.id, message, response => {
            if (chrome.runtime.lastError) {
              console.warn('发送消息到活动标签页错误:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
      } catch (e) {
        console.warn('发送消息到活动标签页异常:', e);
        reject(e);
      }
    });
  }
  
  /**
   * 处理错误
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文
   * @private
   */
  _handleError(error, context) {
    console.warn(`${context}:`, error);
    
    if (error.message && (
        error.message.includes('disconnected') || 
        error.message.includes('connection') || 
        error.message.includes('port closed'))) {
      console.warn('检测到连接错误，可能是扩展重新加载或标签页关闭');
    }
  }
}

export default MessageHandler;
