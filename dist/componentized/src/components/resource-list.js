/**
 * @file resource-list.js
 * @description 资源列表组件，负责显示和管理检测到的资源
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES, QUALITY_LEVELS } from '../config/constants.js';
import URLUtils from '../utils/url-utils.js';
import FileUtils from '../utils/file-utils.js';
import ResourceUtils from '../utils/resource-utils.js';

/**
 * 资源列表组件类
 * @class ResourceList
 */
class ResourceList {
  /**
   * 创建资源列表组件
   * @param {string} containerId - 容器元素ID
   * @param {Object} resourceService - 资源服务实例
   * @param {Object} downloadService - 下载服务实例
   */
  constructor(containerId, resourceService, downloadService) {
    this.container = document.getElementById(containerId);
    this.resourceService = resourceService;
    this.downloadService = downloadService;
    this.selectedResources = new Set();
    this.allResources = [];
    this.filteredResources = [];
    this.resourceGroups = {};
    this.currentFilters = {};
    this.currentSortBy = 'time-desc';
    this.previewCallback = null;
    this.showSimilarCallback = null;
  }
  
  /**
   * 初始化组件
   */
  initialize() {
    if (!this.container) {
      console.error('资源列表容器未找到');
      return;
    }
    
    this._setupEventListeners();
    console.log('资源列表组件已初始化');
  }
  
