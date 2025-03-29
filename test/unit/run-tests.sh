
echo "运行 Resource Sniffer 扩展单元测试"
echo "=================================="

echo "安装测试依赖..."
cd "$(dirname "$0")"
npm install

echo "运行单元测试..."
npm test

echo "测试完成！"
echo "查看 ./coverage 目录获取详细覆盖率报告"
