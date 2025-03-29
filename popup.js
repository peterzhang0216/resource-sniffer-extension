let allResources = [];
let selectedResources = new Set();
let currentPreviewResource = null;

document.addEventListener('DOMContentLoaded', () => {
  const filterImages = document.getElementById('filter-images');
  const filterVideos = document.getElementById('filter-videos');
  const filterQuality = document.getElementById('filter-quality');
  const sortBy = document.getElementById('sort-by');
  const refreshBtn = document.getElementById('refresh-btn');
  const selectAll = document.getElementById('select-all');
  const downloadSelectedBtn = document.getElementById('download-selected-btn');
  const resourcesList = document.getElementById('resources-list');
  const noResources = document.getElementById('no-resources');
  const resourceCount = document.getElementById('resource-count');
  const filenameFormat = document.getElementById('filename-format');
  const customFilenameFormat = document.getElementById('custom-filename-format');
  const previewModal = document.getElementById('preview-modal');
  const closeModal = document.querySelector('.close-modal');
  const previewDownloadBtn = document.getElementById('preview-download-btn');
  
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  const downloadHistoryList = document.getElementById('download-history-list');
  const noHistory = document.getElementById('no-history');
  
  const maxConcurrentDownloads = document.getElementById('max-concurrent-downloads');
  const downloadSpeedLimit = document.getElementById('download-speed-limit');
  const categorizeByWebsite = document.getElementById('categorize-by-website');
  const categorizeByType = document.getElementById('categorize-by-type');
  const defaultDownloadPath = document.getElementById('default-download-path');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const resetSettingsBtn = document.getElementById('reset-settings-btn');
  
  const downloadProgressModal = document.getElementById('download-progress-modal');
  const activeDownloadsContainer = document.getElementById('active-downloads-container');
  const queueCount = document.getElementById('queue-count');
  const closeProgressModal = document.getElementById('close-progress-modal');
  
  loadResources();
  loadDownloadHistory();
  loadSettings();

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
      });
      
      document.getElementById(tabId).classList.add('active');
      button.classList.add('active');
    });
  });
  
  filterImages.addEventListener('change', updateResourcesList);
  filterVideos.addEventListener('change', updateResourcesList);
  filterQuality.addEventListener('change', updateResourcesList);
  sortBy.addEventListener('change', updateResourcesList);
  
  refreshBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'scanPage' }, () => {
        loadResources();
      });
    });
  });
  
  saveSettingsBtn.addEventListener('click', saveSettings);
  resetSettingsBtn.addEventListener('click', resetSettings);
  
  closeProgressModal.addEventListener('click', () => {
    downloadProgressModal.style.display = 'none';
  });

  selectAll.addEventListener('change', (e) => {
    const checkboxes = document.querySelectorAll('.resource-checkbox input');
    checkboxes.forEach(checkbox => {
      checkbox.checked = e.target.checked;
      const resourceId = checkbox.getAttribute('data-id');
      if (e.target.checked) {
        selectedResources.add(resourceId);
      } else {
        selectedResources.delete(resourceId);
      }
    });
    updateDownloadButton();
  });

  downloadSelectedBtn.addEventListener('click', downloadSelectedResources);

  filenameFormat.addEventListener('change', () => {
    if (filenameFormat.value === 'custom') {
      customFilenameFormat.style.display = 'block';
    } else {
      customFilenameFormat.style.display = 'none';
    }
  });

  closeModal.addEventListener('click', () => {
    previewModal.style.display = 'none';
    const previewContainer = document.getElementById('preview-container');
    previewContainer.innerHTML = '';
    currentPreviewResource = null;
  });

  previewDownloadBtn.addEventListener('click', () => {
    if (currentPreviewResource) {
      downloadResource(currentPreviewResource);
      previewModal.style.display = 'none';
    }
  });

  window.addEventListener('click', (e) => {
    if (e.target === previewModal) {
      previewModal.style.display = 'none';
      const previewContainer = document.getElementById('preview-container');
      previewContainer.innerHTML = '';
      currentPreviewResource = null;
    } else if (e.target === downloadProgressModal) {
      downloadProgressModal.style.display = 'none';
    }
  });
  
  const downloadSelectedBtnParent = downloadSelectedBtn.parentElement;
  const showProgressBtn = document.createElement('button');
  showProgressBtn.id = 'show-progress-btn';
  showProgressBtn.textContent = '下载进度';
  showProgressBtn.className = 'secondary-btn';
  showProgressBtn.addEventListener('click', showDownloadProgress);
  downloadSelectedBtnParent.appendChild(showProgressBtn);
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'updateDownloadProgress') {
      updateDownloadProgress();
    }
  });
});

