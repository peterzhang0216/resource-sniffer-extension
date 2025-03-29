/**
 * @file resource-service.js
 * @description 资源管理服务，处理资源的收集、过滤和排序
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES, SORT_METHODS } from '../config/constants.js';
import ResourceUtils from '../utils/resource-utils.js';
import URLUtils from '../utils/url-utils.js';

/**
 * 资源管理服务
 * @class ResourceService
 */
class ResourceService {
  /**
   * 创建资源服务实例
   */
  constructor() {
    this.resources = {};
    this.similarityGroups = {};
  }
  
  /**
   * 添加资源到指定标签页
   * @param {string} tabId - 标签页ID
   * @param {Object} resource - 资源对象
   * @returns {boolean} - 是否成功添加
   */
  addResource(tabId, resource) {
    if (!tabId || !resource || !resource.url) return false;
    
    if (!this.resources[tabId]) {
      this.resources[tabId] = [];
    }
    
    const existingIndex = this.resources[tabId].findIndex(r => r.url === resource.url);
    
    if (existingIndex !== -1) {
      this._updateExistingResource(this.resources[tabId][existingIndex], resource);
      return false;
    } else {
      if (!resource.score) {
        const scoreResult = ResourceUtils.calculateResourceScore(resource);
        resource.score = scoreResult.score;
        resource.scoreDetails = scoreResult.details;
      }
      
      if (!resource.quality || resource.quality === 'unknown') {
        resource.quality = ResourceUtils.estimateQualityLevel(resource);
      }
      
      this.resources[tabId].push(resource);
      return true;
    }
  }
  
  /**
   * 批量添加资源
   * @param {string} tabId - 标签页ID
   * @param {Array} resources - 资源数组
   * @returns {number} - 成功添加的资源数量
   */
  addResources(tabId, resources) {
    if (!tabId || !resources || !Array.isArray(resources)) return 0;
    
    let addedCount = 0;
    
    resources.forEach(resource => {
      if (this.addResource(tabId, resource)) {
        addedCount++;
      }
    });
    
    this._updateSimilarityGroups(tabId);
    
    return addedCount;
  }
  
  /**
   * 获取指定标签页的所有资源
   * @param {string} tabId - 标签页ID
   * @returns {Array} - 资源数组
   */
  getResources(tabId) {
    return this.resources[tabId] || [];
  }
  
  /**
   * 清除指定标签页的资源
   * @param {string} tabId - 标签页ID
   */
  clearResources(tabId) {
    if (tabId in this.resources) {
      this.resources[tabId] = [];
    }
  }
  
