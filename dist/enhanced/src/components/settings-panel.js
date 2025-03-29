/**
 * @file settings-panel.js
 * @description 设置面板组件，负责管理用户设置和配置
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { DEFAULT_DOWNLOAD_SETTINGS, FILENAME_FORMATS, SORT_METHODS, STORAGE_KEYS } from '../config/settings.js';

/**
 * 设置面板组件类
 * @class SettingsPanel
 */
class SettingsPanel {
  /**
   * 创建设置面板组件
   * @param {string} containerId - 容器元素ID
   * @param {Object} storageService - 存储服务实例
   */
  constructor(containerId, storageService) {
    this.container = document.getElementById(containerId);
    this.storageService = storageService;
    this.settings = null;
    this.isOpen = false;
  }
  
  /**
   * 初始化组件
   */
  async initialize() {
    if (!this.container) {
      console.error('设置面板容器未找到');
      return;
    }
    
    await this._loadSettings();
    this._renderSettingsPanel();
    this._setupEventListeners();
    console.log('设置面板组件已初始化');
  }
  
  /**
   * 加载设置
   * @private
   */
  async _loadSettings() {
    try {
      if (!this.storageService) {
        this.settings = { ...DEFAULT_DOWNLOAD_SETTINGS };
        return;
      }
      
      const settings = await this.storageService.get(STORAGE_KEYS.SETTINGS);
      this.settings = settings || { ...DEFAULT_DOWNLOAD_SETTINGS };
    } catch (error) {
      console.error('加载设置错误:', error);
      this.settings = { ...DEFAULT_DOWNLOAD_SETTINGS };
    }
  }
  
