let resources = {};
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
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'
  ],
  videos: [
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska',
    'video/x-ms-wmv', 'video/x-flv', 'video/3gpp', 'video/3gpp2', 'application/x-mpegURL'
  ]
};

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

    let resourceType = null;
    if (mediaTypes.images.some(type => contentType.includes(type))) {
      resourceType = 'image';
    } else if (mediaTypes.videos.some(type => contentType.includes(type))) {
      resourceType = 'video';
    }

    if (resourceType) {
      const tabId = details.tabId.toString();
      if (!resources[tabId]) {
        resources[tabId] = [];
      }

      const existingIndex = resources[tabId].findIndex(r => r.url === details.url);
      if (existingIndex !== -1) {
        resources[tabId][existingIndex].contentType = contentType;
        resources[tabId][existingIndex].size = contentLength;
        resources[tabId][existingIndex].sizeFormatted = formatFileSize(contentLength);
      } else {
        resources[tabId].push({
          url: details.url,
          contentType: contentType,
          type: resourceType,
          size: contentLength,
          sizeFormatted: formatFileSize(contentLength),
          filename: details.url.split('/').pop().split('?')[0] || 'file',
          timestamp: Date.now()
        });
      }

      chrome.storage.local.set({ resources: resources });
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    const tabIdStr = tabId.toString();
    resources[tabIdStr] = [];
    chrome.storage.local.set({ resources: resources });
  }
});

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
        resource: downloadItem.resource
      };
    }
    
    setTimeout(() => {
      isDownloading = false;
      processDownloadQueue();
    }, calculateDelay(downloadSettings.downloadSpeedLimit));
  });
}

function calculateDelay(speedLimit) {
  if (!speedLimit || speedLimit <= 0) {
    return 0; // 不限速
  }
  
  const averageFileSizeKB = 1024;
  const delayMs = (averageFileSizeKB / speedLimit) * 1000;
  return Math.min(delayMs, 5000); // 最大延迟5秒
}

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
      resource: download.resource
    };
    
    downloadHistory.push(historyItem);
    if (downloadHistory.length > 100) {
      downloadHistory.shift();
    }
    
    chrome.storage.local.set({ downloadHistory: downloadHistory });
    
    delete activeDownloads[delta.id];
    
    processDownloadQueue();
  }
});

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
      id: 'downloadMedia',
      title: '下载所有媒体资源',
      contexts: ['page'],
    });
  });
}

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
  } else if (info.menuItemId === 'downloadMedia') {
    chrome.tabs.sendMessage(tab.id, { action: 'downloadAllMedia' });
  }
});

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

function addToDownloadQueue(downloadItem) {
  downloadQueue.push(downloadItem);
  processDownloadQueue();
}

function resumeDownload(historyItem) {
  addToDownloadQueue({
    url: historyItem.url,
    filename: historyItem.filename,
    resource: historyItem.resource,
    type: historyItem.resource ? historyItem.resource.type : 'unknown',
    siteName: historyItem.siteName || 'unknown'
  });
}

chrome.commands.onCommand.addListener((command) => {
  if (command === 'download-all-resources') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'downloadAllMedia' });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getResources') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id.toString();
      sendResponse({ resources: resources[tabId] || [] });
    });
    return true; // Required for async sendResponse
  } else if (message.action === 'downloadResource') {
    addToDownloadQueue({
      url: message.url,
      filename: message.filename,
      saveAs: message.saveAs || false,
      resource: message.resource,
      type: message.resource ? message.resource.type : 'unknown',
      siteName: message.siteName || 'unknown'
    });
  } else if (message.action === 'downloadSelectedResources') {
    message.resources.forEach(resource => {
      addToDownloadQueue({
        url: resource.url,
        filename: resource.filename,
        resource: resource,
        type: resource.type,
        siteName: message.siteName || 'unknown'
      });
    });
  } else if (message.action === 'getDownloadHistory') {
    sendResponse({ history: downloadHistory });
    return true;
  } else if (message.action === 'getDownloadSettings') {
    sendResponse({ settings: downloadSettings });
    return true;
  } else if (message.action === 'updateDownloadSettings') {
    downloadSettings = {...downloadSettings, ...message.settings};
    chrome.storage.local.set({ downloadSettings: downloadSettings });
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'resumeDownload') {
    resumeDownload(message.historyItem);
    sendResponse({ success: true });
    return true;
  } else if (message.action === 'addDOMResources') {
    if (sender.tab) {
      const tabId = sender.tab.id.toString();
      if (!resources[tabId]) {
        resources[tabId] = [];
      }
      
      message.resources.forEach(newResource => {
        const existingIndex = resources[tabId].findIndex(r => {
          if (r.url === newResource.url) return true;
          
          if (window.ResourceSnifferUtils && window.ResourceSnifferUtils.computeUrlSimilarity) {
            const similarity = window.ResourceSnifferUtils.computeUrlSimilarity(r.url, newResource.url);
            return similarity > 0.85; // 相似度阈值
          }
          
          return false;
        });
        
        if (existingIndex === -1) {
          if (window.ResourceSnifferUtils && window.ResourceSnifferUtils.calculateResourceScore) {
            const scoreResult = window.ResourceSnifferUtils.calculateResourceScore(newResource);
            newResource.score = scoreResult.score;
            newResource.scoreDetails = scoreResult.details;
          }
          
          resources[tabId].push(newResource);
        } else {
          const existingResource = resources[tabId][existingIndex];
          
          if (newResource.width && newResource.height) {
            if (!existingResource.width || !existingResource.height || 
                (newResource.width * newResource.height > existingResource.width * existingResource.height)) {
              existingResource.width = newResource.width;
              existingResource.height = newResource.height;
            }
          }
          
          if (newResource.quality && newResource.quality !== 'unknown') {
            existingResource.quality = newResource.quality;
          }
          
          if (newResource.source && !existingResource.sources) {
            existingResource.sources = [existingResource.source || 'unknown'];
          }
          
          if (newResource.source && existingResource.sources && 
              !existingResource.sources.includes(newResource.source)) {
            existingResource.sources.push(newResource.source);
          }
        }
      });
      
      chrome.storage.local.set({ resources: resources });
    }
  } else if (message.action === 'addPredictedResources') {
    if (sender.tab) {
      const tabId = sender.tab.id.toString();
      if (!resources[tabId]) {
        resources[tabId] = [];
      }
      
      message.resources.forEach(newResource => {
        const existingIndex = resources[tabId].findIndex(r => {
          if (r.url === newResource.url) return true;
          
          if (window.ResourceSnifferUtils && window.ResourceSnifferUtils.computeUrlSimilarity) {
            const similarity = window.ResourceSnifferUtils.computeUrlSimilarity(r.url, newResource.url);
            return similarity > 0.7; // 预测资源使用较低的相似度阈值
          }
          
          return false;
        });
        
        if (existingIndex === -1) {
          newResource.confidence = newResource.confidence || 0.7;
          newResource.isPredicted = true;
          
          if (window.ResourceSnifferUtils && window.ResourceSnifferUtils.calculateResourceScore) {
            const scoreResult = window.ResourceSnifferUtils.calculateResourceScore(newResource);
            newResource.score = scoreResult.score;
            newResource.scoreDetails = scoreResult.details;
          }
          
          resources[tabId].push(newResource);
        }
      });
      
      chrome.storage.local.set({ resources: resources });
    }
  }
});
