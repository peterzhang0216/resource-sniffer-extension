
/**
 * Magic Numbers检测文件类型
 * @param {ArrayBuffer} buffer - 文件的二进制数据
 * @returns {string} - 文件MIME类型
 */
function detectFileType(buffer) {
  const uint8Arr = new Uint8Array(buffer);
  
  if (uint8Arr[0] === 0xFF && uint8Arr[1] === 0xD8 && uint8Arr[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  if (uint8Arr[0] === 0x89 && uint8Arr[1] === 0x50 && uint8Arr[2] === 0x4E && uint8Arr[3] === 0x47) {
    return 'image/png';
  }
  
  if (uint8Arr[0] === 0x47 && uint8Arr[1] === 0x49 && uint8Arr[2] === 0x46 && uint8Arr[3] === 0x38) {
    return 'image/gif';
  }
  
  if (uint8Arr[0] === 0x52 && uint8Arr[1] === 0x49 && uint8Arr[2] === 0x46 && uint8Arr[3] === 0x46 &&
      uint8Arr[8] === 0x57 && uint8Arr[9] === 0x45 && uint8Arr[10] === 0x42 && uint8Arr[11] === 0x50) {
    return 'image/webp';
  }
  
  if (uint8Arr[4] === 0x66 && uint8Arr[5] === 0x74 && uint8Arr[6] === 0x79 && uint8Arr[7] === 0x70) {
    return 'video/mp4';
  }
  
  if (uint8Arr[0] === 0x1A && uint8Arr[1] === 0x45 && uint8Arr[2] === 0xDF && uint8Arr[3] === 0xA3) {
    return 'video/webm';
  }
  
  return 'application/octet-stream';
}

/**
 * 深度URL解析
 * @param {string} url - 需要解析的URL
 * @returns {Object} - 解析结果
 */
function parseDeepUrl(url) {
  try {
    const urlObj = new URL(url);
    const result = {
      baseUrl: urlObj.origin,
      path: urlObj.pathname,
      query: {},
      hash: urlObj.hash,
      isHLS: url.includes('.m3u8') || url.includes('/playlist/'),
      isDASH: url.includes('.mpd') || url.includes('/dash/'),
      possibleRedirect: url.includes('redirect') || url.includes('url=') || url.includes('target=')
    };
    
    urlObj.searchParams.forEach((value, key) => {
      result.query[key] = value;
      
      if (key === 'url' || key === 'src' || key === 'source') {
        try {
          const nestedUrl = decodeURIComponent(value);
          if (nestedUrl.startsWith('http')) {
            result.nestedUrl = nestedUrl;
          }
        } catch (e) {}
      }
    });
    
    return result;
  } catch (e) {
    return { error: e.message, originalUrl: url };
  }
}

/**
 * 解析HLS/DASH流媒体URL
 * @param {string} url - 流媒体URL
 * @returns {Promise<Array>} - 解析出的资源列表
 */
async function parseStreamingUrl(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    if (url.includes('.m3u8') || response.headers.get('content-type')?.includes('application/vnd.apple.mpegurl')) {
      const segments = [];
      const lines = text.split('\n');
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line && !line.startsWith('#') && (line.includes('.ts') || line.includes('.mp4'))) {
          const segmentUrl = line.startsWith('http') ? line : new URL(line, baseUrl).href;
          segments.push({
            url: segmentUrl,
            type: 'video/segment',
            filename: segmentUrl.split('/').pop(),
            isStreamSegment: true,
            parentUrl: url,
            index: segments.length
          });
        }
      }
      
      return segments;
    }
    
    if (url.includes('.mpd') || response.headers.get('content-type')?.includes('application/dash+xml')) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "application/xml");
      const segments = [];
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      
      const mediaNodes = xmlDoc.querySelectorAll('SegmentTemplate[media]');
      
      mediaNodes.forEach((node, index) => {
        const template = node.getAttribute('media');
        if (template) {
          const segmentUrl = template.startsWith('http') ? template : new URL(template, baseUrl).href;
          segments.push({
            url: segmentUrl,
            type: 'video/segment',
            filename: segmentUrl.split('/').pop(),
            isStreamSegment: true,
            parentUrl: url,
            index: index
          });
        }
      });
      
      return segments;
    }
    
    return [];
  } catch (e) {
    console.error('解析流媒体URL失败:', e);
    return [];
  }
}

/**
 * 验证资源有效性
 * @param {string} url - 资源URL
 * @returns {Promise<Object>} - 验证结果
 */
async function validateResource(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return {
      valid: response.ok,
      status: response.status,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
      lastModified: response.headers.get('last-modified')
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/**
 * 从CSS规则中提取背景图片URL
 * @param {CSSStyleRule} rule - CSS规则
 * @returns {Array<string>} - 提取的URL列表
 */
function extractImagesFromCSSRule(rule) {
  const urls = [];
  const cssText = rule.cssText;
  
  const bgImgMatches = cssText.match(/background-image:\s*url\(["']?([^"')]+)["']?\)/g);
  if (bgImgMatches) {
    bgImgMatches.forEach(match => {
      const url = match.match(/url\(["']?([^"')]+)["']?\)/)[1];
      if (url) urls.push(url);
    });
  }
  
  const bgMatches = cssText.match(/background:.*url\(["']?([^"')]+)["']?\)/g);
  if (bgMatches) {
    bgMatches.forEach(match => {
      const url = match.match(/url\(["']?([^"')]+)["']?\)/)[1];
      if (url) urls.push(url);
    });
  }
  
  return urls;
}

window.ResourceSnifferUtils = {
  detectFileType,
  parseDeepUrl,
  parseStreamingUrl,
  validateResource,
  extractImagesFromCSSRule
};
