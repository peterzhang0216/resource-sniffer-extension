/**
 * @file resource-detector.js
 * @description 分布式资源检测Worker，处理DOM片段并提取资源
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

/**
 * 处理DOM片段并提取资源
 * @param {Object} data - 包含DOM片段的数据
 */
function detectResources(data) {
  const { domFragment, baseUrl, taskId, detectionMethods = ['dom', 'css', 'attribute'] } = data;
  
  try {
    if (!domFragment || !baseUrl) {
      postMessage({
        taskId,
        action: 'detectionComplete',
        resources: [],
        error: 'Missing required data'
      });
      return;
    }
    
    console.log(`[Worker ${taskId}] 开始检测资源，DOM片段大小: ${domFragment.length} 字节`);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(domFragment, 'text/html');
    
    const resources = [];
    
    if (detectionMethods.includes('dom')) {
      resources.push(...detectDOMResources(doc, baseUrl));
    }
    
    if (detectionMethods.includes('css')) {
      resources.push(...detectCSSResources(doc, baseUrl));
    }
    
    if (detectionMethods.includes('attribute')) {
      resources.push(...detectAttributeResources(doc, baseUrl));
    }
    
    if (detectionMethods.includes('shadow')) {
      resources.push(...detectShadowResources(doc, baseUrl));
    }
    
    console.log(`[Worker ${taskId}] 检测完成，发现 ${resources.length} 个资源`);
    
    const uniqueResources = deduplicateResources(resources);
    
    postMessage({
      taskId,
      action: 'detectionComplete',
      resources: uniqueResources,
      stats: {
        total: resources.length,
        unique: uniqueResources.length,
        duplicates: resources.length - uniqueResources.length
      }
    });
  } catch (e) {
    console.error(`[Worker ${taskId}] 检测资源错误:`, e);
    
    postMessage({
      taskId,
      action: 'detectionComplete',
      resources: [],
      error: e.message
    });
  }
}

/**
 * 检测DOM中的资源
 * @param {Document} doc - DOM文档
 * @param {string} baseUrl - 基础URL
 * @returns {Array} - 资源数组
 */
function detectDOMResources(doc, baseUrl) {
  const resources = [];
  
  try {
    const images = doc.querySelectorAll('img');
    images.forEach(img => {
      const src = img.getAttribute('src');
      if (src) {
        const resource = {
          url: resolveUrl(src, baseUrl),
          type: 'image',
          width: img.naturalWidth || img.width || null,
          height: img.naturalHeight || img.height || null,
          alt: img.alt || '',
          source: 'dom',
          timestamp: Date.now()
        };
        
        const srcset = img.getAttribute('srcset');
        if (srcset) {
          resource.srcset = parseSrcset(srcset, baseUrl);
        }
        
        resources.push(resource);
      }
    });
    
    const videos = doc.querySelectorAll('video');
    videos.forEach(video => {
      const src = video.getAttribute('src');
      if (src) {
        resources.push({
          url: resolveUrl(src, baseUrl),
          type: 'video',
          width: video.videoWidth || video.width || null,
          height: video.videoHeight || video.height || null,
          poster: video.poster ? resolveUrl(video.poster, baseUrl) : null,
          source: 'dom',
          timestamp: Date.now()
        });
      }
      
      const sources = video.querySelectorAll('source');
      sources.forEach(source => {
        const sourceSrc = source.getAttribute('src');
        if (sourceSrc) {
          resources.push({
            url: resolveUrl(sourceSrc, baseUrl),
            type: 'video',
            format: source.getAttribute('type') || null,
            width: video.videoWidth || video.width || null,
            height: video.videoHeight || video.height || null,
            source: 'dom',
            timestamp: Date.now()
          });
        }
      });
    });
    
    const audios = doc.querySelectorAll('audio');
    audios.forEach(audio => {
      const src = audio.getAttribute('src');
      if (src) {
        resources.push({
          url: resolveUrl(src, baseUrl),
          type: 'audio',
          source: 'dom',
          timestamp: Date.now()
        });
      }
      
      const sources = audio.querySelectorAll('source');
      sources.forEach(source => {
        const sourceSrc = source.getAttribute('src');
        if (sourceSrc) {
          resources.push({
            url: resolveUrl(sourceSrc, baseUrl),
            type: 'audio',
            format: source.getAttribute('type') || null,
            source: 'dom',
            timestamp: Date.now()
          });
        }
      });
    });
    
    const links = doc.querySelectorAll('a[href]');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href && isMediaUrl(href)) {
        const url = resolveUrl(href, baseUrl);
        const type = getResourceTypeFromUrl(url);
        
        resources.push({
          url,
          type,
          source: 'dom',
          timestamp: Date.now()
        });
      }
    });
  } catch (e) {
    console.warn('检测DOM资源错误:', e);
  }
  
  return resources;
}

