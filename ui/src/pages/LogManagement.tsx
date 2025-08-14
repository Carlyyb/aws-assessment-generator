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
  StatusIndicator,
  Modal
} from '@cloudscape-design/components';
import { useCollection } from '@cloudscape-design/collection-hooks';
import { generateClient } from 'aws-amplify/api';

const client = generateClient();

// GraphQL查询
const QUERY_LOGS = `
  query QueryLogs($input: LogQueryInput!) {
    queryLogs(input: $input) {
      ... on LogsResult {
        logs {
          logId
          timestamp
          message
          level
          serviceName
          userId
          requestId
          errorType
          stackTrace
          duration
          memoryUsed
          billedDuration
        }
        nextToken
      }
      ... on SystemHealthResult {
        totalRequests
        errorRate
        averageResponseTime
        memoryUtilization
        topErrors {
          errorType
          count
        }
        serviceHealth {
          serviceName
          status
          errorCount
          requestCount
        }
      }
      ... on ErrorDetailResult {
        errorDetail {
          logId
          timestamp
          serviceName
          errorType
          message
          stackTrace
          requestId
          userId
          context {
            duration
            memoryUsed
            billedDuration
            relatedRequests {
              logId
              timestamp
              message
              level
              serviceName
              requestId
            }
          }
        }
      }
      ... on ServiceStatsResult {
        serviceStats {
          serviceName
          requestCount
          errorCount
          avgDuration
          avgMemoryUsed
          errorRate
          lastActivity
          peakMemory
          slowestRequest
        }
      }
      ... on RequestStatsResult {
        requestStats {
          serviceName
          hourlyData {
            hour
            requestCount
            errorCount
            avgDuration
            peakMemory
          }
        }
      }
    }
  }
`;

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
  serviceHealth: Array<{ serviceName: string; status: string; errorCount: number; requestCount: number }>;
}

interface ServiceStats {
  serviceName: string;
  requestCount: number;
  errorCount: number;
  avgDuration: number;
  avgMemoryUsed: number;
  errorRate: number;
  lastActivity: string;
  peakMemory: number;
  slowestRequest: number;
}

interface ErrorDetail {
  logId: string;
  timestamp: string;
  serviceName: string;
  errorType: string;
  message: string;
  stackTrace?: string;
  requestId?: string;
  userId?: string;
  context: {
    duration?: number;
    memoryUsed?: number;
    billedDuration?: number;
    relatedRequests?: LogEntry[];
  };
}

interface RequestStats {
  serviceName: string;
  hourlyData: Array<{
    hour: string;
    requestCount: number;
    errorCount: number;
    avgDuration: number;
    peakMemory: number;
  }>;
}

