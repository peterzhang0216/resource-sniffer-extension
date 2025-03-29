/**
 * @file log-viewer.js
 * @description 日志查看器组件，显示应用状态和下载状态日志
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import loggingService, { LogLevel, LogCategory } from '../services/logging-service.js';

/**
 * 日志查看器组件
 * @class LogViewer
 */
class LogViewer {
  /**
   * 创建日志查看器实例
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 配置选项
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = Object.assign({
      autoRefresh: true,
      refreshInterval: 2000,
      maxDisplayLogs: 100,
      showTimestamp: true,
      showLevel: true,
      showCategory: true,
      defaultLevel: LogLevel.INFO,
      defaultCategory: null,
      allowExport: true,
      allowClear: true,
      allowFilter: true,
      showControls: true
    }, options);
    
    this.filters = {
      level: this.options.defaultLevel,
      category: this.options.defaultCategory,
      search: '',
      startTime: null,
      endTime: null
    };
    
    this.isVisible = false;
    this.refreshTimer = null;
    
    this._createElements();
    this._setupEventListeners();
    
    if (this.options.autoRefresh) {
      this._startAutoRefresh();
    }
  }
  
  /**
   * 创建组件元素
   * @private
   */
  _createElements() {
    this.container.classList.add('log-viewer');
    
    if (this.options.showControls) {
      this.controlsContainer = document.createElement('div');
      this.controlsContainer.className = 'log-viewer-controls';
      
      if (this.options.allowFilter) {
        this._createFilterControls();
      }
      
      this._createActionButtons();
      
      this.container.appendChild(this.controlsContainer);
    }
    
    this.logListContainer = document.createElement('div');
    this.logListContainer.className = 'log-viewer-list';
    this.container.appendChild(this.logListContainer);
    
    this.logList = document.createElement('ul');
    this.logListContainer.appendChild(this.logList);
    
    this.statusBar = document.createElement('div');
    this.statusBar.className = 'log-viewer-status';
    this.container.appendChild(this.statusBar);
    
    this.refresh();
  }
  
