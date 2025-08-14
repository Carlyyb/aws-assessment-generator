import React, { useState, useEffect } from 'react';
import {
  ContentLayout,
  Container,
  Header,
  SpaceBetween,
  Box,
  Cards,
  Badge,
  Button,
  Select,
  Table,
  TextFilter,
  Pagination,
  ColumnLayout,
  ProgressBar,
  StatusIndicator
} from '@cloudscape-design/components';
import { useCollection } from '@cloudscape-design/collection-hooks';

interface LogEntry {
  logId: string;
  timestamp: string;
  message: string;
  level: string;
  serviceName?: string;
  userId?: string;
  requestId?: string;
  errorType?: string;
  duration?: number;
}

interface SystemMetric {
  metricKey: string;
  timestamp: string;
  metricType: string;
  value: number;
  dimensions: Record<string, string>;
}

interface SystemHealth {
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  memoryUtilization: number;
  topErrors: Array<{ errorType: string; count: number }>;
  serviceHealth: Array<{ serviceName: string; status: string; errorCount: number }>;
}

const LogManagement: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  
  // 过滤器状态
  const [filters, setFilters] = useState({
    timeRange: '24h',
    serviceName: '',
    logLevel: '',
    userId: '',
    dateRange: null
  });

  const logLevelOptions = [
    { label: '全部级别', value: '' },
    { label: 'ERROR', value: 'ERROR' },
    { label: 'WARN', value: 'WARN' },
    { label: 'INFO', value: 'INFO' },
    { label: 'DEBUG', value: 'DEBUG' }
  ];

  const timeRangeOptions = [
    { label: '最近1小时', value: '1h' },
    { label: '最近24小时', value: '24h' },
    { label: '最近7天', value: '7d' },
    { label: '最近30天', value: '30d' }
  ];

  const serviceOptions = [
    { label: '全部服务', value: '' },
    { label: 'questions-generator', value: 'questions-generator' },
    { label: 'grade-assessment', value: 'grade-assessment' },
    { label: 'publish-assessment', value: 'publish-assessment' },
    { label: 'rag-pipeline', value: 'rag-pipeline' }
  ];

  // 模拟数据加载 - 在实际项目中应该调用GraphQL API
  useEffect(() => {
    loadSystemHealth();
    loadLogs();
    loadMetrics();
  }, [filters]);

  const loadSystemHealth = async () => {
    setLoading(true);
    try {
      // 这里应该调用实际的GraphQL查询
      const mockHealth: SystemHealth = {
        totalRequests: 15420,
        errorRate: 2.3,
        averageResponseTime: 245,
        memoryUtilization: 68,
        topErrors: [
          { errorType: 'ValidationError', count: 23 },
          { errorType: 'TimeoutError', count: 15 },
          { errorType: 'DatabaseError', count: 8 }
        ],
        serviceHealth: [
          { serviceName: 'questions-generator', status: 'HEALTHY', errorCount: 2 },
          { serviceName: 'grade-assessment', status: 'HEALTHY', errorCount: 1 },
          { serviceName: 'publish-assessment', status: 'WARNING', errorCount: 8 },
          { serviceName: 'rag-pipeline', status: 'HEALTHY', errorCount: 0 }
        ]
      };
      setSystemHealth(mockHealth);
    } catch (error) {
      console.error('Failed to load system health:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      // 模拟日志数据
      const mockLogs: LogEntry[] = [
        {
          logId: '1',
          timestamp: new Date().toISOString(),
          message: 'Assessment generation completed successfully',
          level: 'INFO',
          serviceName: 'questions-generator',
          userId: 'user123',
          requestId: 'req-456',
          duration: 1250
        },
        {
          logId: '2',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          message: 'Failed to validate assessment template',
          level: 'ERROR',
          serviceName: 'questions-generator',
          errorType: 'ValidationError'
        }
      ];
      setLogs(mockLogs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const loadMetrics = async () => {
    try {
      // 模拟指标数据
      const mockMetrics: SystemMetric[] = [
        {
          metricKey: 'lambda_duration#service:questions-generator',
          timestamp: new Date().toISOString(),
          metricType: 'lambda_duration',
          value: 1250,
          dimensions: { service: 'questions-generator' }
        }
      ];
      setMetrics(mockMetrics);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <StatusIndicator type="success">健康</StatusIndicator>;
      case 'WARNING':
        return <StatusIndicator type="warning">警告</StatusIndicator>;
      case 'UNHEALTHY':
        return <StatusIndicator type="error">异常</StatusIndicator>;
      default:
        return <StatusIndicator type="info">未知</StatusIndicator>;
    }
  };

  const getLevelBadge = (level: string) => {
    const getColor = (level: string) => {
      switch (level) {
        case 'ERROR': return 'red';
        case 'WARN': return 'red';
        case 'INFO': return 'blue'; 
        case 'DEBUG': return 'grey';
        default: return 'grey';
      }
    };
    return <Badge color={getColor(level)}>{level}</Badge>;
  };

  const logColumns = [
    {
      id: 'timestamp',
      header: '时间',
      cell: (item: LogEntry) => new Date(item.timestamp).toLocaleString(),
      sortingField: 'timestamp',
      width: 180
    },
    {
      id: 'level',
      header: '级别',
      cell: (item: LogEntry) => getLevelBadge(item.level),
      width: 80
    },
    {
      id: 'serviceName',
      header: '服务',
      cell: (item: LogEntry) => item.serviceName || '-',
      width: 150
    },
    {
      id: 'message',
      header: '消息',
      cell: (item: LogEntry) => (
        <Box variant="span">
          {item.message}
        </Box>
      )
    },
    {
      id: 'duration',
      header: '耗时(ms)',
      cell: (item: LogEntry) => item.duration ? `${item.duration}ms` : '-',
      width: 100
    }
  ];

  const { items, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
    logs,
    {
      filtering: {
        empty: (
          <Box textAlign="center" color="inherit">
            <b>没有日志</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              当前时间范围内没有找到日志记录。
            </Box>
          </Box>
        ),
        noMatch: (
          <Box textAlign="center" color="inherit">
            <b>没有匹配的日志</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              没有找到匹配搜索条件的日志。
            </Box>
          </Box>
        )
      },
      pagination: { pageSize: 20 },
      sorting: {}
    }
  );

  const renderOverview = () => (
    <SpaceBetween size="l">
      {/* 系统健康概览 */}
      <Container header={<Header variant="h2">系统健康状态</Header>}>
        <ColumnLayout columns={4} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">总请求数</Box>
            <Box variant="awsui-value-large">{systemHealth?.totalRequests?.toLocaleString()}</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">错误率</Box>
            <Box variant="awsui-value-large" color={(systemHealth?.errorRate || 0) > 5 ? 'text-status-error' : 'text-status-success'}>
              {systemHealth?.errorRate?.toFixed(2)}%
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label">平均响应时间</Box>
            <Box variant="awsui-value-large">{systemHealth?.averageResponseTime}ms</Box>
          </div>
          <div>
            <Box variant="awsui-key-label">内存使用率</Box>
            <ProgressBar value={systemHealth?.memoryUtilization || 0} />
          </div>
        </ColumnLayout>
      </Container>

      {/* 服务健康状态 */}
      <Container header={<Header variant="h2">服务状态</Header>}>
        <Cards
          cardDefinition={{
            header: (item: any) => item.serviceName,
            sections: [
              {
                id: 'status',
                header: '状态',
                content: (item: any) => getStatusIndicator(item.status)
              },
              {
                id: 'errorCount',
                header: '错误数量',
                content: (item: any) => item.errorCount
              }
            ]
          }}
          cardsPerRow={[
            { cards: 1 },
            { minWidth: 500, cards: 2 },
            { minWidth: 800, cards: 4 }
          ]}
          items={systemHealth?.serviceHealth || []}
        />
      </Container>

      {/* 热门错误 */}
      <Container header={<Header variant="h2">热门错误类型</Header>}>
        <Table
          items={systemHealth?.topErrors || []}
          columnDefinitions={[
            {
              id: 'errorType',
              header: '错误类型',
              cell: (item: any) => item.errorType
            },
            {
              id: 'count',
              header: '次数',
              cell: (item: any) => item.count
            }
          ]}
        />
      </Container>
    </SpaceBetween>
  );

  const renderLogs = () => (
    <Container 
      header={
        <Header 
          variant="h2" 
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Select
                selectedOption={timeRangeOptions.find(opt => opt.value === filters.timeRange) || null}
                onChange={({ detail }) => setFilters({ ...filters, timeRange: detail.selectedOption?.value || '24h' })}
                options={timeRangeOptions}
              />
              <Select
                selectedOption={serviceOptions.find(opt => opt.value === filters.serviceName) || null}
                onChange={({ detail }) => setFilters({ ...filters, serviceName: detail.selectedOption?.value || '' })}
                options={serviceOptions}
              />
              <Select
                selectedOption={logLevelOptions.find(opt => opt.value === filters.logLevel) || null}
                onChange={({ detail }) => setFilters({ ...filters, logLevel: detail.selectedOption?.value || '' })}
                options={logLevelOptions}
              />
              <Button onClick={loadLogs}>刷新</Button>
            </SpaceBetween>
          }
        >
          日志记录 ({filteredItemsCount})
        </Header>
      }
    >
      <Table
        {...collectionProps}
        columnDefinitions={logColumns}
        items={items}
        loadingText="加载日志中..."
        loading={loading}
        pagination={<Pagination {...paginationProps} />}
        filter={
          <TextFilter
            {...filterProps}
            filteringPlaceholder="搜索日志消息..."
          />
        }
      />
    </Container>
  );

  return (
    <ContentLayout
      header={
        <Header 
          variant="h1"
          info={
            <Box variant="p">
              系统日志管理和监控面板，提供实时的系统健康状态、错误追踪和性能监控。
            </Box>
          }
        >
          日志管理系统
        </Header>
      }
    >
      <SpaceBetween size="l">
        {/* 导航标签 */}
        <Box>
          <SpaceBetween direction="horizontal" size="xs">
            <Button 
              variant={selectedTab === 'overview' ? 'primary' : 'normal'}
              onClick={() => setSelectedTab('overview')}
            >
              系统概览
            </Button>
            <Button 
              variant={selectedTab === 'logs' ? 'primary' : 'normal'}
              onClick={() => setSelectedTab('logs')}
            >
              日志记录
            </Button>
            <Button 
              variant={selectedTab === 'metrics' ? 'primary' : 'normal'}
              onClick={() => setSelectedTab('metrics')}
            >
              性能指标
            </Button>
          </SpaceBetween>
        </Box>

        {/* 内容区域 */}
        {selectedTab === 'overview' && renderOverview()}
        {selectedTab === 'logs' && renderLogs()}
        {selectedTab === 'metrics' && (
          <Container header={<Header variant="h2">性能指标</Header>}>
            <Table
              items={metrics}
              columnDefinitions={[
                {
                  id: 'timestamp',
                  header: '时间',
                  cell: (item: SystemMetric) => new Date(item.timestamp).toLocaleString(),
                  width: 180
                },
                {
                  id: 'metricType',
                  header: '指标类型',
                  cell: (item: SystemMetric) => item.metricType,
                  width: 150
                },
                {
                  id: 'value',
                  header: '数值',
                  cell: (item: SystemMetric) => item.value.toFixed(2),
                  width: 100
                },
                {
                  id: 'dimensions',
                  header: '维度',
                  cell: (item: SystemMetric) => (
                    <Box variant="span">
                      {typeof item.dimensions === 'string' 
                        ? item.dimensions 
                        : JSON.stringify(item.dimensions)}
                    </Box>
                  )
                }
              ]}
              loading={loading}
              loadingText="加载指标中..."
              empty={
                <Box textAlign="center" color="inherit">
                  <b>没有指标数据</b>
                  <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                    当前时间范围内没有找到性能指标。
                  </Box>
                </Box>
              }
            />
          </Container>
        )}
      </SpaceBetween>
    </ContentLayout>
  );
};

export default LogManagement;
