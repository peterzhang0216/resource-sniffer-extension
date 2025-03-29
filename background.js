let resourceWorker;
try {
  resourceWorker = new Worker(chrome.runtime.getURL('resource-worker.js'));
  resourceWorker.onmessage = (e) => {
    if (e.data.action === 'analysisComplete') {
      const enhancedResource = e.data.resourceData.originalData;
      Object.assign(enhancedResource, e.data.resourceData.enhancedData);
      
      updateResourceData(enhancedResource);
    }
  };
} catch (e) {
  console.error('Failed to create worker:', e);
}

let resources = {};
let resourceCache = new Map(); // URL -> 资源对象的映射，用于快速查找
let downloadHistory = [];
let activeDownloads = {};
let downloadQueue = [];
let isDownloading = false;
let downloadSettings = {
  maxConcurrentDownloads: 2,
  downloadSpeedLimit: 0, // 0表示不限速，单位为KB/s
  categorizeByWebsite: true,
  categorizeByType: true,
  defaultPath: 'downloads/resource-sniffer'
};

const mediaTypes = {
  images: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
    'image/x-icon', 'image/tiff', 'image/vnd.microsoft.icon'
  ],
  videos: [
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska',
    'video/x-ms-wmv', 'video/x-flv', 'video/3gpp', 'video/3gpp2', 'application/x-mpegURL',
    'application/dash+xml', 'video/mp2t', 'video/x-msvideo', 'video/mpeg'
  ],
  audio: [
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac',
    'audio/flac', 'audio/x-m4a'
  ]
};

const streamingFormats = {
  hls: ['.m3u8', '/playlist/', '/manifest/', '/hls/'],
  dash: ['.mpd', '/dash/']
};

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} - 格式化后的大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 添加或更新资源
 * @param {string} tabId - 标签页ID
 * @param {Object} resource - 资源对象
 * @returns {boolean} - 是否为新资源
 */
function addResource(tabId, resource) {
  if (!resource || !resource.url) return false;
  
  const cacheKey = `${tabId}:${resource.url}`;
  if (resourceCache.has(cacheKey)) {
    const existingResource = resourceCache.get(cacheKey);
    Object.assign(existingResource, resource);
    return false;
  }
  
  if (!resources[tabId]) {
    resources[tabId] = [];
  }
  
  resources[tabId].push(resource);
  resourceCache.set(cacheKey, resource);
  
  if (resourceWorker && !resource.analyzed) {
    try {
      resourceWorker.postMessage({
        action: 'analyze',
        data: resource
      });
      resource.analyzed = true;
    } catch (e) {
      console.error('发送资源到Worker失败:', e);
    }
  }
  
  chrome.storage.local.set({ resources: resources });
  
  return true;
}

/**
 * 更新资源数据
 * @param {Object} resource - 更新后的资源对象
 */
function updateResourceData(resource) {
  if (!resource || !resource.url || !resource.tabId) return;
  
  const tabId = resource.tabId.toString();
  const cacheKey = `${tabId}:${resource.url}`;
  
  if (resourceCache.has(cacheKey)) {
    const existingResource = resourceCache.get(cacheKey);
    Object.assign(existingResource, resource);
    
    chrome.runtime.sendMessage({
      action: 'resourceUpdated',
      resource: existingResource
    });
  }
}

/**
 * 检测资源类型
 * @param {string} contentType - Content-Type头
 * @param {string} url - 资源URL
 * @returns {string|null} - 资源类型
 */
function detectResourceType(contentType, url) {
  if (mediaTypes.images.some(type => contentType.includes(type))) {
    return 'image';
  } else if (mediaTypes.videos.some(type => contentType.includes(type))) {
    return 'video';
  } else if (mediaTypes.audio.some(type => contentType.includes(type))) {
    return 'audio';
  }
  
  const lowercaseUrl = url.toLowerCase();
  
  if (streamingFormats.hls.some(pattern => lowercaseUrl.includes(pattern))) {
    return 'video';
  } else if (streamingFormats.dash.some(pattern => lowercaseUrl.includes(pattern))) {
    return 'video';
  }
  
  const extension = url.split('.').pop().toLowerCase().split('?')[0];
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(extension)) {
    return 'image';
  } else if (['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi', 'flv', '3gp'].includes(extension)) {
    return 'video';
  } else if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(extension)) {
    return 'audio';
  }
  
  return null;
}

/**
 * 检测是否为流媒体URL
 * @param {string} url - 资源URL
 * @returns {Object|null} - 流媒体信息
 */