/**
 * 检测CSS中的资源
 * @param {Document} doc - DOM文档
 * @param {string} baseUrl - 基础URL
 * @returns {Array} - 资源数组
 */
function detectCSSResources(doc, baseUrl) {
  const resources = [];
  
  try {
    const elements = doc.querySelectorAll('[style]');
    elements.forEach(element => {
      const style = element.getAttribute('style');
      if (style) {
        const urls = extractUrlsFromCSS(style);
        urls.forEach(url => {
          if (isMediaUrl(url)) {
            resources.push({
              url: resolveUrl(url, baseUrl),
              type: getResourceTypeFromUrl(url),
              source: 'css',
              timestamp: Date.now()
            });
          }
        });
      }
    });
    
    const styleElements = doc.querySelectorAll('style');
    styleElements.forEach(styleElement => {
      const css = styleElement.textContent;
      if (css) {
        const urls = extractUrlsFromCSS(css);
        urls.forEach(url => {
          if (isMediaUrl(url)) {
            resources.push({
              url: resolveUrl(url, baseUrl),
              type: getResourceTypeFromUrl(url),
              source: 'css',
              timestamp: Date.now()
            });
          }
        });
      }
    });
  } catch (e) {
    console.warn('检测CSS资源错误:', e);
  }
  
  return resources;
}

/**
 * 检测自定义属性中的资源
 * @param {Document} doc - DOM文档
 * @param {string} baseUrl - 基础URL
 * @returns {Array} - 资源数组
 */
function detectAttributeResources(doc, baseUrl) {
  const resources = [];
  
  try {
    const mediaAttributes = [
      'data-src', 'data-original', 'data-url', 'data-img', 'data-image',
      'data-bg', 'data-background', 'data-poster', 'data-thumb', 'data-thumbnail',
      'data-srcset', 'data-source', 'data-video', 'data-audio', 'data-media',
      'data-lazy', 'data-lazy-src', 'data-original-src'
    ];
    
    const elements = doc.querySelectorAll('*');
    elements.forEach(element => {
      mediaAttributes.forEach(attr => {
        const value = element.getAttribute(attr);
        if (value && isMediaUrl(value)) {
          resources.push({
            url: resolveUrl(value, baseUrl),
            type: getResourceTypeFromUrl(value),
            source: 'attribute',
            sourceAttr: attr,
            timestamp: Date.now()
          });
        }
      });
      
      Array.from(element.attributes)
        .filter(attr => attr.name.startsWith('data-') && !mediaAttributes.includes(attr.name))
        .forEach(attr => {
          const value = attr.value;
          if (value && isMediaUrl(value)) {
            resources.push({
              url: resolveUrl(value, baseUrl),
              type: getResourceTypeFromUrl(value),
              source: 'attribute',
              sourceAttr: attr.name,
              timestamp: Date.now()
            });
          }
        });
    });
  } catch (e) {
    console.warn('检测属性资源错误:', e);
  }
  
  return resources;
}

/**
 * 检测Shadow DOM中的资源
 * @param {Document} doc - DOM文档
 * @param {string} baseUrl - 基础URL
 * @returns {Array} - 资源数组
 */
function detectShadowResources(doc, baseUrl) {
  const resources = [];
  
  try {
    const elements = doc.querySelectorAll('*');
    elements.forEach(element => {
      if (element.shadowRoot) {
        const shadowHtml = element.shadowRoot.innerHTML;
        const shadowDoc = new DOMParser().parseFromString(shadowHtml, 'text/html');
        
        const shadowResources = [
          ...detectDOMResources(shadowDoc, baseUrl),
          ...detectCSSResources(shadowDoc, baseUrl),
          ...detectAttributeResources(shadowDoc, baseUrl)
        ];
        
        shadowResources.forEach(resource => {
          resource.source = 'shadow-dom';
        });
        
        resources.push(...shadowResources);
      }
    });
  } catch (e) {
    console.warn('检测Shadow DOM资源错误:', e);
  }
  
  return resources;
}

