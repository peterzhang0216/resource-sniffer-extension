
let resourceWorker;
try {
  resourceWorker = new Worker(chrome.runtime.getURL('resource-worker.js'));
  resourceWorker.onmessage = (e) => {
    if (e.data.action === 'analysisComplete') {
      const enhancedResource = e.data.resourceData.originalData;
      Object.assign(enhancedResource, e.data.resourceData.enhancedData);
      
      chrome.runtime.sendMessage({
        action: 'updateResourceData',
        resource: enhancedResource
      });
    }
  };
} catch (e) {
  console.error('Failed to create worker:', e);
}

const detectedResources = new Set();
let lastDOMChange = Date.now();
let isScanScheduled = false;
let isScanning = false;

/**
 * 提取图片资源
 * 增强版：检测标准标签、背景图片和自定义属性
 */
function extractImageResources() {
  const images = Array.from(document.querySelectorAll('img'));
  const standardImages = images.map(img => {
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
      quality: quality,
      detectionMethod: 'dom-standard',
      elementType: 'img'
    };
  }).filter(img => img.url && !img.url.startsWith('data:') && !img.url.startsWith('blob:'));
  
  const bgImages = [];
  try {
    Array.from(document.styleSheets).forEach(styleSheet => {
      try {
        const rules = styleSheet.cssRules || styleSheet.rules;
        if (!rules) return;
        
        Array.from(rules).forEach(rule => {
          if (rule.type === 1) { // CSSStyleRule
            const urls = window.ResourceSnifferUtils?.extractImagesFromCSSRule(rule) || [];
            
            urls.forEach(url => {
              let absoluteUrl = url;
              if (url.startsWith('/')) {
                absoluteUrl = window.location.origin + url;
              } else if (!url.startsWith('http')) {
                const baseUrl = styleSheet.href || window.location.href;
                absoluteUrl = new URL(url, baseUrl).href;
              }
              
              bgImages.push({
                url: absoluteUrl,
                type: 'image',
                contentType: getImageTypeFromUrl(absoluteUrl),
                size: 0,
                sizeFormatted: 'Unknown',
                filename: absoluteUrl.split('/').pop().split('?')[0] || 'background-image',
                timestamp: Date.now(),
                quality: 'unknown', // 无法直接知道背景图片尺寸
                detectionMethod: 'css-background',
                cssSelector: rule.selectorText
              });
            });
          }
        });
      } catch (e) {
      }
    });
  } catch (e) {
    console.error('Error extracting CSS background images:', e);
  }
  
  const customAttrImages = [];
  const imgAttributes = ['data-src', 'data-original', 'data-img', 'data-background', 'data-srcset', 'data-original-src', 'lazy-src'];
  
  imgAttributes.forEach(attr => {
    const elements = document.querySelectorAll(`[${attr}]`);
    elements.forEach(el => {
      const url = el.getAttribute(attr);
      if (url && typeof url === 'string' && url.match(/\.(jpe?g|png|gif|webp|svg)/i)) {
        let absoluteUrl = url;
        if (url.startsWith('/')) {
          absoluteUrl = window.location.origin + url;
        } else if (!url.startsWith('http')) {
          absoluteUrl = new URL(url, window.location.href).href;
        }
        
        customAttrImages.push({
          url: absoluteUrl,
          type: 'image',
          contentType: getImageTypeFromUrl(absoluteUrl),
          size: 0,
          sizeFormatted: 'Unknown',
          filename: absoluteUrl.split('/').pop().split('?')[0] || 'lazy-image',
          timestamp: Date.now(),
          quality: 'unknown',
          detectionMethod: 'custom-attribute',
          attributeName: attr,
          elementType: el.tagName.toLowerCase()
        });
      }
    });
  });
  
  const shadowImages = [];
  try {
    const hostElements = document.querySelectorAll('*');
    hostElements.forEach(host => {
      if (host.shadowRoot) {
        const shadowImgs = Array.from(host.shadowRoot.querySelectorAll('img'));
        shadowImgs.forEach(img => {
          shadowImages.push({
            url: img.src,
            type: 'image',
            contentType: getImageTypeFromUrl(img.src),
            size: 0,
            sizeFormatted: 'Unknown',
            filename: img.src.split('/').pop().split('?')[0] || 'shadow-image',
            timestamp: Date.now(),
            width: img.naturalWidth || 0,
            height: img.naturalHeight || 0,
            quality: 'unknown',
            detectionMethod: 'shadow-dom',
            elementType: 'img'
          });
        });
      }
    });
  } catch (e) {
    console.error('Error extracting Shadow DOM images:', e);
  }
  
  return [...standardImages, ...bgImages, ...customAttrImages, ...shadowImages]
    .filter(img => {
      if (!img.url || img.url.startsWith('data:') || img.url.startsWith('blob:')) {
        return false;
      }
      
      if (detectedResources.has(img.url)) {
        return false;
      }
      
      detectedResources.add(img.url);
      return true;
    });
}