  /**
   * 设置事件监听器
   * @private
   */
  _setupEventListeners() {
    const selectAllCheckbox = document.getElementById('select-all-resources');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        this._handleSelectAllChange(e.target.checked);
      });
    }
    
    const batchDownloadBtn = document.getElementById('batch-download-btn');
    if (batchDownloadBtn) {
      batchDownloadBtn.addEventListener('click', () => {
        this._handleBatchDownload();
      });
    }
    
    const clearSelectionBtn = document.getElementById('clear-selection-btn');
    if (clearSelectionBtn) {
      clearSelectionBtn.addEventListener('click', () => {
        this._handleClearSelection();
      });
    }
  }
  
  /**
   * 设置预览回调函数
   * @param {Function} callback - 预览回调函数
   */
  setPreviewCallback(callback) {
    this.previewCallback = callback;
  }
  
  /**
   * 设置显示相似资源回调函数
   * @param {Function} callback - 显示相似资源回调函数
   */
  setShowSimilarCallback(callback) {
    this.showSimilarCallback = callback;
  }
  
  /**
   * 加载资源
   * @param {Array} resources - 资源数组
   */
  loadResources(resources) {
    this.allResources = resources || [];
    this._groupSimilarResources();
    this._calculateResourceScores();
    this.updateResourcesList(this.currentFilters, this.currentSortBy);
  }
  
  /**
   * 更新资源列表显示
   * @param {Object} filters - 过滤条件
   * @param {string} sortBy - 排序方式
   */
  updateResourcesList(filters = {}, sortBy = 'time-desc') {
    this.currentFilters = filters;
    this.currentSortBy = sortBy;
    
    this.filteredResources = this._filterResources(this.allResources, filters);
    
    this.filteredResources = this._sortResources(this.filteredResources, sortBy);
    
    this._renderResourcesList();
    
    this._updateStats();
  }
  
  /**
   * 过滤资源
   * @param {Array} resources - 资源数组
   * @param {Object} filters - 过滤条件
   * @returns {Array} - 过滤后的资源数组
   * @private
   */
  _filterResources(resources, filters) {
    if (!resources || !Array.isArray(resources)) return [];
    if (!filters || Object.keys(filters).length === 0) return [...resources];
    
    return resources.filter(resource => {
      if (filters.types && filters.types.length > 0) {
        if (!resource.type || !filters.types.includes(resource.type)) {
          return false;
        }
      }
      
      if (filters.sources && filters.sources.length > 0) {
        if (!resource.source || !filters.sources.includes(resource.source)) {
          return false;
        }
      }
      
      if (filters.quality && filters.quality !== 'all') {
        if (!resource.quality || resource.quality !== filters.quality) {
          return false;
        }
      }
      
      if (filters.minSize !== undefined && filters.minSize > 0) {
        if (!resource.size || resource.size < filters.minSize) {
          return false;
        }
      }
      
      if (filters.maxSize !== undefined && filters.maxSize > 0) {
        if (!resource.size || resource.size > filters.maxSize) {
          return false;
        }
      }
      
      if (filters.search && filters.search.trim() !== '') {
        const searchTerm = filters.search.trim().toLowerCase();
        const filename = (resource.filename || '').toLowerCase();
        const url = (resource.url || '').toLowerCase();
        const type = (resource.type || '').toLowerCase();
        
        if (!filename.includes(searchTerm) && 
            !url.includes(searchTerm) && 
            !type.includes(searchTerm)) {
          return false;
        }
      }
      
      if (filters.minScore !== undefined && filters.minScore > 0) {
        if (!resource.score || resource.score < filters.minScore) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * 排序资源
   * @param {Array} resources - 资源数组
   * @param {string} sortBy - 排序方式
   * @returns {Array} - 排序后的资源数组
   * @private
   */
  _sortResources(resources, sortBy) {
    if (!resources || !Array.isArray(resources)) return [];
    if (!sortBy) return [...resources];
    
    const sortedResources = [...resources];
    
    switch (sortBy) {
      case 'time-desc':
        sortedResources.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        break;
      case 'time-asc':
        sortedResources.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        break;
      case 'size-desc':
        sortedResources.sort((a, b) => (b.size || 0) - (a.size || 0));
        break;
      case 'size-asc':
        sortedResources.sort((a, b) => (a.size || 0) - (b.size || 0));
        break;
      case 'name-asc':
        sortedResources.sort((a, b) => {
          const nameA = (a.filename || '').toLowerCase();
          const nameB = (b.filename || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        break;
      case 'name-desc':
        sortedResources.sort((a, b) => {
          const nameA = (a.filename || '').toLowerCase();
          const nameB = (b.filename || '').toLowerCase();
          return nameB.localeCompare(nameA);
        });
        break;
      case 'quality-desc':
        sortedResources.sort((a, b) => {
          const qualityMap = {
            'high': 3,
            'medium': 2,
            'low': 1,
            'unknown': 0
          };
          const qualityA = qualityMap[a.quality] || 0;
          const qualityB = qualityMap[b.quality] || 0;
          return qualityB - qualityA;
        });
        break;
      case 'score-desc':
        sortedResources.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      default:
        break;
    }
    
    return sortedResources;
  }
  
  /**
   * 获取来源标签
   * @param {string} source - 来源类型
   * @returns {string} - 来源标签
   * @private
   */
  _getSourceLabel(source) {
    const sourceLabels = {
      'dom': 'DOM',
      'css': 'CSS',
      'shadow-dom': 'Shadow DOM',
      'attribute': '属性',
      'nested': '嵌套',
      'streaming': '流媒体',
      'predicted': '预测',
      'network': '网络'
    };
    
    return sourceLabels[source] || source;
  }
  
  /**
   * 获取质量标签
   * @param {string} quality - 质量级别
   * @returns {string} - 质量标签
   * @private
   */
  _getQualityLabel(quality) {
    const qualityLabels = {
      'high': '高质量',
      'medium': '中等',
      'low': '低质量',
      'unknown': '未知'
    };
    
    return qualityLabels[quality] || quality;
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
   * 显示提示消息
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型
   * @private
   */
  _showToast(message, type = 'success') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toastContainer.removeChild(toast);
      }, 300);
    }, 3000);
  }
  
  /**
   * 分组相似资源
   * @private
   */
  _groupSimilarResources() {
    if (!this.allResources || this.allResources.length === 0) return;
    
    this.resourceGroups = {};
    
    const imageResources = this.allResources.filter(r => r.type === RESOURCE_TYPES.IMAGE);
    const videoResources = this.allResources.filter(r => r.type === RESOURCE_TYPES.VIDEO);
    const audioResources = this.allResources.filter(r => r.type === RESOURCE_TYPES.AUDIO);
    
    this._groupSimilarImageResources(imageResources);
    
    this._groupSimilarVideoResources(videoResources);
    
    this._groupSimilarAudioResources(audioResources);
    
    this._updateSimilarCounts();
  }
  
  /**
   * 分组相似图片资源
   * @param {Array} resources - 图片资源数组
   * @private
   */
  _groupSimilarImageResources(resources) {
    if (!resources || resources.length === 0) return;
    
    resources.forEach(resource => {
      const filename = resource.filename || '';
      const url = resource.url || '';
      
      const similarResources = resources.filter(r => {
        if (r.url === url) return false;
        
        const urlSimilarity = URLUtils.calculateURLSimilarity(url, r.url);
        if (urlSimilarity > 0.7) return true;
        
        const filenameSimilarity = FileUtils.calculateFilenameSimilarity(filename, r.filename || '');
        if (filenameSimilarity > 0.7) return true;
        
        return false;
      });
      
      if (similarResources.length > 0) {
        this.resourceGroups[url] = similarResources.map(r => r.url);
      }
    });
  }
  
  /**
   * 分组相似视频资源
   * @param {Array} resources - 视频资源数组
   * @private
   */
  _groupSimilarVideoResources(resources) {
    if (!resources || resources.length === 0) return;
    
    resources.forEach(resource => {
      const filename = resource.filename || '';
      const url = resource.url || '';
      
      const similarResources = resources.filter(r => {
        if (r.url === url) return false;
        
        const urlSimilarity = URLUtils.calculateURLSimilarity(url, r.url);
        if (urlSimilarity > 0.7) return true;
        
        const filenameSimilarity = FileUtils.calculateFilenameSimilarity(filename, r.filename || '');
        if (filenameSimilarity > 0.7) return true;
        
        return false;
      });
      
      if (similarResources.length > 0) {
        this.resourceGroups[url] = similarResources.map(r => r.url);
      }
    });
  }
  
  /**
   * 分组相似音频资源
   * @param {Array} resources - 音频资源数组
   * @private
   */
  _groupSimilarAudioResources(resources) {
    if (!resources || resources.length === 0) return;
    
    resources.forEach(resource => {
      const filename = resource.filename || '';
      const url = resource.url || '';
      
      const similarResources = resources.filter(r => {
        if (r.url === url) return false;
        
        const urlSimilarity = URLUtils.calculateURLSimilarity(url, r.url);
        if (urlSimilarity > 0.7) return true;
        
        const filenameSimilarity = FileUtils.calculateFilenameSimilarity(filename, r.filename || '');
        if (filenameSimilarity > 0.7) return true;
        
        return false;
      });
      
      if (similarResources.length > 0) {
        this.resourceGroups[url] = similarResources.map(r => r.url);
      }
    });
  }
  
  /**
   * 更新相似计数
   * @private
   */
  _updateSimilarCounts() {
    this.allResources.forEach(resource => {
      const url = resource.url;
      if (this.resourceGroups[url]) {
        resource.similarCount = this.resourceGroups[url].length;
      } else {
        resource.similarCount = 0;
      }
    });
  }
  
  /**
   * 计算资源评分
   * @private
   */
  _calculateResourceScores() {
    this.allResources.forEach(resource => {
      if (!resource.score) {
        resource.score = ResourceUtils.calculateResourceScore(resource);
      }
    });
  }
}

export default ResourceList;
