/**
 * @file monitoring-dashboard.js
 * @description 监控面板组件，用于显示资源检测和下载状态
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import monitoringService from '../services/monitoring-service.js';

/**
 * 监控面板组件
 * @class MonitoringDashboard
 */
class MonitoringDashboard {
  /**
   * 创建监控面板组件
   * @param {HTMLElement} container - 容器元素
   * @param {Object} options - 配置选项
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      refreshInterval: options.refreshInterval || 1000,
      showCharts: options.showCharts !== false,
      showResourceStats: options.showResourceStats !== false,
      showPerformance: options.showPerformance !== false,
      showErrors: options.showErrors !== false,
      maxErrors: options.maxErrors || 5,
      ...options
    };
    
    this.refreshTimer = null;
    this.isInitialized = false;
    
    this.init();
  }
  
  /**
   * 初始化面板
   * @private
   */
  init() {
    if (!this.container) return;
    
    this.container.innerHTML = `
      <div class="monitoring-header">
        <h3>资源监控面板</h3>
        <div class="monitoring-controls">
          <button class="start-monitoring-btn">开始监控</button>
          <button class="stop-monitoring-btn" disabled>停止监控</button>
          <button class="clear-stats-btn">清除统计</button>
        </div>
        <div class="monitoring-status">
          <span class="status-indicator"></span>
          <span class="status-text">未监控</span>
        </div>
      </div>
      
      <div class="monitoring-body">
        <div class="monitoring-section resource-stats">
          <h4>资源统计</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">检测资源总数</div>
              <div class="stat-value" data-stat="resourceDetection.total">0</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">分析资源总数</div>
              <div class="stat-value" data-stat="resourceAnalysis.total">0</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">下载资源总数</div>
              <div class="stat-value" data-stat="resourceDownload.total">0</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">下载完成数</div>
              <div class="stat-value" data-stat="resourceDownload.completed">0</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">下载失败数</div>
              <div class="stat-value" data-stat="resourceDownload.failed">0</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">下载进行中</div>
              <div class="stat-value" data-stat="resourceDownload.inProgress">0</div>
            </div>
          </div>
          
          <div class="resource-type-stats">
            <h5>资源类型统计</h5>
            <div class="type-stats-container"></div>
          </div>
        </div>
        
        <div class="monitoring-section performance-stats">
          <h4>性能统计</h4>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">检测速率</div>
              <div class="stat-value" data-stat="resourceDetection.rate">0</div>
              <div class="stat-unit">资源/秒</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">分析速率</div>
              <div class="stat-value" data-stat="resourceAnalysis.rate">0</div>
              <div class="stat-unit">资源/秒</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">下载速率</div>
              <div class="stat-value" data-stat="resourceDownload.rate">0</div>
              <div class="stat-unit">KB/秒</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">网络请求数</div>
              <div class="stat-value" data-stat="performance.networkRequests">0</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">缓存命中数</div>
              <div class="stat-value" data-stat="performance.cacheHits">0</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">缓存未命中数</div>
              <div class="stat-value" data-stat="performance.cacheMisses">0</div>
            </div>
          </div>
          
          <div class="performance-charts">
            <div class="chart-container memory-chart">
              <h5>内存使用</h5>
              <canvas id="memory-chart"></canvas>
            </div>
          </div>
        </div>
        
        <div class="monitoring-section error-stats">
          <h4>错误统计</h4>
          <div class="error-list"></div>
        </div>
      </div>
    `;
    
    this.bindEvents();
    
    this.isInitialized = true;
    
    this.refresh();
  }
  
