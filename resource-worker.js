
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

self.addEventListener('message', (e) => {
  const { action, data } = e.data;
  
  switch (action) {
    case 'analyze':
      analyzeResource(data);
      break;
    default:
      console.warn('Worker received unknown action:', action);
  }
});
