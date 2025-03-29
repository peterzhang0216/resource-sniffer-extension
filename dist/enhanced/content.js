
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
  const standardResources = [...extractImageResources(), ...extractVideoResources()];
  
  const styleResources = extractCSSResources();
  
  const shadowResources = extractShadowDOMResources();
  
  const attributeResources = extractAttributeResources();
  
  const nestedResources = extractNestedResources();
  
  const streamingResources = extractStreamingResources();
  
  const allResources = [
    ...standardResources, 
    ...styleResources, 
    ...shadowResources, 
    ...attributeResources,
    ...nestedResources,
    ...streamingResources
  ];
  
  if (allResources.length > 0) {
    chrome.runtime.sendMessage({
      action: 'addDOMResources',
      resources: allResources
    });
  }
  
  if (window.predictionWorker) {
    window.predictionWorker.postMessage({
      action: 'predict',
      url: window.location.href,
      html: document.documentElement.outerHTML
    });
  }
}

function initPredictionWorker() {
  if (window.Worker && !window.predictionWorker) {
    window.predictionWorker = new Worker('resource-worker.js');
    window.predictionWorker.onmessage = function(e) {
      const { action, predictedResources } = e.data;
      if (action === 'predictionComplete' && predictedResources.length > 0) {
        chrome.runtime.sendMessage({
          action: 'addPredictedResources',
          resources: predictedResources
        });
      }
    };
  }
}

window.addEventListener('load', () => {
  initPredictionWorker();
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

function extractCSSResources() {
  const cssResources = [];
  
  try {
    const styleSheets = Array.from(document.styleSheets);
    for (const sheet of styleSheets) {
      try {
        if (sheet.href && new URL(sheet.href).origin !== window.location.origin) continue;
        
        const rules = Array.from(sheet.cssRules || []);
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) {
            const imageUrls = ResourceSnifferUtils.extractImagesFromCSSRule(rule);
            
            for (const url of imageUrls) {
              const absoluteUrl = new URL(url, rule.parentStyleSheet?.href || window.location.href).href;
              cssResources.push({
                url: absoluteUrl,
                type: 'image',
                contentType: getImageTypeFromUrl(absoluteUrl),
                size: 0,
                sizeFormatted: 'Unknown',
                filename: absoluteUrl.split('/').pop().split('?')[0] || 'css-image',
                timestamp: Date.now(),
                source: 'css',
                quality: 'unknown'
              });
            }
          }
        }
      } catch (e) {
        console.warn('无法访问样式表规则:', e);
      }
    }
  } catch (e) {
    console.warn('CSS资源提取错误:', e);
  }
  
  return cssResources;
}

function extractShadowDOMResources() {
  const shadowResources = [];
  
  function traverseShadowDOM(root) {
    const elements = root.querySelectorAll('*');
    
    for (const element of elements) {
      if (element.shadowRoot) {
        const shadowImages = Array.from(element.shadowRoot.querySelectorAll('img'));
        for (const img of shadowImages) {
          if (img.src && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
            shadowResources.push({
              url: img.src,
              type: 'image',
              contentType: getImageTypeFromUrl(img.src),
              size: 0,
              sizeFormatted: 'Unknown',
              filename: img.src.split('/').pop().split('?')[0] || 'shadow-image',
              timestamp: Date.now(),
              width: img.naturalWidth || 0,
              height: img.naturalHeight || 0,
              source: 'shadow-dom',
              quality: 'unknown'
            });
          }
        }
        
        const shadowVideos = Array.from(element.shadowRoot.querySelectorAll('video, source'));
        for (const video of shadowVideos) {
          const url = video.src || video.currentSrc;
          if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
            shadowResources.push({
              url: url,
              type: 'video',
              contentType: getVideoTypeFromUrl(url),
              size: 0,
              sizeFormatted: 'Unknown',
              filename: url.split('/').pop().split('?')[0] || 'shadow-video',
              timestamp: Date.now(),
              source: 'shadow-dom',
              quality: 'unknown'
            });
          }
        }
        
        traverseShadowDOM(element.shadowRoot);
      }
    }
  }
  
  try {
    traverseShadowDOM(document);
  } catch (e) {
    console.warn('Shadow DOM资源提取错误:', e);
  }
  
  return shadowResources;
}

function extractAttributeResources() {
  const attributeResources = [];
  const customAttrs = ['data-src', 'data-original', 'data-lazy', 'data-bg', 'lazy-img', 'data-url'];
  
  try {
    const elements = document.querySelectorAll('*');
    
    for (const element of elements) {
      for (const attr of customAttrs) {
        if (element.hasAttribute(attr)) {
          const url = element.getAttribute(attr);
          
          if (url && typeof url === 'string' && url.trim() && 
              !url.startsWith('data:') && !url.startsWith('blob:') &&
              (url.startsWith('http') || url.startsWith('//'))) {
            
            let absoluteUrl;
            try {
              absoluteUrl = new URL(url, window.location.href).href;
            } catch (e) {
              continue; // 跳过无效URL
            }
            
            let type = 'image';
            let contentType = getImageTypeFromUrl(absoluteUrl);
            
            if (contentType.includes('video')) {
              type = 'video';
            }
            
            attributeResources.push({
              url: absoluteUrl,
              type: type,
              contentType: contentType,
              size: 0,
              sizeFormatted: 'Unknown',
              filename: absoluteUrl.split('/').pop().split('?')[0] || 'attribute-resource',
              timestamp: Date.now(),
              source: 'custom-attribute',
              sourceAttribute: attr,
              quality: 'unknown'
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('自定义属性资源提取错误:', e);
  }
  
  return attributeResources;
}

function extractNestedResources() {
  const nestedResources = [];
  
  try {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        if (iframe.src && !iframe.src.startsWith('data:') && !iframe.src.startsWith('blob:') &&
            !iframe.src.startsWith('javascript:') && iframe.src.startsWith('http')) {
          nestedResources.push({
            url: iframe.src,
            type: 'iframe',
            contentType: 'text/html',
            size: 0,
            sizeFormatted: 'Unknown',
            filename: 'embedded-content.html',
            timestamp: Date.now(),
            source: 'iframe',
            quality: 'unknown'
          });
        }
      } catch (e) {
        console.warn('iframe资源提取错误:', e);
      }
    }
  } catch (e) {
    console.warn('嵌套资源提取错误:', e);
  }
  
  return nestedResources;
}

function extractStreamingResources() {
  const streamingResources = [];
  
  try {
    const sources = document.querySelectorAll('source');
    
    for (const source of sources) {
      if (source.src && (source.src.includes('.m3u8') || source.src.includes('.mpd'))) {
        streamingResources.push({
          url: source.src,
          type: 'video',
          contentType: source.src.includes('.m3u8') ? 'application/x-mpegURL' : 'application/dash+xml',
          size: 0,
          sizeFormatted: 'Unknown',
          filename: source.src.split('/').pop().split('?')[0] || 'stream',
          timestamp: Date.now(),
          source: 'streaming',
          isStreaming: true,
          streamType: source.src.includes('.m3u8') ? 'HLS' : 'DASH',
          quality: 'HD' // 流媒体通常为高清
        });
      }
    }
  } catch (e) {
    console.warn('流媒体资源提取错误:', e);
  }
  
  return streamingResources;
}

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
