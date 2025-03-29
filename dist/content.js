
function extractImageResources() {
  const images = Array.from(document.querySelectorAll('img'));
  return images.map(img => {
    let quality = 'unknown';
    
    if (img.naturalWidth >= 1920 || img.naturalHeight >= 1080) {
      quality = 'HD';
    } else if (img.naturalWidth >= 1280 || img.naturalHeight >= 720) {
      quality = 'HD';
    } else if (img.naturalWidth >= 640 || img.naturalHeight >= 480) {
      quality = 'SD';
    } else if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      quality = 'LD';
    }
    
    return {
      url: img.src,
      type: 'image',
      contentType: getImageTypeFromUrl(img.src),
      size: 0, // Size will be determined by background script
      sizeFormatted: 'Unknown',
      filename: img.src.split('/').pop().split('?')[0] || 'image',
      timestamp: Date.now(),
      width: img.naturalWidth || 0,
      height: img.naturalHeight || 0,
      quality: quality
    };
  }).filter(img => img.url && !img.url.startsWith('data:') && !img.url.startsWith('blob:'));
}

function extractVideoResources() {
  const videos = Array.from(document.querySelectorAll('video, source'));
  return videos.map(video => {
    const url = video.src || video.currentSrc;
    
    let thumbnailUrl = '';
    let width = 0;
    let height = 0;
    let duration = 0;
    let quality = 'unknown';
    
    if (video.tagName === 'VIDEO') {
      if (video.poster) {
        thumbnailUrl = video.poster;
      }
      
      width = video.videoWidth || 0;
      height = video.videoHeight || 0;
      duration = video.duration || 0;
      
      if (width >= 1920 || height >= 1080) {
        quality = 'HD';
      } else if (width >= 1280 || height >= 720) {
        quality = 'HD';
      } else if (width >= 640 || height >= 480) {
        quality = 'SD';
      } else if (width > 0 && height > 0) {
        quality = 'LD';
      }
    }
    
    return {
      url: url,
      type: 'video',
      contentType: getVideoTypeFromUrl(url),
      size: 0, // Size will be determined by background script
      sizeFormatted: 'Unknown',
      filename: url.split('/').pop().split('?')[0] || 'video',
      timestamp: Date.now(),
      thumbnailUrl: thumbnailUrl,
      width: width,
      height: height,
      duration: duration,
      quality: quality
    };
  }).filter(video => video.url && !video.url.startsWith('data:') && !video.url.startsWith('blob:'));
}

function getImageTypeFromUrl(url) {
  const extension = url.split('.').pop().toLowerCase().split('?')[0];
  const extensionMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp'
  };
  return extensionMap[extension] || 'image/unknown';
}

function getVideoTypeFromUrl(url) {
  const extension = url.split('.').pop().toLowerCase().split('?')[0];
  const extensionMap = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogg': 'video/ogg',
    'mov': 'video/quicktime',
    'mkv': 'video/x-matroska',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    '3gp': 'video/3gpp',
    '3g2': 'video/3gpp2',
    'm3u8': 'application/x-mpegURL'
  };
  return extensionMap[extension] || 'video/unknown';
}

function sendResourcesToBackground() {
  const imageResources = extractImageResources();
  const videoResources = extractVideoResources();
  const allResources = [...imageResources, ...videoResources];
  
  if (allResources.length > 0) {
    chrome.runtime.sendMessage({
      action: 'addDOMResources',
      resources: allResources
    });
  }
}

window.addEventListener('load', () => {
  sendResourcesToBackground();
});

document.addEventListener('DOMContentLoaded', () => {
  sendResourcesToBackground();
});

const observer = new MutationObserver(() => {
  sendResourcesToBackground();
});

observer.observe(document.body, { 
  childList: true, 
  subtree: true 
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scanPage') {
    sendResourcesToBackground();
    sendResponse({ success: true });
  } else if (message.action === 'downloadAllMedia') {
    sendResourcesToBackground();
    const siteName = window.location.hostname.replace('www.', '');
    chrome.runtime.sendMessage({
      action: 'downloadSelectedResources',
      resources: [...extractImageResources(), ...extractVideoResources()],
      siteName: siteName
    });
  }
});
