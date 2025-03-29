
class ResourceCache {
  constructor() {
    this.cache = new Map();
    this.urlIndex = new Set();
    this.stats = {
      totalDetected: 0,
      duplicatesSkipped: 0,
      byType: {}
    };
  }
  
  /**
   * 添加资源到缓存
   * @param {Object} resource - 资源对象
   * @returns {boolean} - 是否为新资源
   */
  addResource(resource) {
    if (!resource || !resource.url) return false;
    
    if (this.urlIndex.has(resource.url)) {
      this.stats.duplicatesSkipped++;
      return false;
    }
    
    const tabId = resource.tabId || 'default';
    if (!this.cache.has(tabId)) {
      this.cache.set(tabId, []);
    }
    
    this.cache.get(tabId).push(resource);
    this.urlIndex.add(resource.url);
    
    this.stats.totalDetected++;
    const type = resource.type || 'unknown';
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
    
    return true;
  }
  
  /**
   * 获取指定标签页的所有资源
   * @param {string} tabId - 标签页ID
   * @returns {Array} - 资源列表
   */
  getResourcesByTab(tabId) {
    return this.cache.get(tabId) || [];
  }
  
  /**
   * 清除指定标签页的资源
   * @param {string} tabId - 标签页ID
   */
  clearTab(tabId) {
    if (!this.cache.has(tabId)) return;
    
    const resources = this.cache.get(tabId);
    resources.forEach(resource => {
      this.urlIndex.delete(resource.url);
    });
    
    this.cache.delete(tabId);
  }
  
  /**
   * 获取缓存统计信息
   * @returns {Object} - 统计信息
   */
  getStats() {
    return { ...this.stats };
  }
}

window.ResourceCache = new ResourceCache();