function detectStreamingUrl(url) {
  const lowercaseUrl = url.toLowerCase();
  
  if (streamingFormats.hls.some(pattern => lowercaseUrl.includes(pattern))) {
    return {
      type: 'HLS',
      url: url
    };
  }
  
  if (streamingFormats.dash.some(pattern => lowercaseUrl.includes(pattern))) {
    return {
      type: 'DASH',
      url: url
    };
  }
  
  return null;
}

/**
 * 处理流媒体URL
 * @param {string} url - 流媒体URL
 * @param {string} tabId - 标签页ID
 */
async function processStreamingUrl(url, tabId) {
  try {
    chrome.tabs.sendMessage(parseInt(tabId), {
      action: 'analyzeStreamingUrl',
      url: url
    }, response => {
      if (response && response.success && response.segments) {
        response.segments.forEach(segment => {
          segment.tabId = tabId;
          segment.detectionMethod = 'streaming';
          addResource(tabId, segment);
        });
      }
    });
  } catch (e) {
    console.error('处理流媒体URL失败:', e);
  }
}

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.initiator && details.initiator.startsWith('chrome-extension://')) {
      return;
    }

    let contentType = '';
    for (const header of details.responseHeaders || []) {
      if (header.name.toLowerCase() === 'content-type') {
        contentType = header.value.toLowerCase();
        break;
      }
    }

    let contentLength = 0;
    for (const header of details.responseHeaders || []) {
      if (header.name.toLowerCase() === 'content-length') {
        contentLength = parseInt(header.value, 10);
        break;
      }
    }

    const resourceType = detectResourceType(contentType, details.url);
    
    if (resourceType) {
      const tabId = details.tabId.toString();
      
      const resource = {
        url: details.url,
        contentType: contentType,
        type: resourceType,
        size: contentLength,
        sizeFormatted: formatFileSize(contentLength),
        filename: details.url.split('/').pop().split('?')[0] || 'file',
        timestamp: Date.now(),
        tabId: tabId,
        frameId: details.frameId,
        detectionMethod: 'network-request'
      };
      
      addResource(tabId, resource);
      
      const streamingInfo = detectStreamingUrl(details.url);
      if (streamingInfo) {
        resource.isStreaming = true;
        resource.streamType = streamingInfo.type;
        
        processStreamingUrl(details.url, tabId);
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

/**
 * 标签页更新监听
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    const tabIdStr = tabId.toString();
    
    resources[tabIdStr] = [];
    
    const keysToDelete = [];
    resourceCache.forEach((value, key) => {
      if (key.startsWith(`${tabIdStr}:`)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => {
      resourceCache.delete(key);
    });
    
    chrome.storage.local.set({ resources: resources });
  }
});

/**
 * 网页导航监听
 */
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) {
    chrome.tabs.sendMessage(details.tabId, { action: 'scanPage' });
  }
});

/**
 * 处理下载队列
 */
function processDownloadQueue() {
  if (downloadQueue.length === 0 || isDownloading) {
    return;
  }

  isDownloading = true;
  const activeDownloadCount = Object.keys(activeDownloads).length;
  
  if (activeDownloadCount >= downloadSettings.maxConcurrentDownloads) {
    isDownloading = false;
    return;
  }

  const downloadItem = downloadQueue.shift();
  
  let filename = downloadItem.filename;
  if (downloadSettings.categorizeByWebsite || downloadSettings.categorizeByType) {
    const pathParts = [];
    
    if (downloadSettings.categorizeByWebsite && downloadItem.siteName) {
      pathParts.push(downloadItem.siteName);
    }
    
    if (downloadSettings.categorizeByType && downloadItem.type) {
      pathParts.push(downloadItem.type + 's'); // 加s表示复数，如images, videos
    }
    
    if (pathParts.length > 0) {
      const originalPath = filename.split('/');
      const originalFilename = originalPath.pop();
      const newPath = [...originalPath, ...pathParts, originalFilename].join('/');
      filename = newPath;
    }
  }
  
  if (downloadItem.resource && downloadItem.resource.quality && 
      downloadItem.resource.quality !== 'unknown') {
    const filenameParts = filename.split('.');
    const extension = filenameParts.pop();
    filename = filenameParts.join('.') + '-' + downloadItem.resource.quality + '.' + extension;
  }
  
  chrome.downloads.download({
    url: downloadItem.url,
    filename: filename,
    saveAs: downloadItem.saveAs || false
  }, (downloadId) => {
    if (downloadId) {
      activeDownloads[downloadId] = {
        url: downloadItem.url,
        filename: filename,
        startTime: Date.now(),
        resource: downloadItem.resource,
        siteName: downloadItem.siteName,
        type: downloadItem.type
      };
      
      chrome.runtime.sendMessage({
        action: 'downloadStarted',
        downloadId: downloadId,
        resource: downloadItem.resource
      });
    }
    
    setTimeout(() => {
      isDownloading = false;
      processDownloadQueue();
    }, calculateDelay(downloadSettings.downloadSpeedLimit));
  });
}

