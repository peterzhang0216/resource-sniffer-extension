/**
 * @file log-tab.js
 * @description 日志标签页组件，用于在弹出窗口中显示日志
 * @version 2.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import loggingService, { LogLevel, LogCategory } from '../services/logging-service.js';
import LogViewer from './log-viewer.js';
import Chart from '../libs/chart.min.js';

/**
 * 日志标签页组件类
 * @class LogTab
 */
export class LogTab {
  /**
   * 创建日志标签页组件实例
   * @param {HTMLElement} container - 容器元素
   */
  constructor(container) {
    this.container = container;
    this.logViewer = null;
    this.isInitialized = false;
    this.isVisible = false;
    this.autoRefresh = false;
    this.refreshInterval = null;
    this.refreshRate = 2000; // 2秒刷新一次
    
    this.statsVisible = false;
    this.statsChart = null;
    
    this.searchHistory = [];
    this.maxSearchHistory = 10;
    this._loadSearchHistory();
  }
  
  /**
   * 初始化日志标签页
   */
  initialize() {
    if (this.isInitialized) return;
    
    this._renderLogTab();
    this._setupLogViewer();
    this._setupEventListeners();
    this._setupCategoryStats();
    
    this.isInitialized = true;
  }
  
  /**
   * 渲染日志标签页
   * @private
   */
  _renderLogTab() {
    this.container.innerHTML = `
      <div class="log-tab-container">
        <div class="log-controls">
          <div class="log-control-group">
            <button id="refresh-logs" class="control-button" title="刷新日志">
              <span class="icon">🔄</span>
              <span class="label">刷新</span>
            </button>
            <button id="clear-logs" class="control-button warning" title="清除所有日志">
              <span class="icon">🗑️</span>
              <span class="label">清除</span>
            </button>
            <button id="export-logs" class="control-button" title="导出日志">
              <span class="icon">📥</span>
              <span class="label">导出</span>
            </button>
            <button id="toggle-stats" class="control-button" title="显示/隐藏统计信息">
              <span class="icon">📊</span>
              <span class="label">统计</span>
            </button>
          </div>
          
          <div class="log-control-group">
            <div class="log-filter">
              <label for="log-level-filter">级别:</label>
              <select id="log-level-filter">
                <option value="${LogLevel.DEBUG}">调试</option>
                <option value="${LogLevel.INFO}" selected>信息</option>
                <option value="${LogLevel.WARNING}">警告</option>
                <option value="${LogLevel.ERROR}">错误</option>
              </select>
            </div>
            
            <div class="log-filter">
              <label for="log-category-filter">类别:</label>
              <select id="log-category-filter">
                <option value="">全部</option>
                <option value="${LogCategory.APP}">应用</option>
                <option value="${LogCategory.DETECTION}">检测</option>
                <option value="${LogCategory.DOWNLOAD}">下载</option>
                <option value="${LogCategory.RESOURCE}">资源</option>
                <option value="${LogCategory.NETWORK}">网络</option>
                <option value="${LogCategory.UI}">界面</option>
                <option value="${LogCategory.WORKER}">工作线程</option>
              </select>
            </div>
          </div>
          
          <div class="log-control-group">
            <div class="log-search">
              <div class="search-input-container">
                <input type="text" id="log-search" placeholder="搜索日志...">
                <div id="search-history-dropdown" class="search-history-dropdown"></div>
              </div>
              <button id="search-logs" class="control-button">
                <span class="icon">🔍</span>
              </button>
            </div>
            
            <div class="auto-refresh-container">
              <div class="auto-refresh-toggle">
                <input type="checkbox" id="auto-refresh-logs" ${this.autoRefresh ? 'checked' : ''}>
                <label for="auto-refresh-logs">自动刷新</label>
              </div>
              <select id="refresh-rate" class="refresh-rate-select">
                <option value="1000">1秒</option>
                <option value="2000" selected>2秒</option>
                <option value="5000">5秒</option>
                <option value="10000">10秒</option>
                <option value="30000">30秒</option>
              </select>
            </div>
          </div>
        </div>
        
        <div id="log-stats-container" class="log-stats-container" style="display: none;">
          <div class="stats-header">
            <h3>日志统计</h3>
            <div class="stats-controls">
              <button id="refresh-stats" class="stats-button" title="刷新统计">
                <span class="icon">🔄</span>
              </button>
              <select id="stats-type" class="stats-type-select">
                <option value="category">按类别</option>
                <option value="level">按级别</option>
                <option value="time">按时间</option>
              </select>
            </div>
          </div>
          <div class="stats-content">
            <div class="stats-chart-container">
              <canvas id="stats-chart"></canvas>
            </div>
            <div class="stats-summary"></div>
          </div>
        </div>
        
        <div id="log-viewer-container" class="log-viewer-container"></div>
        
        <div class="log-status-bar">
          <span id="log-count">0 条日志</span>
          <span id="log-filter-status"></span>
          <span id="log-last-updated"></span>
        </div>
      </div>
    `;
  }
  