  /**
   * 过滤资源
   * @param {Array} resources - 要过滤的资源数组
   * @param {Object} filters - 过滤条件
   * @param {boolean} filters.includeImages - 是否包含图片
   * @param {boolean} filters.includeVideos - 是否包含视频
   * @param {string} filters.quality - 按质量过滤
   * @param {string} filters.source - 按来源过滤
   * @returns {Array} - 过滤后的资源
   */
  filterResources(resources, filters) {
    if (!resources || !Array.isArray(resources)) return [];
    
    return resources.filter(resource => {
      if (resource.type === RESOURCE_TYPES.IMAGE && !filters.includeImages) return false;
      if (resource.type === RESOURCE_TYPES.VIDEO && !filters.includeVideos) return false;
      
      if (filters.quality !== 'all' && resource.quality !== filters.quality) return false;
      
      if (filters.source !== 'all') {
        if (filters.source === 'predicted' && resource.isPredicted) return true;
        if (resource.source === filters.source) return true;
        if (resource.sources && resource.sources.includes(filters.source)) return true;
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * 排序资源
   * @param {Array} resources - 要排序的资源数组
   * @param {string} sortMethod - 排序方法
   * @returns {Array} - 排序后的资源
   */
  sortResources(resources, sortMethod) {
    if (!resources || !Array.isArray(resources)) return [];
    
    return [...resources].sort((a, b) => {
      switch (sortMethod) {
        case 'size-desc':
          return b.size - a.size;
        case 'size-asc':
          return a.size - b.size;
        case 'time-desc':
          return b.timestamp - a.timestamp;
        case 'time-asc':
          return a.timestamp - b.timestamp;
        case 'quality-desc':
          return (b.score || 0) - (a.score || 0);
        case 'quality-asc':
          return (a.score || 0) - (b.score || 0);
        default:
          return 0;
      }
    });
  }
  
  /**
   * 更新现有资源信息
   * @param {Object} existingResource - 现有资源对象
   * @param {Object} newResource - 新资源对象
   * @private
   */
  _updateExistingResource(existingResource, newResource) {
    if (newResource.width && newResource.height) {
      if (!existingResource.width || !existingResource.height || 
          (newResource.width * newResource.height > existingResource.width * existingResource.height)) {
        existingResource.width = newResource.width;
        existingResource.height = newResource.height;
      }
    }
    
    if (newResource.quality && newResource.quality !== 'unknown') {
      existingResource.quality = newResource.quality;
    }
    
    if (newResource.contentType && (!existingResource.contentType || existingResource.contentType === 'unknown')) {
      existingResource.contentType = newResource.contentType;
    }
    
    if (newResource.size && (!existingResource.size || existingResource.size === 0)) {
      existingResource.size = newResource.size;
      existingResource.sizeFormatted = newResource.sizeFormatted;
    }
    
    if (newResource.source) {
      if (!existingResource.sources) {
        existingResource.sources = [existingResource.source || 'unknown'];
      }
      
      if (!existingResource.sources.includes(newResource.source)) {
        existingResource.sources.push(newResource.source);
      }
    }
    
    if (newResource.thumbnailUrl && !existingResource.thumbnailUrl) {
      existingResource.thumbnailUrl = newResource.thumbnailUrl;
    }
  }
  
  /**
   * 更新资源相似性分组
   * @param {string} tabId - 标签页ID
   * @private
   */
  _updateSimilarityGroups(tabId) {
    if (!this.resources[tabId]) return;
    
    const groups = ResourceUtils.groupSimilarResources(this.resources[tabId]);
    this.similarityGroups = groups;
  }
  
  /**
   * 获取相似资源组
   * @param {string} tabId - 标签页ID
   * @param {string} resourceUrl - 资源URL
   * @returns {Array} - 相似资源数组
   */
  getSimilarResources(tabId, resourceUrl) {
    if (!tabId || !resourceUrl || !this.resources[tabId]) return [];
    
    if (!this.similarityGroups) {
      this._updateSimilarityGroups(tabId);
    }
    
    const targetResource = this.resources[tabId].find(r => r.url === resourceUrl);
    if (!targetResource) return [];
    
    const fingerprint = URLUtils.computeUrlFingerprint(resourceUrl);
    return (this.similarityGroups[fingerprint] || []).filter(r => r.url !== resourceUrl);
  }
  
  /**
   * 查找重复资源
   * @param {string} tabId - 标签页ID
   * @param {Object} resource - 要检查的资源
   * @param {number} similarityThreshold - 相似度阈值（0-1之间）
   * @returns {Object|null} - 找到的重复资源，如果没有则返回null
   */
  findDuplicateResource(tabId, resource, similarityThreshold = 0.8) {
    if (!tabId || !resource || !resource.url || !this.resources[tabId]) return null;
    
    const exactMatch = this.resources[tabId].find(r => r.url === resource.url);
    if (exactMatch) return exactMatch;
    
    for (const existingResource of this.resources[tabId]) {
      const similarity = URLUtils.computeUrlSimilarity(existingResource.url, resource.url);
      if (similarity >= similarityThreshold) {
        return existingResource;
      }
    }
    
    return null;
  }
  
  /**
   * 获取资源统计信息
   * @param {string} tabId - 标签页ID
   * @returns {Object} - 统计信息
   */
  getResourceStats(tabId) {
    if (!tabId || !this.resources[tabId]) {
      return {
        total: 0,
        images: 0,
        videos: 0,
        hdQuality: 0,
        sdQuality: 0,
        ldQuality: 0,
        totalSize: 0
      };
    }
    
    const resources = this.resources[tabId];
    let totalSize = 0;
    let images = 0;
    let videos = 0;
    let hdQuality = 0;
    let sdQuality = 0;
    let ldQuality = 0;
    
    resources.forEach(resource => {
      if (resource.size) {
        totalSize += resource.size;
      }
      
      if (resource.type === RESOURCE_TYPES.IMAGE) {
        images++;
      } else if (resource.type === RESOURCE_TYPES.VIDEO) {
        videos++;
      }
      
      if (resource.quality === 'HD') {
        hdQuality++;
      } else if (resource.quality === 'SD') {
        sdQuality++;
      } else if (resource.quality === 'LD') {
        ldQuality++;
      }
    });
    
    return {
      total: resources.length,
      images,
      videos,
      hdQuality,
      sdQuality,
      ldQuality,
      totalSize
    };
  }
}

export default ResourceService;
