/**
 * @file cache-service.js
 * @description 缓存服务，提供LRU缓存功能
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

/**
 * LRU缓存节点
 * @class LRUNode
 * @private
 */
class LRUNode {
  /**
   * 创建LRU缓存节点
   * @param {string} key - 键
   * @param {*} value - 值
   */
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
    this.timestamp = Date.now();
  }
}

/**
 * LRU缓存
 * @class LRUCache
 */
class LRUCache {
  /**
   * 创建LRU缓存
   * @param {number} capacity - 容量
   */
  constructor(capacity) {
    this.capacity = capacity;
    this.size = 0;
    this.cache = new Map();
    this.head = new LRUNode('head', null); // 哨兵头节点
    this.tail = new LRUNode('tail', null); // 哨兵尾节点
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.hits = 0;
    this.misses = 0;
    this.totalAccess = 0;
  }
  
  /**
   * 将节点移动到链表头部（最近使用）
   * @private
   * @param {LRUNode} node - 缓存节点
   */
  moveToHead(node) {
    this.removeFromList(node);
    this.addToHead(node);
  }
  
  /**
   * 从链表中移除节点
   * @private
   * @param {LRUNode} node - 缓存节点
   */
  removeFromList(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }
  
  /**
   * 添加节点到链表头部
   * @private
   * @param {LRUNode} node - 缓存节点
   */
  addToHead(node) {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next.prev = node;
    this.head.next = node;
  }
  
  /**
   * 移除链表尾部节点（最久未使用）
   * @private
   * @returns {LRUNode} 移除的节点
   */
  removeTail() {
    const node = this.tail.prev;
    this.removeFromList(node);
    return node;
  }
  
  /**
   * 获取缓存值
   * @param {string} key - 键
   * @returns {*} 值或undefined
   */
  get(key) {
    this.totalAccess++;
    
    if (this.cache.has(key)) {
      const node = this.cache.get(key);
      this.moveToHead(node);
      node.timestamp = Date.now(); // 更新访问时间
      this.hits++;
      return node.value;
    }
    
    this.misses++;
    return undefined;
  }
  
  /**
   * 设置缓存值
   * @param {string} key - 键
   * @param {*} value - 值
   */
  put(key, value) {
    if (this.cache.has(key)) {
      const node = this.cache.get(key);
      node.value = value;
      node.timestamp = Date.now();
      this.moveToHead(node);
      return;
    }
    
    const newNode = new LRUNode(key, value);
    this.cache.set(key, newNode);
    this.addToHead(newNode);
    this.size++;
    
    if (this.size > this.capacity) {
      const tailNode = this.removeTail();
      this.cache.delete(tailNode.key);
      this.size--;
    }
  }
  
  /**
   * 检查键是否存在
   * @param {string} key - 键
   * @returns {boolean} 是否存在
   */
  has(key) {
    return this.cache.has(key);
  }
  
  /**
   * 删除缓存项
   * @param {string} key - 键
   * @returns {boolean} 是否成功删除
   */
  delete(key) {
    if (this.cache.has(key)) {
      const node = this.cache.get(key);
      this.removeFromList(node);
      this.cache.delete(key);
      this.size--;
      return true;
    }
    return false;
  }
  
  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.size = 0;
  }
  
  /**
   * 获取所有键
   * @returns {Array} 键数组
   */
  keys() {
    return Array.from(this.cache.keys());
  }
  
  /**
   * 获取所有值
   * @returns {Array} 值数组
   */
  values() {
    const values = [];
    let current = this.head.next;
    
    while (current !== this.tail) {
      values.push(current.value);
      current = current.next;
    }
    
    return values;
  }
  
  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const hitRate = this.totalAccess > 0 ? this.hits / this.totalAccess : 0;
    
    return {
      size: this.size,
      capacity: this.capacity,
      hits: this.hits,
      misses: this.misses,
      totalAccess: this.totalAccess,
      hitRate: hitRate,
      usageRate: this.size / this.capacity
    };
  }
  
  /**
   * 清除过期项
   * @param {number} maxAge - 最大年龄(毫秒)
   * @returns {number} 清除的项数
   */
  clearExpired(maxAge) {
    const now = Date.now();
    let count = 0;
    
    const expiredKeys = [];
    this.cache.forEach((node, key) => {
      if (now - node.timestamp > maxAge) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => {
      this.delete(key);
      count++;
    });
    
    return count;
  }
}

/**
 * 缓存服务
 * @class CacheService
 */
class CacheService {
  /**
   * 创建缓存服务实例
   */
  constructor() {
    this.caches = new Map();
    this.defaultCapacity = 1000;
  }
  
  /**
   * 获取或创建缓存
   * @param {string} name - 缓存名称
   * @param {number} capacity - 缓存容量
   * @returns {LRUCache} 缓存实例
   */
  getCache(name, capacity = this.defaultCapacity) {
    if (!this.caches.has(name)) {
      this.caches.set(name, new LRUCache(capacity));
    }
    return this.caches.get(name);
  }
  
  /**
   * 删除缓存
   * @param {string} name - 缓存名称
   * @returns {boolean} 是否成功删除
   */
  deleteCache(name) {
    return this.caches.delete(name);
  }
  
  /**
   * 清空所有缓存
   */
  clearAll() {
    this.caches.forEach(cache => cache.clear());
  }
  
  /**
   * 获取所有缓存名称
   * @returns {Array} 缓存名称数组
   */
  getCacheNames() {
    return Array.from(this.caches.keys());
  }
  
  /**
   * 获取所有缓存统计信息
   * @returns {Object} 统计信息
   */
  getAllStats() {
    const stats = {};
    
    this.caches.forEach((cache, name) => {
      stats[name] = cache.getStats();
    });
    
    return stats;
  }
  
  /**
   * 清除所有过期缓存项
   * @param {number} maxAge - 最大年龄(毫秒)
   * @returns {Object} 清除统计信息
   */
  clearAllExpired(maxAge = 3600000) { // 默认1小时
    const stats = {};
    
    this.caches.forEach((cache, name) => {
      stats[name] = cache.clearExpired(maxAge);
    });
    
    return stats;
  }
}

const cacheService = new CacheService();

export default cacheService;