/**
 * 计算下载延迟
 * @param {number} speedLimit - 速度限制(KB/s)
 * @returns {number} - 延迟时间(ms)
 */
function calculateDelay(speedLimit) {
  if (!speedLimit || speedLimit <= 0) {
    return 0; // 不限速
  }
  
  const averageFileSizeKB = 1024;
  const delayMs = (averageFileSizeKB / speedLimit) * 1000;
  return Math.min(delayMs, 5000); // 最大延迟5秒
}

/**
 * 下载状态变化监听
 */
chrome.downloads.onChanged.addListener((delta) => {
  if (!activeDownloads[delta.id]) {
    return;
  }
  
  const download = activeDownloads[delta.id];
  
  if (delta.bytesReceived) {
    download.bytesReceived = delta.bytesReceived.current;
    
    chrome.runtime.sendMessage({
      action: 'updateDownloadProgress',
      downloadId: delta.id,
      bytesReceived: delta.bytesReceived.current,
      totalBytes: delta.totalBytes ? delta.totalBytes.current : 0
    });
  }
  
  if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
    const historyItem = {
      url: download.url,
      filename: download.filename,
      downloadId: delta.id,
      state: delta.state.current,
      timestamp: Date.now(),
      resource: download.resource,
      siteName: download.siteName,
      type: download.type
    };
    
    downloadHistory.push(historyItem);
    if (downloadHistory.length > 100) {
      downloadHistory.shift();
    }
    
    chrome.storage.local.set({ downloadHistory: downloadHistory });
    
    delete activeDownloads[delta.id];
    
    chrome.runtime.sendMessage({
      action: 'downloadCompleted',
      downloadId: delta.id,
      historyItem: historyItem
    });
    
    processDownloadQueue();
  }
});

/**
 * 创建上下文菜单
 */
function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'downloadImage',
      title: '使用Resource Sniffer下载图片',
      contexts: ['image'],
    });
    
    chrome.contextMenus.create({
      id: 'downloadVideo',
      title: '使用Resource Sniffer下载视频',
      contexts: ['video'],
    });
    
    chrome.contextMenus.create({
      id: 'downloadAudio',
      title: '使用Resource Sniffer下载音频',
      contexts: ['audio'],
    });
    
    chrome.contextMenus.create({
      id: 'downloadMedia',
      title: '下载所有媒体资源',
      contexts: ['page'],
    });
    
    chrome.contextMenus.create({
      id: 'scanPage',
      title: '重新扫描页面资源',
      contexts: ['page'],
    });
    
    chrome.contextMenus.create({
      id: 'analyzeStreaming',
      title: '分析流媒体资源',
      contexts: ['link'],
      targetUrlPatterns: [
        '*://*/*.m3u8*',
        '*://*/*.mpd*',
        '*://*/*playlist*',
        '*://*/*manifest*',
        '*://*/*dash*'
      ]
    });
  });
}

