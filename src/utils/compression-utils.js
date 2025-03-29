/**
 * @file compression-utils.js
 * @description 数据压缩工具，用于减少日志存储空间占用
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

/**
 * 压缩数据
 * @param {string} data - 要压缩的数据
 * @returns {Promise<string>} - 压缩后的数据
 */
export async function compress(data) {
  try {
    const textEncoder = new TextEncoder();
    const uint8Array = textEncoder.encode(data);
    
    const compressedStream = new Blob([uint8Array]).stream().pipeThrough(new CompressionStream('gzip'));
    const compressedBlob = await new Response(compressedStream).blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(compressedBlob);
    });
  } catch (error) {
    console.error('压缩数据失败:', error);
    return btoa(unescape(encodeURIComponent(data)));
  }
}

/**
 * 解压数据
 * @param {string} compressedData - 压缩的数据
 * @returns {Promise<string>} - 解压后的数据
 */
export async function decompress(compressedData) {
  try {
    const byteCharacters = atob(compressedData);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray]);
    
    const decompressedStream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
    const decompressedBlob = await new Response(decompressedStream).blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsText(decompressedBlob);
    });
  } catch (error) {
    console.error('解压数据失败:', error);
    try {
      return decodeURIComponent(escape(atob(compressedData)));
    } catch (e) {
      console.error('解码Base64失败:', e);
      return compressedData;
    }
  }
}

/**
 * 检测浏览器是否支持CompressionStream
 * @returns {boolean} - 是否支持
 */
export function isCompressionSupported() {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/**
 * 压缩文本使用LZ-String算法
 * 当浏览器不支持CompressionStream时的备选方案
 * @param {string} input - 输入字符串
 * @returns {string} - 压缩后的字符串
 */
export function compressLZString(input) {
  let output = '';
  const dictionary = {};
  let c, wc, w = '', result = [];
  let dictSize = 256;
  
  for (let i = 0; i < 256; i++) {
    dictionary[String.fromCharCode(i)] = i;
  }
  
  for (let i = 0; i < input.length; i++) {
    c = input.charAt(i);
    wc = w + c;
    
    if (dictionary[wc] !== undefined) {
      w = wc;
    } else {
      result.push(dictionary[w]);
      dictionary[wc] = dictSize++;
      w = c;
    }
  }
  
  if (w !== '') {
    result.push(dictionary[w]);
  }
  
  return btoa(result.map(code => String.fromCharCode(code)).join(''));
}

/**
 * 解压LZ-String压缩的文本
 * @param {string} compressed - 压缩后的字符串
 * @returns {string} - 解压后的字符串
 */
export function decompressLZString(compressed) {
  try {
    const input = atob(compressed);
    const dictionary = {};
    let w, result, k, entry = '';
    let dictSize = 256;
    
    for (let i = 0; i < 256; i++) {
      dictionary[i] = String.fromCharCode(i);
    }
    
    const codes = [];
    for (let i = 0; i < input.length; i++) {
      codes.push(input.charCodeAt(i));
    }
    
    w = String.fromCharCode(codes[0]);
    result = w;
    
    for (let i = 1; i < codes.length; i++) {
      k = codes[i];
      
      if (dictionary[k] !== undefined) {
        entry = dictionary[k];
      } else {
        if (k === dictSize) {
          entry = w + w.charAt(0);
        } else {
          return null;
        }
      }
      
      result += entry;
      dictionary[dictSize++] = w + entry.charAt(0);
      w = entry;
    }
    
    return result;
  } catch (error) {
    console.error('解压LZ-String失败:', error);
    return compressed;
  }
}

/**
 * 估计压缩率
 * @param {string} original - 原始数据
 * @param {string} compressed - 压缩后的数据
 * @returns {number} - 压缩率百分比
 */
export function estimateCompressionRatio(original, compressed) {
  const originalSize = original.length;
  const compressedSize = compressed.length;
  
  if (originalSize === 0) return 0;
  
  return Math.round((1 - (compressedSize / originalSize)) * 100);
}
