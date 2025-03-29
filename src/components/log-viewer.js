/**
 * @file log-viewer.js
 * @description 日志查看器组件，显示应用状态和下载状态日志
 * @version 2.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import loggingService, { LogLevel, LogCategory } from '../services/logging-service.js';
import Chart from '../libs/chart.min.js';

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
      showControls: true,
      showVisualization: true,
      allowComparison: true,
      allowAnnotation: true,
      chartColors: {
        error: 'rgba(255, 99, 132, 0.7)',
        warning: 'rgba(255, 206, 86, 0.7)',
        info: 'rgba(54, 162, 235, 0.7)',
        debug: 'rgba(75, 192, 192, 0.7)',
        borderColor: 'rgba(0, 0, 0, 0.1)'
      }
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
    
    this.charts = {};
    this.visualizationMode = 'trend'; // 'trend', 'distribution', 'category'
    
    this.comparisonActive = false;
    this.comparisonFilters = {
      startTime: null,
      endTime: null,
      level: this.options.defaultLevel,
      category: this.options.defaultCategory
    };
    this.comparisonLogs = [];
    
    this.annotations = new Map();
    this.bookmarks = new Set();
    
    this._loadAnnotationsAndBookmarks();
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
      
      if (this.options.showVisualization) {
        this._createVisualizationControls();
      }
      
      if (this.options.allowComparison) {
        this._createComparisonControls();
      }
      
      this.container.appendChild(this.controlsContainer);
    }
    
    this.mainViewContainer = document.createElement('div');
    this.mainViewContainer.className = 'log-viewer-main-view';
    this.container.appendChild(this.mainViewContainer);
    
    this.logListContainer = document.createElement('div');
    this.logListContainer.className = 'log-viewer-list';
    this.mainViewContainer.appendChild(this.logListContainer);
    
    this.logList = document.createElement('ul');
    this.logListContainer.appendChild(this.logList);
    
    if (this.options.showVisualization) {
      this.visualizationContainer = document.createElement('div');
      this.visualizationContainer.className = 'log-visualization-container';
      this.visualizationContainer.style.display = 'none';
      this.mainViewContainer.appendChild(this.visualizationContainer);
    }
    
    if (this.options.allowComparison) {
      this.comparisonContainer = document.createElement('div');
      this.comparisonContainer.className = 'log-comparison-container';
      this.comparisonContainer.style.display = 'none';
      
      this.comparisonLogList = document.createElement('ul');
      this.comparisonContainer.appendChild(this.comparisonLogList);
      
      this.mainViewContainer.appendChild(this.comparisonContainer);
    }
    
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
    
    const viewToggleContainer = document.createElement('div');
    viewToggleContainer.className = 'view-toggle-container';
    
    const listViewButton = document.createElement('button');
    listViewButton.textContent = '列表视图';
    listViewButton.className = 'view-button active';
    listViewButton.addEventListener('click', () => this._switchView('list'));
    viewToggleContainer.appendChild(listViewButton);
    
    if (this.options.showVisualization) {
      const visualViewButton = document.createElement('button');
      visualViewButton.textContent = '可视化视图';
      visualViewButton.className = 'view-button';
      visualViewButton.addEventListener('click', () => this._switchView('visualization'));
      viewToggleContainer.appendChild(visualViewButton);
    }
    
    actionContainer.appendChild(viewToggleContainer);
    
    this.controlsContainer.appendChild(actionContainer);
  }
  
  /**
   * 创建可视化控件
   * @private
   */
  _createVisualizationControls() {
    const visualContainer = document.createElement('div');
    visualContainer.className = 'visualization-controls';
    visualContainer.style.display = 'none';
    
    const visualTitle = document.createElement('h3');
    visualTitle.textContent = '日志可视化';
    visualContainer.appendChild(visualTitle);
    
    const visualTypeContainer = document.createElement('div');
    visualTypeContainer.className = 'visual-type-container';
    
    const visualTypes = [
      { id: 'trend', text: '趋势图' },
      { id: 'distribution', text: '分布图' },
      { id: 'category', text: '类别图' }
    ];
    
    visualTypes.forEach(type => {
      const typeButton = document.createElement('button');
      typeButton.textContent = type.text;
      typeButton.className = `visual-type-button ${type.id === this.visualizationMode ? 'active' : ''}`;
      typeButton.dataset.type = type.id;
      typeButton.addEventListener('click', () => {
        this.visualizationMode = type.id;
        
        visualTypeContainer.querySelectorAll('.visual-type-button').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.type === type.id);
        });
        
        this._updateVisualization();
      });
      
      visualTypeContainer.appendChild(typeButton);
    });
    
    visualContainer.appendChild(visualTypeContainer);
    
    const timeRangeContainer = document.createElement('div');
    timeRangeContainer.className = 'time-range-container';
    
    const timeRangeLabel = document.createElement('label');
    timeRangeLabel.textContent = '时间范围:';
    timeRangeContainer.appendChild(timeRangeLabel);
    
    const timeRangeSelect = document.createElement('select');
    timeRangeSelect.className = 'time-range-select';
    
    const timeRanges = [
      { value: 15, text: '最近15分钟' },
      { value: 60, text: '最近1小时' },
      { value: 360, text: '最近6小时' },
      { value: 1440, text: '最近24小时' },
      { value: 10080, text: '最近7天' }
    ];
    
    timeRanges.forEach(range => {
      const option = document.createElement('option');
      option.value = range.value;
      option.textContent = range.text;
      timeRangeSelect.appendChild(option);
    });
    
    timeRangeSelect.addEventListener('change', () => {
      this._updateVisualization();
    });
    
    timeRangeContainer.appendChild(timeRangeSelect);
    visualContainer.appendChild(timeRangeContainer);
    
    this.visualizationControls = visualContainer;
    this.controlsContainer.appendChild(visualContainer);
  }
  
  /**
   * 创建日志对比控件
   * @private
   */
  _createComparisonControls() {
    const comparisonContainer = document.createElement('div');
    comparisonContainer.className = 'comparison-controls';
    comparisonContainer.style.display = 'none';
    
    const comparisonTitle = document.createElement('h3');
    comparisonTitle.textContent = '日志对比';
    comparisonContainer.appendChild(comparisonTitle);
    
    const timeRangeContainer = document.createElement('div');
    timeRangeContainer.className = 'comparison-time-container';
    
    const startTimeLabel = document.createElement('label');
    startTimeLabel.textContent = '开始时间:';
    timeRangeContainer.appendChild(startTimeLabel);
    
    const startTimeInput = document.createElement('input');
    startTimeInput.type = 'datetime-local';
    startTimeInput.className = 'comparison-start-time';
    timeRangeContainer.appendChild(startTimeInput);
    
    const endTimeLabel = document.createElement('label');
    endTimeLabel.textContent = '结束时间:';
    timeRangeContainer.appendChild(endTimeLabel);
    
    const endTimeInput = document.createElement('input');
    endTimeInput.type = 'datetime-local';
    endTimeInput.className = 'comparison-end-time';
    timeRangeContainer.appendChild(endTimeInput);
    
    comparisonContainer.appendChild(timeRangeContainer);
    
    const filterContainer = document.createElement('div');
    filterContainer.className = 'comparison-filter-container';
    
    const levelLabel = document.createElement('label');
    levelLabel.textContent = '级别:';
    filterContainer.appendChild(levelLabel);
    
    const levelSelect = document.createElement('select');
    levelSelect.className = 'comparison-level-select';
    
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
      levelSelect.appendChild(optionElement);
    });
    
    filterContainer.appendChild(levelSelect);
    
    const categoryLabel = document.createElement('label');
    categoryLabel.textContent = '类别:';
    filterContainer.appendChild(categoryLabel);
    
    const categorySelect = document.createElement('select');
    categorySelect.className = 'comparison-category-select';
    
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = '全部';
    categorySelect.appendChild(allOption);
    
    Object.entries(LogCategory).forEach(([key, value]) => {
      const optionElement = document.createElement('option');
      optionElement.value = value;
      optionElement.textContent = key;
      categorySelect.appendChild(optionElement);
    });
    
    filterContainer.appendChild(categorySelect);
    
    comparisonContainer.appendChild(filterContainer);
    
    const actionContainer = document.createElement('div');
    actionContainer.className = 'comparison-action-container';
    
    const loadButton = document.createElement('button');
    loadButton.textContent = '加载对比日志';
    loadButton.className = 'load-comparison-button';
    loadButton.addEventListener('click', () => {
      this._loadComparisonLogs();
    });
    actionContainer.appendChild(loadButton);
    
    const toggleButton = document.createElement('button');
    toggleButton.textContent = '开启对比视图';
    toggleButton.className = 'toggle-comparison-button';
    toggleButton.addEventListener('click', () => {
      this._toggleComparisonView();
    });
    actionContainer.appendChild(toggleButton);
    
    comparisonContainer.appendChild(actionContainer);
    
    this.comparisonControls = comparisonContainer;
    this.controlsContainer.appendChild(comparisonContainer);
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
  _appendLogEntry(logEntry, targetList = this.logList) {
    const logItem = document.createElement('li');
    logItem.className = `log-item log-level-${logEntry.level} log-category-${logEntry.category}`;
    logItem.dataset.id = logEntry.id;
    
    if (this.options.allowAnnotation) {
      const actionContainer = document.createElement('div');
      actionContainer.className = 'log-action-icons';
      
      const bookmarkIcon = document.createElement('span');
      bookmarkIcon.className = `log-bookmark-icon ${this.bookmarks.has(logEntry.id) ? 'active' : ''}`;
      bookmarkIcon.title = this.bookmarks.has(logEntry.id) ? '取消书签' : '添加书签';
      bookmarkIcon.innerHTML = '&#9733;'; // 星形图标
      bookmarkIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this._toggleBookmark(logEntry.id);
        bookmarkIcon.classList.toggle('active');
        bookmarkIcon.title = bookmarkIcon.classList.contains('active') ? '取消书签' : '添加书签';
      });
      
      const annotationIcon = document.createElement('span');
      annotationIcon.className = `log-annotation-icon ${this.annotations.has(logEntry.id) ? 'active' : ''}`;
      annotationIcon.title = this.annotations.has(logEntry.id) ? '编辑注释' : '添加注释';
      annotationIcon.innerHTML = '&#9998;'; // 笔形图标
      annotationIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        this._showAnnotationDialog(logEntry.id, logItem);
      });
      
      actionContainer.appendChild(bookmarkIcon);
      actionContainer.appendChild(annotationIcon);
      logItem.appendChild(actionContainer);
    }
    
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
    
    if (this.annotations.has(logEntry.id)) {
      const annotationContainer = document.createElement('div');
      annotationContainer.className = 'log-annotation-container';
      
      const annotationContent = document.createElement('div');
      annotationContent.className = 'log-annotation-content';
      annotationContent.textContent = this.annotations.get(logEntry.id);
      
      annotationContainer.appendChild(annotationContent);
      logItem.appendChild(annotationContainer);
    }
    
    targetList.appendChild(logItem);
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
    
    if (this.visualizationContainer && 
        this.visualizationContainer.style.display !== 'none') {
      this._updateVisualization();
    }
    
    if (this.comparisonActive) {
      this._updateComparisonView();
    }
    
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
  /**
   * 切换视图模式
   * @param {string} viewMode - 视图模式 ('list', 'visualization', 'comparison')
   * @private
   */
  _switchView(viewMode) {
    const viewButtons = this.controlsContainer.querySelectorAll('.view-button');
    viewButtons.forEach(button => {
      button.classList.remove('active');
      if (button.textContent.toLowerCase().includes(viewMode)) {
        button.classList.add('active');
      }
    });
    
    if (this.logListContainer) {
      this.logListContainer.style.display = 'none';
    }
    
    if (this.visualizationContainer) {
      this.visualizationContainer.style.display = 'none';
    }
    
    if (this.comparisonContainer) {
      this.comparisonContainer.style.display = 'none';
    }
    
    if (this.visualizationControls) {
      this.visualizationControls.style.display = 'none';
    }
    
    if (this.comparisonControls) {
      this.comparisonControls.style.display = 'none';
    }
    
    switch (viewMode) {
      case 'list':
        this.logListContainer.style.display = 'block';
        break;
      case 'visualization':
        this.visualizationContainer.style.display = 'block';
        this.visualizationControls.style.display = 'block';
        this._updateVisualization();
        break;
      case 'comparison':
        this.comparisonContainer.style.display = 'block';
        this.comparisonControls.style.display = 'block';
        break;
    }
  }
  
  /**
   * 更新可视化视图
   * @private
   */
  _updateVisualization() {
    if (!this.visualizationContainer) return;
    
    this.visualizationContainer.innerHTML = '';
    
    const timeRangeSelect = this.visualizationControls.querySelector('.time-range-select');
    const minutesRange = parseInt(timeRangeSelect?.value || 60);
    const endTime = Date.now();
    const startTime = endTime - (minutesRange * 60 * 1000);
    
    const logs = loggingService.getLogs({
      startTime,
      endTime,
      limit: 1000 // 获取足够的日志用于可视化
    });
    
    if (logs.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-visualization-message';
      emptyMessage.textContent = '没有可用于可视化的日志数据';
      this.visualizationContainer.appendChild(emptyMessage);
      return;
    }
    
    switch (this.visualizationMode) {
      case 'trend':
        this._createTrendChart(logs);
        break;
      case 'distribution':
        this._createDistributionChart(logs);
        break;
      case 'category':
        this._createCategoryChart(logs);
        break;
    }
  }
  
  /**
   * 创建趋势图表
   * @param {Array} logs - 日志数组
   * @private
   */
  _createTrendChart(logs) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    
    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);
    this.visualizationContainer.appendChild(chartContainer);
    
    const timeGroups = this._groupLogsByTime(logs);
    
    const labels = Object.keys(timeGroups).map(time => 
      new Date(parseInt(time)).toLocaleTimeString()
    );
    
    const datasets = [
      {
        label: '错误',
        data: Object.values(timeGroups).map(group => 
          group.filter(log => log.level === LogLevel.ERROR).length
        ),
        backgroundColor: this.options.chartColors.error,
        borderColor: this.options.chartColors.error,
        borderWidth: 1
      },
      {
        label: '警告',
        data: Object.values(timeGroups).map(group => 
          group.filter(log => log.level === LogLevel.WARNING).length
        ),
        backgroundColor: this.options.chartColors.warning,
        borderColor: this.options.chartColors.warning,
        borderWidth: 1
      },
      {
        label: '信息',
        data: Object.values(timeGroups).map(group => 
          group.filter(log => log.level === LogLevel.INFO).length
        ),
        backgroundColor: this.options.chartColors.info,
        borderColor: this.options.chartColors.info,
        borderWidth: 1
      },
      {
        label: '调试',
        data: Object.values(timeGroups).map(group => 
          group.filter(log => log.level === LogLevel.DEBUG).length
        ),
        backgroundColor: this.options.chartColors.debug,
        borderColor: this.options.chartColors.debug,
        borderWidth: 1
      }
    ];
    
    if (this.charts.trend) {
      this.charts.trend.destroy();
    }
    
    this.charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: '日志数量'
            }
          },
          x: {
            title: {
              display: true,
              text: '时间'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: '日志趋势分析'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    });
  }
  
  /**
   * 创建分布图表
   * @param {Array} logs - 日志数组
   * @private
   */
  _createDistributionChart(logs) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    
    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);
    this.visualizationContainer.appendChild(chartContainer);
    
    const levelCounts = [0, 0, 0, 0]; // DEBUG, INFO, WARNING, ERROR
    
    logs.forEach(log => {
      levelCounts[log.level]++;
    });
    
    const data = {
      labels: ['调试', '信息', '警告', '错误'],
      datasets: [{
        label: '日志数量',
        data: levelCounts,
        backgroundColor: [
          this.options.chartColors.debug,
          this.options.chartColors.info,
          this.options.chartColors.warning,
          this.options.chartColors.error
        ],
        borderColor: this.options.chartColors.borderColor,
        borderWidth: 1
      }]
    };
    
    if (this.charts.distribution) {
      this.charts.distribution.destroy();
    }
    
    this.charts.distribution = new Chart(canvas, {
      type: 'pie',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: '日志级别分布'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = Math.round((value / total) * 100);
                return `${label}: ${value} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }
  
  /**
   * 创建类别图表
   * @param {Array} logs - 日志数组
   * @private
   */
  _createCategoryChart(logs) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    
    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);
    this.visualizationContainer.appendChild(chartContainer);
    
    const categoryCounts = {};
    
    logs.forEach(log => {
      if (!categoryCounts[log.category]) {
        categoryCounts[log.category] = [0, 0, 0, 0]; // DEBUG, INFO, WARNING, ERROR
      }
      categoryCounts[log.category][log.level]++;
    });
    
    const labels = Object.keys(categoryCounts);
    
    const datasets = [
      {
        label: '错误',
        data: labels.map(category => categoryCounts[category][LogLevel.ERROR]),
        backgroundColor: this.options.chartColors.error,
        borderColor: this.options.chartColors.borderColor,
        borderWidth: 1
      },
      {
        label: '警告',
        data: labels.map(category => categoryCounts[category][LogLevel.WARNING]),
        backgroundColor: this.options.chartColors.warning,
        borderColor: this.options.chartColors.borderColor,
        borderWidth: 1
      },
      {
        label: '信息',
        data: labels.map(category => categoryCounts[category][LogLevel.INFO]),
        backgroundColor: this.options.chartColors.info,
        borderColor: this.options.chartColors.borderColor,
        borderWidth: 1
      },
      {
        label: '调试',
        data: labels.map(category => categoryCounts[category][LogLevel.DEBUG]),
        backgroundColor: this.options.chartColors.debug,
        borderColor: this.options.chartColors.borderColor,
        borderWidth: 1
      }
    ];
    
    if (this.charts.category) {
      this.charts.category.destroy();
    }
    
    this.charts.category = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            stacked: true,
            title: {
              display: true,
              text: '日志类别'
            }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            title: {
              display: true,
              text: '日志数量'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: '日志类别分析'
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        }
      }
    });
  }
  
  /**
   * 按时间分组日志
   * @param {Array} logs - 日志数组
   * @returns {Object} - 按时间分组的日志
   * @private
   */
  _groupLogsByTime(logs) {
    const timeGroups = {};
    const interval = 5 * 60 * 1000; // 5分钟间隔
    
    logs.forEach(log => {
      const timeGroup = Math.floor(log.timestamp / interval) * interval;
      
      if (!timeGroups[timeGroup]) {
        timeGroups[timeGroup] = [];
      }
      
      timeGroups[timeGroup].push(log);
    });
    
    return timeGroups;
  }
  
  /**
   * 加载注释和书签
   * @private
   */
  _loadAnnotationsAndBookmarks() {
    try {
      chrome.storage.local.get(['log_annotations', 'log_bookmarks'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('加载注释和书签失败:', chrome.runtime.lastError);
          return;
        }
        
        if (result.log_annotations) {
          this.annotations = new Map(JSON.parse(result.log_annotations));
        }
        
        if (result.log_bookmarks) {
          this.bookmarks = new Set(JSON.parse(result.log_bookmarks));
        }
      });
    } catch (error) {
      console.error('加载注释和书签失败:', error);
    }
  }
  
  /**
   * 保存注释和书签
   * @private
   */
  _saveAnnotationsAndBookmarks() {
    try {
      const annotationsArray = Array.from(this.annotations.entries());
      const bookmarksArray = Array.from(this.bookmarks.values());
      
      chrome.storage.local.set({
        'log_annotations': JSON.stringify(annotationsArray),
        'log_bookmarks': JSON.stringify(bookmarksArray)
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('保存注释和书签失败:', chrome.runtime.lastError);
        }
      });
    } catch (error) {
      console.error('保存注释和书签失败:', error);
    }
  }
  
  /**
   * 切换书签状态
   * @param {string} logId - 日志ID
   * @private
   */
  _toggleBookmark(logId) {
    if (this.bookmarks.has(logId)) {
      this.bookmarks.delete(logId);
    } else {
      this.bookmarks.add(logId);
    }
    
    this._saveAnnotationsAndBookmarks();
  }
  
  /**
   * 显示注释对话框
   * @param {string} logId - 日志ID
   * @param {HTMLElement} logItem - 日志项元素
   * @private
   */
  _showAnnotationDialog(logId, logItem) {
    const dialog = document.createElement('div');
    dialog.className = 'annotation-dialog';
    
    const title = document.createElement('h3');
    title.textContent = '添加注释';
    dialog.appendChild(title);
    
    const textarea = document.createElement('textarea');
    textarea.className = 'annotation-textarea';
    textarea.placeholder = '输入注释内容...';
    
    if (this.annotations.has(logId)) {
      textarea.value = this.annotations.get(logId);
      title.textContent = '编辑注释';
    }
    
    dialog.appendChild(textarea);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'annotation-buttons';
    
    const saveButton = document.createElement('button');
    saveButton.textContent = '保存';
    saveButton.addEventListener('click', () => {
      const text = textarea.value.trim();
      
      if (text) {
        this.annotations.set(logId, text);
        this._saveAnnotationsAndBookmarks();
        
        const existingAnnotation = logItem.querySelector('.log-annotation-container');
        if (existingAnnotation) {
          existingAnnotation.querySelector('.log-annotation-content').textContent = text;
        } else {
          const annotationContainer = document.createElement('div');
          annotationContainer.className = 'log-annotation-container';
          
          const annotationContent = document.createElement('div');
          annotationContent.className = 'log-annotation-content';
          annotationContent.textContent = text;
          
          annotationContainer.appendChild(annotationContent);
          logItem.appendChild(annotationContainer);
        }
        
        const icon = logItem.querySelector('.log-annotation-icon');
        if (icon) {
          icon.classList.add('active');
          icon.title = '编辑注释';
        }
      } else {
        this.annotations.delete(logId);
        this._saveAnnotationsAndBookmarks();
        
        const existingAnnotation = logItem.querySelector('.log-annotation-container');
        if (existingAnnotation) {
          logItem.removeChild(existingAnnotation);
        }
        
        const icon = logItem.querySelector('.log-annotation-icon');
        if (icon) {
          icon.classList.remove('active');
          icon.title = '添加注释';
        }
      }
      
      document.body.removeChild(dialog);
    });
    
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    
    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(cancelButton);
    
    dialog.appendChild(buttonContainer);
    
    document.body.appendChild(dialog);
    
    textarea.focus();
  }
  
  /**
   * 销毁日志查看器
   */
  destroy() {
    this._stopAutoRefresh();
    
    loggingService.removeListener(this._onNewLog.bind(this));
    
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    
    this.container.innerHTML = '';
    this.container.classList.remove('log-viewer');
  }
}

export default LogViewer;