/**
 * 上下文菜单点击监听
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'downloadImage' && info.srcUrl) {
    addToDownloadQueue({
      url: info.srcUrl,
      filename: info.srcUrl.split('/').pop().split('?')[0] || 'image.jpg',
      type: 'image',
      siteName: new URL(tab.url).hostname.replace('www.', '')
    });
  } else if (info.menuItemId === 'downloadVideo' && info.srcUrl) {
    addToDownloadQueue({
      url: info.srcUrl,
      filename: info.srcUrl.split('/').pop().split('?')[0] || 'video.mp4',
      type: 'video',
      siteName: new URL(tab.url).hostname.replace('www.', '')
    });
  } else if (info.menuItemId === 'downloadAudio' && info.srcUrl) {
    addToDownloadQueue({
      url: info.srcUrl,
      filename: info.srcUrl.split('/').pop().split('?')[0] || 'audio.mp3',
      type: 'audio',
      siteName: new URL(tab.url).hostname.replace('www.', '')
    });
  } else if (info.menuItemId === 'downloadMedia') {
    chrome.tabs.sendMessage(tab.id, { action: 'downloadAllMedia' });
  } else if (info.menuItemId === 'scanPage') {
    chrome.tabs.sendMessage(tab.id, { action: 'scanPage' });
  } else if (info.menuItemId === 'analyzeStreaming' && info.linkUrl) {
    processStreamingUrl(info.linkUrl, tab.id.toString());
    
    chrome.tabs.sendMessage(tab.id, { 
      action: 'showNotification',
      message: '正在分析流媒体资源，请稍候...'
    });
  }
});

/**
 * 扩展安装/更新监听
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['downloadHistory', 'downloadSettings'], (result) => {
    if (result.downloadHistory) {
      downloadHistory = result.downloadHistory;
    }
    
    if (result.downloadSettings) {
      downloadSettings = {...downloadSettings, ...result.downloadSettings};
    }
    
    createContextMenus();
  });
});

/**
 * 添加下载到队列
 * @param {Object} downloadItem - 下载项
 */
function addToDownloadQueue(downloadItem) {
  downloadQueue.push(downloadItem);
  processDownloadQueue();
}

/**
 * 恢复下载
 * @param {Object} historyItem - 历史记录项
 */
function resumeDownload(historyItem) {
  addToDownloadQueue({
    url: historyItem.url,
    filename: historyItem.filename,
    resource: historyItem.resource,
    type: historyItem.resource ? historyItem.resource.type : 'unknown',
    siteName: historyItem.siteName || 'unknown'
  });
}

/**
 * 键盘快捷键监听
 */
chrome.commands.onCommand.addListener((command) => {
  if (command === 'download-all-resources') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'downloadAllMedia' });
    });
  }
});

/**
 * 消息监听
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getResources') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id.toString();
      sendResponse({ resources: resources[tabId] || [] });
    });
    return true; // Required for async sendResponse
  } 
  else if (message.action === 'downloadResource') {
    addToDownloadQueue({
      url: message.url,
      filename: message.filename,
      saveAs: message.saveAs || false,
      resource: message.resource,
      type: message.resource ? message.resource.type : 'unknown',
      siteName: message.siteName || 'unknown'
    });
  } 
  else if (message.action === 'downloadSelectedResources') {
    message.resources.forEach(resource => {
      addToDownloadQueue({
        url: resource.url,
        filename: resource.filename,
        resource: resource,
        type: resource.type,
        siteName: message.siteName || 'unknown'
      });
    });
  } 
  else if (message.action === 'getDownloadHistory') {
    sendResponse({ history: downloadHistory });
    return true;
  } 
  else if (message.action === 'getDownloadSettings') {
    sendResponse({ settings: downloadSettings });
    return true;
  } 
  else if (message.action === 'updateDownloadSettings') {
    downloadSettings = {...downloadSettings, ...message.settings};
    chrome.storage.local.set({ downloadSettings: downloadSettings });
    sendResponse({ success: true });
    return true;
  } 
  else if (message.action === 'resumeDownload') {
    resumeDownload(message.historyItem);
    sendResponse({ success: true });
    return true;
  } 
  else if (message.action === 'addDOMResources') {
    if (sender.tab) {
      const tabId = sender.tab.id.toString();
      
      message.resources.forEach(newResource => {
        newResource.tabId = tabId;
        
        addResource(tabId, newResource);
      });
    }
  } 
  else if (message.action === 'updateResourceData') {
    if (message.resource) {
      updateResourceData(message.resource);
    }
  } 
  else if (message.action === 'validateResource') {
    const url = message.url;
    
    fetch(url, { method: 'HEAD', cache: 'no-store' })
      .then(response => {
        sendResponse({
          valid: response.ok,
          status: response.status,
          contentType: response.headers.get('content-type'),
          contentLength: response.headers.get('content-length')
        });
      })
      .catch(error => {
        sendResponse({ valid: false, error: error.message });
      });
    
    return true;
  } 
  else if (message.action === 'clearResourceCache') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id.toString();
      
      resources[tabId] = [];
      
      const keysToDelete = [];
      resourceCache.forEach((value, key) => {
        if (key.startsWith(`${tabId}:`)) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => {
        resourceCache.delete(key);
      });
      
      chrome.storage.local.set({ resources: resources });
      
      chrome.tabs.sendMessage(tabs[0].id, { action: 'clearResourceCache' });
      
      sendResponse({ success: true });
    });
    
    return true;
  }
});
