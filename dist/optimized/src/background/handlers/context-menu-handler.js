/**
 * @file context-menu-handler.js
 * @description 右键菜单处理程序，管理扩展的右键菜单功能
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES } from '../../config/constants.js';

/**
 * 右键菜单处理程序类
 * @class ContextMenuHandler
 */
class ContextMenuHandler {
  /**
   * 创建右键菜单处理程序实例
   * @param {Object} resourceService - 资源服务实例
   * @param {Object} downloadHandler - 下载处理程序实例
   */
  constructor(resourceService, downloadHandler) {
    this.resourceService = resourceService;
    this.downloadHandler = downloadHandler;
    this.menuItems = [];
  }
  
  /**
   * 初始化右键菜单
   */
  initialize() {
    try {
      this._removeMenuItems();
      
      this._createMenuItems();
      
      console.log('右键菜单已初始化');
    } catch (e) {
      console.error('初始化右键菜单错误:', e);
    }
  }
  
  /**
   * 创建菜单项
   * @private
   */
  _createMenuItems() {
    try {
      const parentId = chrome.contextMenus.create({
        id: 'resource-sniffer',
        title: 'Resource Sniffer',
        contexts: ['all']
      });
      
      this.menuItems.push(parentId);
      
      const detectResourcesId = chrome.contextMenus.create({
        id: 'detect-resources',
        parentId: parentId,
        title: '嗅探当前页面资源',
        contexts: ['all']
      });
      
      this.menuItems.push(detectResourcesId);
      
      const downloadAllId = chrome.contextMenus.create({
        id: 'download-all',
        parentId: parentId,
        title: '下载所有资源',
        contexts: ['all']
      });
      
      this.menuItems.push(downloadAllId);
      
      const separator1Id = chrome.contextMenus.create({
        id: 'separator-1',
        parentId: parentId,
        type: 'separator',
        contexts: ['all']
      });
      
      this.menuItems.push(separator1Id);
      
      const downloadImagesId = chrome.contextMenus.create({
        id: 'download-images',
        parentId: parentId,
        title: '下载所有图片',
        contexts: ['all']
      });
      
      this.menuItems.push(downloadImagesId);
      
      const downloadVideosId = chrome.contextMenus.create({
        id: 'download-videos',
        parentId: parentId,
        title: '下载所有视频',
        contexts: ['all']
      });
      
      this.menuItems.push(downloadVideosId);
      
      const downloadAudiosId = chrome.contextMenus.create({
        id: 'download-audios',
        parentId: parentId,
        title: '下载所有音频',
        contexts: ['all']
      });
      
      this.menuItems.push(downloadAudiosId);
      
      const separator2Id = chrome.contextMenus.create({
        id: 'separator-2',
        parentId: parentId,
        type: 'separator',
        contexts: ['all']
      });
      
      this.menuItems.push(separator2Id);
      
      const downloadCurrentId = chrome.contextMenus.create({
        id: 'download-current',
        parentId: parentId,
        title: '下载当前元素',
        contexts: ['image', 'video', 'audio']
      });
      
      this.menuItems.push(downloadCurrentId);
      
      const downloadHighQualityId = chrome.contextMenus.create({
        id: 'download-high-quality',
        parentId: parentId,
        title: '查找并下载高质量版本',
        contexts: ['image', 'video']
      });
      
      this.menuItems.push(downloadHighQualityId);
      
      const separator3Id = chrome.contextMenus.create({
        id: 'separator-3',
        parentId: parentId,
        type: 'separator',
        contexts: ['all']
      });
      
      this.menuItems.push(separator3Id);
      
      const openManagerId = chrome.contextMenus.create({
        id: 'open-manager',
        parentId: parentId,
        title: '打开资源管理器',
        contexts: ['all']
      });
      
      this.menuItems.push(openManagerId);
      
      chrome.contextMenus.onClicked.addListener(this._handleMenuClick.bind(this));
    } catch (e) {
      console.error('创建菜单项错误:', e);
    }
  }
  
  /**
   * 移除菜单项
   * @private
   */
  _removeMenuItems() {
    try {
      chrome.contextMenus.removeAll();
      this.menuItems = [];
    } catch (e) {
      console.error('移除菜单项错误:', e);
    }
  }
  
