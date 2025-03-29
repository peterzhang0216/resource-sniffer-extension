/**
 * @file log-tab.test.js
 * @description 日志标签页组件单元测试
 */

document.body.innerHTML = `
  <div id="log-tab-container"></div>
`;

const mockLoggingService = {
  logs: [],
  getFilteredLogs: jest.fn(),
  clearLogs: jest.fn(),
  exportLogs: jest.fn(),
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
  },
  LogCategory: {
    APP: 'APP',
    RESOURCE: 'RESOURCE',
    DOWNLOAD: 'DOWNLOAD',
    UI: 'UI',
    NETWORK: 'NETWORK',
    DETECTION: 'DETECTION'
  },
  getLevelName: jest.fn().mockImplementation(level => {
    const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levels[level] || 'UNKNOWN';
  }),
  getCategoryName: jest.fn().mockImplementation(category => category)
};

const mockLogViewer = {
  init: jest.fn(),
  render: jest.fn(),
  applyFilter: jest.fn(),
  exportLogs: jest.fn(),
  clearLogs: jest.fn()
};

jest.mock('../../src/services/logging-service', () => mockLoggingService);
jest.mock('../../src/components/log-viewer', () => {
  return {
    default: jest.fn().mockImplementation(() => mockLogViewer)
  };
});

const LogTab = require('../../src/components/log-tab').default;

describe('LogTab', () => {
  let logTab;
  let container;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLoggingService.logs = [
      { id: '1', timestamp: 1617235200000, level: 0, category: 'APP', message: '调试日志' },
      { id: '2', timestamp: 1617235300000, level: 1, category: 'RESOURCE', message: '信息日志' },
      { id: '3', timestamp: 1617235400000, level: 2, category: 'DOWNLOAD', message: '警告日志' },
      { id: '4', timestamp: 1617235500000, level: 3, category: 'NETWORK', message: '错误日志' }
    ];
    
    mockLoggingService.getFilteredLogs.mockReturnValue(mockLoggingService.logs);
    
    container = document.getElementById('log-tab-container');
    
    logTab = new LogTab(container);
  });

  test('应该正确初始化日志标签页组件', () => {
    logTab.init();
    
    expect(container.querySelector('.log-tab-header')).toBeTruthy();
    expect(container.querySelector('.log-filter-controls')).toBeTruthy();
    expect(container.querySelector('.log-viewer-container')).toBeTruthy();
    
    expect(mockLogViewer.init).toHaveBeenCalled();
  });

  test('应该正确处理过滤条件变化', () => {
    logTab.init();
    
    const levelSelect = container.querySelector('#log-level-filter');
    const categorySelect = container.querySelector('#log-category-filter');
    const searchInput = container.querySelector('#log-search-input');
    
    levelSelect.value = '2'; // WARN
    categorySelect.value = 'DOWNLOAD';
    searchInput.value = '警告';
    
    levelSelect.dispatchEvent(new Event('change'));
    
    expect(mockLogViewer.applyFilter).toHaveBeenCalledWith({
      level: 2,
      category: 'DOWNLOAD',
      search: '警告'
    });
    
    const logCount = container.querySelector('.log-count');
    expect(logCount.textContent).toContain('4'); // 总日志数
  });

  test('应该正确处理日志导出和清除操作', () => {
    logTab.init();
    
    const exportButton = container.querySelector('#export-logs-btn');
    const clearButton = container.querySelector('#clear-logs-btn');
    
    exportButton.click();
    
    expect(mockLogViewer.exportLogs).toHaveBeenCalled();
    
    clearButton.click();
    
    expect(mockLogViewer.clearLogs).toHaveBeenCalled();
    
    expect(mockLoggingService.clearLogs).toHaveBeenCalled();
  });
});
