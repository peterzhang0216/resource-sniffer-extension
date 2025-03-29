/**
 * @file download-history.js
 * @description 下载历史组件，负责显示和管理资源下载历史
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES } from '../config/constants.js';

/**
 * 下载历史组件类
 * @class DownloadHistory
 */
class DownloadHistory {
  /**
   * 创建下载历史组件
   * @param {string} containerId - 容器元素ID
   * @param {Object} downloadService - 下载服务实例
   */
  constructor(containerId, downloadService) {
    this.container = document.getElementById(containerId);
    this.downloadService = downloadService;
    this.historyItems = [];
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.totalPages = 1;
  }
  
  /**
   * 初始化组件
   */
  initialize() {
    if (!this.container) {
      console.error('下载历史容器未找到');
      return;
    }
    
    this._renderHistoryContainer();
    this._setupEventListeners();
    this.loadHistory();
    console.log('下载历史组件已初始化');
  }
  
  /**
   * 渲染历史容器
   * @private
   */
  _renderHistoryContainer() {
    this.container.innerHTML = `
      <div class="history-header">
        <h2>下载历史</h2>
        <div class="history-actions">
          <button id="refresh-history" title="刷新历史">🔄</button>
          <button id="clear-history" title="清空历史">🗑️</button>
        </div>
      </div>
      <div class="history-content">
        <div id="history-list" class="history-list"></div>
        <div id="history-empty" class="history-empty">暂无下载历史</div>
      </div>
      <div class="history-pagination">
        <button id="prev-page" disabled>上一页</button>
        <span id="page-info">第 1 页 / 共 1 页</span>
        <button id="next-page" disabled>下一页</button>
      </div>
    `;
  }
  