  /**
   * 渲染设置面板
   * @private
   */
  _renderSettingsPanel() {
    this.container.innerHTML = `
      <div class="settings-header">
        <h2>设置</h2>
        <button id="close-settings" title="关闭设置">×</button>
      </div>
      <div class="settings-content">
        <div class="settings-section">
          <h3>下载设置</h3>
          <div class="settings-item">
            <label for="max-concurrent-downloads">最大并发下载数:</label>
            <input type="number" id="max-concurrent-downloads" min="1" max="10" value="${this.settings.maxConcurrentDownloads || 2}">
          </div>
          <div class="settings-item">
            <label for="download-speed-limit">下载速度限制 (KB/s, 0表示不限制):</label>
            <input type="number" id="download-speed-limit" min="0" max="10240" value="${this.settings.downloadSpeedLimit || 0}">
          </div>
          <div class="settings-item">
            <label for="default-path">默认下载路径:</label>
            <input type="text" id="default-path" value="${this.settings.defaultPath || 'downloads/resource-sniffer'}">
          </div>
          <div class="settings-item checkbox">
            <input type="checkbox" id="categorize-by-website" ${this.settings.categorizeByWebsite ? 'checked' : ''}>
            <label for="categorize-by-website">按网站分类存储</label>
          </div>
          <div class="settings-item checkbox">
            <input type="checkbox" id="categorize-by-type" ${this.settings.categorizeByType ? 'checked' : ''}>
            <label for="categorize-by-type">按资源类型分类存储</label>
          </div>
        </div>
        
        <div class="settings-section">
          <h3>文件名格式</h3>
          <div class="settings-item radio">
            <input type="radio" name="filename-format" id="format-original" value="${FILENAME_FORMATS.ORIGINAL}" ${this.settings.filenameFormat === FILENAME_FORMATS.ORIGINAL ? 'checked' : ''}>
            <label for="format-original">使用原始文件名</label>
          </div>
          <div class="settings-item radio">
            <input type="radio" name="filename-format" id="format-type-timestamp" value="${FILENAME_FORMATS.TYPE_TIMESTAMP}" ${this.settings.filenameFormat === FILENAME_FORMATS.TYPE_TIMESTAMP ? 'checked' : ''}>
            <label for="format-type-timestamp">类型-时间戳 (例如: image-1617123456789.jpg)</label>
          </div>
          <div class="settings-item radio">
            <input type="radio" name="filename-format" id="format-site-type-index" value="${FILENAME_FORMATS.SITE_TYPE_INDEX}" ${this.settings.filenameFormat === FILENAME_FORMATS.SITE_TYPE_INDEX ? 'checked' : ''}>
            <label for="format-site-type-index">网站-类型-序号 (例如: example-image-001.jpg)</label>
          </div>
          <div class="settings-item radio">
            <input type="radio" name="filename-format" id="format-custom" value="${FILENAME_FORMATS.CUSTOM}" ${this.settings.filenameFormat === FILENAME_FORMATS.CUSTOM ? 'checked' : ''}>
            <label for="format-custom">自定义格式:</label>
            <input type="text" id="custom-format" value="${this.settings.customFormat || '{site}-{type}-{index}'}" ${this.settings.filenameFormat !== FILENAME_FORMATS.CUSTOM ? 'disabled' : ''}>
          </div>
          <div class="settings-info">
            <p>可用的占位符: {site}, {type}, {index}, {timestamp}, {width}, {height}, {quality}</p>
          </div>
        </div>
        
        <div class="settings-section">
          <h3>默认排序方式</h3>
          <div class="settings-item radio">
            <input type="radio" name="default-sort" id="sort-time-desc" value="${SORT_METHODS.TIME_DESC}" ${this.settings.defaultSort === SORT_METHODS.TIME_DESC ? 'checked' : ''}>
            <label for="sort-time-desc">时间 (新→旧)</label>
          </div>
          <div class="settings-item radio">
            <input type="radio" name="default-sort" id="sort-size-desc" value="${SORT_METHODS.SIZE_DESC}" ${this.settings.defaultSort === SORT_METHODS.SIZE_DESC ? 'checked' : ''}>
            <label for="sort-size-desc">大小 (大→小)</label>
          </div>
          <div class="settings-item radio">
            <input type="radio" name="default-sort" id="sort-quality-desc" value="${SORT_METHODS.QUALITY_DESC}" ${this.settings.defaultSort === SORT_METHODS.QUALITY_DESC ? 'checked' : ''}>
            <label for="sort-quality-desc">质量 (高→低)</label>
          </div>
        </div>
        
        <div class="settings-section">
          <h3>检测设置</h3>
          <div class="settings-item checkbox">
            <input type="checkbox" id="enable-dom-detection" ${this.settings.enableDOMDetection !== false ? 'checked' : ''}>
            <label for="enable-dom-detection">启用DOM检测</label>
          </div>
          <div class="settings-item checkbox">
            <input type="checkbox" id="enable-css-detection" ${this.settings.enableCSSDetection !== false ? 'checked' : ''}>
            <label for="enable-css-detection">启用CSS检测</label>
          </div>
          <div class="settings-item checkbox">
            <input type="checkbox" id="enable-shadow-dom-detection" ${this.settings.enableShadowDOMDetection !== false ? 'checked' : ''}>
            <label for="enable-shadow-dom-detection">启用Shadow DOM检测</label>
          </div>
          <div class="settings-item checkbox">
            <input type="checkbox" id="enable-attribute-detection" ${this.settings.enableAttributeDetection !== false ? 'checked' : ''}>
            <label for="enable-attribute-detection">启用属性检测</label>
          </div>
          <div class="settings-item checkbox">
            <input type="checkbox" id="enable-nested-detection" ${this.settings.enableNestedDetection !== false ? 'checked' : ''}>
            <label for="enable-nested-detection">启用嵌套检测</label>
          </div>
          <div class="settings-item checkbox">
            <input type="checkbox" id="enable-streaming-detection" ${this.settings.enableStreamingDetection !== false ? 'checked' : ''}>
            <label for="enable-streaming-detection">启用流媒体检测</label>
          </div>
          <div class="settings-item checkbox">
            <input type="checkbox" id="enable-predicted-detection" ${this.settings.enablePredictedDetection !== false ? 'checked' : ''}>
            <label for="enable-predicted-detection">启用预测检测</label>
          </div>
        </div>
        
        <div class="settings-section">
          <h3>高级设置</h3>
          <div class="settings-item checkbox">
            <input type="checkbox" id="auto-detect-on-page-load" ${this.settings.autoDetectOnPageLoad !== false ? 'checked' : ''}>
            <label for="auto-detect-on-page-load">页面加载时自动检测资源</label>
          </div>
          <div class="settings-item checkbox">
            <input type="checkbox" id="show-notifications" ${this.settings.showNotifications !== false ? 'checked' : ''}>
            <label for="show-notifications">显示下载通知</label>
          </div>
          <div class="settings-item checkbox">
            <input type="checkbox" id="enable-context-menu" ${this.settings.enableContextMenu !== false ? 'checked' : ''}>
            <label for="enable-context-menu">启用右键菜单</label>
          </div>
          <div class="settings-item checkbox">
            <input type="checkbox" id="enable-keyboard-shortcuts" ${this.settings.enableKeyboardShortcuts !== false ? 'checked' : ''}>
            <label for="enable-keyboard-shortcuts">启用键盘快捷键</label>
          </div>
          <div class="settings-item">
            <label for="min-image-size">最小图片大小 (KB):</label>
            <input type="number" id="min-image-size" min="0" max="1024" value="${this.settings.minImageSize || 0}">
          </div>
          <div class="settings-item">
            <label for="min-video-size">最小视频大小 (KB):</label>
            <input type="number" id="min-video-size" min="0" max="10240" value="${this.settings.minVideoSize || 0}">
          </div>
        </div>
      </div>
      <div class="settings-footer">
        <button id="reset-settings">恢复默认设置</button>
        <button id="save-settings" class="primary">保存设置</button>
      </div>
    `;
  }
  