/**
 * 提取视频资源
 * 增强版：检测标准视频、流媒体和自定义视频属性
 */
function extractVideoResources() {
  const videos = Array.from(document.querySelectorAll('video, source'));
  const standardVideos = videos.map(video => {
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
      quality: quality,
      detectionMethod: 'dom-standard',
      elementType: video.tagName.toLowerCase()
    };
  }).filter(video => video.url && !video.url.startsWith('data:') && !video.url.startsWith('blob:'));
  
  const customAttrVideos = [];
  const videoAttributes = ['data-video', 'data-src', 'data-mp4', 'data-webm', 'data-source', 'data-video-src'];
  
  videoAttributes.forEach(attr => {
    const elements = document.querySelectorAll(`[${attr}]`);
    elements.forEach(el => {
      const url = el.getAttribute(attr);
      if (url && typeof url === 'string' && url.match(/\.(mp4|webm|ogg|mov|m3u8|mpd)/i)) {
        let absoluteUrl = url;
        if (url.startsWith('/')) {
          absoluteUrl = window.location.origin + url;
        } else if (!url.startsWith('http')) {
          absoluteUrl = new URL(url, window.location.href).href;
        }
        
        customAttrVideos.push({
          url: absoluteUrl,
          type: 'video',
          contentType: getVideoTypeFromUrl(absoluteUrl),
          size: 0,
          sizeFormatted: 'Unknown',
          filename: absoluteUrl.split('/').pop().split('?')[0] || 'custom-video',
          timestamp: Date.now(),
          quality: 'unknown',
          detectionMethod: 'custom-attribute',
          attributeName: attr,
          elementType: el.tagName.toLowerCase()
        });
      }
    });
  });
  
  const iframeVideos = [];
  try {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      const src = iframe.src;
      if (src) {
        if (src.includes('youtube.com/embed/') || 
            src.includes('player.vimeo.com/video/') || 
            src.includes('dailymotion.com/embed/video/')) {
          iframeVideos.push({
            url: src,
            type: 'video',
            contentType: 'video/iframe',
            size: 0,
            sizeFormatted: 'Unknown',
            filename: 'embedded-video',
            timestamp: Date.now(),
            quality: 'unknown',
            detectionMethod: 'iframe',
            elementType: 'iframe',
            platform: src.includes('youtube') ? 'youtube' : 
                     src.includes('vimeo') ? 'vimeo' : 
                     src.includes('dailymotion') ? 'dailymotion' : 'unknown'
          });
        }
      }
    });
  } catch (e) {
    console.error('Error extracting iframe videos:', e);
  }
  
  const streamingVideos = [];
  const hlsPatterns = ['.m3u8', '/playlist/', '/manifest/', '/hls/'];
  const dashPatterns = ['.mpd', '/dash/'];
  
  const links = document.querySelectorAll('a[href]');
  links.forEach(link => {
    const href = link.href;
    if (href) {
      if (hlsPatterns.some(pattern => href.includes(pattern))) {
        streamingVideos.push({
          url: href,
          type: 'video',
          contentType: 'application/x-mpegURL',
          size: 0,
          sizeFormatted: 'Unknown',
          filename: href.split('/').pop() || 'hls-stream',
          timestamp: Date.now(),
          quality: 'unknown',
          detectionMethod: 'streaming-link',
          streamType: 'HLS'
        });
      }
      else if (dashPatterns.some(pattern => href.includes(pattern))) {
        streamingVideos.push({
          url: href,
          type: 'video',
          contentType: 'application/dash+xml',
          size: 0,
          sizeFormatted: 'Unknown',
          filename: href.split('/').pop() || 'dash-stream',
          timestamp: Date.now(),
          quality: 'unknown',
          detectionMethod: 'streaming-link',
          streamType: 'DASH'
        });
      }
    }
  });
  
  return [...standardVideos, ...customAttrVideos, ...iframeVideos, ...streamingVideos]
    .filter(video => {
      if (!video.url || video.url.startsWith('data:') || video.url.startsWith('blob:')) {
        return false;
      }
      
      if (detectedResources.has(video.url)) {
        return false;
      }
      
      detectedResources.add(video.url);
      return true;
    });
}