  /**
   * 处理菜单点击
   * @param {Object} info - 点击信息
   * @param {Object} tab - 标签页信息
   * @private
   */
  _handleMenuClick(info, tab) {
    try {
      if (!tab || !tab.id) return;
      
      const tabId = tab.id.toString();
      const menuItemId = info.menuItemId;
      
      switch (menuItemId) {
        case 'detect-resources':
          this._detectResources(tabId);
          break;
          
        case 'download-all':
          this._downloadAllResources(tabId);
          break;
          
        case 'download-images':
          this._downloadResourcesByType(tabId, RESOURCE_TYPES.IMAGE);
          break;
          
        case 'download-videos':
          this._downloadResourcesByType(tabId, RESOURCE_TYPES.VIDEO);
          break;
          
        case 'download-audios':
          this._downloadResourcesByType(tabId, RESOURCE_TYPES.AUDIO);
          break;
          
        case 'download-current':
          this._downloadCurrentElement(info, tab);
          break;
          
        case 'download-high-quality':
          this._downloadHighQualityVersion(info, tab);
          break;
          
        case 'open-manager':
          this._openResourceManager(tabId);
          break;
          
        default:
          break;
      }
    } catch (e) {
      console.error('处理菜单点击错误:', e);
    }
  }
  
  /**
   * 检测资源
   * @param {string} tabId - 标签页ID
   * @private
   */
  _detectResources(tabId) {
    try {
      chrome.tabs.sendMessage(parseInt(tabId), {
        action: 'detectResources'
      }, response => {
        if (chrome.runtime.lastError) {
          console.warn('发送检测资源消息错误:', chrome.runtime.lastError);
          this._showNotification('检测资源失败', chrome.runtime.lastError.message);
        } else if (response && response.success) {
          this._showNotification('资源检测完成', `检测到 ${response.count || 0} 个资源`);
        }
      });
    } catch (e) {
      console.error('检测资源错误:', e);
      this._showNotification('检测资源失败', e.message);
    }
  }
  
  /**
   * 下载所有资源
   * @param {string} tabId - 标签页ID
   * @private
   */
  _downloadAllResources(tabId) {
    try {
      if (!this.resourceService || !this.downloadHandler) {
        this._showNotification('下载失败', '资源服务或下载处理程序未初始化');
        return;
      }
      
      const resources = this.resourceService.getResources(tabId);
      
      if (!resources || resources.length === 0) {
        this._showNotification('没有可下载的资源', '请先检测资源');
        return;
      }
      
      this._batchDownloadResources(resources, tabId);
    } catch (e) {
      console.error('下载所有资源错误:', e);
      this._showNotification('下载失败', e.message);
    }
  }
  
  /**
   * 按类型下载资源
   * @param {string} tabId - 标签页ID
   * @param {string} type - 资源类型
   * @private
   */
  _downloadResourcesByType(tabId, type) {
    try {
      if (!this.resourceService || !this.downloadHandler) {
        this._showNotification('下载失败', '资源服务或下载处理程序未初始化');
        return;
      }
      
      const allResources = this.resourceService.getResources(tabId);
      
      if (!allResources || allResources.length === 0) {
        this._showNotification('没有可下载的资源', '请先检测资源');
        return;
      }
      
      const resources = allResources.filter(resource => resource.type === type);
      
      if (resources.length === 0) {
        this._showNotification('没有可下载的资源', `没有找到类型为 ${type} 的资源`);
        return;
      }
      
      this._batchDownloadResources(resources, tabId);
    } catch (e) {
      console.error(`下载 ${type} 资源错误:`, e);
      this._showNotification('下载失败', e.message);
    }
  }
  
  /**
   * 下载当前元素
   * @param {Object} info - 点击信息
   * @param {Object} tab - 标签页信息
   * @private
   */
  _downloadCurrentElement(info, tab) {
    try {
      if (!this.downloadHandler) {
        this._showNotification('下载失败', '下载处理程序未初始化');
        return;
      }
      
      const tabId = tab.id.toString();
      const srcUrl = info.srcUrl;
      
      if (!srcUrl) {
        this._showNotification('下载失败', '无法获取元素URL');
        return;
      }
      
      const resource = {
        url: srcUrl,
        type: this._getTypeFromContext(info.mediaType),
        source: 'context-menu',
        timestamp: Date.now()
      };
      
      this.downloadHandler.addToDownloadQueue(resource, tabId);
      
      this._showNotification('已添加到下载队列', resource.url);
    } catch (e) {
      console.error('下载当前元素错误:', e);
      this._showNotification('下载失败', e.message);
    }
  }
  