const LogManagement: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [_serviceStats, setServiceStats] = useState<ServiceStats[]>([]);
  const [_requestStats, setRequestStats] = useState<RequestStats[]>([]);
  const [selectedErrorDetail, setSelectedErrorDetail] = useState<ErrorDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  
  // 过滤器状态
  const [filters, setFilters] = useState({
    timeRange: '24h',
    serviceName: '',
    logLevel: '',
    userId: '',
    searchText: '',
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
    loadServiceStats();
    loadRequestStats();
  }, [filters]);

  const loadSystemHealth = async () => {
    setLoading(true);
    try {
      const result = await client.graphql({
        query: QUERY_LOGS,
        variables: {
          input: {
            operation: 'getSystemHealth',
            filters: {
              timeRange: filters.timeRange
            }
          }
        }
      });

      const response = (result as any).data?.queryLogs;
      if (response && response.__typename === 'SystemHealthResult') {
        setSystemHealth({
          totalRequests: response.totalRequests,
          errorRate: response.errorRate,
          averageResponseTime: response.averageResponseTime,
          memoryUtilization: response.memoryUtilization,
          topErrors: response.topErrors || [],
          serviceHealth: response.serviceHealth || []
        });
      }
    } catch (error) {
      console.error('Failed to load system health:', error);
      // 如果API调用失败，显示默认数据
      setSystemHealth({
        totalRequests: 0,
        errorRate: 0,
        averageResponseTime: 0,
        memoryUtilization: 0,
        topErrors: [],
        serviceHealth: []
      });
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const result = await client.graphql({
        query: QUERY_LOGS,
        variables: {
          input: {
            operation: 'getLogs',
            filters: {
              timeRange: filters.timeRange,
              level: filters.logLevel || undefined,
              serviceName: filters.serviceName || undefined,
              limit: 100
            },
            searchQuery: filters.searchText || undefined
          }
        }
      });

      const response = (result as any).data?.queryLogs;
      if (response && response.__typename === 'LogsResult') {
        setLogs(response.logs.map((item: any) => ({
          logId: item.logId,
          timestamp: item.timestamp,
          level: item.level,
          serviceName: item.serviceName,
          message: item.message,
          requestId: item.requestId,
          duration: item.duration,
          errorType: item.errorType,
          userId: item.userId
        })));
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
      // 如果API调用失败，显示空数组
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    setLoading(true);
    try {
      const result = await client.graphql({
        query: QUERY_LOGS,
        variables: {
          input: {
            operation: 'getMetrics',
            filters: {
              timeRange: filters.timeRange,
              serviceName: filters.serviceName || undefined,
              limit: 100
            }
          }
        }
      });

      const response = (result as any).data?.queryLogs;
      if (response && response.__typename === 'MetricsResult') {
        setMetrics(response.metrics.map((item: any) => ({
          metricKey: item.metricKey,
          timestamp: item.timestamp,
          metricType: item.metricType,
          value: item.value,
          dimensions: item.dimensions
        })));
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
      // 如果API调用失败，显示空数组
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  };

  // 获取错误详情
  const loadErrorDetail = async (logId: string) => {
    try {
      setLoading(true);
      const result = await client.graphql({
        query: QUERY_LOGS,
        variables: {
          input: {
            operation: 'getErrorDetail',
            filters: {
              logId: logId
            }
          }
        }
      });

      const response = (result as any).data?.queryLogs;
      if (response && response.__typename === 'ErrorDetailResult') {
        const errorDetail = response.errorDetail;
        setSelectedErrorDetail({
          logId: errorDetail.logId,
          timestamp: errorDetail.timestamp,
          serviceName: errorDetail.serviceName,
          errorType: errorDetail.errorType,
          message: errorDetail.message,
          stackTrace: errorDetail.stackTrace,
          requestId: errorDetail.requestId,
          userId: errorDetail.userId,
          context: errorDetail.context
        });
      }
    } catch (error) {
      console.error('Failed to load error detail:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取服务统计
  const loadServiceStats = async () => {
    try {
      const result = await client.graphql({
        query: QUERY_LOGS,
        variables: {
          input: {
            operation: 'getServiceStats',
            filters: {
              timeRange: filters.timeRange
            }
          }
        }
      });

      const response = (result as any).data?.queryLogs;
      if (response && response.__typename === 'ServiceStatsResult') {
        setServiceStats(response.serviceStats.map((item: any) => ({
          serviceName: item.serviceName,
          requestCount: item.requestCount,
          errorCount: item.errorCount,
          avgDuration: item.avgDuration,
          avgMemoryUsed: item.avgMemoryUsed,
          errorRate: item.errorRate,
          lastActivity: item.lastActivity,
          peakMemory: item.peakMemory,
          slowestRequest: item.slowestRequest
        })));
      }
    } catch (error) {
      console.error('Failed to load service stats:', error);
      setServiceStats([]);
    }
  };

  // 获取请求统计
  const loadRequestStats = async () => {
    try {
      const result = await client.graphql({
        query: QUERY_LOGS,
        variables: {
          input: {
            operation: 'getRequestStats',
            filters: {
              timeRange: filters.timeRange,
              serviceName: filters.serviceName || undefined
            }
          }
        }
      });

      const response = (result as any).data?.queryLogs;
      if (response && response.__typename === 'RequestStatsResult') {
        setRequestStats(response.requestStats.map((item: any) => ({
          serviceName: item.serviceName,
          hourlyData: item.hourlyData || []
        })));
      }
    } catch (error) {
      console.error('Failed to load request stats:', error);
      setRequestStats([]);
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
    },
    {
      id: 'actions',
      header: '操作',
      cell: (item: LogEntry) => (
        item.level === 'ERROR' && item.errorType ? (
          <Button 
            variant="inline-link" 
            onClick={() => loadErrorDetail(item.logId)}
            disabled={loading}
          >
            查看详情
          </Button>
        ) : '-'
      ),
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
      
      {/* 错误详情模态框 */}
      {selectedErrorDetail && (
        <Modal
          visible={!!selectedErrorDetail}
          onDismiss={() => setSelectedErrorDetail(null)}
          header="错误详情"
          size="large"
        >
          <SpaceBetween size="m">
            <ColumnLayout columns={2} variant="text-grid">
              <div>
                <Box variant="awsui-key-label">错误类型</Box>
                <div>{selectedErrorDetail.errorType}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">服务名称</Box>
                <div>{selectedErrorDetail.serviceName}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">请求ID</Box>
                <div>{selectedErrorDetail.requestId}</div>
              </div>
              <div>
                <Box variant="awsui-key-label">用户ID</Box>
                <div>{selectedErrorDetail.userId || '-'}</div>
              </div>
            </ColumnLayout>
            
            <div>
              <Box variant="awsui-key-label">错误消息</Box>
              <Box variant="code">{selectedErrorDetail.message}</Box>
            </div>
            
            {selectedErrorDetail.stackTrace && (
              <div>
                <Box variant="awsui-key-label">堆栈跟踪</Box>
                <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px', backgroundColor: '#f4f4f4', padding: '8px', borderRadius: '4px' }}>
                  {selectedErrorDetail.stackTrace}
                </div>
              </div>
            )}
            
            {selectedErrorDetail.context && (
              <div>
                <Box variant="awsui-key-label">上下文信息</Box>
                <ColumnLayout columns={3} variant="text-grid">
                  <div>
                    <Box variant="awsui-key-label">执行时长</Box>
                    <div>{selectedErrorDetail.context.duration}ms</div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">内存使用</Box>
                    <div>{selectedErrorDetail.context.memoryUsed}MB</div>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">计费时长</Box>
                    <div>{selectedErrorDetail.context.billedDuration}ms</div>
                  </div>
                </ColumnLayout>
              </div>
            )}
          </SpaceBetween>
        </Modal>
      )}
    </ContentLayout>
  );
};

export default LogManagement;
