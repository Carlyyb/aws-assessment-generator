/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useContext, useCallback } from 'react';
import { 
  Table, 
  Header, 
  SpaceBetween, 
  Container, 
  ContentLayout, 
  Box, 
  Button, 
  Pagination,
  Select,
  SelectProps,
  Modal,
  Alert,
  StatusIndicator,
  TextFilter
} from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { listAssessments, listAllAssessments } from '../graphql/queries';
import { deleteAssessment, unpublishAssessment, publishAssessment } from '../graphql/mutations';
import { Assessment, AssessStatus } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { getText } from '../i18n/lang';
import { useAdminPermissions } from '../utils/adminPermissions';
import { ExportModal } from '../components/ExportModal';
import { exportAssessments, ExportOptions } from '../utils/exportUtils';
import { formatBeijingTime } from '../utils/timeUtils';

const client = generateClient();

const FindAssessmentsPage = () => {
  const navigate = useNavigate();
  const dispatchAlert = useContext(DispatchAlertContext);
  const { adminInfo } = useAdminPermissions();
  
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filteredAssessments, setFilteredAssessments] = useState<Assessment[]>([]);
  const [statusFilter, setStatusFilter] = useState<SelectProps.Option | null>(null);
  const [publishedFilter, setPublishedFilter] = useState<SelectProps.Option | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState<Assessment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dataErrors, setDataErrors] = useState<Map<string, string>>(new Map());
  
  // 批量操作相关状态
  const [selectedAssessments, setSelectedAssessments] = useState<Assessment[]>([]);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // 检查数据异常的辅助函数
  const checkDataIntegrity = (assessment: any): string | null => {
    try {
      const hasMultiChoice = assessment.multiChoiceAssessment && Array.isArray(assessment.multiChoiceAssessment) && assessment.multiChoiceAssessment.length > 0;
      const hasSingleAnswer = assessment.singleAnswerAssessment && Array.isArray(assessment.singleAnswerAssessment) && assessment.singleAnswerAssessment.length > 0;
      const hasTrueFalse = assessment.trueFalseAssessment && Array.isArray(assessment.trueFalseAssessment) && assessment.trueFalseAssessment.length > 0;
      const hasFreeText = assessment.freeTextAssessment && Array.isArray(assessment.freeTextAssessment) && assessment.freeTextAssessment.length > 0;
      
      if (!hasMultiChoice && !hasSingleAnswer && !hasTrueFalse && !hasFreeText) {
        return '所有题目内容为空，数据完全异常';
      }

      if (assessment.multiChoiceAssessment && Array.isArray(assessment.multiChoiceAssessment)) {
        for (let i = 0; i < assessment.multiChoiceAssessment.length; i++) {
          const question = assessment.multiChoiceAssessment[i];
          if (question) {
            if (question.correctAnswer === null) {
              return `多选题 ${i + 1} 的答案数据已被清理（原数据格式异常）`;
            }
            if (question.question === null) {
              return `多选题 ${i + 1} 的问题数据已被清理（原数据格式异常）`;
            }
            if (question.explanation === null) {
              return `多选题 ${i + 1} 的解释数据已被清理（原数据格式异常）`;
            }
          }
        }
      }

      if (assessment.singleAnswerAssessment && Array.isArray(assessment.singleAnswerAssessment)) {
        for (let i = 0; i < assessment.singleAnswerAssessment.length; i++) {
          const question = assessment.singleAnswerAssessment[i];
          if (question && question.correctAnswer === null) {
            return `单选题 ${i + 1} 的答案数据已被清理（原数据格式异常）`;
          }
        }
      }

      if (assessment.trueFalseAssessment && Array.isArray(assessment.trueFalseAssessment)) {
        for (let i = 0; i < assessment.trueFalseAssessment.length; i++) {
          const question = assessment.trueFalseAssessment[i];
          if (question && question.correctAnswer === null) {
            return `判断题 ${i + 1} 的答案数据已被清理（原数据格式异常）`;
          }
        }
      }

      return null;
    } catch (error: any) {
      return `数据结构检查时发生错误: ${error.message}`;
    }
  };

  const getAssessments = useCallback(() => {
    // 根据用户权限选择适当的查询
    const query = adminInfo?.isAdmin ? listAllAssessments : listAssessments;
    const queryName = adminInfo?.isAdmin ? 'listAllAssessments' : 'listAssessments';
    
    client
      .graphql<any>({ query })
      .then(({ data }) => {
        const list = data?.[queryName] || [];
        const errors = new Map<string, string>();
        
        list.forEach((assessment: any) => {
          const error = checkDataIntegrity(assessment);
          if (error) {
            errors.set(assessment.id, error);
          }
        });
        
        setDataErrors(errors);
        setAssessments(list);
        setFilteredAssessments(list);
        
        if (errors.size > 0) {
          dispatchAlert({ 
            type: AlertType.ERROR, 
            content: `检测到 ${errors.size} 个测试存在数据异常，已在列表中标记` 
          });
        }
      })
      .catch((error) => {
        console.error('Error fetching assessments:', error);
        dispatchAlert({ 
          type: AlertType.ERROR, 
          content: '获取测试列表时发生错误，请稍后重试' 
        });
      });
  }, [adminInfo?.isAdmin, dispatchAlert]);

  // 批量删除处理函数
  const handleBatchDelete = async () => {
    setIsDeleting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const assessment of selectedAssessments) {
        try {
          await client.graphql<any>({
            query: deleteAssessment,
            variables: { id: assessment.id }
          });
          successCount++;
        } catch (error: any) {
          errorCount++;
          console.error(`删除 ${assessment.name} 失败:`, error);
        }
      }

      if (successCount > 0) {
        dispatchAlert({
          type: AlertType.SUCCESS,
          content: `成功删除 ${successCount} 个评估${errorCount > 0 ? `，${errorCount} 个删除失败` : ''}`
        });
      }

      if (errorCount > 0 && successCount === 0) {
        dispatchAlert({
          type: AlertType.ERROR,
          content: `批量删除失败，共 ${errorCount} 个评估删除失败`
        });
      }

      setSelectedAssessments([]);
      getAssessments();
    } catch (error: any) {
      console.error('批量删除错误:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: `批量删除失败: ${error.message || '未知错误'}`
      });
    } finally {
      setIsDeleting(false);
      setShowBatchDeleteModal(false);
    }
  };

  // 导出处理函数
  const handleExport = async (options: ExportOptions) => {
    setIsExporting(true);
    try {
      await exportAssessments(selectedAssessments, options);
      
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: `成功导出 ${selectedAssessments.length} 个评估`
      });
    } catch (error: any) {
      console.error('导出错误:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: `导出失败: ${error.message || '未知错误'}`
      });
    } finally {
      setIsExporting(false);
      setShowExportModal(false);
    }
  };

  const statusOptions: SelectProps.Option[] = [
    { label: '全部状态', value: 'all' },
    { label: '进行中', value: AssessStatus.IN_PROGRESS },
    { label: '已创建', value: AssessStatus.CREATED },
    { label: '失败', value: AssessStatus.FAILED },
    { label: '已发布', value: AssessStatus.PUBLISHED },
  ];

  const publishedOptions: SelectProps.Option[] = [
    { label: '全部', value: 'all' },
    { label: '已发布', value: 'published' },
    { label: '未发布', value: 'unpublished' },
  ];

  useEffect(() => {
    let filtered = [...assessments];

    if (statusFilter && statusFilter.value !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter.value);
    }

    if (publishedFilter && publishedFilter.value !== 'all') {
      if (publishedFilter.value === 'published') {
        filtered = filtered.filter(item => item.published);
      } else if (publishedFilter.value === 'unpublished') {
        filtered = filtered.filter(item => !item.published);
      }
    }

    if (nameFilter.trim()) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(nameFilter.toLowerCase()) ||
        item.course?.name?.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    setFilteredAssessments(filtered);
  }, [assessments, statusFilter, publishedFilter, nameFilter]);

  const handleDelete = async () => {
    if (!assessmentToDelete) return;

    setIsDeleting(true);
    try {
      await client.graphql<any>({
        query: deleteAssessment,
        variables: { id: assessmentToDelete.id }
      });

      dispatchAlert({
        type: AlertType.SUCCESS,
        content: '评估已成功删除'
      });

      getAssessments();
    } catch (error: any) {
      console.error('Delete error:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: `删除失败: ${error.message || '未知错误'}`
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setAssessmentToDelete(null);
    }
  };

  const handleUnpublish = async (assessment: Assessment) => {
    try {
      await client.graphql<any>({
        query: unpublishAssessment,
        variables: { assessmentId: assessment.id }
      });

      dispatchAlert({
        type: AlertType.SUCCESS,
        content: '评估已取消发布'
      });

      getAssessments();
    } catch (error: any) {
      console.error('Unpublish error:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: `取消发布失败: ${error.message || '未知错误'}`
      });
    }
  };

  const getStatusDisplay = (status: AssessStatus) => {
    switch (status) {
      case AssessStatus.IN_PROGRESS:
        return <StatusIndicator type="in-progress">进行中</StatusIndicator>;
      case AssessStatus.CREATED:
        return <StatusIndicator type="success">已创建</StatusIndicator>;
      case AssessStatus.FAILED:
        return <StatusIndicator type="error">失败</StatusIndicator>;
      case AssessStatus.PUBLISHED:
        return <StatusIndicator type="success">已发布</StatusIndicator>;
      default:
        return status;
    }
  };

  // 检查是否可以删除
  const canDelete = (item: Assessment) => {
    const hasDataError = dataErrors.has(item.id);
    return hasDataError || adminInfo?.isAdmin || item.status === AssessStatus.FAILED;
  };

  useEffect(() => {
    getAssessments();
  }, [getAssessments]);

  return (
    <>
      <ContentLayout>
        <Container
          header={
            <SpaceBetween size="l">
              <Header variant="h1">
                {getText('teachers.assessments.find.title')}
                {adminInfo?.isAdmin && (
                  <Box variant="small" color="text-status-info" display="inline" margin={{ left: 's' }}>
                    (管理员视图 - 显示所有用户的评估)
                  </Box>
                )}
              </Header>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Box padding="s">
              <SpaceBetween size="s" direction="horizontal">
                <Box variant="awsui-key-label">筛选条件:</Box>
                <Select
                  selectedOption={statusFilter}
                  onChange={({ detail }) => setStatusFilter(detail.selectedOption)}
                  options={statusOptions}
                  placeholder="选择状态"
                />
                <Select
                  selectedOption={publishedFilter}
                  onChange={({ detail }) => setPublishedFilter(detail.selectedOption)}
                  options={publishedOptions}
                  placeholder="发布状态"
                />
                <TextFilter
                  filteringText={nameFilter}
                  filteringPlaceholder="搜索名称或课程"
                  onChange={({ detail }) => setNameFilter(detail.filteringText)}
                />
              </SpaceBetween>
            </Box>

            {/* 批量操作栏 */}
            {selectedAssessments.length > 0 && (
              <Box padding="s" variant="awsui-value-large">
                <SpaceBetween size="s" direction="horizontal">
                  <Box variant="awsui-key-label">已选择 {selectedAssessments.length} 项:</Box>
                  <Button
                    onClick={() => setShowExportModal(true)}
                    iconName="download"
                  >
                    导出选中项
                  </Button>
                  <Button
                    variant="normal"
                    iconName="remove"
                    onClick={() => setShowBatchDeleteModal(true)}
                    disabled={!selectedAssessments.some(canDelete)}
                  >
                    删除选中项
                  </Button>
                </SpaceBetween>
              </Box>
            )}

            <Table
              selectionType="multi"
              selectedItems={selectedAssessments}
              onSelectionChange={({ detail }) => setSelectedAssessments(detail.selectedItems)}
              columnDefinitions={[
                {
                  id: 'name',
                  header: getText('common.labels.name'),
                  cell: (item) => item.name,
                },
                {
                  id: 'course',
                  header: getText('common.labels.course'),
                  cell: (item) => item.course?.name,
                },
                // 只有管理员才显示创建者列
                ...(adminInfo?.isAdmin ? [{
                  id: 'creator',
                  header: '创建者',
                  cell: (item: any) => item.userId || item.createdBy || '未知',
                }] : []),
                {
                  id: 'lectureDate',
                  header: getText('teachers.assessments.find.lecture_date'),
                  cell: (item) => formatBeijingTime(item.lectureDate, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Shanghai'
                  }),
                },
                {
                  id: 'deadline',
                  header: getText('common.labels.deadline'),
                  cell: (item) => formatBeijingTime(item.deadline, {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Shanghai'
                  }),
                },
                {
                  id: 'updatedAt',
                  header: getText('teachers.assessments.find.updated_at'),
                  cell: (item) => item.updatedAt,
                },
                {
                  id: 'status',
                  header: getText('common.labels.status'),
                  cell: (item) => {
                    const error = dataErrors.get(item.id);
                    if (error) {
                      return (
                        <SpaceBetween size="xs" direction="vertical">
                          {getStatusDisplay(item.status)}
                          <StatusIndicator type="error">
                            数据异常: {error}
                          </StatusIndicator>
                        </SpaceBetween>
                      );
                    }
                    return getStatusDisplay(item.status);
                  },
                },
                {
                  id: 'published',
                  header: '发布状态',
                  cell: (item) => item.published ? 
                    <StatusIndicator type="success">已发布</StatusIndicator> : 
                    <StatusIndicator type="pending">未发布</StatusIndicator>,
                },
                {
                  id: 'edit',
                  header: '操作',
                  cell: (item) => {
                    const hasDataError = dataErrors.has(item.id);
                    const errorMessage = dataErrors.get(item.id) || '';
                    const isCompletelyCorrupted = errorMessage.includes('所有题目内容为空，数据完全异常');
                    
                    return (
                      <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                        {/* 对于失败状态的评估，只显示删除按钮和失败信息 */}
                        {item.status === AssessStatus.FAILED ? (
                          <>
                            <Box variant="small" color="text-status-error">
                              生成失败
                            </Box>
                            <Button
                              variant="normal"
                              iconName="remove"
                              onClick={() => {
                                setAssessmentToDelete(item);
                                setShowDeleteModal(true);
                              }}
                            >
                              删除
                            </Button>
                          </>
                        ) : (
                          <>
                            {/* 数据异常警告信息 - 以简洁的文本形式显示 */}
                            {hasDataError && (
                              <Box variant="small" color={isCompletelyCorrupted ? "text-status-error" : "text-status-warning"}>
                                {isCompletelyCorrupted ? '数据损坏' : '数据异常'}
                              </Box>
                            )}
                            
                            {isCompletelyCorrupted ? (
                              <Button
                                variant="normal"
                                iconName="remove"
                                onClick={() => {
                                  setAssessmentToDelete(item);
                                  setShowDeleteModal(true);
                                }}
                              >
                                删除
                              </Button>
                            ) : (
                              <>
                                {/* 设置按钮 - 对于已创建的测试 */}
                                {!hasDataError && item.status === AssessStatus.CREATED && (
                                  <Button
                                    variant="normal"
                                    iconName="settings"
                                    onClick={() => navigate(`/assessment-settings/${item.id}`)}
                                  >
                                    设置
                                  </Button>
                                )}
                                
                                {/* 模拟测试按钮 - 对于已创建且已发布的测试 */}
                                {!hasDataError && item.status === AssessStatus.CREATED && item.published && (
                                  <Button
                                    variant="normal"
                                    iconName="external"
                                    onClick={() => navigate(`/assessment/${item.id}?preview=true`)}
                                  >
                                    模拟测试
                                  </Button>
                                )}
                                
                                {/* 查看数据按钮 - 已发布或已创建的测试都显示 */}
                                {!hasDataError && (item.published || item.status === AssessStatus.CREATED) && (
                                  <Button
                                    variant="normal"
                                    iconName="search"
                                    onClick={() => navigate(`/assessment-results/${item.id}`)}
                                  >
                                    {item.published ? '测试结果' : '查看数据'}
                                  </Button>
                                )}
                                
                                {!hasDataError && item.status === AssessStatus.CREATED && (
                                  item.published ? (
                                    <Button
                                      iconName="status-negative"
                                      onClick={() => handleUnpublish(item)}
                                    >
                                      取消发布
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        variant="primary"
                                        iconName="status-positive"
                                        onClick={() =>
                                          client
                                            .graphql<any>({ query: publishAssessment, variables: { assessmentId: item.id } })
                                            .then(({ data }) => {
                                              if (!data || data.publishAssessment !== true) {
                                                throw new Error('Publish mutation returned falsy result');
                                              }
                                              dispatchAlert({ type: AlertType.SUCCESS, content: getText('teachers.assessments.find.published_successfully') });
                                              return getAssessments();
                                            })
                                            .catch((e) => {
                                              console.error('publishAssessment failed', e);
                                              dispatchAlert({ type: AlertType.ERROR, content: getText('common.status.error') });
                                            })
                                        }
                                      >
                                        {getText('common.actions.publish')}
                                      </Button>
                                      <Button
                                        variant="normal"
                                        iconName="edit"
                                        onClick={() => navigate(`/edit-assessment/${item.id}`)}
                                      >
                                        编辑试卷
                                      </Button>
                                    </>
                                  )
                                )}

                                {!hasDataError && item.status === AssessStatus.PUBLISHED && (
                                  <Button
                                    iconName="status-negative"
                                    onClick={() => handleUnpublish(item)}
                                  >
                                    取消发布
                                  </Button>
                                )}
                                
                              </>
                            )}
                          </>
                        )}
                      </SpaceBetween>
                    );
                  },
                },
              ]}
              columnDisplay={[
                { id: 'name', visible: true },
                { id: 'course', visible: true },
                // 只有管理员才显示创建者列
                ...(adminInfo?.isAdmin ? [{ id: 'creator', visible: true }] : []),
                { id: 'lectureDate', visible: true },
                { id: 'deadline', visible: true },
                { id: 'updatedAt', visible: true },
                { id: 'status', visible: true },
                { id: 'published', visible: true },
                { id: 'edit', visible: true },
              ]}
              items={filteredAssessments}
              loadingText={getText('common.status.loading')}
              trackBy="id"
              empty={
                <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
                  {nameFilter || statusFilter || publishedFilter ? 
                    '没有找到符合筛选条件的测试' : 
                    getText('common.status.empty')
                  }
                </Box>
              }
              pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
            />
          </SpaceBetween>
        </Container>
      </ContentLayout>

      {/* 单个删除确认对话框 */}
      <Modal
        visible={showDeleteModal}
        onDismiss={() => {
          setShowDeleteModal(false);
          setAssessmentToDelete(null);
        }}
        header="确认删除"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="link"
                onClick={() => {
                  setShowDeleteModal(false);
                  setAssessmentToDelete(null);
                }}
              >
                取消
              </Button>
              <Button 
                variant="primary" 
                onClick={handleDelete}
                loading={isDeleting}
              >
                删除
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {assessmentToDelete && (
          <SpaceBetween size="m">
            <Alert type="warning" statusIconAriaLabel="警告">
              此操作无法撤销。删除后，所有相关的学生答题记录也将被删除。
            </Alert>
            <Box>
              确定要删除测试 <strong>"{assessmentToDelete.name}"</strong> 吗？
            </Box>
            {assessmentToDelete.status === AssessStatus.FAILED && (
              <Alert type="info">
                这是一个生成失败的测试记录，删除它有助于清理无效数据。
              </Alert>
            )}
            {dataErrors.has(assessmentToDelete.id) && (
              <Alert type="error">
                数据异常: {dataErrors.get(assessmentToDelete.id)}
                <br />
                建议删除此记录以避免系统错误。
              </Alert>
            )}
          </SpaceBetween>
        )}
      </Modal>

      {/* 批量删除确认对话框 */}
      <Modal
        visible={showBatchDeleteModal}
        onDismiss={() => setShowBatchDeleteModal(false)}
        header="确认批量删除"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="link"
                onClick={() => setShowBatchDeleteModal(false)}
              >
                取消
              </Button>
              <Button 
                variant="primary" 
                onClick={handleBatchDelete}
                loading={isDeleting}
              >
                删除
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="m">
          <Alert type="warning" statusIconAriaLabel="警告">
            此操作无法撤销。删除后，所有相关的学生答题记录也将被删除。
          </Alert>
          <Box>
            确定要删除选中的 <strong>{selectedAssessments.length}</strong> 个测试吗？
          </Box>
          {selectedAssessments.some(item => dataErrors.has(item.id)) && (
            <Alert type="error">
              选中项中包含数据异常的测试，建议删除以避免系统错误。
            </Alert>
          )}
        </SpaceBetween>
      </Modal>

      {/* 导出模态窗口 */}
      <ExportModal
        visible={showExportModal}
        onDismiss={() => setShowExportModal(false)}
        onExport={handleExport}
        selectedCount={selectedAssessments.length}
        isExporting={isExporting}
      />
    </>
  );
};

export default FindAssessmentsPage;
