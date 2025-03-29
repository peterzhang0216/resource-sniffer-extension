/**
 * @file log-tab.js
 * @description 日志标签页组件，用于在弹出窗口中显示日志
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import loggingService, { LogLevel, LogCategory } from '../services/logging-service.js';
import LogViewer from './log-viewer.js';

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
  }
  
  /**
   * 初始化日志标签页
   */
  initialize() {
    if (this.isInitialized) return;
    
    this._renderLogTab();
    this._setupLogViewer();
    this._setupEventListeners();
    
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
              <input type="text" id="log-search" placeholder="搜索日志...">
              <button id="search-logs" class="control-button">
                <span class="icon">🔍</span>
              </button>
            </div>
            
            <div class="auto-refresh-toggle">
              <input type="checkbox" id="auto-refresh-logs" ${this.autoRefresh ? 'checked' : ''}>
              <label for="auto-refresh-logs">自动刷新</label>
            </div>
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
    }
    
    const autoRefreshToggle = document.getElementById('auto-refresh-logs');
    if (autoRefreshToggle) {
      autoRefreshToggle.addEventListener('change', (e) => {
        this.autoRefresh = e.target.checked;
        this._toggleAutoRefresh();
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
    
    this.logViewer.filters.search = query || '';
    this.logViewer.refresh();
    this._updateLogCount();
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
      }, this.refreshRate);
    }
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
