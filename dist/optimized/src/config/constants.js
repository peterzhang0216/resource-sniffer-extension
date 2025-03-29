/**
 * @file constants.js
 * @description 资源嗅探器扩展的全局常量配置
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

/**
 * 资源类型常量定义
 * @enum {string}
 */
export const RESOURCE_TYPES = {
  /** 图片资源类型 */
  IMAGE: 'image',
  /** 视频资源类型 */
  VIDEO: 'video',
  /** 音频资源类型 */
  AUDIO: 'audio',
  /** 文档资源类型 */
  DOCUMENT: 'document',
  /** 其他资源类型 */
  OTHER: 'other'
};

/**
 * 资源质量等级定义
 * @enum {string}
 */
export const QUALITY_LEVELS = {
  /** 高清质量 */
  HD: 'HD',
  /** 标清质量 */
  SD: 'SD',
  /** 低清质量 */
  LD: 'LD',
  /** 未知质量 */
  UNKNOWN: 'unknown'
};

/**
 * 资源来源类型定义
 * @enum {string}
 */
export const SOURCE_TYPES = {
  /** DOM元素资源 */
  DOM: 'dom',
  /** CSS样式资源 */
  CSS: 'css',
  /** Shadow DOM资源 */
  SHADOW_DOM: 'shadow-dom',
  /** 自定义属性资源 */
  ATTRIBUTE: 'attribute',
  /** 嵌套资源 */
  NESTED: 'nested',
  /** 流媒体资源 */
  STREAMING: 'streaming',
  /** 预测资源 */
  PREDICTED: 'predicted',
  /** 网络请求资源 */
  NETWORK: 'network'
};

/**
 * 文件大小分类定义
 * @enum {string}
 */
export const SIZE_CATEGORIES = {
  /** 大型文件 (>10MB) */
  LARGE: 'large',
  /** 中型文件 (1MB-10MB) */
  MEDIUM: 'medium',
  /** 小型文件 (100KB-1MB) */
  SMALL: 'small',
  /** 微型文件 (<100KB) */
  TINY: 'tiny'
};

/**
 * 消息动作类型定义
 * @enum {string}
 */
export const MESSAGE_ACTIONS = {
  /** 添加资源 */
  ADD_RESOURCE: 'addResource',
  /** 添加DOM资源 */
  ADD_DOM_RESOURCES: 'addDOMResources',
  /** 添加预测资源 */
  ADD_PREDICTED_RESOURCES: 'addPredictedResources',
  /** 获取资源 */
  GET_RESOURCES: 'getResources',
  /** 下载资源 */
  DOWNLOAD_RESOURCE: 'downloadResource',
  /** 清除资源 */
  CLEAR_RESOURCES: 'clearResources',
  /** 分析资源 */
  ANALYZE_RESOURCE: 'analyzeResource',
  /** 预测资源 */
  PREDICT_RESOURCES: 'predictResources',
  /** 获取相似资源 */
  GET_SIMILAR_RESOURCES: 'getSimilarResources',
  /** 获取资源统计 */
  GET_RESOURCE_STATS: 'getResourceStats',
  /** 内容脚本初始化 */
  CONTENT_SCRIPT_INITIALIZED: 'contentScriptInitialized',
  /** 流媒体资源 */
  STREAMING_RESOURCE: 'streamingResource',
  /** 批量下载资源 */
  BATCH_DOWNLOAD_RESOURCES: 'batchDownloadResources',
  /** 获取下载队列 */
  GET_DOWNLOAD_QUEUE: 'getDownloadQueue',
  /** 获取下载历史 */
  GET_DOWNLOAD_HISTORY: 'getDownloadHistory',
  /** 清除下载历史 */
  CLEAR_DOWNLOAD_HISTORY: 'clearDownloadHistory',
  /** 取消下载 */
  CANCEL_DOWNLOAD: 'cancelDownload',
  /** 暂停下载 */
  PAUSE_DOWNLOAD: 'pauseDownload',
  /** 恢复下载 */
  RESUME_DOWNLOAD: 'resumeDownload',
  /** 更新下载设置 */
  UPDATE_DOWNLOAD_SETTINGS: 'updateDownloadSettings',
  /** 页面加载完成 */
  PAGE_LOADED: 'pageLoaded',
  /** 测试ML模型 */
  TEST_ML_MODEL: 'testMLModel',
  /** 测试指纹 */
  TEST_FINGERPRINTING: 'testFingerprinting',
  /** 测试元数据分析 */
  TEST_METADATA_ANALYSIS: 'testMetadataAnalysis',
  /** 检测资源 */
  DETECT_RESOURCES: 'detectResources'
};