  /**
   * 设置事件监听器
   * @private
   */
  _setupEventListeners() {
    const closeBtn = document.getElementById('close-settings');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.close();
      });
    }
    
    const formatCustom = document.getElementById('format-custom');
    const customFormat = document.getElementById('custom-format');
    
    if (formatCustom && customFormat) {
      formatCustom.addEventListener('change', (e) => {
        customFormat.disabled = !e.target.checked;
      });
    }
    
    const filenameFormatRadios = document.querySelectorAll('input[name="filename-format"]');
    filenameFormatRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (customFormat) {
          customFormat.disabled = e.target.value !== FILENAME_FORMATS.CUSTOM;
        }
      });
    });
    
    const resetBtn = document.getElementById('reset-settings');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this._confirmResetSettings();
      });
    }
    
    const saveBtn = document.getElementById('save-settings');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this._saveSettings();
      });
    }
  }
  
  /**
   * 确认重置设置
   * @private
   */
  _confirmResetSettings() {
    const confirmed = window.confirm('确定要恢复默认设置吗？此操作不可撤销。');
    
    if (confirmed) {
      this._resetSettings();
    }
  }
  
  /**
   * 重置设置
   * @private
   */
  _resetSettings() {
    this.settings = { ...DEFAULT_DOWNLOAD_SETTINGS };
    
    this._renderSettingsPanel();
    this._setupEventListeners();
    
    this._saveSettingsToStorage();
    
    this._showToast('已恢复默认设置');
  }
  
  /**
   * 保存设置
   * @private
   */
  _saveSettings() {
    const maxConcurrentDownloads = parseInt(document.getElementById('max-concurrent-downloads').value) || 2;
    const downloadSpeedLimit = parseInt(document.getElementById('download-speed-limit').value) || 0;
    const defaultPath = document.getElementById('default-path').value || 'downloads/resource-sniffer';
    const categorizeByWebsite = document.getElementById('categorize-by-website').checked;
    const categorizeByType = document.getElementById('categorize-by-type').checked;
    
    const filenameFormatRadios = document.querySelectorAll('input[name="filename-format"]');
    let filenameFormat = FILENAME_FORMATS.ORIGINAL;
    
    filenameFormatRadios.forEach(radio => {
      if (radio.checked) {
        filenameFormat = radio.value;
      }
    });
    
    const customFormat = document.getElementById('custom-format').value || '{site}-{type}-{index}';
    
    const defaultSortRadios = document.querySelectorAll('input[name="default-sort"]');
    let defaultSort = SORT_METHODS.TIME_DESC;
    
    defaultSortRadios.forEach(radio => {
      if (radio.checked) {
        defaultSort = radio.value;
      }
    });
    
    const enableDOMDetection = document.getElementById('enable-dom-detection').checked;
    const enableCSSDetection = document.getElementById('enable-css-detection').checked;
    const enableShadowDOMDetection = document.getElementById('enable-shadow-dom-detection').checked;
    const enableAttributeDetection = document.getElementById('enable-attribute-detection').checked;
    const enableNestedDetection = document.getElementById('enable-nested-detection').checked;
    const enableStreamingDetection = document.getElementById('enable-streaming-detection').checked;
    const enablePredictedDetection = document.getElementById('enable-predicted-detection').checked;
    
    const autoDetectOnPageLoad = document.getElementById('auto-detect-on-page-load').checked;
    const showNotifications = document.getElementById('show-notifications').checked;
    const enableContextMenu = document.getElementById('enable-context-menu').checked;
    const enableKeyboardShortcuts = document.getElementById('enable-keyboard-shortcuts').checked;
    const minImageSize = parseInt(document.getElementById('min-image-size').value) || 0;
    const minVideoSize = parseInt(document.getElementById('min-video-size').value) || 0;
    
    this.settings = {
      maxConcurrentDownloads,
      downloadSpeedLimit,
      defaultPath,
      categorizeByWebsite,
      categorizeByType,
      filenameFormat,
      customFormat,
      defaultSort,
      enableDOMDetection,
      enableCSSDetection,
      enableShadowDOMDetection,
      enableAttributeDetection,
      enableNestedDetection,
      enableStreamingDetection,
      enablePredictedDetection,
      autoDetectOnPageLoad,
      showNotifications,
      enableContextMenu,
      enableKeyboardShortcuts,
      minImageSize,
      minVideoSize
    };
    
    this._saveSettingsToStorage();
    
    this._showToast('设置已保存');
  }
  
  /**
   * 保存设置到存储
   * @private
   */
  async _saveSettingsToStorage() {
    try {
      if (!this.storageService) {
        console.warn('存储服务未初始化，无法保存设置');
        return;
      }
      
      await this.storageService.set(STORAGE_KEYS.SETTINGS, this.settings);
      
      const event = new CustomEvent('settings-updated', {
        detail: { settings: this.settings }
      });
      
      document.dispatchEvent(event);
    } catch (error) {
      console.error('保存设置错误:', error);
      this._showToast('保存设置失败', 'error');
    }
  }
  
  /**
   * 打开设置面板
   */
  open() {
    if (!this.container) return;
    
    this.container.classList.add('open');
    this.isOpen = true;
  }
  
  /**
   * 关闭设置面板
   */
  close() {
    if (!this.container) return;
    
    this.container.classList.remove('open');
    this.isOpen = false;
  }
  
  /**
   * 切换设置面板
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
  
  /**
   * 获取设置
   * @returns {Object} - 设置对象
   */
  getSettings() {
    return { ...this.settings };
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

export default SettingsPanel;