  /**
   * 绑定事件
   * @private
   */
  bindEvents() {
    const startBtn = this.container.querySelector('.start-monitoring-btn');
    const stopBtn = this.container.querySelector('.stop-monitoring-btn');
    const clearBtn = this.container.querySelector('.clear-stats-btn');
    
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        this.startMonitoring();
      });
    }
    
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.stopMonitoring();
      });
    }
    
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearStats();
      });
    }
  }
  
  /**
   * 开始监控
   */
  startMonitoring() {
    if (!this.isInitialized) return;
    
    monitoringService.startMonitoring();
    
    this.updateMonitoringStatus(true);
    
    this.startRefreshTimer();
  }
  
  /**
   * 停止监控
   */
  stopMonitoring() {
    if (!this.isInitialized) return;
    
    monitoringService.stopMonitoring();
    
    this.updateMonitoringStatus(false);
    
    this.stopRefreshTimer();
    
    this.refresh();
  }
  
  /**
   * 清除统计
   */
  clearStats() {
    if (!this.isInitialized) return;
    
    if (monitoringService.isMonitoring) {
      monitoringService.stopMonitoring();
      monitoringService.startMonitoring();
    }
    
    this.refresh();
  }
  
  /**
   * 更新监控状态
   * @private
   * @param {boolean} isMonitoring - 是否正在监控
   */
  updateMonitoringStatus(isMonitoring) {
    const statusIndicator = this.container.querySelector('.status-indicator');
    const statusText = this.container.querySelector('.status-text');
    const startBtn = this.container.querySelector('.start-monitoring-btn');
    const stopBtn = this.container.querySelector('.stop-monitoring-btn');
    
    if (statusIndicator) {
      statusIndicator.className = 'status-indicator ' + (isMonitoring ? 'active' : 'inactive');
    }
    
    if (statusText) {
      statusText.textContent = isMonitoring ? '监控中' : '未监控';
    }
    
    if (startBtn) {
      startBtn.disabled = isMonitoring;
    }
    
    if (stopBtn) {
      stopBtn.disabled = !isMonitoring;
    }
  }
  
  /**
   * 启动刷新定时器
   * @private
   */
  startRefreshTimer() {
    this.stopRefreshTimer();
    
    this.refreshTimer = setInterval(() => {
      this.refresh();
    }, this.options.refreshInterval);
  }
  
  /**
   * 停止刷新定时器
   * @private
   */
  stopRefreshTimer() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
  
  /**
   * 刷新面板
   */
  refresh() {
    if (!this.isInitialized) return;
    
    const metrics = monitoringService.getMetrics();
    
    this.updateMonitoringStatus(metrics.isMonitoring);
    
    this.updateStatValues(metrics);
    
    this.updateTypeStats(metrics);
    
    this.updateErrorList(metrics.errors);
    
    if (this.options.showCharts) {
      this.updateCharts(metrics);
    }
  }
  
  /**
   * 更新统计值
   * @private
   * @param {Object} metrics - 监控指标
   */
  updateStatValues(metrics) {
    const statElements = this.container.querySelectorAll('[data-stat]');
    
    statElements.forEach(element => {
      const statPath = element.getAttribute('data-stat');
      const value = this.getNestedValue(metrics, statPath);
      
      if (statPath.endsWith('.rate')) {
        element.textContent = value ? value.toFixed(2) : '0';
      } else {
        element.textContent = value || '0';
      }
    });
  }
  
  /**
   * 获取嵌套对象的值
   * @private
   * @param {Object} obj - 对象
   * @param {string} path - 路径
   * @returns {*} 值
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((prev, curr) => {
      return prev && prev[curr] !== undefined ? prev[curr] : null;
    }, obj);
  }
  
  /**
   * 更新资源类型统计
   * @private
   * @param {Object} metrics - 监控指标
   */
  updateTypeStats(metrics) {
    const container = this.container.querySelector('.type-stats-container');
    if (!container) return;
    
    const typeStats = {};
    
    if (metrics.resourceDetection && metrics.resourceDetection.byType) {
      Object.entries(metrics.resourceDetection.byType).forEach(([type, count]) => {
        typeStats[type] = typeStats[type] || {};
        typeStats[type].detected = count;
      });
    }
    
    if (metrics.resourceAnalysis && metrics.resourceAnalysis.byType) {
      Object.entries(metrics.resourceAnalysis.byType).forEach(([type, count]) => {
        typeStats[type] = typeStats[type] || {};
        typeStats[type].analyzed = count;
      });
    }
    
    if (metrics.resourceDownload && metrics.resourceDownload.byType) {
      Object.entries(metrics.resourceDownload.byType).forEach(([type, count]) => {
        typeStats[type] = typeStats[type] || {};
        typeStats[type].downloaded = count;
      });
    }
    
    let html = '';
    
    Object.entries(typeStats).forEach(([type, stats]) => {
      html += `
        <div class="type-stat-item">
          <div class="type-name">${type}</div>
          <div class="type-values">
            <span class="detected" title="检测数">检测: ${stats.detected || 0}</span>
            <span class="analyzed" title="分析数">分析: ${stats.analyzed || 0}</span>
            <span class="downloaded" title="下载数">下载: ${stats.downloaded || 0}</span>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html || '<div class="no-data">暂无数据</div>';
  }
  
  /**
   * 更新错误列表
   * @private
   * @param {Array} errors - 错误数组
   */
  updateErrorList(errors) {
    const container = this.container.querySelector('.error-list');
    if (!container) return;
    
    if (!errors || !errors.length) {
      container.innerHTML = '<div class="no-errors">暂无错误</div>';
      return;
    }
    
    const displayErrors = errors.slice(-this.options.maxErrors);
    
    let html = '';
    
    displayErrors.forEach(error => {
      const time = new Date(error.timestamp).toLocaleTimeString();
      html += `
        <div class="error-item">
          <div class="error-time">${time}</div>
          <div class="error-type">${error.type || 'error'}</div>
          <div class="error-message">${error.message || '未知错误'}</div>
        </div>
      `;
    });
    
    container.innerHTML = html;
  }
  
  /**
   * 更新图表
   * @private
   * @param {Object} metrics - 监控指标
   */
  updateCharts(metrics) {
    this.updateMemoryChart(metrics.performance.memoryUsage);
  }
  
  /**
   * 更新内存使用图表
   * @private
   * @param {Array} memoryData - 内存使用数据
   */
  updateMemoryChart(memoryData) {
    const canvas = this.container.querySelector('#memory-chart');
    if (!canvas || !memoryData || !memoryData.length) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#1a73e8';
    ctx.lineWidth = 2;
    
    const values = memoryData.map(item => item.usedJSHeapSize);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue || 1;
    
    ctx.beginPath();
    memoryData.forEach((item, index) => {
      const x = (index / (memoryData.length - 1)) * canvas.width;
      const y = canvas.height - ((item.usedJSHeapSize - minValue) / range) * canvas.height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  }
  
  /**
   * 销毁组件
   */
  destroy() {
    this.stopRefreshTimer();
    
    if (this.container) {
      this.container.innerHTML = '';
    }
    
    this.isInitialized = false;
  }
}

export default MonitoringDashboard;
