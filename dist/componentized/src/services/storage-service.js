/**
 * @file storage-service.js
 * @description 存储服务，处理数据持久化和设置管理
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { STORAGE_KEYS } from '../config/constants.js';
import { DEFAULT_OPTIONS } from '../config/constants.js';

/**
 * 存储服务类
 * @class StorageService
 */
class StorageService {
  /**
   * 创建存储服务实例
   */
  constructor() {
    this.cache = {};
    this.listeners = {};
  }
  
  /**
   * 保存设置
   * @param {Object} settings - 用户设置
   * @returns {Promise} - 保存操作的Promise
   */
  saveSettings(settings) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set({ 
          [STORAGE_KEYS.OPTIONS]: settings 
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            this.cache[STORAGE_KEYS.OPTIONS] = settings;
            this._notifyListeners(STORAGE_KEYS.OPTIONS, settings);
            resolve(settings);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  
  /**
   * 获取设置
   * @returns {Promise<Object>} - 用户设置
   */
  getSettings() {
    return new Promise((resolve, reject) => {
      if (this.cache[STORAGE_KEYS.OPTIONS]) {
        resolve(this.cache[STORAGE_KEYS.OPTIONS]);
        return;
      }
      
      try {
        chrome.storage.local.get(STORAGE_KEYS.OPTIONS, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            const settings = result[STORAGE_KEYS.OPTIONS] || DEFAULT_OPTIONS;
            this.cache[STORAGE_KEYS.OPTIONS] = settings;
            resolve(settings);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  
  /**
   * 保存下载历史
   * @param {Array} history - 下载历史记录
   * @returns {Promise} - 保存操作的Promise
   */
  saveDownloadHistory(history) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set({ 
          [STORAGE_KEYS.DOWNLOAD_HISTORY]: history 
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            this.cache[STORAGE_KEYS.DOWNLOAD_HISTORY] = history;
            this._notifyListeners(STORAGE_KEYS.DOWNLOAD_HISTORY, history);
            resolve(history);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  
  /**
   * 获取下载历史
   * @returns {Promise<Array>} - 下载历史记录
   */
  getDownloadHistory() {
    return new Promise((resolve, reject) => {
      if (this.cache[STORAGE_KEYS.DOWNLOAD_HISTORY]) {
        resolve(this.cache[STORAGE_KEYS.DOWNLOAD_HISTORY]);
        return;
      }
      
      try {
        chrome.storage.local.get(STORAGE_KEYS.DOWNLOAD_HISTORY, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            const history = result[STORAGE_KEYS.DOWNLOAD_HISTORY] || [];
            this.cache[STORAGE_KEYS.DOWNLOAD_HISTORY] = history;
            resolve(history);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  
  /**
   * 保存网站特定配置
   * @param {string} hostname - 网站主机名
   * @param {Object} config - 网站配置
   * @returns {Promise} - 保存操作的Promise
   */
  saveSiteConfig(hostname, config) {
    return new Promise((resolve, reject) => {
      this.getSiteConfigs().then(configs => {
        const updatedConfigs = { ...configs, [hostname]: config };
        
        try {
          chrome.storage.local.set({ 
            [STORAGE_KEYS.SITE_CONFIGS]: updatedConfigs 
          }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              this.cache[STORAGE_KEYS.SITE_CONFIGS] = updatedConfigs;
              this._notifyListeners(STORAGE_KEYS.SITE_CONFIGS, updatedConfigs);
              resolve(config);
            }
          });
        } catch (e) {
          reject(e);
        }
      }).catch(reject);
    });
  }
  
  /**
   * 获取网站特定配置
   * @param {string} hostname - 网站主机名
   * @returns {Promise<Object>} - 网站配置
   */
  getSiteConfig(hostname) {
    return new Promise((resolve, reject) => {
      this.getSiteConfigs().then(configs => {
        resolve(configs[hostname] || {});
      }).catch(reject);
    });
  }
  
  /**
   * 获取所有网站配置
   * @returns {Promise<Object>} - 所有网站配置
   */
  getSiteConfigs() {
    return new Promise((resolve, reject) => {
      if (this.cache[STORAGE_KEYS.SITE_CONFIGS]) {
        resolve(this.cache[STORAGE_KEYS.SITE_CONFIGS]);
        return;
      }
      
      try {
        chrome.storage.local.get(STORAGE_KEYS.SITE_CONFIGS, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            const configs = result[STORAGE_KEYS.SITE_CONFIGS] || {};
            this.cache[STORAGE_KEYS.SITE_CONFIGS] = configs;
            resolve(configs);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  
  /**
   * 保存资源缓存
   * @param {string} tabId - 标签页ID
   * @param {Array} resources - 资源数组
   * @returns {Promise} - 保存操作的Promise
   */
  saveResourceCache(tabId, resources) {
    const cacheKey = `resource_cache_${tabId}`;
    
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set({ 
          [cacheKey]: resources 
        }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            this.cache[cacheKey] = resources;
            resolve(resources);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  
  /**
   * 获取资源缓存
   * @param {string} tabId - 标签页ID
   * @returns {Promise<Array>} - 资源数组
   */
  getResourceCache(tabId) {
    const cacheKey = `resource_cache_${tabId}`;
    
    return new Promise((resolve, reject) => {
      if (this.cache[cacheKey]) {
        resolve(this.cache[cacheKey]);
        return;
      }
      
      try {
        chrome.storage.local.get(cacheKey, (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            const resources = result[cacheKey] || [];
            this.cache[cacheKey] = resources;
            resolve(resources);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  
  /**
   * 清除资源缓存
   * @param {string} tabId - 标签页ID
   * @returns {Promise} - 清除操作的Promise
   */
  clearResourceCache(tabId) {
    const cacheKey = `resource_cache_${tabId}`;
    
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.remove(cacheKey, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            delete this.cache[cacheKey];
            resolve();
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }
  
  /**
   * 添加存储变化监听器
   * @param {string} key - 存储键
   * @param {Function} callback - 回调函数
   */
  addListener(key, callback) {
    if (!this.listeners[key]) {
      this.listeners[key] = [];
    }
    
    if (typeof callback === 'function' && !this.listeners[key].includes(callback)) {
      this.listeners[key].push(callback);
    }
  }
  
  /**
   * 移除存储变化监听器
   * @param {string} key - 存储键
   * @param {Function} callback - 回调函数
   */
  removeListener(key, callback) {
    if (this.listeners[key]) {
      this.listeners[key] = this.listeners[key].filter(cb => cb !== callback);
    }
  }
  
  /**
   * 通知监听器
   * @param {string} key - 存储键
   * @param {*} data - 数据
   * @private
   */
  _notifyListeners(key, data) {
    if (this.listeners[key]) {
      this.listeners[key].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`存储监听器错误 (${key}):`, error);
        }
      });
    }
  }
  
  /**
   * 清除缓存
   */
  clearCache() {
    this.cache = {};
  }
  
  /**
   * 清除所有数据
   * @returns {Promise} - 清除操作的Promise
   */
  clearAllData() {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            this.clearCache();
            resolve();
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }
}

export default StorageService;