  /**
   * 创建过滤控件
   * @private
   */
  _createFilterControls() {
    const filterContainer = document.createElement('div');
    filterContainer.className = 'log-filter-container';
    
    const levelFilterContainer = document.createElement('div');
    levelFilterContainer.className = 'filter-group';
    
    const levelLabel = document.createElement('label');
    levelLabel.textContent = '级别:';
    levelFilterContainer.appendChild(levelLabel);
    
    this.levelSelect = document.createElement('select');
    this.levelSelect.className = 'level-select';
    
    const levelOptions = [
      { value: LogLevel.DEBUG, text: '调试' },
      { value: LogLevel.INFO, text: '信息' },
      { value: LogLevel.WARNING, text: '警告' },
      { value: LogLevel.ERROR, text: '错误' }
    ];
    
    levelOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      this.levelSelect.appendChild(optionElement);
    });
    
    this.levelSelect.value = this.filters.level;
    levelFilterContainer.appendChild(this.levelSelect);
    
    filterContainer.appendChild(levelFilterContainer);
    
    const categoryFilterContainer = document.createElement('div');
    categoryFilterContainer.className = 'filter-group';
    
    const categoryLabel = document.createElement('label');
    categoryLabel.textContent = '类别:';
    categoryFilterContainer.appendChild(categoryLabel);
    
    this.categorySelect = document.createElement('select');
    this.categorySelect.className = 'category-select';
    
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = '全部';
    this.categorySelect.appendChild(allOption);
    
    Object.entries(LogCategory).forEach(([key, value]) => {
      const optionElement = document.createElement('option');
      optionElement.value = value;
      optionElement.textContent = key;
      this.categorySelect.appendChild(optionElement);
    });
    
    if (this.filters.category) {
      this.categorySelect.value = this.filters.category;
    }
    
    categoryFilterContainer.appendChild(this.categorySelect);
    
    filterContainer.appendChild(categoryFilterContainer);
    
    const searchContainer = document.createElement('div');
    searchContainer.className = 'filter-group search-group';
    
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.placeholder = '搜索日志...';
    this.searchInput.className = 'search-input';
    
    searchContainer.appendChild(this.searchInput);
    
    const searchButton = document.createElement('button');
    searchButton.textContent = '搜索';
    searchButton.className = 'search-button';
    searchButton.addEventListener('click', () => {
      this.filters.search = this.searchInput.value;
      this.refresh();
    });
    
    searchContainer.appendChild(searchButton);
    
    filterContainer.appendChild(searchContainer);
    
    this.controlsContainer.appendChild(filterContainer);
  }
  
  /**
   * 创建操作按钮
   * @private
   */
  _createActionButtons() {
    const actionContainer = document.createElement('div');
    actionContainer.className = 'log-actions-container';
    
    const refreshButton = document.createElement('button');
    refreshButton.textContent = '刷新';
    refreshButton.className = 'refresh-button';
    refreshButton.addEventListener('click', () => this.refresh());
    actionContainer.appendChild(refreshButton);
    
    const autoRefreshContainer = document.createElement('div');
    autoRefreshContainer.className = 'auto-refresh-container';
    
    const autoRefreshLabel = document.createElement('label');
    autoRefreshLabel.textContent = '自动刷新';
    
    this.autoRefreshCheckbox = document.createElement('input');
    this.autoRefreshCheckbox.type = 'checkbox';
    this.autoRefreshCheckbox.checked = this.options.autoRefresh;
    
    autoRefreshLabel.prepend(this.autoRefreshCheckbox);
    autoRefreshContainer.appendChild(autoRefreshLabel);
    actionContainer.appendChild(autoRefreshContainer);
    
    if (this.options.allowClear) {
      const clearButton = document.createElement('button');
      clearButton.textContent = '清除日志';
      clearButton.className = 'clear-button';
      clearButton.addEventListener('click', () => this.clearLogs());
      actionContainer.appendChild(clearButton);
    }
    
    if (this.options.allowExport) {
      const exportButton = document.createElement('button');
      exportButton.textContent = '导出日志';
      exportButton.className = 'export-button';
      exportButton.addEventListener('click', () => this.exportLogs());
      actionContainer.appendChild(exportButton);
    }
    
    this.controlsContainer.appendChild(actionContainer);
  }
  
  /**
   * 设置事件监听器
   * @private
   */
  _setupEventListeners() {
    if (this.levelSelect) {
      this.levelSelect.addEventListener('change', () => {
        this.filters.level = parseInt(this.levelSelect.value, 10);
        this.refresh();
      });
    }
    
    if (this.categorySelect) {
      this.categorySelect.addEventListener('change', () => {
        this.filters.category = this.categorySelect.value || null;
        this.refresh();
      });
    }
    
    if (this.searchInput) {
      this.searchInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
          this.filters.search = this.searchInput.value;
          this.refresh();
        }
      });
    }
    
    if (this.autoRefreshCheckbox) {
      this.autoRefreshCheckbox.addEventListener('change', () => {
        if (this.autoRefreshCheckbox.checked) {
          this._startAutoRefresh();
        } else {
          this._stopAutoRefresh();
        }
      });
    }
    
    loggingService.addListener(this._onNewLog.bind(this));
  }
  
  /**
   * 处理新日志事件
   * @param {Object} logEntry - 日志条目
   * @private
   */
  _onNewLog(logEntry) {
    if (logEntry.type === 'clear') {
      this.refresh();
      return;
    }
    
    if (logEntry.type === 'settings_changed') {
      this.refresh();
      return;
    }
    
    if (this._matchesFilters(logEntry)) {
      this._appendLogEntry(logEntry);
      
      const logItems = this.logList.querySelectorAll('li');
      if (logItems.length > this.options.maxDisplayLogs) {
        for (let i = 0; i < logItems.length - this.options.maxDisplayLogs; i++) {
          this.logList.removeChild(logItems[i]);
        }
      }
      
      this.logListContainer.scrollTop = this.logListContainer.scrollHeight;
    }
    
    this._updateStatusBar();
  }
  
  /**
   * 检查日志是否符合过滤条件
   * @param {Object} logEntry - 日志条目
   * @returns {boolean} - 是否符合条件
   * @private
   */
  _matchesFilters(logEntry) {
    if (this.filters.level !== undefined && logEntry.level < this.filters.level) {
      return false;
    }
    
    if (this.filters.category && logEntry.category !== this.filters.category) {
      return false;
    }
    
    if (this.filters.search) {
      const searchLower = this.filters.search.toLowerCase();
      const messageMatch = logEntry.message.toLowerCase().includes(searchLower);
      const dataMatch = logEntry.data ? JSON.stringify(logEntry.data).toLowerCase().includes(searchLower) : false;
      
      if (!messageMatch && !dataMatch) {
        return false;
      }
    }
    
    if (this.filters.startTime && logEntry.timestamp < this.filters.startTime) {
      return false;
    }
    
    if (this.filters.endTime && logEntry.timestamp > this.filters.endTime) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 添加日志条目到列表
   * @param {Object} logEntry - 日志条目
   * @private
   */
  _appendLogEntry(logEntry) {
    const logItem = document.createElement('li');
    logItem.className = `log-item log-level-${logEntry.level} log-category-${logEntry.category}`;
    logItem.dataset.id = logEntry.id;
    
    if (this.options.showTimestamp) {
      const timestamp = document.createElement('span');
      timestamp.className = 'log-timestamp';
      timestamp.textContent = new Date(logEntry.timestamp).toLocaleTimeString();
      logItem.appendChild(timestamp);
    }
    
    if (this.options.showLevel) {
      const level = document.createElement('span');
      level.className = 'log-level';
      level.textContent = ['DEBUG', 'INFO', 'WARNING', 'ERROR'][logEntry.level];
      logItem.appendChild(level);
    }
    
    if (this.options.showCategory) {
      const category = document.createElement('span');
      category.className = 'log-category';
      category.textContent = logEntry.category;
      logItem.appendChild(category);
    }
    
    const message = document.createElement('span');
    message.className = 'log-message';
    message.textContent = logEntry.message;
    logItem.appendChild(message);
    
    if (logEntry.data) {
      const dataToggle = document.createElement('button');
      dataToggle.className = 'log-data-toggle';
      dataToggle.textContent = '显示数据';
      logItem.appendChild(dataToggle);
      
      const dataContainer = document.createElement('div');
      dataContainer.className = 'log-data-container';
      dataContainer.style.display = 'none';
      
      const dataContent = document.createElement('pre');
      dataContent.className = 'log-data';
      dataContent.textContent = JSON.stringify(logEntry.data, null, 2);
      dataContainer.appendChild(dataContent);
      
      logItem.appendChild(dataContainer);
      
      dataToggle.addEventListener('click', () => {
        const isVisible = dataContainer.style.display !== 'none';
        dataContainer.style.display = isVisible ? 'none' : 'block';
        dataToggle.textContent = isVisible ? '显示数据' : '隐藏数据';
      });
    }
    
    this.logList.appendChild(logItem);
  }
  
  /**
   * 更新状态栏
   * @private
   */
  _updateStatusBar() {
    const stats = loggingService.getStats();
    
    let statusText = `总日志数: ${stats.total} | `;
    statusText += `错误: ${stats.byLevel[LogLevel.ERROR]} | `;
    statusText += `警告: ${stats.byLevel[LogLevel.WARNING]} | `;
    statusText += `信息: ${stats.byLevel[LogLevel.INFO]} | `;
    statusText += `调试: ${stats.byLevel[LogLevel.DEBUG]}`;
    
    this.statusBar.textContent = statusText;
  }
  
  /**
   * 开始自动刷新
   * @private
   */
  _startAutoRefresh() {
    this._stopAutoRefresh();
    
    this.refreshTimer = setInterval(() => {
      this.refresh();
    }, this.options.refreshInterval);
    
    if (this.autoRefreshCheckbox) {
      this.autoRefreshCheckbox.checked = true;
    }
  }
  
  /**
   * 停止自动刷新
   * @private
   */
  _stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    if (this.autoRefreshCheckbox) {
      this.autoRefreshCheckbox.checked = false;
    }
  }
  
  /**
   * 刷新日志显示
   */
  refresh() {
    this.logList.innerHTML = '';
    
    const logs = loggingService.getLogs({
      ...this.filters,
      limit: this.options.maxDisplayLogs
    });
    
    logs.forEach(logEntry => {
      this._appendLogEntry(logEntry);
    });
    
    this.logListContainer.scrollTop = this.logListContainer.scrollHeight;
    
    this._updateStatusBar();
  }
  
  /**
   * 清除所有日志
   */
  clearLogs() {
    loggingService.clearLogs();
    this.refresh();
  }
  
  /**
   * 导出日志
   * @param {string} [format='json'] - 导出格式
   */
  exportLogs(format = 'json') {
    const exportData = loggingService.exportLogs(format);
    
    if (!exportData) {
      console.warn('导出日志失败: 没有日志数据');
      return;
    }
    
    const blob = new Blob([exportData], { type: this._getMimeType(format) });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `resource-sniffer-logs-${new Date().toISOString().replace(/:/g, '-')}.${format}`;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
  
  /**
   * 获取MIME类型
   * @param {string} format - 导出格式
   * @returns {string} - MIME类型
   * @private
   */
  _getMimeType(format) {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      case 'text':
        return 'text/plain';
      default:
        return 'text/plain';
    }
  }
  
  /**
   * 显示日志查看器
   */
  show() {
    this.container.style.display = 'flex';
    this.isVisible = true;
    this.refresh();
  }
  
  /**
   * 隐藏日志查看器
   */
  hide() {
    this.container.style.display = 'none';
    this.isVisible = false;
  }
  
  /**
   * 切换显示状态
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * 销毁日志查看器
   */
  destroy() {
    this._stopAutoRefresh();
    
    loggingService.removeListener(this._onNewLog.bind(this));
    
    this.container.innerHTML = '';
    this.container.classList.remove('log-viewer');
  }
}

export default LogViewer;