/**
 * 文件扩展名映射到资源类型
 * @type {Object.<string, string>}
 */
export const EXTENSION_TO_TYPE = {
  'jpg': RESOURCE_TYPES.IMAGE,
  'jpeg': RESOURCE_TYPES.IMAGE,
  'png': RESOURCE_TYPES.IMAGE,
  'gif': RESOURCE_TYPES.IMAGE,
  'webp': RESOURCE_TYPES.IMAGE,
  'svg': RESOURCE_TYPES.IMAGE,
  'ico': RESOURCE_TYPES.IMAGE,
  'bmp': RESOURCE_TYPES.IMAGE,
  
  'mp4': RESOURCE_TYPES.VIDEO,
  'webm': RESOURCE_TYPES.VIDEO,
  'ogg': RESOURCE_TYPES.VIDEO,
  'mov': RESOURCE_TYPES.VIDEO,
  'avi': RESOURCE_TYPES.VIDEO,
  'mkv': RESOURCE_TYPES.VIDEO,
  'flv': RESOURCE_TYPES.VIDEO,
  
  'mp3': RESOURCE_TYPES.AUDIO,
  'wav': RESOURCE_TYPES.AUDIO,
  'aac': RESOURCE_TYPES.AUDIO,
  'flac': RESOURCE_TYPES.AUDIO,
  'm4a': RESOURCE_TYPES.AUDIO,
  
  'pdf': RESOURCE_TYPES.DOCUMENT,
  'doc': RESOURCE_TYPES.DOCUMENT,
  'docx': RESOURCE_TYPES.DOCUMENT,
  'xls': RESOURCE_TYPES.DOCUMENT,
  'xlsx': RESOURCE_TYPES.DOCUMENT,
  'ppt': RESOURCE_TYPES.DOCUMENT,
  'pptx': RESOURCE_TYPES.DOCUMENT
};

/**
 * 默认配置选项
 * @type {Object}
 */
export const DEFAULT_OPTIONS = {
  /** 是否启用预测功能 */
  enablePrediction: true,
  /** 是否启用智能去重 */
  enableDeduplication: true,
  /** 是否启用资源关联分析 */
  enableAssociation: true,
  /** 是否启用自适应检测 */
  enableAdaptiveDetection: true,
  /** 是否启用分布式处理 */
  enableDistributedProcessing: true,
  /** 是否启用压缩优化 */
  enableCompression: false,
  /** 是否启用智能命名 */
  enableSmartNaming: true,
  /** 是否启用资源评分 */
  enableResourceScoring: true,
  /** 默认下载路径 */
  defaultDownloadPath: '',
  /** 默认文件名格式 */
  defaultFilenameFormat: '{site}_{type}_{timestamp}'
};

/**
 * 存储键名定义
 * @enum {string}
 */
export const STORAGE_KEYS = {
  /** 用户选项存储键 */
  OPTIONS: 'resource_sniffer_options',
  /** 下载历史存储键 */
  DOWNLOAD_HISTORY: 'resource_sniffer_download_history',
  /** 网站配置存储键 */
  SITE_CONFIGS: 'resource_sniffer_site_configs'
};

export default {
  RESOURCE_TYPES,
  QUALITY_LEVELS,
  SOURCE_TYPES,
  SIZE_CATEGORIES,
  MESSAGE_ACTIONS,
  EXTENSION_TO_TYPE,
  DEFAULT_OPTIONS,
  STORAGE_KEYS
};
