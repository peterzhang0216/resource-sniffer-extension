/**
 * @file popup-main.js
 * @description 弹出窗口主入口文件，负责初始化和协调各个组件
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import ResourceList from '../components/resource-list.js';
import FilterBar from '../components/filter-bar.js';
import DownloadHistory from '../components/download-history.js';
import SettingsPanel from '../components/settings-panel.js';
import PreviewModal from '../components/preview-modal.js';
import { LogTab } from '../components/log-tab.js';
import ResourceService from '../services/resource-service.js';
import DownloadService from '../services/download-service.js';
import StorageService from '../services/storage-service.js';
import loggingService from '../services/logging-service.js';
import appStateLogger from '../services/app-state-logger.js';
import downloadLogger from '../services/download-logger.js';
import { MESSAGE_ACTIONS } from '../config/constants.js';

/**
 * 弹出窗口主类
 * @class PopupMain
 */
class PopupMain {
  /**
   * 创建弹出窗口主实例
   */
  constructor() {
    this.currentTab = null;
    this.storageService = new StorageService();
    this.resourceService = new ResourceService(this.storageService);
    this.downloadService = new DownloadService(this.storageService);
    
    this.components = {};
    
    this.initialize();
  }
  
  /**
   * 初始化弹出窗口
   */
  async initialize() {
    try {
      await this.storageService.initialize();
      
      await this._getCurrentTab();
      
      this._initializeComponents();
      
      this._setupEventListeners();
      
      this._loadResources();
      
      console.log('Resource Sniffer 弹出窗口已初始化');
    } catch (e) {
      console.error('初始化弹出窗口错误:', e);
      this._showError('初始化失败: ' + e.message);
    }
  }
  