function loadResources() {
  chrome.runtime.sendMessage({ action: 'getResources' }, (response) => {
    if (response && response.resources) {
      allResources = response.resources;
      updateResourcesList();
    }
  });
}

function loadDownloadHistory() {
  chrome.runtime.sendMessage({ action: 'getDownloadHistory' }, (response) => {
    if (response && response.history) {
      displayDownloadHistory(response.history);
    }
  });
}

function displayDownloadHistory(history) {
  const downloadHistoryList = document.getElementById('download-history-list');
  const noHistory = document.getElementById('no-history');
  
  if (history.length === 0) {
    downloadHistoryList.innerHTML = '';
    noHistory.style.display = 'block';
    return;
  }
  
  noHistory.style.display = 'none';
  downloadHistoryList.innerHTML = '';
  
  history.sort((a, b) => b.timestamp - a.timestamp);
  
  history.forEach(item => {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    const statusClass = item.state === 'complete' ? 'complete' : 'interrupted';
    const statusText = item.state === 'complete' ? '完成' : '中断';
    
    historyItem.innerHTML = `
      <div class="history-info">
        <div class="history-filename">${item.filename.split('/').pop()}</div>
        <div class="history-details">
          <span class="history-date">${new Date(item.timestamp).toLocaleString()}</span>
          <span class="history-status ${statusClass}">${statusText}</span>
        </div>
      </div>
      ${item.state === 'interrupted' ? `
        <div class="history-actions">
          <div class="history-resume">
            <button class="resume-btn" data-id="${item.downloadId}">恢复下载</button>
          </div>
        </div>
      ` : ''}
    `;
    
    downloadHistoryList.appendChild(historyItem);
    
    if (item.state === 'interrupted') {
      const resumeBtn = historyItem.querySelector('.resume-btn');
      resumeBtn.addEventListener('click', () => {
        resumeDownload(item);
      });
    }
  });
}

function resumeDownload(historyItem) {
  chrome.runtime.sendMessage({
    action: 'resumeDownload',
    historyItem: historyItem
  });
}

function loadSettings() {
  chrome.runtime.sendMessage({ action: 'getDownloadSettings' }, (response) => {
    if (response && response.settings) {
      const settings = response.settings;
      
      document.getElementById('max-concurrent-downloads').value = settings.maxConcurrentDownloads || 2;
      document.getElementById('download-speed-limit').value = settings.downloadSpeedLimit || 0;
      document.getElementById('categorize-by-website').checked = settings.categorizeByWebsite !== false;
      document.getElementById('categorize-by-type').checked = settings.categorizeByType !== false;
      document.getElementById('default-download-path').value = settings.defaultPath || 'downloads/resource-sniffer';
    }
  });
}

function saveSettings() {
  const settings = {
    maxConcurrentDownloads: parseInt(document.getElementById('max-concurrent-downloads').value) || 2,
    downloadSpeedLimit: parseInt(document.getElementById('download-speed-limit').value) || 0,
    categorizeByWebsite: document.getElementById('categorize-by-website').checked,
    categorizeByType: document.getElementById('categorize-by-type').checked,
    defaultPath: document.getElementById('default-download-path').value || 'downloads/resource-sniffer'
  };
  
  chrome.runtime.sendMessage({
    action: 'updateDownloadSettings',
    settings: settings
  }, (response) => {
    if (response && response.success) {
      alert('设置已保存');
    }
  });
}

function resetSettings() {
  document.getElementById('max-concurrent-downloads').value = 2;
  document.getElementById('download-speed-limit').value = 0;
  document.getElementById('categorize-by-website').checked = true;
  document.getElementById('categorize-by-type').checked = true;
  document.getElementById('default-download-path').value = 'downloads/resource-sniffer';
  
  saveSettings();
}

function showDownloadProgress() {
  const downloadProgressModal = document.getElementById('download-progress-modal');
  downloadProgressModal.style.display = 'block';
  
  updateDownloadProgress();
}

function updateDownloadProgress() {
  chrome.runtime.sendMessage({ action: 'getActiveDownloads' }, (response) => {
    if (response && response.activeDownloads) {
      displayActiveDownloads(response.activeDownloads, response.queueCount || 0);
    }
  });
}