  /**
   * 下载高质量版本
   * @param {Object} info - 点击信息
   * @param {Object} tab - 标签页信息
   * @private
   */
  _downloadHighQualityVersion(info, tab) {
    try {
      if (!this.resourceService || !this.downloadHandler) {
        this._showNotification('下载失败', '资源服务或下载处理程序未初始化');
        return;
      }
      
      const tabId = tab.id.toString();
      const srcUrl = info.srcUrl;
      
      if (!srcUrl) {
        this._showNotification('下载失败', '无法获取元素URL');
        return;
      }
      
      const similarResources = this.resourceService.getSimilarResources(tabId, srcUrl);
      
      if (!similarResources || similarResources.length === 0) {
        this._downloadCurrentElement(info, tab);
        return;
      }
      
      const sortedResources = [...similarResources].sort((a, b) => {
        const qualityA = a.quality === 'high' ? 3 : (a.quality === 'medium' ? 2 : 1);
        const qualityB = b.quality === 'high' ? 3 : (b.quality === 'medium' ? 2 : 1);
        return qualityB - qualityA;
      });
      
      const highestQualityResource = sortedResources[0];
      
      this.downloadHandler.addToDownloadQueue(highestQualityResource, tabId);
      
      this._showNotification('已添加高质量版本到下载队列', highestQualityResource.url);
    } catch (e) {
      console.error('下载高质量版本错误:', e);
      this._showNotification('下载失败', e.message);
    }
  }
  
  /**
   * 打开资源管理器
   * @param {string} tabId - 标签页ID
   * @private
   */
  _openResourceManager(tabId) {
    try {
      chrome.action.openPopup();
    } catch (e) {
      console.error('打开资源管理器错误:', e);
      this._showNotification('打开资源管理器失败', e.message);
    }
  }
  
  /**
   * 批量下载资源
   * @param {Array} resources - 资源数组
   * @param {string} tabId - 标签页ID
   * @private
   */
  _batchDownloadResources(resources, tabId) {
    try {
      if (!this.downloadHandler) {
        this._showNotification('下载失败', '下载处理程序未初始化');
        return;
      }
      
      chrome.runtime.sendMessage({
        action: 'batchDownloadResources',
        resources: resources,
        tabId: tabId
      }, response => {
        if (chrome.runtime.lastError) {
          console.warn('发送批量下载请求错误:', chrome.runtime.lastError);
          this._showNotification('下载失败', chrome.runtime.lastError.message);
        } else if (response && response.success) {
          this._showNotification('已添加到下载队列', `已添加 ${response.addedCount || 0} 个资源到下载队列`);
        } else if (response && response.error) {
          this._showNotification('下载失败', response.error);
        }
      });
    } catch (e) {
      console.error('批量下载资源错误:', e);
      this._showNotification('下载失败', e.message);
    }
  }
  
  /**
   * 从上下文获取类型
   * @param {string} mediaType - 媒体类型
   * @returns {string} - 资源类型
   * @private
   */
  _getTypeFromContext(mediaType) {
    switch (mediaType) {
      case 'image':
        return RESOURCE_TYPES.IMAGE;
      case 'video':
        return RESOURCE_TYPES.VIDEO;
      case 'audio':
        return RESOURCE_TYPES.AUDIO;
      default:
        return RESOURCE_TYPES.OTHER;
    }
  }
  
  /**
   * 显示通知
   * @param {string} title - 通知标题
   * @param {string} message - 通知消息
   * @private
   */
  _showNotification(title, message) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('images/icon128.png'),
        title: title,
        message: message
      });
    } catch (e) {
      console.warn('显示通知错误:', e);
    }
  }
  
  /**
   * 清理资源
   */
  cleanup() {
    try {
      this._removeMenuItems();
      
      chrome.contextMenus.onClicked.removeListener(this._handleMenuClick);
    } catch (e) {
      console.warn('清理右键菜单处理程序错误:', e);
    }
  }
}

export default ContextMenuHandler;
