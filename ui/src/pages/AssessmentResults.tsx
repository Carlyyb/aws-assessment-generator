import { useState, useEffect, useContext } from 'react';
import {
  Table,
  Header,
  SpaceBetween,
  Container,
  ContentLayout,
  Box,
  Button,
  StatusIndicator,
  Badge,
  Modal,
  Spinner,
  Alert
} from '@cloudscape-design/components';
import { useParams, useNavigate } from 'react-router-dom';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';

interface StudentResult {
  userId: string;
  userName: string;
  userEmail: string;
  completed: boolean;
  score?: number;
  duration?: number; // 用时（分钟）
  submittedAt?: string;
  startedAt?: string;
}

export default () => {
  const params = useParams();
  const navigate = useNavigate();
  const dispatchAlert = useContext(DispatchAlertContext);
  
  const [loading, setLoading] = useState(true);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [assessmentInfo, setAssessmentInfo] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);

  useEffect(() => {
    loadAssessmentResults();
  }, [params.id]);

  const loadAssessmentResults = async () => {
    setLoading(true);
    try {
      // 这里需要实现获取测试结果的GraphQL查询
      // 暂时使用模拟数据
      const mockData: StudentResult[] = [
        {
          userId: '1',
          userName: '张三',
          userEmail: 'zhangsan@example.com',
          completed: true,
          score: 85,
          duration: 45,
          submittedAt: '2025-08-18T10:30:00Z',
          startedAt: '2025-08-18T09:45:00Z'
        },
        {
          userId: '2',
          userName: '李四',
          userEmail: 'lisi@example.com',
          completed: true,
          score: 92,
          duration: 38,
          submittedAt: '2025-08-18T11:15:00Z',
          startedAt: '2025-08-18T10:37:00Z'
        },
        {
          userId: '3',
          userName: '王五',
          userEmail: 'wangwu@example.com',
          completed: false,
          startedAt: '2025-08-18T09:30:00Z'
        },
        {
          userId: '4',
          userName: '赵六',
          userEmail: 'zhaoliu@example.com',
          completed: false
        }
      ];

      const mockAssessmentInfo = {
        name: '期中考试 - 数据结构',
        course: { name: '计算机科学' },
        deadline: '2025-08-20T23:59:59Z',
        totalQuestions: 20
      };

      setStudentResults(mockData);
      setAssessmentInfo(mockAssessmentInfo);
      
    } catch (error: any) {
      console.error('Error loading assessment results:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '加载测试结果失败，请稍后重试'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}小时${mins}分钟`;
    }
    return `${mins}分钟`;
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getCompletionStatus = (student: StudentResult) => {
    if (student.completed) {
      return <StatusIndicator type="success">已完成</StatusIndicator>;
    } else if (student.startedAt) {
      return <StatusIndicator type="in-progress">进行中</StatusIndicator>;
    } else {
      return <StatusIndicator type="pending">未开始</StatusIndicator>;
    }
  };

  const getScoreBadge = (score?: number) => {
    if (score === undefined) return '-';
    
    let color: 'blue' | 'green' | 'red' = 'blue';
    if (score >= 90) color = 'green';
    else if (score < 60) color = 'red';
    
    return <Badge color={color}>{score}分</Badge>;
  };

  const completedCount = studentResults.filter(s => s.completed).length;
  const totalCount = studentResults.length;
  const averageScore = studentResults
    .filter(s => s.completed && s.score !== undefined)
    .reduce((sum, s) => sum + (s.score || 0), 0) / Math.max(completedCount, 1);

  if (loading) {\
    return (
      <ContentLayout>
        <Container>
          <SpaceBetween size="l" alignItems="center">
            <Spinner size="big" />
            <Box>加载测试结果中...</Box>
          </SpaceBetween>
        </Container>
      </ContentLayout>
    );
  }

  return (
    <>
      <ContentLayout>
        <SpaceBetween size="l">
          {/* 测试信息概览 */}
          <Container
            header={
              <Header 
                variant="h1"
                actions={
                  <Button 
                    variant="primary"
                    onClick={() => navigate('/assessments/find-assessments')}
                  >
                    返回测试列表
                  </Button>
                }
              >
                测试结果 - {assessmentInfo?.name}
              </Header>
            }
          >
            <SpaceBetween size="m">
              <Box>
                <strong>课程：</strong>{assessmentInfo?.course?.name}
              </Box>
              <Box>
                <strong>截止时间：</strong>{formatDateTime(assessmentInfo?.deadline)}
              </Box>
              <SpaceBetween size="s" direction="horizontal">
                <Badge color="blue">总学生数: {totalCount}</Badge>
                <Badge color="green">已完成: {completedCount}</Badge>
                <Badge color="grey">未完成: {totalCount - completedCount}</Badge>
                {completedCount > 0 && (
                  <Badge color="red">平均分: {Math.round(averageScore)}分</Badge>
                )}
              </SpaceBetween>
            </SpaceBetween>
          </Container>

          {/* 学生结果表格 */}
          <Container>
            <Table
              columnDefinitions={[
                {
                  id: 'student',
                  header: '学生信息',
                  cell: (item) => (
                    <SpaceBetween size="xs">
                      <Box fontWeight="bold">{item.userName}</Box>
                      <Box fontSize="body-s" color="text-status-inactive">{item.userEmail}</Box>
                    </SpaceBetween>
                  ),
                },
                {
                  id: 'status',
                  header: '完成状态',
                  cell: (item) => getCompletionStatus(item),
                },
                {
                  id: 'score',
                  header: '分数',
                  cell: (item) => getScoreBadge(item.score),
                },
                {
                  id: 'duration',
                  header: '用时',
                  cell: (item) => formatDuration(item.duration),
                },
                {
                  id: 'submittedAt',
                  header: '提交时间',
                  cell: (item) => formatDateTime(item.submittedAt),
                },
                {
                  id: 'actions',
                  header: '操作',
                  cell: (item) => (
                    <SpaceBetween size="xs" direction="horizontal">
                      {item.completed && (
                        <Button
                          variant="normal"
                          onClick={() => {
                            setSelectedStudent(item);
                            setShowDetailsModal(true);
                          }}
                        >
                          查看试卷
                        </Button>
                      )}
                      {item.startedAt && !item.completed && (
                        <Button
                          variant="normal"
                          onClick={() => {
                            // 这里可以实现查看进度的功能
                            dispatchAlert({
                              type: AlertType.SUCCESS,
                              content: `${item.userName} 的测试仍在进行中`
                            });
                          }}
                        >
                          查看进度
                        </Button>
                      )}
                    </SpaceBetween>
                  ),
                },
              ]}
              items={studentResults}
              loadingText="加载中..."
              trackBy="userId"
              empty={
                <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
                  <SpaceBetween size="m">
                    <Box>没有学生参与此测试</Box>
                    <Alert>
                      请确保测试已发布，并且学生已经开始答题。
                    </Alert>
                  </SpaceBetween>
                </Box>
              }
              header={
                <Header
                  counter={`(${studentResults.length})`}
                  actions={
                    <SpaceBetween size="xs" direction="horizontal">
                      <Button
                        variant="normal"
                        onClick={() => {
                          // 这里可以实现导出功能
                          dispatchAlert({
                            type: AlertType.SUCCESS,
                            content: '导出功能开发中...'
                          });
                        }}
                      >
                        导出结果
                      </Button>
                      <Button
                        variant="normal"
                        onClick={loadAssessmentResults}
                      >
                        刷新
                      </Button>
                    </SpaceBetween>
                  }
                >
                  学生测试结果
                </Header>
              }
            />
          </Container>
        </SpaceBetween>
      </ContentLayout>

      {/* 查看试卷详情模态框 */}
      <Modal
        visible={showDetailsModal}
        onDismiss={() => {
          setShowDetailsModal(false);
          setSelectedStudent(null);
        }}
        header={`${selectedStudent?.userName} 的答题详情`}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="link"
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedStudent(null);
                }}
              >
                关闭
              </Button>
              <Button 
                variant="primary"
                onClick={() => {
                  // 这里可以导航到详细的答题回顾页面
                  navigate(`/student-assessment-review/${params.id}/${selectedStudent?.userId}`);
                }}
              >
                查看详细试卷
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {selectedStudent && (
          <SpaceBetween size="l">
            <Alert type="info" header="答题概览">
              <SpaceBetween size="s">
                <Box><strong>学生：</strong>{selectedStudent.userName}</Box>
                <Box><strong>分数：</strong>{selectedStudent.score}分</Box>
                <Box><strong>用时：</strong>{formatDuration(selectedStudent.duration)}</Box>
                <Box><strong>提交时间：</strong>{formatDateTime(selectedStudent.submittedAt)}</Box>
              </SpaceBetween>
            </Alert>
            
            <Box>
              <Header variant="h3">快速预览</Header>
              <Alert>
                详细的答题内容和批改结果需要点击"查看详细试卷"按钮查看。
              </Alert>
            </Box>
          </SpaceBetween>
        )}
      </Modal>
    </>
  );
};