function displayActiveDownloads(activeDownloads, queueCount) {
  const activeDownloadsContainer = document.getElementById('active-downloads-container');
  const queueCountElement = document.getElementById('queue-count');
  
  activeDownloadsContainer.innerHTML = '';
  queueCountElement.textContent = queueCount;
  
  if (Object.keys(activeDownloads).length === 0) {
    activeDownloadsContainer.innerHTML = '<div class="no-active-downloads">当前没有活动下载</div>';
    return;
  }
  
  for (const [downloadId, download] of Object.entries(activeDownloads)) {
    const downloadItem = document.createElement('div');
    downloadItem.className = 'download-item';
    
    const progress = download.bytesReceived && download.totalBytes ? 
      Math.round((download.bytesReceived / download.totalBytes) * 100) : 0;
    
    const bytesReceived = download.bytesReceived ? formatFileSize(download.bytesReceived) : '0 B';
    const totalBytes = download.totalBytes ? formatFileSize(download.totalBytes) : '未知';
    
    downloadItem.innerHTML = `
      <div class="download-item-header">
        <div class="download-filename">${download.filename.split('/').pop()}</div>
      </div>
      <div class="download-progress-bar">
        <div class="download-progress-fill" style="width: ${progress}%"></div>
      </div>
      <div class="download-details">
        <div class="download-progress-text">${progress}%</div>
        <div class="download-size">${bytesReceived} / ${totalBytes}</div>
      </div>
    `;
    
    activeDownloadsContainer.appendChild(downloadItem);
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateResourcesList() {
  const filterImages = document.getElementById('filter-images').checked;
  const filterVideos = document.getElementById('filter-videos').checked;
  const filterQuality = document.getElementById('filter-quality').value;
  const sortBy = document.getElementById('sort-by').value;
  const resourcesList = document.getElementById('resources-list');
  const noResources = document.getElementById('no-resources');
  const resourceCount = document.getElementById('resource-count');
  
  function generateVideoThumbnail(videoElement) {
    try {
      videoElement.currentTime = 1.0; // Set to 1 second to avoid black frames at the beginning
      videoElement.addEventListener('loadeddata', function() {
        videoElement.style.display = 'block';
      });
    } catch (e) {
      console.error('Error generating video thumbnail:', e);
    }
  }
  
  let filteredResources = allResources.filter(resource => {
    if (resource.type === 'image' && filterImages) return true;
    if (resource.type === 'video' && filterVideos) return true;
    return false;
  });
  
  if (filterQuality !== 'all') {
    filteredResources = filteredResources.filter(resource => resource.quality === filterQuality);
  }
  
  filteredResources.sort((a, b) => {
    switch (sortBy) {
      case 'size-desc':
        return b.size - a.size;
      case 'size-asc':
        return a.size - b.size;
      case 'time-desc':
        return b.timestamp - a.timestamp;
      case 'time-asc':
        return a.timestamp - b.timestamp;
      default:
        return 0;
    }
  });
  
  if (filteredResources.length === 0) {
    resourcesList.innerHTML = '';
    noResources.style.display = 'block';
  } else {
    noResources.style.display = 'none';
    resourcesList.innerHTML = '';
    
    filteredResources.forEach((resource, index) => {
      const resourceItem = document.createElement('div');
      resourceItem.className = 'resource-item';
      
      const isSelected = selectedResources.has(resource.url);
      
      let thumbnailHtml = '';
      if (resource.type === 'image') {
        thumbnailHtml = `<img src="${resource.url}" class="thumbnail" alt="Thumbnail" data-url="${resource.url}">`;
      } else {
        const posterAttr = resource.thumbnailUrl ? `poster="${resource.thumbnailUrl}"` : '';
        thumbnailHtml = `<div class="video-thumbnail" data-url="${resource.url}">
          <video width="50" height="50" preload="metadata" ${posterAttr} style="object-fit: cover;">
            <source src="${resource.url}" type="${resource.contentType}">
          </video>
          <div class="play-icon">▶</div>
        </div>`;
      }
      
      resourceItem.innerHTML = `
        <div class="resource-checkbox">
          <input type="checkbox" data-id="${resource.url}" ${isSelected ? 'checked' : ''}>
        </div>
        ${thumbnailHtml}
        <div class="resource-info">
          <div class="resource-name">${resource.filename}</div>
          <div class="resource-details">
            <span class="resource-type">${resource.contentType}</span>
            <span class="resource-size">${resource.sizeFormatted}</span>
          </div>
        </div>
        <div class="resource-actions">
          <div class="resource-preview">
            <button class="preview-btn" data-url="${resource.url}">预览</button>
          </div>
          <div class="resource-download">
            <button class="download-btn" data-url="${resource.url}" data-filename="${resource.filename}">下载</button>
          </div>
        </div>
      `;
      
      resourcesList.appendChild(resourceItem);
      
      const checkbox = resourceItem.querySelector('.resource-checkbox input');
      checkbox.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedResources.add(resource.url);
        } else {
          selectedResources.delete(resource.url);
          document.getElementById('select-all').checked = false;
        }
        updateDownloadButton();
      });
      
      const downloadBtn = resourceItem.querySelector('.download-btn');
      downloadBtn.addEventListener('click', () => {
        downloadResource(resource);
      });
      
      const previewBtn = resourceItem.querySelector('.preview-btn');
      previewBtn.addEventListener('click', () => {
        openPreviewModal(resource);
      });
      
      const thumbnail = resourceItem.querySelector('.thumbnail, .video-thumbnail');
      if (thumbnail) {
        thumbnail.addEventListener('click', () => {
          openPreviewModal(resource);
        });
        
        if (resource.type === 'video') {
          const videoElement = thumbnail.querySelector('video');
          if (videoElement) {
            generateVideoThumbnail(videoElement);
          }
        }
      }
    });
  }
  
  resourceCount.textContent = filteredResources.length;
  
  updateSelectAllCheckbox();
  
  updateDownloadButton();
}