  /**
   * 设置日志查看器
   * @private
   */
  _setupLogViewer() {
    const logViewerContainer = document.getElementById('log-viewer-container');
    
    if (!logViewerContainer) {
      console.error('日志查看器容器不存在');
      return;
    }
    
    this.logViewer = new LogViewer(logViewerContainer, {
      autoRefresh: this.autoRefresh,
      refreshInterval: this.refreshRate,
      defaultLevel: parseInt(document.getElementById('log-level-filter')?.value || LogLevel.INFO),
      defaultCategory: document.getElementById('log-category-filter')?.value || null
    });
    
    this._updateLogCount();
  }
  
  /**
   * 设置事件监听器
   * @private
   */
  _setupEventListeners() {
    const refreshBtn = document.getElementById('refresh-logs');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this._refreshLogs();
      });
    }
    
    const clearBtn = document.getElementById('clear-logs');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._confirmClearLogs();
      });
    }
    
    const exportBtn = document.getElementById('export-logs');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this._exportLogs();
      });
    }
    
    const toggleStatsBtn = document.getElementById('toggle-stats');
    if (toggleStatsBtn) {
      toggleStatsBtn.addEventListener('click', () => {
        this._toggleStats();
      });
    }
    
    const refreshStatsBtn = document.getElementById('refresh-stats');
    if (refreshStatsBtn) {
      refreshStatsBtn.addEventListener('click', () => {
        this._updateCategoryStats();
      });
    }
    
    const statsTypeSelect = document.getElementById('stats-type');
    if (statsTypeSelect) {
      statsTypeSelect.addEventListener('change', () => {
        this._updateCategoryStats();
      });
    }
    
    const levelFilter = document.getElementById('log-level-filter');
    if (levelFilter) {
      levelFilter.addEventListener('change', () => {
        this._updateFilters();
      });
    }
    
    const categoryFilter = document.getElementById('log-category-filter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', () => {
        this._updateFilters();
      });
    }
    
    const searchInput = document.getElementById('log-search');
    const searchBtn = document.getElementById('search-logs');
    
    if (searchInput && searchBtn) {
      searchBtn.addEventListener('click', () => {
        this._searchLogs(searchInput.value);
      });
      
      searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          this._searchLogs(searchInput.value);
        }
      });
      
      searchInput.addEventListener('focus', () => {
        this._showSearchHistory();
      });
      
      searchInput.addEventListener('blur', () => {
        setTimeout(() => {
          const dropdown = document.getElementById('search-history-dropdown');
          if (dropdown) {
            dropdown.style.display = 'none';
          }
        }, 200);
      });
    }
    
    const autoRefreshToggle = document.getElementById('auto-refresh-logs');
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener('change', (e) => {
        this.autoRefresh = e.target.checked;
        this._toggleAutoRefresh();
      });
    }
    
    const refreshRateSelect = document.getElementById('refresh-rate');
    if (refreshRateSelect) {
      refreshRateSelect.addEventListener('change', (e) => {
        this.refreshRate = parseInt(e.target.value);
        if (this.autoRefresh) {
          this._toggleAutoRefresh();
          this._toggleAutoRefresh();
        }
      });
    }
  }
  
  /**
   * 刷新日志
   * @private
   */
  _refreshLogs() {
    if (!this.logViewer) return;
    
    this.logViewer.refresh();
    this._updateLogCount();
    this._updateLastUpdated();
  }
  
  /**
   * 确认清除日志
   * @private
   */
  _confirmClearLogs() {
    if (confirm('确定要清除所有日志吗？此操作不可撤销。')) {
      this._clearLogs();
    }
  }
  
  /**
   * 清除日志
   * @private
   */
  _clearLogs() {
    if (!this.logViewer) return;
    
    loggingService.clearLogs();
    this.logViewer.refresh();
    this._updateLogCount();
    
    this._showToast('日志已清除');
  }
  
  /**
   * 导出日志
   * @private
   */
  _exportLogs() {
    if (!this.logViewer) return;
    
    const format = 'json'; // 默认导出格式
    const exportData = loggingService.exportLogs(format);
    
    if (!exportData) {
      this._showToast('导出日志失败: 没有日志数据', 'error');
      return;
    }
    
    const blob = new Blob([exportData], { type: 'application/json' });
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
    
    this._showToast('日志导出成功');
  }
  
  /**
   * 更新过滤器
   * @private
   */
  _updateFilters() {
    if (!this.logViewer) return;
    
    const levelFilter = document.getElementById('log-level-filter');
    const categoryFilter = document.getElementById('log-category-filter');
    
    if (!levelFilter || !categoryFilter) return;
    
    const level = parseInt(levelFilter.value);
    const category = categoryFilter.value || undefined;
    
    this.logViewer.filters.level = level;
    this.logViewer.filters.category = category;
    this.logViewer.refresh();
    
    this._updateLogCount();
    this._updateFilterStatus(level, category);
  }
  
  /**
   * 搜索日志
   * @private
   * @param {string} query - 搜索查询
   */
  _searchLogs(query) {
    if (!this.logViewer) return;
    
    query = query.trim();
    if (!query) {
      this.logViewer.filters.search = '';
      this.logViewer.refresh();
      this._updateLogCount();
      return;
    }
    
    this.logViewer.filters.search = query;
    this.logViewer.refresh();
    this._updateLogCount();
    
    this._addToSearchHistory(query);
  }
  
  /**
   * 添加到搜索历史
   * @private
   * @param {string} query - 搜索查询
   */
  _addToSearchHistory(query) {
    const index = this.searchHistory.indexOf(query);
    if (index !== -1) {
      this.searchHistory.splice(index, 1);
    }
    
    this.searchHistory.unshift(query);
    
    if (this.searchHistory.length > this.maxSearchHistory) {
      this.searchHistory.pop();
    }
    
    this._saveSearchHistory();
  }
  
  /**
   * 保存搜索历史
   * @private
   */
  _saveSearchHistory() {
    try {
      chrome.storage.local.set({ 'log_search_history': JSON.stringify(this.searchHistory) });
    } catch (error) {
      console.error('保存搜索历史失败:', error);
    }
  }
  
  /**
   * 加载搜索历史
   * @private
   */
  _loadSearchHistory() {
    try {
      chrome.storage.local.get(['log_search_history'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('加载搜索历史失败:', chrome.runtime.lastError);
          return;
        }
        
        if (result.log_search_history) {
          try {
            this.searchHistory = JSON.parse(result.log_search_history);
          } catch (e) {
            console.error('解析搜索历史失败:', e);
            this.searchHistory = [];
          }
        }
      });
    } catch (error) {
      console.error('加载搜索历史失败:', error);
    }
  }
  
  /**
   * 显示搜索历史
   * @private
   */
  _showSearchHistory() {
    const dropdown = document.getElementById('search-history-dropdown');
    if (!dropdown || this.searchHistory.length === 0) return;
    
    dropdown.innerHTML = '';
    
    this.searchHistory.forEach(term => {
      const item = document.createElement('div');
      item.className = 'history-item';
      
      const termSpan = document.createElement('span');
      termSpan.className = 'history-term';
      termSpan.textContent = term;
      item.appendChild(termSpan);
      
      const deleteBtn = document.createElement('span');
      deleteBtn.className = 'history-delete';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.title = '删除此搜索记录';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._removeFromSearchHistory(term);
        item.remove();
        
        if (this.searchHistory.length === 0) {
          dropdown.style.display = 'none';
        }
      });
      item.appendChild(deleteBtn);
      
      item.addEventListener('click', () => {
        const searchInput = document.getElementById('log-search');
        if (searchInput) {
          searchInput.value = term;
          this._searchLogs(term);
        }
        dropdown.style.display = 'none';
      });
      
      dropdown.appendChild(item);
    });
    
    dropdown.style.display = 'block';
  }
  
  /**
   * 从搜索历史中移除
   * @private
   * @param {string} term - 搜索词
   */
  _removeFromSearchHistory(term) {
    const index = this.searchHistory.indexOf(term);
    if (index !== -1) {
      this.searchHistory.splice(index, 1);
      this._saveSearchHistory();
    }
  }
  
  /**
   * 切换自动刷新
   * @private
   */
  _toggleAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    if (this.autoRefresh) {
      this.refreshInterval = setInterval(() => {
        this._refreshLogs();
        
        if (this.statsVisible) {
          this._updateCategoryStats();
        }
      }, this.refreshRate);
      
      const autoRefreshLabel = document.querySelector('label[for="auto-refresh-logs"]');
      if (autoRefreshLabel) {
        const refreshRateSelect = document.getElementById('refresh-rate');
        const rate = refreshRateSelect ? refreshRateSelect.options[refreshRateSelect.selectedIndex].text : '2秒';
        autoRefreshLabel.textContent = `自动刷新 (${rate})`;
      }
    } else {
      const autoRefreshLabel = document.querySelector('label[for="auto-refresh-logs"]');
      if (autoRefreshLabel) {
        autoRefreshLabel.textContent = '自动刷新';
      }
    }
  }
  /**
   * 设置类别统计
   * @private
   */
  _setupCategoryStats() {
    const statsContainer = document.getElementById('log-stats-container');
    if (!statsContainer) return;
    
    const canvas = document.getElementById('stats-chart');
    if (!canvas) return;
    
    statsContainer.style.display = 'none';
  }
  
  /**
   * 切换统计视图
   * @private
   */
  _toggleStats() {
    const statsContainer = document.getElementById('log-stats-container');
    if (!statsContainer) return;
    
    this.statsVisible = !this.statsVisible;
    statsContainer.style.display = this.statsVisible ? 'block' : 'none';
    
    if (this.statsVisible) {
      this._updateCategoryStats();
    } else if (this.statsChart) {
      this.statsChart.destroy();
      this.statsChart = null;
    }
  }
  
  /**
   * 更新类别统计
   * @private
   */
  _updateCategoryStats() {
    if (!this.statsVisible) return;
    
    const canvas = document.getElementById('stats-chart');
    const summaryContainer = document.querySelector('.stats-summary');
    if (!canvas || !summaryContainer) return;
    
    const logs = loggingService.getLogs();
    if (logs.length === 0) {
      summaryContainer.innerHTML = '<p class="empty-stats">没有可用的日志数据</p>';
      if (this.statsChart) {
        this.statsChart.destroy();
        this.statsChart = null;
      }
      return;
    }
    
    const statsTypeSelect = document.getElementById('stats-type');
    const statsType = statsTypeSelect ? statsTypeSelect.value : 'category';
    
    let chartData;
    let chartType;
    let chartOptions;
    let summary;
    
    switch (statsType) {
      case 'level':
        ({ chartData, chartType, chartOptions, summary } = this._generateLevelStats(logs));
        break;
      case 'time':
        ({ chartData, chartType, chartOptions, summary } = this._generateTimeStats(logs));
        break;
      case 'category':
      default:
        ({ chartData, chartType, chartOptions, summary } = this._generateCategoryStats(logs));
        break;
    }
    
    if (this.statsChart) {
      this.statsChart.destroy();
    }
    
    this.statsChart = new Chart(canvas, {
      type: chartType,
      data: chartData,
      options: chartOptions
    });
    
    summaryContainer.innerHTML = summary;
  }
  
  /**
   * 生成类别统计数据
   * @private
   * @param {Array} logs - 日志数组
   * @returns {Object} - 图表数据和摘要
   */
  _generateCategoryStats(logs) {
    const categoryStats = {};
    const levelNames = ['调试', '信息', '警告', '错误'];
    const levelColors = [
      'rgba(75, 192, 192, 0.7)',  // 调试
      'rgba(54, 162, 235, 0.7)',  // 信息
      'rgba(255, 206, 86, 0.7)',  // 警告
      'rgba(255, 99, 132, 0.7)'   // 错误
    ];
    
    logs.forEach(log => {
      if (!categoryStats[log.category]) {
        categoryStats[log.category] = [0, 0, 0, 0]; // DEBUG, INFO, WARNING, ERROR
      }
      categoryStats[log.category][log.level]++;
    });
    
    const categories = Object.keys(categoryStats);
    const datasets = [];
    
    for (let level = 0; level < 4; level++) {
      datasets.push({
        label: levelNames[level],
        data: categories.map(category => categoryStats[category][level]),
        backgroundColor: levelColors[level],
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1
      });
    }
    
    const chartData = {
      labels: categories,
      datasets
    };
    
    const chartType = 'bar';
    
    const chartOptions = {
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
          text: '日志类别分布'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      }
    };
    
    let summary = '<div class="stats-summary-table">';
    summary += '<table><thead><tr><th>类别</th><th>总数</th><th>调试</th><th>信息</th><th>警告</th><th>错误</th></tr></thead><tbody>';
    
    categories.forEach(category => {
      const counts = categoryStats[category];
      const total = counts.reduce((a, b) => a + b, 0);
      
      summary += `<tr>
        <td>${category}</td>
        <td>${total}</td>
        <td>${counts[0]}</td>
        <td>${counts[1]}</td>
        <td>${counts[2]}</td>
        <td>${counts[3]}</td>
      </tr>`;
    });
    
    summary += '</tbody></table></div>';
    
    return { chartData, chartType, chartOptions, summary };
  }
  
  /**
   * 生成级别统计数据
   * @private
   * @param {Array} logs - 日志数组
   * @returns {Object} - 图表数据和摘要
   */
  _generateLevelStats(logs) {
    const levelCounts = [0, 0, 0, 0]; // DEBUG, INFO, WARNING, ERROR
    const levelNames = ['调试', '信息', '警告', '错误'];
    const levelColors = [
      'rgba(75, 192, 192, 0.7)',  // 调试
      'rgba(54, 162, 235, 0.7)',  // 信息
      'rgba(255, 206, 86, 0.7)',  // 警告
      'rgba(255, 99, 132, 0.7)'   // 错误
    ];
    
    logs.forEach(log => {
      levelCounts[log.level]++;
    });
    
    const chartData = {
      labels: levelNames,
      datasets: [{
        label: '日志数量',
        data: levelCounts,
        backgroundColor: levelColors,
        borderColor: 'rgba(0, 0, 0, 0.1)',
        borderWidth: 1
      }]
    };
    
    const chartType = 'pie';
    
    const chartOptions = {
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
    };
    
    let summary = '<div class="stats-summary-table">';
    summary += '<table><thead><tr><th>级别</th><th>数量</th><th>百分比</th></tr></thead><tbody>';
    
    const total = levelCounts.reduce((a, b) => a + b, 0);
    
    levelNames.forEach((name, index) => {
      const count = levelCounts[index];
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      
      summary += `<tr>
        <td>${name}</td>
        <td>${count}</td>
        <td>${percentage}%</td>
      </tr>`;
    });
    
    summary += '</tbody></table></div>';
    
    return { chartData, chartType, chartOptions, summary };
  }
  
  /**
   * 生成时间统计数据
   * @private
   * @param {Array} logs - 日志数组
   * @returns {Object} - 图表数据和摘要
   */
  _generateTimeStats(logs) {
    const timeGroups = {};
    const interval = 5 * 60 * 1000; // 5分钟间隔
    const levelNames = ['调试', '信息', '警告', '错误'];
    const levelColors = [
      'rgba(75, 192, 192, 0.7)',  // 调试
      'rgba(54, 162, 235, 0.7)',  // 信息
      'rgba(255, 206, 86, 0.7)',  // 警告
      'rgba(255, 99, 132, 0.7)'   // 错误
    ];
    
    logs.forEach(log => {
      const timeGroup = Math.floor(log.timestamp / interval) * interval;
      
      if (!timeGroups[timeGroup]) {
        timeGroups[timeGroup] = [0, 0, 0, 0]; // DEBUG, INFO, WARNING, ERROR
      }
      
      timeGroups[timeGroup][log.level]++;
    });
    
    const sortedTimes = Object.keys(timeGroups).sort((a, b) => parseInt(a) - parseInt(b));
    
    const labels = sortedTimes.map(time => 
      new Date(parseInt(time)).toLocaleTimeString()
    );
    
    const datasets = [
      {
        label: '错误',
        data: sortedTimes.map(time => timeGroups[time][LogLevel.ERROR]),
        backgroundColor: levelColors[3],
        borderColor: levelColors[3],
        borderWidth: 1
      },
      {
        label: '警告',
        data: sortedTimes.map(time => timeGroups[time][LogLevel.WARNING]),
        backgroundColor: levelColors[2],
        borderColor: levelColors[2],
        borderWidth: 1
      },
      {
        label: '信息',
        data: sortedTimes.map(time => timeGroups[time][LogLevel.INFO]),
        backgroundColor: levelColors[1],
        borderColor: levelColors[1],
        borderWidth: 1
      },
      {
        label: '调试',
        data: sortedTimes.map(time => timeGroups[time][LogLevel.DEBUG]),
        backgroundColor: levelColors[0],
        borderColor: levelColors[0],
        borderWidth: 1
      }
    ];
    
    const chartData = {
      labels,
      datasets
    };
    
    const chartType = 'line';
    
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          stacked: true,
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
          text: '日志时间分布'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      }
    };
    
    let summary = '<div class="stats-summary-table">';
    summary += '<table><thead><tr><th>时间</th><th>总数</th><th>调试</th><th>信息</th><th>警告</th><th>错误</th></tr></thead><tbody>';
    
    sortedTimes.forEach(time => {
      const counts = timeGroups[time];
      const total = counts.reduce((a, b) => a + b, 0);
      const timeString = new Date(parseInt(time)).toLocaleTimeString();
      
      summary += `<tr>
        <td>${timeString}</td>
        <td>${total}</td>
        <td>${counts[0]}</td>
        <td>${counts[1]}</td>
        <td>${counts[2]}</td>
        <td>${counts[3]}</td>
      </tr>`;
    });
    
    summary += '</tbody></table></div>';
    
    return { chartData, chartType, chartOptions, summary };
  }

  
  /**
   * 更新日志计数
   * @private
   */
  _updateLogCount() {
    if (!this.logViewer) return;
    
    const logCountElement = document.getElementById('log-count');
    if (!logCountElement) return;
    
    const logs = loggingService.getLogs();
    const total = logs.length;
    
    const count = logs.filter(log => {
      if (this.logViewer.filters.level !== undefined && log.level < this.logViewer.filters.level) {
        return false;
      }
      
      if (this.logViewer.filters.category && log.category !== this.logViewer.filters.category) {
        return false;
      }
      
      if (this.logViewer.filters.search) {
        const searchLower = this.logViewer.filters.search.toLowerCase();
        const messageMatch = log.message.toLowerCase().includes(searchLower);
        const dataMatch = log.data ? JSON.stringify(log.data).toLowerCase().includes(searchLower) : false;
        
        if (!messageMatch && !dataMatch) {
          return false;
        }
      }
      
      return true;
    }).length;
    
    if (count === total) {
      logCountElement.textContent = `${total} 条日志`;
    } else {
      logCountElement.textContent = `显示 ${count}/${total} 条日志`;
    }
  }
  
  /**
   * 更新过滤器状态
   * @private
   * @param {number} level - 日志级别
   * @param {string} category - 日志类别
   */
  _updateFilterStatus(level, category) {
    const filterStatusElement = document.getElementById('log-filter-status');
    if (!filterStatusElement) return;
    
    const levelNames = {
      [LogLevel.DEBUG]: '调试',
      [LogLevel.INFO]: '信息',
      [LogLevel.WARNING]: '警告',
      [LogLevel.ERROR]: '错误'
    };
    
    const categoryNames = {
      [LogCategory.APP]: '应用',
      [LogCategory.DETECTION]: '检测',
      [LogCategory.DOWNLOAD]: '下载',
      [LogCategory.RESOURCE]: '资源',
      [LogCategory.NETWORK]: '网络',
      [LogCategory.UI]: '界面',
      [LogCategory.WORKER]: '工作线程'
    };
    
    let statusText = `过滤: ${levelNames[level] || '全部'}`;
    
    if (category) {
      statusText += ` | ${categoryNames[category] || category}`;
    }
    
    filterStatusElement.textContent = statusText;
  }
  
  /**
   * 更新最后更新时间
   * @private
   */
  _updateLastUpdated() {
    const lastUpdatedElement = document.getElementById('log-last-updated');
    if (!lastUpdatedElement) return;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    
    lastUpdatedElement.textContent = `更新于 ${timeString}`;
  }
  
  /**
   * 显示提示消息
   * @private
   * @param {string} message - 消息内容
   * @param {string} type - 消息类型
   */
  _showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }
  
  /**
   * 显示日志标签页
   */
  show() {
    if (!this.isInitialized) {
      this.initialize();
    }
    
    this.container.style.display = 'block';
    this.isVisible = true;
    
    this._refreshLogs();
    
    if (this.autoRefresh) {
      this._toggleAutoRefresh();
    }
  }
  
  /**
   * 隐藏日志标签页
   */
  hide() {
    this.container.style.display = 'none';
    this.isVisible = false;
    
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
  
  /**
   * 切换日志标签页显示状态
   * @returns {boolean} - 是否显示
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
    
    return this.isVisible;
  }
}
