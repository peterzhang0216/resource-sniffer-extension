/**
 * @file filter-bar.js
 * @description 过滤栏组件，负责提供资源过滤和排序功能
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES, SOURCE_TYPES, QUALITY_LEVELS } from '../config/constants.js';

/**
 * 过滤栏组件类
 * @class FilterBar
 */
class FilterBar {
  /**
   * 创建过滤栏组件
   * @param {string} containerId - 容器元素ID
   * @param {Function} filterCallback - 过滤回调函数
   */
  constructor(containerId, filterCallback) {
    this.container = document.getElementById(containerId);
    this.filterCallback = filterCallback;
    this.currentFilters = {
      types: [],
      sources: [],
      quality: 'all',
      minSize: 0,
      maxSize: 0,
      search: '',
      minScore: 0
    };
    this.currentSortBy = 'time-desc';
  }
  
  /**
   * 初始化组件
   */
  initialize() {
    if (!this.container) {
      console.error('过滤栏容器未找到');
      return;
    }
    
    this._renderFilterBar();
    this._setupEventListeners();
    console.log('过滤栏组件已初始化');
  }
  
  /**
   * 渲染过滤栏
   * @private
   */
  _renderFilterBar() {
    this.container.innerHTML = `
      <div class="filter-section">
        <div class="filter-header">
          <h3>资源类型</h3>
          <button class="toggle-filter" data-section="type">▼</button>
        </div>
        <div class="filter-content" id="type-filters">
          <label>
            <input type="checkbox" class="type-filter" value="image" checked> 图片
          </label>
          <label>
            <input type="checkbox" class="type-filter" value="video" checked> 视频
          </label>
          <label>
            <input type="checkbox" class="type-filter" value="audio" checked> 音频
          </label>
          <label>
            <input type="checkbox" class="type-filter" value="other"> 其他
          </label>
        </div>
      </div>
      
      <div class="filter-section">
        <div class="filter-header">
          <h3>资源来源</h3>
          <button class="toggle-filter" data-section="source">▼</button>
        </div>
        <div class="filter-content" id="source-filters">
          <label>
            <input type="checkbox" class="source-filter" value="dom" checked> DOM
          </label>
          <label>
            <input type="checkbox" class="source-filter" value="css" checked> CSS
          </label>
          <label>
            <input type="checkbox" class="source-filter" value="shadow-dom" checked> Shadow DOM
          </label>
          <label>
            <input type="checkbox" class="source-filter" value="attribute" checked> 属性
          </label>
          <label>
            <input type="checkbox" class="source-filter" value="nested" checked> 嵌套
          </label>
          <label>
            <input type="checkbox" class="source-filter" value="streaming" checked> 流媒体
          </label>
          <label>
            <input type="checkbox" class="source-filter" value="network" checked> 网络
          </label>
          <label>
            <input type="checkbox" class="source-filter" value="predicted" checked> 预测
          </label>
        </div>
      </div>
      
      <div class="filter-section">
        <div class="filter-header">
          <h3>资源质量</h3>
          <button class="toggle-filter" data-section="quality">▼</button>
        </div>
        <div class="filter-content" id="quality-filters">
          <label>
            <input type="radio" name="quality-filter" class="quality-filter" value="all" checked> 全部
          </label>
          <label>
            <input type="radio" name="quality-filter" class="quality-filter" value="high"> 高质量
          </label>
          <label>
            <input type="radio" name="quality-filter" class="quality-filter" value="medium"> 中等
          </label>
          <label>
            <input type="radio" name="quality-filter" class="quality-filter" value="low"> 低质量
          </label>
        </div>
      </div>
      
      <div class="filter-section">
        <div class="filter-header">
          <h3>资源大小</h3>
          <button class="toggle-filter" data-section="size">▼</button>
        </div>
        <div class="filter-content" id="size-filters">
          <div class="size-range">
            <label>最小: <span id="min-size-value">0 KB</span></label>
            <input type="range" id="min-size" min="0" max="10240" step="10" value="0">
          </div>
          <div class="size-range">
            <label>最大: <span id="max-size-value">不限</span></label>
            <input type="range" id="max-size" min="0" max="102400" step="100" value="0">
          </div>
        </div>
      </div>
      
      <div class="filter-section">
        <div class="filter-header">
          <h3>资源评分</h3>
          <button class="toggle-filter" data-section="score">▼</button>
        </div>
        <div class="filter-content" id="score-filters">
          <div class="score-range">
            <label>最低评分: <span id="min-score-value">0</span></label>
            <input type="range" id="min-score" min="0" max="100" step="5" value="0">
          </div>
        </div>
      </div>
      
      <div class="filter-section">
        <div class="filter-header">
          <h3>排序方式</h3>
          <button class="toggle-filter" data-section="sort">▼</button>
        </div>
        <div class="filter-content" id="sort-options">
          <label>
            <input type="radio" name="sort-by" class="sort-option" value="time-desc" checked> 时间 (新→旧)
          </label>
          <label>
            <input type="radio" name="sort-by" class="sort-option" value="time-asc"> 时间 (旧→新)
          </label>
          <label>
            <input type="radio" name="sort-by" class="sort-option" value="size-desc"> 大小 (大→小)
          </label>
          <label>
            <input type="radio" name="sort-by" class="sort-option" value="size-asc"> 大小 (小→大)
          </label>
          <label>
            <input type="radio" name="sort-by" class="sort-option" value="name-asc"> 名称 (A→Z)
          </label>
          <label>
            <input type="radio" name="sort-by" class="sort-option" value="name-desc"> 名称 (Z→A)
          </label>
          <label>
            <input type="radio" name="sort-by" class="sort-option" value="type-asc"> 类型
          </label>
          <label>
            <input type="radio" name="sort-by" class="sort-option" value="quality-desc"> 质量 (高→低)
          </label>
          <label>
            <input type="radio" name="sort-by" class="sort-option" value="score-desc"> 评分 (高→低)
          </label>
        </div>
      </div>
      
      <div class="filter-section">
        <div class="search-container">
          <input type="text" id="resource-search" placeholder="搜索资源...">
          <button id="search-button">搜索</button>
        </div>
      </div>
      
      <div class="filter-actions">
        <button id="reset-filters">重置过滤器</button>
        <button id="apply-filters">应用过滤器</button>
      </div>
    `;
  }
  