/**
 * 从CSS中提取URL
 * @param {string} css - CSS文本
 * @returns {Array} - URL数组
 */
function extractUrlsFromCSS(css) {
  const urls = [];
  
  try {
    const urlRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
    let match;
    
    while ((match = urlRegex.exec(css)) !== null) {
      urls.push(match[1]);
    }
  } catch (e) {
    console.warn('从CSS提取URL错误:', e);
  }
  
  return urls;
}

/**
 * 解析srcset属性
 * @param {string} srcset - srcset属性值
 * @param {string} baseUrl - 基础URL
 * @returns {Array} - srcset资源数组
 */
function parseSrcset(srcset, baseUrl) {
  const sources = [];
  
  try {
    const srcsetParts = srcset.split(',').map(part => part.trim());
    
    srcsetParts.forEach(part => {
      const [url, descriptor] = part.split(/\s+/);
      if (url) {
        sources.push({
          url: resolveUrl(url, baseUrl),
          descriptor: descriptor || ''
        });
      }
    });
  } catch (e) {
    console.warn('解析srcset错误:', e);
  }
  
  return sources;
}

/**
 * 解析相对URL
 * @param {string} url - 相对URL
 * @param {string} baseUrl - 基础URL
 * @returns {string} - 绝对URL
 */
function resolveUrl(url, baseUrl) {
  try {
    if (url.startsWith('data:')) {
      return url;
    }
    
    if (url.match(/^(https?:|\/\/)/i)) {
      return url;
    }
    
    return new URL(url, baseUrl).href;
  } catch (e) {
    console.warn('解析URL错误:', e);
    return url;
  }
}

/**
 * 判断URL是否为媒体文件
 * @param {string} url - URL字符串
 * @returns {boolean} - 是否为媒体文件
 */
function isMediaUrl(url) {
  try {
    if (url.startsWith('data:image/') || 
        url.startsWith('data:video/') || 
        url.startsWith('data:audio/')) {
      return true;
    }
    
    const mediaExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp',
      '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv',
      '.mp3', '.wav', '.aac', '.flac', '.m4a'
    ];
    
    const lowercaseUrl = url.toLowerCase();
    return mediaExtensions.some(ext => lowercaseUrl.endsWith(ext) || lowercaseUrl.includes(ext + '?'));
  } catch (e) {
    console.warn('检查媒体URL错误:', e);
    return false;
  }
}

/**
 * 从URL获取资源类型
 * @param {string} url - URL字符串
 * @returns {string} - 资源类型
 */
function getResourceTypeFromUrl(url) {
  try {
    if (url.startsWith('data:image/')) return 'image';
    if (url.startsWith('data:video/')) return 'video';
    if (url.startsWith('data:audio/')) return 'audio';
    
    const lowercaseUrl = url.toLowerCase();
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp'];
    if (imageExtensions.some(ext => lowercaseUrl.endsWith(ext) || lowercaseUrl.includes(ext + '?'))) {
      return 'image';
    }
    
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv'];
    if (videoExtensions.some(ext => lowercaseUrl.endsWith(ext) || lowercaseUrl.includes(ext + '?'))) {
      return 'video';
    }
    
    const audioExtensions = ['.mp3', '.wav', '.aac', '.flac', '.m4a'];
    if (audioExtensions.some(ext => lowercaseUrl.endsWith(ext) || lowercaseUrl.includes(ext + '?'))) {
      return 'audio';
    }
    
    const documentExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
    if (documentExtensions.some(ext => lowercaseUrl.endsWith(ext) || lowercaseUrl.includes(ext + '?'))) {
      return 'document';
    }
    
    return 'other';
  } catch (e) {
    console.warn('获取资源类型错误:', e);
    return 'other';
  }
}

/**
 * 去重资源
 * @param {Array} resources - 资源数组
 * @returns {Array} - 去重后的资源数组
 */
function deduplicateResources(resources) {
  try {
    const uniqueUrls = new Set();
    const uniqueResources = [];
    
    resources.forEach(resource => {
      if (resource.url && !uniqueUrls.has(resource.url)) {
        uniqueUrls.add(resource.url);
        uniqueResources.push(resource);
      }
    });
    
    return uniqueResources;
  } catch (e) {
    console.warn('资源去重错误:', e);
    return resources;
  }
}

self.onmessage = function(e) {
  const data = e.data;
  
  if (data.action === 'detectResources') {
    detectResources(data);
  }
};
