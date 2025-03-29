/**
 * 分析资源URL
 * @param {Object} data - 包含资源数据的对象
 */
function analyzeResource(data) {
  const { url, type, contentType } = data;
  const result = {
    originalData: data,
    enhancedData: {
      fileExtension: getFileExtension(url),
      possibleQuality: estimateQuality(data),
      sizeCategory: getSizeCategory(data.size || 0)
    }
  };
  
  try {
    const urlInfo = new URL(url);
    result.enhancedData.host = urlInfo.hostname;
    result.enhancedData.protocol = urlInfo.protocol;
    result.enhancedData.path = urlInfo.pathname;
    result.enhancedData.query = {};
    
    urlInfo.searchParams.forEach((value, key) => {
      result.enhancedData.query[key] = value;
    });
    
    if (url.includes('.m3u8') || url.includes('.mpd') || 
        contentType?.includes('mpegurl') || contentType?.includes('dash+xml')) {
      result.enhancedData.isStreaming = true;
      result.enhancedData.streamType = url.includes('.m3u8') ? 'HLS' : 'DASH';
    }
    
    const host = urlInfo.hostname.toLowerCase();
    if (host.includes('cdn') || host.includes('static') || host.includes('media') || 
        host.includes('assets') || host.includes('content')) {
      result.enhancedData.likelyCDN = true;
    }
  } catch (e) {
    result.enhancedData.urlParseError = e.message;
  }
  
  postMessage({
    action: 'analysisComplete',
    resourceData: result
  });
}

/**
 * 获取文件扩展名
 * @param {string} url - 资源URL
 * @returns {string} - 文件扩展名
 */
function getFileExtension(url) {
  try {
    const pathParts = new URL(url).pathname.split('.');
    if (pathParts.length > 1) {
      return pathParts.pop().toLowerCase();
    }
  } catch (e) {}
  return '';
}

/**
 * 估计资源质量
 * @param {Object} data - 资源数据
 * @returns {string} - 质量估计
 */
function estimateQuality(data) {
  const { width, height, size, type } = data;
  
  if (width && height) {
    const pixels = width * height;
    if (pixels >= 2073600) return 'HD'; // 1920x1080以上
    if (pixels >= 921600) return 'HD';  // 1280x720以上
    if (pixels >= 307200) return 'SD';  // 640x480以上
    return 'LD';
  }
  
  if (size) {
    if (type === 'image') {
      if (size > 500000) return 'HD';
      if (size > 100000) return 'SD';
      return 'LD';
    } else if (type === 'video') {
      if (size > 10000000) return 'HD';
      if (size > 2000000) return 'SD';
      return 'LD';
    }
  }
  
  return 'unknown';
}

/**
 * 获取大小分类
 * @param {number} size - 文件大小(字节)
 * @returns {string} - 大小分类
 */
function getSizeCategory(size) {
  if (size > 10485760) return 'large';      // > 10MB
  if (size > 1048576) return 'medium';      // > 1MB
  if (size > 102400) return 'small';        // > 100KB
  return 'tiny';                            // < 100KB
}

/**
 * 使用简单模式匹配预测网页中的资源
 * @param {Object} data - 包含页面数据的对象
 */
function predictResources(data) {
  const { url, html } = data;
  const predictedResources = [];
  
  try {
    const hostname = new URL(url).hostname;
    
    const patterns = [
      { regex: /https?:\/\/(?:[a-z0-9\-]+\.)?cdn\..*?\/.*?\.(jpe?g|png|gif|webp|mp4|webm)/gi, type: 'match' },
      { regex: /https?:\/\/(?:[a-z0-9\-]+\.)?img\..*?\/.*?\.(jpe?g|png|gif|webp)/gi, type: 'match' },
      { regex: /https?:\/\/(?:[a-z0-9\-]+\.)?video\..*?\/.*?\.(mp4|webm|mov)/gi, type: 'match' },
      { regex: /["']https?:\/\/.*?\/.*?(?:photo|image|img|pic).*?\.(jpe?g|png|gif|webp)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/.*?\/.*?(?:video|movie|film|clip).*?\.(mp4|webm|mov)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/.*?\/.*?(?:thumb|thumbnail|small|preview).*?\.(jpe?g|png|gif|webp)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/(?:[a-z0-9\-]+\.)?pexels\.com\/.*?\.(jpe?g|png)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/(?:[a-z0-9\-]+\.)?unsplash\.com\/.*?\.(jpe?g|png)["']/gi, type: 'extract' },
      { regex: /["']https?:\/\/(?:[a-z0-9\-]+\.)?imgur\.com\/.*?\.(jpe?g|png|gif)["']/gi, type: 'extract' }
    ];
    
    if (hostname.includes('youtube')) {
      patterns.push({ regex: /https?:\/\/i\.ytimg\.com\/vi\/.*?\/(hqdefault|mqdefault|sddefault|maxresdefault)\.jpg/gi, type: 'match' });
    } else if (hostname.includes('vimeo')) {
      patterns.push({ regex: /https?:\/\/i\.vimeocdn\.com\/video\/.*?\.(jpe?g|png)/gi, type: 'match' });
    } else if (hostname.includes('facebook')) {
      patterns.push({ regex: /https?:\/\/scontent.*?\.fbcdn\.net\/.*?\.(jpe?g|png|gif)/gi, type: 'match' });
    }
    
    for (const pattern of patterns) {
      let matches;
      
      if (pattern.type === 'match') {
        while ((matches = pattern.regex.exec(html)) !== null) {
          addPredictedResource(matches[0], predictedResources);
        }
      } else if (pattern.type === 'extract') {
        while ((matches = pattern.regex.exec(html)) !== null) {
          const extracted = matches[0].replace(/^["']|["']$/g, '');
          addPredictedResource(extracted, predictedResources);
        }
      }
    }
    
    postMessage({
      action: 'predictionComplete',
      predictedResources: predictedResources
    });
  } catch (e) {
    console.error('资源预测错误:', e);
    postMessage({
      action: 'predictionComplete',
      predictedResources: [],
      error: e.message
    });
  }
}

/**
 * 添加预测资源到列表
 * @param {string} url - 资源URL
 * @param {Array} resources - 资源列表
 */
function addPredictedResource(url, resources) {
  try {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return;
    
    if (resources.some(r => r.url === url)) return;
    
    const filename = url.split('/').pop().split('?')[0] || 'predicted-resource';
    
    let type = 'image';
    let contentType = 'image/jpeg';
    
    if (/\.(mp4|webm|mov|avi|flv|wmv)($|\?)/i.test(url)) {
      type = 'video';
      contentType = 'video/mp4';
    } else if (/\.gif($|\?)/i.test(url)) {
      contentType = 'image/gif';
    } else if (/\.png($|\?)/i.test(url)) {
      contentType = 'image/png';
    } else if (/\.webp($|\?)/i.test(url)) {
      contentType = 'image/webp';
    }
    
    resources.push({
      url: url,
      type: type,
      contentType: contentType,
      size: 0,
      sizeFormatted: 'Unknown',
      filename: filename,
      timestamp: Date.now(),
      source: 'predicted',
      quality: 'unknown',
      confidence: 0.8 // 置信度
    });
  } catch (e) {
    console.warn('添加预测资源错误:', e);
  }
}

self.addEventListener('message', (e) => {
  const { action, data } = e.data;
  
  switch (action) {
    case 'analyze':
      analyzeResource(data);
      break;
    case 'predict':
      predictResources(data);
      break;
    default:
      console.warn('Worker received unknown action:', action);
  }
});