  /**
   * 设置事件监听器
   * @private
   */
  _setupEventListeners() {
    const refreshBtn = document.getElementById('refresh-history');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadHistory();
      });
    }
    
    const clearBtn = document.getElementById('clear-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._confirmClearHistory();
      });
    }
    
    const prevPageBtn = document.getElementById('prev-page');
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this._renderHistoryPage();
        }
      });
    }
    
    const nextPageBtn = document.getElementById('next-page');
    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          this._renderHistoryPage();
        }
      });
    }
  }
  
  /**
   * 加载下载历史
   */
  loadHistory() {
    if (!this.downloadService) {
      console.error('下载服务未初始化');
      return;
    }
    
    this.downloadService.getDownloadHistory()
      .then(history => {
        this.historyItems = history || [];
        this._calculatePagination();
        this._renderHistoryPage();
      })
      .catch(error => {
        console.error('加载下载历史错误:', error);
        this._showError('加载下载历史失败');
      });
  }
  
  /**
   * 计算分页
   * @private
   */
  _calculatePagination() {
    this.totalPages = Math.max(1, Math.ceil(this.historyItems.length / this.itemsPerPage));
    this.currentPage = Math.min(this.currentPage, this.totalPages);
    
    const pageInfo = document.getElementById('page-info');
    if (pageInfo) {
      pageInfo.textContent = `第 ${this.currentPage} 页 / 共 ${this.totalPages} 页`;
    }
    
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    
    if (prevPageBtn) {
      prevPageBtn.disabled = this.currentPage <= 1;
    }
    
    if (nextPageBtn) {
      nextPageBtn.disabled = this.currentPage >= this.totalPages;
    }
  }
  
  /**
   * 渲染历史页面
   * @private
   */
  _renderHistoryPage() {
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');
    
    if (!historyList || !historyEmpty) return;
    
    if (this.historyItems.length === 0) {
      historyList.style.display = 'none';
      historyEmpty.style.display = 'block';
      return;
    }
    
    historyList.style.display = 'block';
    historyEmpty.style.display = 'none';
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = Math.min(startIndex + this.itemsPerPage, this.historyItems.length);
    const pageItems = this.historyItems.slice(startIndex, endIndex);
    
    historyList.innerHTML = '';
    
    pageItems.forEach(item => {
      const historyItem = this._createHistoryItem(item);
      historyList.appendChild(historyItem);
    });
    
    this._calculatePagination();
  }
  
  /**
   * 创建历史项目元素
   * @param {Object} item - 历史项目对象
   * @returns {HTMLElement} - 历史项目元素
   * @private
   */
  _createHistoryItem(item) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.dataset.id = item.id;
    
    let thumbnailHtml = '';
    if (item.resource.type === RESOURCE_TYPES.IMAGE) {
      thumbnailHtml = `<div class="history-thumbnail">
        <img src="${item.resource.url}" class="thumbnail" alt="Thumbnail" loading="lazy">
      </div>`;
    } else if (item.resource.type === RESOURCE_TYPES.VIDEO) {
      const posterAttr = item.resource.thumbnailUrl ? `poster="${item.resource.thumbnailUrl}"` : '';
      thumbnailHtml = `<div class="history-thumbnail video-thumbnail">
        <video width="40" height="40" preload="metadata" ${posterAttr} loading="lazy">
          <source src="${item.resource.url}" type="${item.resource.contentType || 'video/mp4'}">
        </video>
        <div class="play-icon">▶</div>
      </div>`;
    } else if (item.resource.type === RESOURCE_TYPES.AUDIO) {
      thumbnailHtml = `<div class="history-thumbnail audio-thumbnail">
        <div class="audio-icon">🔊</div>
      </div>`;
    } else {
      thumbnailHtml = `<div class="history-thumbnail other-thumbnail">
        <div class="file-icon">📄</div>
      </div>`;
    }
    
    const statusClass = item.status === 'completed' ? 'success' : 
                        (item.status === 'failed' ? 'error' : 
                        (item.status === 'canceled' ? 'warning' : 'info'));
    
    const statusText = item.status === 'completed' ? '已完成' : 
                       (item.status === 'failed' ? '失败' : 
                       (item.status === 'canceled' ? '已取消' : 
                       (item.status === 'in_progress' ? '下载中' : 
                       (item.status === 'paused' ? '已暂停' : '未知'))));
    
    const timestamp = new Date(item.timestamp).toLocaleString();
    
    historyItem.innerHTML = `
      ${thumbnailHtml}
      <div class="history-info">
        <div class="history-name" title="${item.resource.filename || ''}">${item.resource.filename || '未命名资源'}</div>
        <div class="history-details">
          <span class="history-type">${item.resource.contentType || item.resource.type || '未知类型'}</span>
          <span class="history-size">${item.resource.sizeFormatted || '未知大小'}</span>
        </div>
        <div class="history-meta">
          <span class="history-time">${timestamp}</span>
          <span class="history-status ${statusClass}">${statusText}</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="redownload-btn" data-id="${item.id}" title="重新下载">
          <span class="icon">🔄</span>
        </button>
        <button class="delete-history-btn" data-id="${item.id}" title="删除记录">
          <span class="icon">🗑️</span>
        </button>
      </div>
    `;
    
    this._setupHistoryItemEvents(historyItem, item);
    
    return historyItem;
  }
  
  /**
   * 设置历史项目事件
   * @param {HTMLElement} historyItem - 历史项目元素
   * @param {Object} item - 历史项目对象
   * @private
   */
  _setupHistoryItemEvents(historyItem, item) {
    const redownloadBtn = historyItem.querySelector('.redownload-btn');
    if (redownloadBtn) {
      redownloadBtn.addEventListener('click', () => {
        this._redownloadItem(item);
      });
    }
    
    const deleteBtn = historyItem.querySelector('.delete-history-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        this._deleteHistoryItem(item.id);
      });
    }
    
    const thumbnail = historyItem.querySelector('.history-thumbnail');
    if (thumbnail) {
      thumbnail.addEventListener('click', () => {
        this._openPreviewModal(item.resource);
      });
    }
  }
  
  /**
   * 重新下载项目
   * @param {Object} item - 历史项目对象
   * @private
   */
  _redownloadItem(item) {
    if (!this.downloadService) return;
    
    this.downloadService.download(item.resource)
      .then(result => {
        console.log('重新下载结果:', result);
        this._showToast(`已添加到下载队列: ${item.resource.filename || '资源'}`);
      })
      .catch(error => {
        console.error('重新下载错误:', error);
        this._showToast(`下载失败: ${error.message || '未知错误'}`, 'error');
      });
  }
  
  /**
   * 删除历史项目
   * @param {string} id - 历史项目ID
   * @private
   */
  _deleteHistoryItem(id) {
    if (!this.downloadService) return;
    
    this.downloadService.removeDownloadHistoryItem(id)
      .then(() => {
        this.historyItems = this.historyItems.filter(item => item.id !== id);
        
        this._calculatePagination();
        this._renderHistoryPage();
        
        this._showToast('已删除下载记录');
      })
      .catch(error => {
        console.error('删除下载记录错误:', error);
        this._showToast(`删除失败: ${error.message || '未知错误'}`, 'error');
      });
  }
  
  /**
   * 确认清空历史
   * @private
   */
  _confirmClearHistory() {
    if (this.historyItems.length === 0) {
      this._showToast('没有历史记录可清空');
      return;
    }
    
    const confirmed = window.confirm('确定要清空所有下载历史记录吗？此操作不可撤销。');
    
    if (confirmed) {
      this._clearHistory();
    }
  }
  
  /**
   * 清空历史
   * @private
   */
  _clearHistory() {
    if (!this.downloadService) return;
    
    this.downloadService.clearDownloadHistory()
      .then(() => {
        this.historyItems = [];
        
        this._calculatePagination();
        this._renderHistoryPage();
        
        this._showToast('已清空下载历史');
      })
      .catch(error => {
        console.error('清空下载历史错误:', error);
        this._showToast(`清空失败: ${error.message || '未知错误'}`, 'error');
      });
  }
  
  /**
   * 打开预览模态框
   * @param {Object} resource - 资源对象
   * @private
   */
  _openPreviewModal(resource) {
    if (!resource || !resource.url) return;
    
    const event = new CustomEvent('preview-resource', {
      detail: { resource }
    });
    
    document.dispatchEvent(event);
  }
  
  /**
   * 显示错误消息
   * @param {string} message - 错误消息
   * @private
   */
  _showError(message) {
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');
    
    if (!historyList || !historyEmpty) return;
    
    historyList.style.display = 'none';
    historyEmpty.style.display = 'block';
    historyEmpty.innerHTML = `<div class="error-message">${message}</div>`;
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
}

export default DownloadHistory;
