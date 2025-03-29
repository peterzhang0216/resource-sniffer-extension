/**
 * @file indexeddb-service.js
 * @description IndexedDB数据库服务，用于长期存储和压缩日志数据
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { compress, decompress } from '../utils/compression-utils.js';

/**
 * IndexedDB数据库服务
 * @class IndexedDBService
 */
class IndexedDBService {
  /**
   * 创建IndexedDB服务实例
   */
  constructor() {
    this.DB_NAME = 'resource_sniffer_db';
    this.DB_VERSION = 1;
    this.STORES = {
      LOGS: 'logs',
      METRICS: 'performance_metrics',
      DOWNLOAD_HISTORY: 'download_history',
      LOG_ANALYSIS: 'log_analysis'
    };
    this.db = null;
    this.ready = this._initDatabase();
  }

  /**
   * 初始化数据库
   * @private
   * @returns {Promise} - 数据库初始化Promise
   */
  _initDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = (event) => {
        console.error('打开IndexedDB失败:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('IndexedDB连接成功');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains(this.STORES.LOGS)) {
          const logStore = db.createObjectStore(this.STORES.LOGS, { keyPath: 'id' });
          logStore.createIndex('timestamp', 'timestamp', { unique: false });
          logStore.createIndex('level', 'level', { unique: false });
          logStore.createIndex('category', 'category', { unique: false });
          logStore.createIndex('batchId', 'batchId', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.STORES.METRICS)) {
          const metricsStore = db.createObjectStore(this.STORES.METRICS, { keyPath: 'id' });
          metricsStore.createIndex('timestamp', 'timestamp', { unique: false });
          metricsStore.createIndex('type', 'type', { unique: false });
          metricsStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains(this.STORES.DOWNLOAD_HISTORY)) {
          const downloadStore = db.createObjectStore(this.STORES.DOWNLOAD_HISTORY, { keyPath: 'id' });
          downloadStore.createIndex('timestamp', 'timestamp', { unique: false });
          downloadStore.createIndex('status', 'status', { unique: false });
          downloadStore.createIndex('fileType', 'fileType', { unique: false });
        }
        
        if (!db.objectStoreNames.contains(this.STORES.LOG_ANALYSIS)) {
          const analysisStore = db.createObjectStore(this.STORES.LOG_ANALYSIS, { keyPath: 'id' });
          analysisStore.createIndex('timestamp', 'timestamp', { unique: false });
          analysisStore.createIndex('type', 'type', { unique: false });
          analysisStore.createIndex('severity', 'severity', { unique: false });
        }
      };
    });
  }

  /**
   * 保存压缩日志
   * @param {Array} logs - 日志数组
   * @returns {Promise} - 保存操作的Promise
   */
  async saveLogs(logs) {
    await this.ready;
    const compressedData = await compress(JSON.stringify(logs));
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.LOGS], 'readwrite');
      const store = transaction.objectStore(this.STORES.LOGS);
      
      const batchId = `log_batch_${Date.now()}`;
      const batchData = {
        id: batchId,
        timestamp: Date.now(),
        count: logs.length,
        compressedData: compressedData,
        batchId: batchId
      };
      
      const request = store.put(batchData);
      
      request.onsuccess = () => resolve(batchId);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * 获取日志
   * @param {Object} [filters] - 过滤条件
   * @returns {Promise<Array>} - 日志数组
   */
  async getLogs(filters = {}) {
    await this.ready;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.LOGS], 'readonly');
      const store = transaction.objectStore(this.STORES.LOGS);
      
      const allLogs = [];
      
      let range = null;
      if (filters.startTime && filters.endTime) {
        range = IDBKeyRange.bound(filters.startTime, filters.endTime);
      } else if (filters.startTime) {
        range = IDBKeyRange.lowerBound(filters.startTime);
      } else if (filters.endTime) {
        range = IDBKeyRange.upperBound(filters.endTime);
      }
      
      const index = store.index('timestamp');
      const request = range ? index.openCursor(range) : index.openCursor();
      
      request.onsuccess = async (event) => {
        const cursor = event.target.result;
        if (cursor) {
          try {
            const decompressedData = await decompress(cursor.value.compressedData);
            const decompressedLogs = JSON.parse(decompressedData);
            
            const filteredLogs = this._filterLogs(decompressedLogs, filters);
            allLogs.push(...filteredLogs);
          } catch (error) {
            console.error('解压日志失败:', error);
          }
          
          cursor.continue();
        } else {
          allLogs.sort((a, b) => b.timestamp - a.timestamp);
          
          if (filters.limit && allLogs.length > filters.limit) {
            resolve(allLogs.slice(0, filters.limit));
          } else {
            resolve(allLogs);
          }
        }
      };
      
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * 清除过期日志
   * @param {number} maxAge - 最大保留天数
   * @returns {Promise<number>} - 清除的日志条数
   */
  async clearOldLogs(maxAge) {
    await this.ready;
    const maxAgeTimestamp = Date.now() - (maxAge * 24 * 60 * 60 * 1000);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.LOGS], 'readwrite');
      const store = transaction.objectStore(this.STORES.LOGS);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(maxAgeTimestamp);
      
      let deleteCount = 0;
      
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          deleteCount += cursor.value.count;
          cursor.delete();
          cursor.continue();
        } else {
          resolve(deleteCount);
        }
      };
      
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * 保存性能指标
   * @param {string} type - 指标类型
   * @param {Object} data - 指标数据
   * @returns {Promise<string>} - 保存的指标ID
   */
  async saveMetric(type, data) {
    await this.ready;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.METRICS], 'readwrite');
      const store = transaction.objectStore(this.STORES.METRICS);
      
      const metricId = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const metricData = {
        id: metricId,
        timestamp: Date.now(),
        type,
        name: data.name || type,
        data
      };
      
      const request = store.put(metricData);
      
      request.onsuccess = () => resolve(metricId);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * 获取性能指标
   * @param {string} type - 指标类型
   * @param {number} limit - 最大条数
   * @returns {Promise<Array>} - 指标数组
   */
  async getMetrics(type, limit = 100) {
    await this.ready;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.METRICS], 'readonly');
      const store = transaction.objectStore(this.STORES.METRICS);
      const index = store.index('type');
      const range = IDBKeyRange.only(type);
      
      const metrics = [];
      
      const request = index.openCursor(range, 'prev');
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && metrics.length < limit) {
          metrics.push(cursor.value);
          cursor.continue();
        } else {
          resolve(metrics);
        }
      };
      
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * 保存下载历史
   * @param {Object} downloadItem - 下载项
   * @returns {Promise<string>} - 保存的下载项ID
   */
  async saveDownloadHistory(downloadItem) {
    await this.ready;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.DOWNLOAD_HISTORY], 'readwrite');
      const store = transaction.objectStore(this.STORES.DOWNLOAD_HISTORY);
      
      const request = store.put(downloadItem);
      
      request.onsuccess = () => resolve(downloadItem.id);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * 获取下载历史
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>} - 下载历史数组
   */
  async getDownloadHistory(filters = {}) {
    await this.ready;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.DOWNLOAD_HISTORY], 'readonly');
      const store = transaction.objectStore(this.STORES.DOWNLOAD_HISTORY);
      
      let request;
      
      if (filters.status) {
        const index = store.index('status');
        const range = IDBKeyRange.only(filters.status);
        request = index.openCursor(range, 'prev');
      } else if (filters.fileType) {
        const index = store.index('fileType');
        const range = IDBKeyRange.only(filters.fileType);
        request = index.openCursor(range, 'prev');
      } else {
        const index = store.index('timestamp');
        request = index.openCursor(null, 'prev');
      }
      
      const history = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && (!filters.limit || history.length < filters.limit)) {
          history.push(cursor.value);
          cursor.continue();
        } else {
          resolve(history);
        }
      };
      
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  /**
   * 保存日志分析结果
   * @param {string} type - 分析类型
   * @param {Object} data - 分析数据
   * @param {string} severity - 严重程度
   * @returns {Promise<string>} - 保存的分析结果ID
   */
  async saveAnalysisResult(type, data, severity = 'info') {
    await this.ready;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.LOG_ANALYSIS], 'readwrite');
      const store = transaction.objectStore(this.STORES.LOG_ANALYSIS);
      
      const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const analysisData = {
        id: analysisId,
        timestamp: Date.now(),
        type,
        severity,
        data
      };
      
      const request = store.put(analysisData);
      
      request.onsuccess = () => resolve(analysisId);
      request.onerror = (event) => reject(event.target.error);
    });
  }
  
  /**
   * 获取日志分析结果
   * @param {string} type - 分析类型
   * @param {number} limit - 最大条数
   * @returns {Promise<Array>} - 分析结果数组
   */
  async getAnalysisResults(type, limit = 100) {
    await this.ready;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORES.LOG_ANALYSIS], 'readonly');
      const store = transaction.objectStore(this.STORES.LOG_ANALYSIS);
      
      let request;
      
      if (type) {
        const index = store.index('type');
        const range = IDBKeyRange.only(type);
        request = index.openCursor(range, 'prev');
      } else {
        const index = store.index('timestamp');
        request = index.openCursor(null, 'prev');
      }
      
      const results = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * 过滤日志
   * @private
   * @param {Array} logs - 日志数组
   * @param {Object} filters - 过滤条件
   * @returns {Array} - 过滤后的日志数组
   */
  _filterLogs(logs, filters) {
    let filteredLogs = [...logs];
    
    if (filters.level !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.level >= filters.level);
    }
    
    if (filters.category) {
      filteredLogs = filteredLogs.filter(log => log.category === filters.category);
    }
    
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchLower) || 
        (log.data && JSON.stringify(log.data).toLowerCase().includes(searchLower))
      );
    }
    
    return filteredLogs;
  }
}

const indexedDBService = new IndexedDBService();
export default indexedDBService;