/**
 * 从URL获取图片类型
 */
function getImageTypeFromUrl(url) {
  const extension = url.split('.').pop().toLowerCase().split('?')[0];
  const extensionMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    'tiff': 'image/tiff',
    'tif': 'image/tiff'
  };
  return extensionMap[extension] || 'image/unknown';
}

/**
 * 从URL获取视频类型
 */
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
    'm3u8': 'application/x-mpegURL',
    'mpd': 'application/dash+xml',
    'ts': 'video/mp2t',
    'avi': 'video/x-msvideo'
  };
  return extensionMap[extension] || 'video/unknown';
}

/**
 * 增强版：使用增量扫描和批处理发送资源
 */
function sendResourcesToBackground() {
  if (isScanning) return;
  
  isScanning = true;
  
  try {
    const imageResources = extractImageResources();
    const videoResources = extractVideoResources();
    const allResources = [...imageResources, ...videoResources];
    
    if (allResources.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < allResources.length; i += batchSize) {
        const batch = allResources.slice(i, i + batchSize);
        
        chrome.runtime.sendMessage({
          action: 'addDOMResources',
          resources: batch
        });
        
        if (resourceWorker) {
          batch.forEach(resource => {
            resourceWorker.postMessage({
              action: 'analyze',
              data: resource
            });
          });
        }
      }
    }
  } catch (e) {
    console.error('Error scanning resources:', e);
  } finally {
    isScanning = false;
  }
}

/**
 * 增强版：智能扫描调度
 */
function scheduleScan() {
  if (isScanScheduled) return;
  
  isScanScheduled = true;
  
  const timeSinceLastChange = Date.now() - lastDOMChange;
  const delay = timeSinceLastChange < 1000 ? 1000 : 0;
  
  setTimeout(() => {
    sendResourcesToBackground();
    isScanScheduled = false;
  }, delay);
}

window.addEventListener('load', () => {
  scheduleScan();
});

document.addEventListener('DOMContentLoaded', () => {
  scheduleScan();
});

const observer = new MutationObserver((mutations) => {
  lastDOMChange = Date.now();
  
  const hasRelevantChanges = mutations.some(mutation => {
    if (mutation.addedNodes.length > 0) {
      return Array.from(mutation.addedNodes).some(node => {
        return node.nodeType === 1 && (
          node.tagName === 'IMG' || 
          node.tagName === 'VIDEO' || 
          node.tagName === 'SOURCE' ||
          node.tagName === 'IFRAME' ||
          node.querySelector('img, video, source, iframe')
        );
      });
    }
    
    if (mutation.type === 'attributes') {
      const target = mutation.target;
      if (target.nodeType === 1) {
        const attrName = mutation.attributeName;
        return attrName === 'src' || attrName === 'poster' || attrName.startsWith('data-');
      }
    }
    
    return false;
  });
  
  if (hasRelevantChanges) {
    scheduleScan();
  }
});

observer.observe(document.body, { 
  childList: true, 
  subtree: true,
  attributes: true,
  attributeFilter: ['src', 'poster', 'data-src', 'data-original', 'href']
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
  } else if (message.action === 'clearResourceCache') {
    detectedResources.clear();
    sendResponse({ success: true });
  } else if (message.action === 'analyzeStreamingUrl') {
    const url = message.url;
    if (url && window.ResourceSnifferUtils) {
      window.ResourceSnifferUtils.parseStreamingUrl(url)
        .then(segments => {
          sendResponse({ success: true, segments: segments });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true; // 异步响应
    }
    sendResponse({ success: false, error: 'Invalid URL or utils not available' });
  }
});
