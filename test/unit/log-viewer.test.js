/**
 * @file log-viewer.test.js
 * @description 日志查看器组件单元测试
 */

document.body.innerHTML = `
  <div id="log-viewer-container"></div>
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
  })
};

jest.mock('../../src/services/logging-service', () => mockLoggingService);

const LogViewer = require('../../src/components/log-viewer').default;

describe('LogViewer', () => {
  let logViewer;
  let container;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLoggingService.logs = [
      { id: '1', timestamp: 1617235200000, level: 0, category: 'APP', message: '调试日志', data: { test: true } },
      { id: '2', timestamp: 1617235300000, level: 1, category: 'RESOURCE', message: '信息日志', data: { count: 5 } },
      { id: '3', timestamp: 1617235400000, level: 2, category: 'DOWNLOAD', message: '警告日志', data: { file: 'test.jpg' } },
      { id: '4', timestamp: 1617235500000, level: 3, category: 'NETWORK', message: '错误日志', data: { status: 404 } }
    ];
    
    mockLoggingService.getFilteredLogs.mockReturnValue(mockLoggingService.logs);
    
    container = document.getElementById('log-viewer-container');
    
    logViewer = new LogViewer(container);
  });

  test('应该正确渲染日志列表', () => {
    logViewer.init();
    
    expect(mockLoggingService.getFilteredLogs).toHaveBeenCalled();
    
    const logItems = container.querySelectorAll('.log-item');
    expect(logItems.length).toBe(4);
    
    expect(logItems[0].textContent).toContain('调试日志');
    expect(logItems[0].querySelector('.log-level').textContent).toContain('DEBUG');
    expect(logItems[0].querySelector('.log-category').textContent).toContain('APP');
    
    expect(logItems[3].textContent).toContain('错误日志');
    expect(logItems[3].querySelector('.log-level').textContent).toContain('ERROR');
    expect(logItems[3].querySelector('.log-category').textContent).toContain('NETWORK');
  });

  test('应该根据过滤条件过滤日志', () => {
    logViewer.init();
    
    const filterOptions = {
      level: 2, // WARN及以上
      category: 'DOWNLOAD',
      search: '警告'
    };
    
    mockLoggingService.getFilteredLogs.mockReturnValue([mockLoggingService.logs[2]]);
    
    logViewer.applyFilter(filterOptions);
    
    expect(mockLoggingService.getFilteredLogs).toHaveBeenCalledWith(
      expect.objectContaining(filterOptions)
    );
    
    const logItems = container.querySelectorAll('.log-item');
    expect(logItems.length).toBe(1);
    expect(logItems[0].textContent).toContain('警告日志');
    expect(logItems[0].querySelector('.log-category').textContent).toContain('DOWNLOAD');
  });

  test('应该支持日志导出和清除功能', async () => {
    logViewer.init();
    
    const mockExportData = JSON.stringify(mockLoggingService.logs);
    mockLoggingService.exportLogs.mockResolvedValue(mockExportData);
    
    const mockCreateElement = jest.spyOn(document, 'createElement');
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn(),
      remove: jest.fn()
    };
    mockCreateElement.mockReturnValue(mockLink);
    
    await logViewer.exportLogs();
    
    expect(mockLoggingService.exportLogs).toHaveBeenCalled();
    
    expect(mockLink.download).toBe('resource-sniffer-logs.json');
    expect(mockLink.href).toContain('data:application/json');
    expect(mockLink.click).toHaveBeenCalled();
    
    logViewer.clearLogs();
    
    expect(mockLoggingService.clearLogs).toHaveBeenCalled();
  });
});
