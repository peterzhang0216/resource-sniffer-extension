/**
 * @file log-visualization.test.js
 * @description 日志可视化组件单元测试
 * @version 1.0.0
 * @license MIT
 * @copyright © 2025 Resource Sniffer
 */

jest.mock('../../src/libs/chart.min.js', () => {
  return jest.fn().mockImplementation(() => ({
    destroy: jest.fn(),
    _render: jest.fn()
  }));
});

const LogVisualization = require('../../src/components/log-viewer').LogVisualization;
const Chart = require('../../src/libs/chart.min.js');

describe('LogVisualization', () => {
  let logVisualization;
  let container;
  let testLogs;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    container = document.createElement('div');
    document.body.appendChild(container);
    
    testLogs = [
      { id: '1', timestamp: Date.now() - 3600000, level: 'info', category: 'resource', message: 'Resource detected' },
      { id: '2', timestamp: Date.now() - 3000000, level: 'warning', category: 'download', message: 'Slow download' },
      { id: '3', timestamp: Date.now() - 2400000, level: 'error', category: 'network', message: 'Network error' },
      { id: '4', timestamp: Date.now() - 1800000, level: 'info', category: 'resource', message: 'Resource detected' },
      { id: '5', timestamp: Date.now() - 1200000, level: 'warning', category: 'download', message: 'Slow download' },
      { id: '6', timestamp: Date.now() - 600000, level: 'error', category: 'network', message: 'Network error' }
    ];
    
    logVisualization = new LogVisualization(container);
  });
  
  afterEach(() => {
    document.body.removeChild(container);
  });
  
  test('应该正确初始化可视化组件', () => {
    expect(logVisualization.container).toBe(container);
    expect(logVisualization.charts).toEqual({});
    expect(logVisualization.currentMode).toBe('trend');
  });
  
  test('应该正确创建趋势图表', () => {
    logVisualization.createTrendChart(testLogs);
    
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    
    expect(Chart).toHaveBeenCalledWith(
      canvas,
      expect.objectContaining({
        type: 'line',
        data: expect.any(Object),
        options: expect.any(Object)
      })
    );
    
    expect(logVisualization.charts.trend).toBeTruthy();
  });
  
  test('应该正确创建分布图表', () => {
    logVisualization.createDistributionChart(testLogs, 'level');
    
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    
    expect(Chart).toHaveBeenCalledWith(
      canvas,
      expect.objectContaining({
        type: 'pie',
        data: expect.any(Object),
        options: expect.any(Object)
      })
    );
    
    expect(logVisualization.charts.distribution).toBeTruthy();
  });
  
  test('应该正确创建类别图表', () => {
    logVisualization.createCategoryChart(testLogs);
    
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    
    expect(Chart).toHaveBeenCalledWith(
      canvas,
      expect.objectContaining({
        type: 'bar',
        data: expect.any(Object),
        options: expect.any(Object)
      })
    );
    
    expect(logVisualization.charts.category).toBeTruthy();
  });
  
  test('应该正确切换可视化模式', () => {
    logVisualization.createTrendChart(testLogs);
    
    const mockChart = logVisualization.charts.trend;
    
    logVisualization.switchMode('distribution', testLogs);
    
    expect(mockChart.destroy).toHaveBeenCalled();
    
    expect(Chart).toHaveBeenCalledTimes(2);
    expect(logVisualization.currentMode).toBe('distribution');
  });
  
  test('应该正确处理空日志数据', () => {
    logVisualization.createTrendChart([]);
    
    const emptyMessage = container.querySelector('.empty-data-message');
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.textContent).toContain('没有可用的日志数据');
  });
  
  test('应该正确更新现有图表', () => {
    logVisualization.createTrendChart(testLogs);
    
    const initialChart = logVisualization.charts.trend;
    
    const newLogs = [...testLogs, { id: '7', timestamp: Date.now(), level: 'info', category: 'resource', message: 'New resource' }];
    logVisualization.updateChart(newLogs);
    
    expect(initialChart.destroy).toHaveBeenCalled();
    
    expect(Chart).toHaveBeenCalledTimes(2);
    expect(logVisualization.charts.trend).not.toBe(initialChart);
  });
  
  test('应该正确导出图表为图像', () => {
    const mockToDataURL = jest.fn().mockReturnValue('data:image/png;base64,test');
    
    logVisualization.createTrendChart(testLogs);
    
    const canvas = container.querySelector('canvas');
    canvas.toDataURL = mockToDataURL;
    
    const dataUrl = logVisualization.exportChart();
    
    expect(mockToDataURL).toHaveBeenCalledWith('image/png');
    expect(dataUrl).toBe('data:image/png;base64,test');
  });
});
