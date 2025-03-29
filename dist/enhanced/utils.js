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

/**
 * 计算URL的指纹
 * @param {string} url - URL字符串
 * @returns {string} - URL指纹
 */
function computeUrlFingerprint(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    let normalized = path
      .replace(/\/\d+x\d+\//, '/') // 移除尺寸目录
      .replace(/[-_]\d+x\d+/, '') // 移除尺寸后缀
      .replace(/[-_](?:small|medium|large|thumb|preview)/, '') // 移除尺寸描述
      .replace(/[-_][0-9a-f]{8,}/, '') // 移除哈希
      .replace(/\d+/, 'N'); // 替换所有数字
    
    return normalized;
  } catch (e) {
    return url;
  }
}

/**
 * 计算URL的相似度
 * @param {string} url1 - 第一个URL
 * @param {string} url2 - 第二个URL
 * @returns {number} - 相似度分数，0-1
 */
function computeUrlSimilarity(url1, url2) {
  if (url1 === url2) return 1.0;
  
  try {
    const urlObj1 = new URL(url1);
    const urlObj2 = new URL(url2);
    
    if (urlObj1.hostname !== urlObj2.hostname) return 0.1;
    
    const path1 = urlObj1.pathname;
    const path2 = urlObj2.pathname;
    
    const filename1 = path1.split('/').pop();
    const filename2 = path2.split('/').pop();
    
    const ext1 = filename1.split('.').pop();
    const ext2 = filename2.split('.').pop();
    if (ext1 !== ext2) return 0.2;
    
    const pathSimilarity = calculateJaccardSimilarity(path1, path2);
    
    return pathSimilarity;
  } catch (e) {
    return 0;
  }
}

/**
 * 计算Jaccard相似度
 * @param {string} str1 - 第一个字符串
 * @param {string} str2 - 第二个字符串
 * @returns {number} - 相似度分数，0-1
 */
function calculateJaccardSimilarity(str1, str2) {
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  
  const intersection = [...set1].filter(char => set2.has(char)).length;
  const union = set1.size + set2.size - intersection;
  
  return union === 0 ? 0 : intersection / union;
}

/**
 * 智能生成文件名
 * @param {Object} resource - 资源对象
 * @param {string} siteName - 网站名称
 * @returns {string} - 智能生成的文件名
 */
function generateSmartFilename(resource, siteName) {
  try {
    if (!resource || !resource.url) return '';
    
    const url = new URL(resource.url);
    const originalFilename = url.pathname.split('/').pop().split('?')[0];
    const fileExt = originalFilename.split('.').pop() || 
                   (resource.type === 'image' ? 'jpg' : 'mp4');
    
    const pathSegments = url.pathname.split('/').filter(s => s.length > 0);
    
    const possibleCategories = pathSegments.filter(s => 
      !s.includes('.') && 
      s.length > 3 && 
      !/^\d+$/.test(s) && 
      !['small', 'medium', 'large', 'thumb', 'thumbnail', 'preview'].includes(s)
    );
    
    let smartName = '';
    
    if (possibleCategories.length > 0) {
      smartName = possibleCategories[possibleCategories.length - 1];
    }
    
    let prefix = siteName || url.hostname.replace('www.', '');
    prefix = prefix.split('.')[0];
    
    const type = resource.type || 'media';
    
    const quality = resource.quality || 'SD';
    
    const uniqueId = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    if (smartName) {
      return `${prefix}-${smartName}-${quality}-${uniqueId}.${fileExt}`;
    } else {
      return `${prefix}-${type}-${quality}-${uniqueId}.${fileExt}`;
    }
  } catch (e) {
    console.warn('智能命名生成错误:', e);
    return resource.url.split('/').pop().split('?')[0] || 'resource';
  }
}

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
 * 计算资源质量评分
 * @param {Object} resource - 资源对象
 * @returns {Object} - 评分和评分详情
 */
function calculateResourceScore(resource) {
  if (!resource) return { score: 0, details: {} };
  
  const details = {};
  let totalScore = 0;
  let maxScore = 0;
  
  if (resource.width && resource.height) {
    const pixels = resource.width * resource.height;
    let resolutionScore = 0;
    
    if (pixels >= 2073600) { // 1920x1080及以上
      resolutionScore = 30;
    } else if (pixels >= 921600) { // 1280x720及以上
      resolutionScore = 25;
    } else if (pixels >= 307200) { // 640x480及以上
      resolutionScore = 15;
    } else {
      resolutionScore = 5;
    }
    
    details.resolution = { 
      score: resolutionScore, 
      value: `${resource.width}x${resource.height}` 
    };
    totalScore += resolutionScore;
    maxScore += 30;
  }
  
  if (resource.size) {
    let sizeScore = 0;
    
    if (resource.type === 'image') {
      if (resource.size > 500000) {
        sizeScore = 20; // 大图片通常质量更高
      } else if (resource.size > 100000) {
        sizeScore = 15;
      } else if (resource.size > 30000) {
        sizeScore = 10;
      } else {
        sizeScore = 5;
      }
    } else if (resource.type === 'video') {
      if (resource.size > 10000000) {
        sizeScore = 20; // 大视频通常质量更高
      } else if (resource.size > 5000000) {
        sizeScore = 15;
      } else if (resource.size > 1000000) {
        sizeScore = 10;
      } else {
        sizeScore = 5;
      }
    }
    
    details.size = {
      score: sizeScore,
      value: formatFileSize(resource.size)
    };
    totalScore += sizeScore;
    maxScore += 20;
  }
  
  if (resource.source) {
    let sourceScore = 0;
    
    if (resource.source === 'original') {
      sourceScore = 15; // 原始资源
    } else if (resource.source === 'css' || resource.source === 'shadow-dom') {
      sourceScore = 10; // CSS或Shadow DOM中的资源
    } else if (resource.source === 'custom-attribute') {
      sourceScore = 8; // 自定义属性中的资源
    } else if (resource.source === 'predicted') {
      sourceScore = 5; // 预测的资源
    }
    
    details.source = {
      score: sourceScore,
      value: resource.source
    };
    totalScore += sourceScore;
    maxScore += 15;
  }
  
  const finalScore = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  
  return {
    score: finalScore,
    details: details,
    totalScore: totalScore,
    maxScore: maxScore
  };
}

window.ResourceSnifferUtils = {
  detectFileType,
  parseDeepUrl,
  parseStreamingUrl,
  validateResource,
  extractImagesFromCSSRule,
  computeUrlFingerprint,
  computeUrlSimilarity,
  calculateJaccardSimilarity,
  generateSmartFilename,
  formatFileSize,
  calculateResourceScore
};