  /**
   * 获取当前标签页
   * @private
   */
  async _getCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tabs && tabs.length > 0) {
        this.currentTab = tabs[0];
        console.log('当前标签页:', this.currentTab);
      } else {
        throw new Error('无法获取当前标签页');
      }
    } catch (e) {
      console.error('获取当前标签页错误:', e);
      throw e;
    }
  }
  
  /**
   * 初始化组件
   * @private
   */
  _initializeComponents() {
    try {
      this.components.filterBar = new FilterBar(
        'filter-bar-container',
        this.storageService
      );
      this.components.filterBar.initialize();
      
      this.components.resourceList = new ResourceList(
        'resources-list',
        this.resourceService,
        this.downloadService,
        this.components.filterBar
      );
      this.components.resourceList.initialize();
      
      this.components.downloadHistory = new DownloadHistory(
        'download-history-container',
        this.downloadService,
        this.storageService
      );
      this.components.downloadHistory.initialize();
      
      this.components.settingsPanel = new SettingsPanel(
        'settings-panel-container',
        this.storageService
      );
      this.components.settingsPanel.initialize();
      
      this.components.previewModal = new PreviewModal(
        'preview-modal-container',
        this.downloadService
      );
      this.components.previewModal.initialize();
      
      this.components.logTab = new LogTab(
        document.getElementById('log-tab-container')
      );
      this.components.logTab.initialize();
      
      appStateLogger.logExtensionStartup();
      
      console.log('所有组件已初始化');
    } catch (e) {
      console.error('初始化组件错误:', e);
      throw e;
    }
  }
  
  /**
   * 设置事件监听器
   * @private
   */
  _setupEventListeners() {
    try {
      const tabButtons = document.querySelectorAll('.tab-button');
      tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          this._switchTab(button.dataset.tab);
        });
      });
      
      const refreshBtn = document.getElementById('refresh-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          this._loadResources(true);
        });
      }
      
      const settingsBtn = document.getElementById('settings-btn');
      if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
          this.components.settingsPanel.toggle();
        });
      }
      
      const detectResourcesBtn = document.getElementById('detect-resources-btn');
      if (detectResourcesBtn) {
        detectResourcesBtn.addEventListener('click', () => {
          this._detectResources();
        });
      }
      
      const refreshStatsBtn = document.getElementById('refresh-stats-btn');
      if (refreshStatsBtn) {
        refreshStatsBtn.addEventListener('click', () => {
          this._loadResourceStats();
        });
      }
      
      console.log('事件监听器已设置');
    } catch (e) {
      console.error('设置事件监听器错误:', e);
      throw e;
    }
  }
  
  /**
   * 切换标签
   * @param {string} tabId - 标签ID
   * @private
   */
  _switchTab(tabId) {
    try {
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      
      const tabButtons = document.querySelectorAll('.tab-button');
      tabButtons.forEach(button => {
        button.classList.remove('active');
      });
      
      const selectedTab = document.getElementById(tabId);
      if (selectedTab) {
        selectedTab.classList.add('active');
      }
      
      const selectedButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
      if (selectedButton) {
        selectedButton.classList.add('active');
      }
      
      if (tabId === 'history-tab') {
        this.components.downloadHistory.loadHistory();
      } else if (tabId === 'stats-tab') {
        this._loadResourceStats();
      } else if (tabId === 'logs-tab') {
        this.components.logTab.show();
        
        appStateLogger.logUserInteraction('view_logs', {
          tabId: this.currentTab?.id,
          url: this.currentTab?.url
        });
      } else {
        if (this.components.logTab) {
          this.components.logTab.hide();
        }
      }
    } catch (e) {
      console.error('切换标签错误:', e);
    }
  }
  
  /**
   * 加载资源
   * @param {boolean} forceRefresh - 是否强制刷新
   * @private
   */
  async _loadResources(forceRefresh = false) {
    try {
      if (!this.currentTab || !this.currentTab.id) {
        throw new Error('无效的标签页');
      }
      
      const tabId = this.currentTab.id.toString();
      
      const resourcesList = document.getElementById('resources-list');
      if (resourcesList) {
        resourcesList.innerHTML = '<div class="loading">正在加载资源...</div>';
      }
      
      const noResources = document.getElementById('no-resources');
      if (noResources) {
        noResources.style.display = 'none';
      }
      
      chrome.runtime.sendMessage({
        action: MESSAGE_ACTIONS.GET_RESOURCES,
        tabId: tabId,
        forceRefresh: forceRefresh
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('获取资源错误:', chrome.runtime.lastError);
          this._showError('获取资源失败: ' + chrome.runtime.lastError.message);
          return;
        }
        
        if (!response || !response.success) {
          console.error('获取资源失败:', response ? response.error : '未知错误');
          this._showError('获取资源失败: ' + (response ? response.error : '未知错误'));
          return;
        }
        
        const resources = response.resources || [];
        
        const resourceCount = document.getElementById('resource-count');
        if (resourceCount) {
          resourceCount.textContent = resources.length;
        }
        
        this.components.resourceList.updateResources(resources);
        
        if (resources.length === 0) {
          if (noResources) {
            noResources.style.display = 'block';
          }
        }
        
        console.log('已加载资源:', resources.length);
      });
    } catch (e) {
      console.error('加载资源错误:', e);
      this._showError('加载资源失败: ' + e.message);
    }
  }
  
  /**
   * 检测资源
   * @private
   */
  async _detectResources() {
    try {
      if (!this.currentTab || !this.currentTab.id) {
        throw new Error('无效的标签页');
      }
      
      const resourcesList = document.getElementById('resources-list');
      if (resourcesList) {
        resourcesList.innerHTML = '<div class="loading">正在检测资源...</div>';
      }
      
      const noResources = document.getElementById('no-resources');
      if (noResources) {
        noResources.style.display = 'none';
      }
      
      chrome.tabs.sendMessage(this.currentTab.id, {
        action: MESSAGE_ACTIONS.DETECT_RESOURCES
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('检测资源错误:', chrome.runtime.lastError);
          this._showError('检测资源失败: ' + chrome.runtime.lastError.message);
          return;
        }
        
        if (!response || !response.success) {
          console.error('检测资源失败:', response ? response.error : '未知错误');
          this._showError('检测资源失败: ' + (response ? response.error : '未知错误'));
          return;
        }
        
        this._loadResources(true);
        
        console.log('资源检测已完成');
      });
    } catch (e) {
      console.error('检测资源错误:', e);
      this._showError('检测资源失败: ' + e.message);
    }
  }
  
  /**
   * 加载资源统计
   * @private
   */
  async _loadResourceStats() {
    try {
      if (!this.currentTab || !this.currentTab.id) {
        throw new Error('无效的标签页');
      }
      
      const tabId = this.currentTab.id.toString();
      
      chrome.runtime.sendMessage({
        action: MESSAGE_ACTIONS.GET_RESOURCE_STATS,
        tabId: tabId
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('获取资源统计错误:', chrome.runtime.lastError);
          this._showError('获取资源统计失败: ' + chrome.runtime.lastError.message);
          return;
        }
        
        if (!response || !response.success) {
          console.error('获取资源统计失败:', response ? response.error : '未知错误');
          this._showError('获取资源统计失败: ' + (response ? response.error : '未知错误'));
          return;
        }
        
        const stats = response.stats || {};
        
        const imageCount = document.getElementById('image-count');
        if (imageCount) {
          imageCount.textContent = stats.typeCounts?.image || 0;
        }
        
        const videoCount = document.getElementById('video-count');
        if (videoCount) {
          videoCount.textContent = stats.typeCounts?.video || 0;
        }
        
        const audioCount = document.getElementById('audio-count');
        if (audioCount) {
          audioCount.textContent = stats.typeCounts?.audio || 0;
        }
        
        const otherCount = document.getElementById('other-count');
        if (otherCount) {
          otherCount.textContent = stats.typeCounts?.other || 0;
        }
        
        const totalSize = document.getElementById('total-size');
        if (totalSize) {
          totalSize.textContent = stats.sizeStats?.totalFormatted || '0 B';
        }
        
        const avgSize = document.getElementById('avg-size');
        if (avgSize) {
          avgSize.textContent = stats.sizeStats?.averageFormatted || '0 B';
        }
        
        const maxSize = document.getElementById('max-size');
        if (maxSize) {
          maxSize.textContent = stats.sizeStats?.maxFormatted || '0 B';
        }
        
        const highQualityCount = document.getElementById('high-quality-count');
        if (highQualityCount) {
          highQualityCount.textContent = stats.qualityCounts?.high || 0;
        }
        
        const mediumQualityCount = document.getElementById('medium-quality-count');
        if (mediumQualityCount) {
          mediumQualityCount.textContent = stats.qualityCounts?.medium || 0;
        }
        
        const lowQualityCount = document.getElementById('low-quality-count');
        if (lowQualityCount) {
          lowQualityCount.textContent = stats.qualityCounts?.low || 0;
        }
        
        console.log('已加载资源统计:', stats);
      });
    } catch (e) {
      console.error('加载资源统计错误:', e);
      this._showError('加载资源统计失败: ' + e.message);
    }
  }
  
  /**
   * 显示错误消息
   * @param {string} message - 错误消息
   * @private
   */
  _showError(message) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast error';
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
    }, 5000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const popupMain = new PopupMain();
});

export default PopupMain;
