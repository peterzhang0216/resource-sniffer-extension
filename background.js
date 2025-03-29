let resources = {};

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getResources') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0].id.toString();
      sendResponse({ resources: resources[tabId] || [] });
    });
    return true; // Required for async sendResponse
  } else if (message.action === 'downloadResource') {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: message.saveAs || false
    });
  } else if (message.action === 'addDOMResources') {
    if (sender.tab) {
      const tabId = sender.tab.id.toString();
      if (!resources[tabId]) {
        resources[tabId] = [];
      }
      
      message.resources.forEach(newResource => {
        const existingIndex = resources[tabId].findIndex(r => r.url === newResource.url);
        if (existingIndex === -1) {
          resources[tabId].push(newResource);
        }
      });
      
      chrome.storage.local.set({ resources: resources });
    }
  }
});