  /**
   * 设置事件监听器
   * @private
   */
  _setupEventListeners() {
    const toggleButtons = this.container.querySelectorAll('.toggle-filter');
    toggleButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const section = e.target.dataset.section;
        const content = document.getElementById(`${section}-filters`) || 
                        document.getElementById(`${section}-options`);
        
        if (content) {
          content.classList.toggle('collapsed');
          e.target.textContent = content.classList.contains('collapsed') ? '▶' : '▼';
        }
      });
    });
    
    const typeFilters = this.container.querySelectorAll('.type-filter');
    typeFilters.forEach(filter => {
      filter.addEventListener('change', () => {
        this._updateTypeFilters();
      });
    });
    
    const sourceFilters = this.container.querySelectorAll('.source-filter');
    sourceFilters.forEach(filter => {
      filter.addEventListener('change', () => {
        this._updateSourceFilters();
      });
    });
    
    const qualityFilters = this.container.querySelectorAll('.quality-filter');
    qualityFilters.forEach(filter => {
      filter.addEventListener('change', (e) => {
        this._updateQualityFilter(e.target.value);
      });
    });
    
    const minSizeSlider = document.getElementById('min-size');
    const maxSizeSlider = document.getElementById('max-size');
    const minSizeValue = document.getElementById('min-size-value');
    const maxSizeValue = document.getElementById('max-size-value');
    
    if (minSizeSlider && minSizeValue) {
      minSizeSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        minSizeValue.textContent = this._formatSize(value * 1024);
        this._updateSizeFilters(value * 1024, this.currentFilters.maxSize);
      });
    }
    
    if (maxSizeSlider && maxSizeValue) {
      maxSizeSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        maxSizeValue.textContent = value === 0 ? '不限' : this._formatSize(value * 1024);
        this._updateSizeFilters(this.currentFilters.minSize, value === 0 ? 0 : value * 1024);
      });
    }
    
    const minScoreSlider = document.getElementById('min-score');
    const minScoreValue = document.getElementById('min-score-value');
    
    if (minScoreSlider && minScoreValue) {
      minScoreSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        minScoreValue.textContent = value;
        this._updateScoreFilter(value);
      });
    }
    
    const sortOptions = this.container.querySelectorAll('.sort-option');
    sortOptions.forEach(option => {
      option.addEventListener('change', (e) => {
        if (e.target.checked) {
          this._updateSortBy(e.target.value);
        }
      });
    });
    
    const searchInput = document.getElementById('resource-search');
    const searchButton = document.getElementById('search-button');
    
    if (searchInput && searchButton) {
      searchButton.addEventListener('click', () => {
        this._updateSearchFilter(searchInput.value);
      });
      
      searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          this._updateSearchFilter(searchInput.value);
        }
      });
    }
    
    const resetButton = document.getElementById('reset-filters');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        this._resetFilters();
      });
    }
    
    const applyButton = document.getElementById('apply-filters');
    if (applyButton) {
      applyButton.addEventListener('click', () => {
        this._applyFilters();
      });
    }
  }
  
  /**
   * 更新类型过滤器
   * @private
   */
  _updateTypeFilters() {
    const typeFilters = this.container.querySelectorAll('.type-filter:checked');
    const types = Array.from(typeFilters).map(filter => filter.value);
    
    this.currentFilters.types = types;
  }
  
  /**
   * 更新来源过滤器
   * @private
   */
  _updateSourceFilters() {
    const sourceFilters = this.container.querySelectorAll('.source-filter:checked');
    const sources = Array.from(sourceFilters).map(filter => filter.value);
    
    this.currentFilters.sources = sources;
  }
  
  /**
   * 更新质量过滤器
   * @param {string} quality - 质量级别
   * @private
   */
  _updateQualityFilter(quality) {
    this.currentFilters.quality = quality;
  }
  
  /**
   * 更新大小过滤器
   * @param {number} minSize - 最小大小(字节)
   * @param {number} maxSize - 最大大小(字节)
   * @private
   */
  _updateSizeFilters(minSize, maxSize) {
    this.currentFilters.minSize = minSize;
    this.currentFilters.maxSize = maxSize;
  }
  
  /**
   * 更新评分过滤器
   * @param {number} minScore - 最低评分
   * @private
   */
  _updateScoreFilter(minScore) {
    this.currentFilters.minScore = minScore;
  }
  
  /**
   * 更新搜索过滤器
   * @param {string} search - 搜索关键词
   * @private
   */
  _updateSearchFilter(search) {
    this.currentFilters.search = search;
  }
  
  /**
   * 更新排序方式
   * @param {string} sortBy - 排序方式
   * @private
   */
  _updateSortBy(sortBy) {
    this.currentSortBy = sortBy;
  }
  
  /**
   * 重置过滤器
   * @private
   */
  _resetFilters() {
    const typeFilters = this.container.querySelectorAll('.type-filter');
    typeFilters.forEach(filter => {
      filter.checked = filter.value !== 'other';
    });
    
    const sourceFilters = this.container.querySelectorAll('.source-filter');
    sourceFilters.forEach(filter => {
      filter.checked = true;
    });
    
    const allQualityFilter = this.container.querySelector('.quality-filter[value="all"]');
    if (allQualityFilter) {
      allQualityFilter.checked = true;
    }
    
    const minSizeSlider = document.getElementById('min-size');
    const maxSizeSlider = document.getElementById('max-size');
    const minSizeValue = document.getElementById('min-size-value');
    const maxSizeValue = document.getElementById('max-size-value');
    
    if (minSizeSlider && minSizeValue) {
      minSizeSlider.value = 0;
      minSizeValue.textContent = '0 KB';
    }
    
    if (maxSizeSlider && maxSizeValue) {
      maxSizeSlider.value = 0;
      maxSizeValue.textContent = '不限';
    }
    
    const minScoreSlider = document.getElementById('min-score');
    const minScoreValue = document.getElementById('min-score-value');
    
    if (minScoreSlider && minScoreValue) {
      minScoreSlider.value = 0;
      minScoreValue.textContent = '0';
    }
    
    const timeDescSort = this.container.querySelector('.sort-option[value="time-desc"]');
    if (timeDescSort) {
      timeDescSort.checked = true;
    }
    
    const searchInput = document.getElementById('resource-search');
    if (searchInput) {
      searchInput.value = '';
    }
    
    this.currentFilters = {
      types: ['image', 'video', 'audio'],
      sources: ['dom', 'css', 'shadow-dom', 'attribute', 'nested', 'streaming', 'network', 'predicted'],
      quality: 'all',
      minSize: 0,
      maxSize: 0,
      search: '',
      minScore: 0
    };
    
    this.currentSortBy = 'time-desc';
    
    this._applyFilters();
  }
  
  /**
   * 应用过滤器
   * @private
   */
  _applyFilters() {
    if (this.filterCallback && typeof this.filterCallback === 'function') {
      this.filterCallback(this.currentFilters, this.currentSortBy);
    }
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
   * 获取当前过滤器
   * @returns {Object} - 当前过滤器对象
   */
  getCurrentFilters() {
    return {
      filters: { ...this.currentFilters },
      sortBy: this.currentSortBy
    };
  }
  
  /**
   * 设置过滤器
   * @param {Object} filters - 过滤器对象
   * @param {string} sortBy - 排序方式
   */
  setFilters(filters, sortBy) {
    if (filters) {
      this.currentFilters = { ...filters };
      
      this._updateFilterUI();
    }
    
    if (sortBy) {
      this.currentSortBy = sortBy;
      
      this._updateSortUI();
    }
  }
  
  /**
   * 更新过滤器UI
   * @private
   */
  _updateFilterUI() {
    const typeFilters = this.container.querySelectorAll('.type-filter');
    typeFilters.forEach(filter => {
      filter.checked = this.currentFilters.types.includes(filter.value);
    });
    
    const sourceFilters = this.container.querySelectorAll('.source-filter');
    sourceFilters.forEach(filter => {
      filter.checked = this.currentFilters.sources.includes(filter.value);
    });
    
    const qualityFilter = this.container.querySelector(`.quality-filter[value="${this.currentFilters.quality}"]`);
    if (qualityFilter) {
      qualityFilter.checked = true;
    }
    
    const minSizeSlider = document.getElementById('min-size');
    const maxSizeSlider = document.getElementById('max-size');
    const minSizeValue = document.getElementById('min-size-value');
    const maxSizeValue = document.getElementById('max-size-value');
    
    if (minSizeSlider && minSizeValue) {
      const minSizeKB = Math.floor(this.currentFilters.minSize / 1024);
      minSizeSlider.value = minSizeKB;
      minSizeValue.textContent = this._formatSize(this.currentFilters.minSize);
    }
    
    if (maxSizeSlider && maxSizeValue) {
      const maxSizeKB = this.currentFilters.maxSize === 0 ? 0 : Math.floor(this.currentFilters.maxSize / 1024);
      maxSizeSlider.value = maxSizeKB;
      maxSizeValue.textContent = this.currentFilters.maxSize === 0 ? '不限' : this._formatSize(this.currentFilters.maxSize);
    }
    
    const minScoreSlider = document.getElementById('min-score');
    const minScoreValue = document.getElementById('min-score-value');
    
    if (minScoreSlider && minScoreValue) {
      minScoreSlider.value = this.currentFilters.minScore;
      minScoreValue.textContent = this.currentFilters.minScore;
    }
    
    const searchInput = document.getElementById('resource-search');
    if (searchInput) {
      searchInput.value = this.currentFilters.search;
    }
  }
  
  /**
   * 更新排序UI
   * @private
   */
  _updateSortUI() {
    const sortOption = this.container.querySelector(`.sort-option[value="${this.currentSortBy}"]`);
    if (sortOption) {
      sortOption.checked = true;
    }
  }
}

export default FilterBar;
