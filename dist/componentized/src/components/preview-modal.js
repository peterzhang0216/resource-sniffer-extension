/**
 * @file preview-modal.js
 * @description 预览模态框组件，负责显示资源预览
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

import { RESOURCE_TYPES } from '../config/constants.js';

/**
 * 预览模态框组件类
 * @class PreviewModal
 */
class PreviewModal {
  /**
   * 创建预览模态框组件
   * @param {string} containerId - 容器元素ID
   * @param {Object} downloadService - 下载服务实例
   */
  constructor(containerId, downloadService) {
    this.container = document.getElementById(containerId);
    this.downloadService = downloadService;
    this.currentResource = null;
    this.isOpen = false;
  }
  
  /**
   * 初始化组件
   */
  initialize() {
    if (!this.container) {
      console.error('预览模态框容器未找到');
      return;
    }
    
    this._renderModalContainer();
    this._setupEventListeners();
    this._setupGlobalEventListeners();
    console.log('预览模态框组件已初始化');
  }
  
  /**
   * 渲染模态框容器
   * @private
   */
  _renderModalContainer() {
    this.container.innerHTML = `
      <div class="preview-modal-content">
        <div class="preview-header">
          <h2 id="preview-title">资源预览</h2>
          <button id="close-preview" title="关闭预览">×</button>
        </div>
        <div class="preview-body">
          <div id="preview-container" class="preview-container"></div>
          <div class="preview-info">
            <div class="preview-details">
              <div class="preview-detail-item">
                <span class="detail-label">文件名:</span>
                <span id="preview-filename" class="detail-value"></span>
              </div>
              <div class="preview-detail-item">
                <span class="detail-label">类型:</span>
                <span id="preview-type" class="detail-value"></span>
              </div>
              <div class="preview-detail-item">
                <span class="detail-label">大小:</span>
                <span id="preview-size" class="detail-value"></span>
              </div>
              <div class="preview-detail-item">
                <span class="detail-label">尺寸:</span>
                <span id="preview-dimensions" class="detail-value"></span>
              </div>
              <div class="preview-detail-item">
                <span class="detail-label">质量:</span>
                <span id="preview-quality" class="detail-value"></span>
              </div>
              <div class="preview-detail-item">
                <span class="detail-label">来源:</span>
                <span id="preview-source" class="detail-value"></span>
              </div>
              <div class="preview-detail-item">
                <span class="detail-label">URL:</span>
                <div id="preview-url" class="detail-value url-value"></div>
              </div>
            </div>
            <div class="preview-actions">
              <button id="preview-download-btn" class="primary">下载资源</button>
              <button id="preview-copy-url-btn">复制URL</button>
              <button id="preview-open-tab-btn">在新标签页打开</button>
            </div>
          </div>
        </div>
        <div class="preview-footer">
          <div class="preview-navigation">
            <button id="preview-prev-btn" disabled>上一个</button>
            <span id="preview-counter">1/1</span>
            <button id="preview-next-btn" disabled>下一个</button>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * 设置事件监听器
   * @private
   */
  _setupEventListeners() {
    const closeBtn = document.getElementById('close-preview');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.close();
      });
    }
    
    const downloadBtn = document.getElementById('preview-download-btn');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        this._downloadCurrentResource();
      });
    }
    
    const copyUrlBtn = document.getElementById('preview-copy-url-btn');
    if (copyUrlBtn) {
      copyUrlBtn.addEventListener('click', () => {
        this._copyResourceUrl();
      });
    }
    
    const openTabBtn = document.getElementById('preview-open-tab-btn');
    if (openTabBtn) {
      openTabBtn.addEventListener('click', () => {
        this._openInNewTab();
      });
    }
    
    const prevBtn = document.getElementById('preview-prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        this._navigateToPrevious();
      });
    }
    
    const nextBtn = document.getElementById('preview-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this._navigateToNext();
      });
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
    
    this.container.addEventListener('click', (e) => {
      if (e.target === this.container) {
        this.close();
      }
    });
  }
  
  /**
   * 设置全局事件监听器
   * @private
   */
  _setupGlobalEventListeners() {
    document.addEventListener('preview-resource', (e) => {
      if (e.detail && e.detail.resource) {
        this.open(e.detail.resource, e.detail.resources);
      }
    });
  }
  
  /**
   * 打开预览模态框
   * @param {Object} resource - 资源对象
   * @param {Array} resources - 资源数组(用于导航)
   */
  open(resource, resources = null) {
    if (!this.container || !resource) return;
    
    this.currentResource = resource;
    this.resources = resources;
    this.currentIndex = resources ? resources.findIndex(r => r.url === resource.url) : -1;
    
    this._updatePreviewContent();
    this._updateNavigationButtons();
    
    this.container.classList.add('open');
    this.isOpen = true;
  }
  
  /**
   * 关闭预览模态框
   */
  close() {
    if (!this.container) return;
    
    this.container.classList.remove('open');
    this.isOpen = false;
    
    const previewContainer = document.getElementById('preview-container');
    if (previewContainer) {
      previewContainer.innerHTML = '';
    }
    
    this.currentResource = null;
    this.resources = null;
    this.currentIndex = -1;
  }
  
  /**
   * 更新预览内容
   * @private
   */
  _updatePreviewContent() {
    if (!this.currentResource) return;
    
    const resource = this.currentResource;
    
    const previewTitle = document.getElementById('preview-title');
    if (previewTitle) {
      previewTitle.textContent = resource.filename || '资源预览';
    }
    
    const previewContainer = document.getElementById('preview-container');
    if (previewContainer) {
      previewContainer.innerHTML = '';
      
      if (resource.type === RESOURCE_TYPES.IMAGE) {
        const img = document.createElement('img');
        img.src = resource.url;
        img.alt = resource.filename || '图片预览';
        img.className = 'preview-image';
        previewContainer.appendChild(img);
        
        img.addEventListener('load', () => {
          const previewDimensions = document.getElementById('preview-dimensions');
          if (previewDimensions) {
            previewDimensions.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
          }
        });
      } else if (resource.type === RESOURCE_TYPES.VIDEO) {
        const video = document.createElement('video');
        video.src = resource.url;
        video.controls = true;
        video.autoplay = false;
        video.className = 'preview-video';
        
        if (resource.thumbnailUrl) {
          video.poster = resource.thumbnailUrl;
        }
        
        previewContainer.appendChild(video);
        
        video.addEventListener('loadedmetadata', () => {
          const previewDimensions = document.getElementById('preview-dimensions');
          if (previewDimensions) {
            previewDimensions.textContent = `${video.videoWidth} × ${video.videoHeight}`;
          }
        });
      } else if (resource.type === RESOURCE_TYPES.AUDIO) {
        const audio = document.createElement('audio');
        audio.src = resource.url;
        audio.controls = true;
        audio.autoplay = false;
        audio.className = 'preview-audio';
        
        const audioContainer = document.createElement('div');
        audioContainer.className = 'audio-container';
        
        const audioIcon = document.createElement('div');
        audioIcon.className = 'audio-icon';
        audioIcon.innerHTML = '🔊';
        
        audioContainer.appendChild(audioIcon);
        audioContainer.appendChild(audio);
        
        previewContainer.appendChild(audioContainer);
      } else {
        const fileIcon = document.createElement('div');
        fileIcon.className = 'file-icon';
        fileIcon.innerHTML = '📄';
        
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.textContent = `无法预览此类型的文件: ${resource.contentType || resource.type || '未知类型'}`;
        
        previewContainer.appendChild(fileIcon);
        previewContainer.appendChild(fileInfo);
      }
    }
    
    const previewFilename = document.getElementById('preview-filename');
    if (previewFilename) {
      previewFilename.textContent = resource.filename || '未命名资源';
    }
    
    const previewType = document.getElementById('preview-type');
    if (previewType) {
      previewType.textContent = resource.contentType || resource.type || '未知类型';
    }
    
    const previewSize = document.getElementById('preview-size');
    if (previewSize) {
      previewSize.textContent = resource.sizeFormatted || '未知大小';
    }
    
    const previewDimensions = document.getElementById('preview-dimensions');
    if (previewDimensions) {
      previewDimensions.textContent = resource.width && resource.height ? 
        `${resource.width} × ${resource.height}` : '未知尺寸';
    }
    
    const previewQuality = document.getElementById('preview-quality');
    if (previewQuality) {
      const qualityLabels = {
        'high': '高质量',
        'medium': '中等',
        'low': '低质量',
        'unknown': '未知'
      };
      
      previewQuality.textContent = qualityLabels[resource.quality] || resource.quality || '未知';
      
      previewQuality.className = 'detail-value';
      if (resource.quality) {
        previewQuality.classList.add(resource.quality);
      }
    }
    
    const previewSource = document.getElementById('preview-source');
    if (previewSource) {
      const sourceLabels = {
        'dom': 'DOM',
        'css': 'CSS',
        'shadow-dom': 'Shadow DOM',
        'attribute': '属性',
        'nested': '嵌套',
        'streaming': '流媒体',
        'predicted': '预测',
        'network': '网络'
      };
      
      previewSource.textContent = sourceLabels[resource.source] || resource.source || '未知';
    }
    
    const previewUrl = document.getElementById('preview-url');
    if (previewUrl) {
      previewUrl.textContent = resource.url || '';
      previewUrl.title = resource.url || '';
    }
    
    const previewCounter = document.getElementById('preview-counter');
    if (previewCounter && this.resources) {
      previewCounter.textContent = `${this.currentIndex + 1}/${this.resources.length}`;
    } else if (previewCounter) {
      previewCounter.textContent = '1/1';
    }
  }
  
  /**
   * 更新导航按钮状态
   * @private
   */
  _updateNavigationButtons() {
    const prevBtn = document.getElementById('preview-prev-btn');
    const nextBtn = document.getElementById('preview-next-btn');
    
    if (!this.resources || this.resources.length <= 1) {
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }
    
    if (prevBtn) {
      prevBtn.disabled = this.currentIndex <= 0;
    }
    
    if (nextBtn) {
      nextBtn.disabled = this.currentIndex >= this.resources.length - 1;
    }
  }
  
  /**
   * 导航到上一个资源
   * @private
   */
  _navigateToPrevious() {
    if (!this.resources || this.currentIndex <= 0) return;
    
    this.currentIndex--;
    this.currentResource = this.resources[this.currentIndex];
    
    this._updatePreviewContent();
    this._updateNavigationButtons();
  }
  
  /**
   * 导航到下一个资源
   * @private
   */
  _navigateToNext() {
    if (!this.resources || this.currentIndex >= this.resources.length - 1) return;
    
    this.currentIndex++;
    this.currentResource = this.resources[this.currentIndex];
    
    this._updatePreviewContent();
    this._updateNavigationButtons();
  }
  
  /**
   * 下载当前资源
   * @private
   */
  _downloadCurrentResource() {
    if (!this.currentResource) return;
    
    if (this.downloadService) {
      this.downloadService.download(this.currentResource)
        .then(result => {
          console.log('下载结果:', result);
          this._showToast(`已添加到下载队列: ${this.currentResource.filename || '资源'}`);
        })
        .catch(error => {
          console.error('下载错误:', error);
          this._showToast(`下载失败: ${error.message || '未知错误'}`, 'error');
        });
    } else {
      try {
        const a = document.createElement('a');
        a.href = this.currentResource.url;
        a.download = this.currentResource.filename || '';
        a.target = '_blank';
        a.click();
        
        this._showToast(`已开始下载: ${this.currentResource.filename || '资源'}`);
      } catch (e) {
        console.error('下载资源错误:', e);
        this._showToast(`下载失败: ${e.message || '未知错误'}`, 'error');
      }
    }
  }
  
  /**
   * 复制资源URL
   * @private
   */
  _copyResourceUrl() {
    if (!this.currentResource || !this.currentResource.url) return;
    
    try {
      navigator.clipboard.writeText(this.currentResource.url)
        .then(() => {
          this._showToast('URL已复制到剪贴板');
        })
        .catch(err => {
          console.error('复制URL错误:', err);
          this._showToast('复制URL失败', 'error');
          
          this._fallbackCopyToClipboard(this.currentResource.url);
        });
    } catch (e) {
      console.error('复制URL错误:', e);
      this._showToast('复制URL失败', 'error');
      
      this._fallbackCopyToClipboard(this.currentResource.url);
    }
  }
  
  /**
   * 回退复制到剪贴板方法
   * @param {string} text - 要复制的文本
   * @private
   */
  _fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        this._showToast('URL已复制到剪贴板');
      } else {
        this._showToast('复制URL失败', 'error');
      }
    } catch (err) {
      console.error('回退复制方法错误:', err);
      this._showToast('复制URL失败', 'error');
    }
    
    document.body.removeChild(textArea);
  }
  
  /**
   * 在新标签页打开
   * @private
   */
  _openInNewTab() {
    if (!this.currentResource || !this.currentResource.url) return;
    
    window.open(this.currentResource.url, '_blank');
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

export default PreviewModal;