function updateSelectAllCheckbox() {
  const checkboxes = document.querySelectorAll('.resource-checkbox input');
  const selectAll = document.getElementById('select-all');
  
  if (checkboxes.length === 0) {
    selectAll.checked = false;
    selectAll.disabled = true;
  } else {
    selectAll.disabled = false;
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
    selectAll.checked = allChecked;
  }
}

function updateDownloadButton() {
  const downloadSelectedBtn = document.getElementById('download-selected-btn');
  downloadSelectedBtn.disabled = selectedResources.size === 0;
}

function openPreviewModal(resource) {
  const previewModal = document.getElementById('preview-modal');
  const previewContainer = document.getElementById('preview-container');
  const previewFilename = document.getElementById('preview-filename');
  const previewType = document.getElementById('preview-type');
  const previewSize = document.getElementById('preview-size');
  
  previewContainer.innerHTML = '';
  
  currentPreviewResource = resource;
  
  if (resource.type === 'image') {
    const img = document.createElement('img');
    img.src = resource.url;
    img.alt = resource.filename;
    previewContainer.appendChild(img);
  } else if (resource.type === 'video') {
    const video = document.createElement('video');
    video.src = resource.url;
    video.controls = true;
    video.autoplay = false;
    previewContainer.appendChild(video);
  }
  
  previewFilename.textContent = resource.filename;
  previewType.textContent = `类型: ${resource.contentType}`;
  previewSize.textContent = `大小: ${resource.sizeFormatted}`;
  
  previewModal.style.display = 'block';
}

function getFormattedFilename(resource) {
  const filenameFormat = document.getElementById('filename-format').value;
  const customFormat = document.getElementById('custom-filename-format').value;
  const downloadPath = document.getElementById('download-path').value;
  
  let filename = resource.filename;
  const timestamp = new Date().getTime();
  const fileExtension = resource.filename.split('.').pop();
  const fileBaseName = resource.filename.split('.').slice(0, -1).join('.');
  
  let siteName = 'website';
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].url) {
      try {
        siteName = new URL(tabs[0].url).hostname.replace('www.', '');
      } catch (e) {
        console.error('Error parsing URL:', e);
      }
    }
  });
  
  switch (filenameFormat) {
    case 'type-timestamp':
      filename = `${resource.type}-${timestamp}.${fileExtension}`;
      break;
    case 'site-type-index':
      filename = `${siteName}-${resource.type}-${Math.floor(Math.random() * 1000)}.${fileExtension}`;
      break;
    case 'custom':
      if (customFormat) {
        filename = customFormat
          .replace('{site}', siteName)
          .replace('{type}', resource.type)
          .replace('{index}', Math.floor(Math.random() * 1000))
          .replace('{timestamp}', timestamp)
          .replace('{basename}', fileBaseName)
          .replace('{ext}', fileExtension);
        
        if (!filename.includes('.')) {
          filename += `.${fileExtension}`;
        }
      }
      break;
    default:
      break;
  }
  
  if (downloadPath) {
    filename = `${downloadPath}/${filename}`;
  }
  
  return filename;
}

function downloadResource(resource) {
  const filename = getFormattedFilename(resource);
  
  chrome.runtime.sendMessage({
    action: 'downloadResource',
    url: resource.url,
    filename: filename
  });
}

function downloadSelectedResources() {
  const resources = allResources.filter(resource => selectedResources.has(resource.url));
  
  resources.forEach(resource => {
    const filename = getFormattedFilename(resource);
    
    chrome.runtime.sendMessage({
      action: 'downloadResource',
      url: resource.url,
      filename: filename
    });
  });
}
