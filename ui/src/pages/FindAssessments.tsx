import { useState, useEffect, useContext } from 'react';
import { 
  Table, 
  Header, 
  SpaceBetween, 
  Container, 
  ContentLayout, 
  Link, 
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
import { listAssessments, publishAssessment } from '../graphql/queries';
import { deleteAssessment, unpublishAssessment } from '../graphql/mutations';
import { Assessment, AssessStatus } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { getText } from '../i18n/lang';
import { useAdminPermissions } from '../utils/adminPermissions';

const client = generateClient();

export default () => {
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

  // 状态选项
  const statusOptions: SelectProps.Option[] = [
    { label: '全部状态', value: 'all' },
    { label: '进行中', value: AssessStatus.IN_PROGRESS },
    { label: '已创建', value: AssessStatus.CREATED },
    { label: '失败', value: AssessStatus.FAILED },
    { label: '已发布', value: AssessStatus.PUBLISHED },
  ];

  // 发布状态选项
  const publishedOptions: SelectProps.Option[] = [
    { label: '全部', value: 'all' },
    { label: '已发布', value: 'published' },
    { label: '未发布', value: 'unpublished' },
  ];

  const getAssessments = () => {
    client
      .graphql<any>({ query: listAssessments })
      .then(({ data }) => {
        const list = data.listAssessments || [];
        setAssessments(list);
        setFilteredAssessments(list);
      })
      .catch(() => dispatchAlert({ type: AlertType.ERROR }));
  };

  // 筛选逻辑
  useEffect(() => {
    let filtered = [...assessments];

    // 按状态筛选
    if (statusFilter && statusFilter.value !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter.value);
    }

    // 按发布状态筛选
    if (publishedFilter && publishedFilter.value !== 'all') {
      if (publishedFilter.value === 'published') {
        filtered = filtered.filter(item => item.published);
      } else if (publishedFilter.value === 'unpublished') {
        filtered = filtered.filter(item => !item.published);
      }
    }

    // 按名称筛选
    if (nameFilter.trim()) {
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(nameFilter.toLowerCase()) ||
        item.course?.name?.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    setFilteredAssessments(filtered);
  }, [assessments, statusFilter, publishedFilter, nameFilter]);

  // 删除评估
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

  // 取消发布评估
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

  // 获取状态显示
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

  // 检查是否可以删除（管理员或失败状态的记录）
  useEffect(getAssessments, []);

  return (
    <>
      <ContentLayout>
        <Container
          header={
            <SpaceBetween size="l">
              <Header variant="h1">{getText('teachers.assessments.find.title')}</Header>
            </SpaceBetween>
          }
        >
          {/* 筛选器 */}
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

            <Table
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
                {
                  id: 'lectureDate',
                  header: getText('teachers.assessments.find.lecture_date'),
                  cell: (item) => new Date(item.lectureDate).toDateString(),
                },
                {
                  id: 'deadline',
                  header: getText('common.labels.deadline'),
                  cell: (item) => new Date(item.deadline).toDateString(),
                },
                {
                  id: 'updatedAt',
                  header: getText('teachers.assessments.find.updated_at'),
                  cell: (item) => item.updatedAt,
                },
                {
                  id: 'status',
                  header: getText('common.labels.status'),
                  cell: (item) => getStatusDisplay(item.status),
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
                  cell: (item) => (
                    <SpaceBetween size="xs" direction="horizontal">
                      {/* 编辑按钮 - 只有未发布且状态为CREATED的测试才能编辑 */}
                      {!item.published && item.status === AssessStatus.CREATED && (
                        <Link
                          href={`/edit-assessment/${item.id}`}
                          onFollow={(e) => {
                            e.preventDefault();
                            navigate(e.detail.href!);
                          }}
                        >
                          {getText('common.actions.edit')}
                        </Link>
                      )}
                      
                      {/* 发布/取消发布按钮 */}
                      {item.status === AssessStatus.CREATED && (
                        item.published ? (
                          <Button
                            onClick={() => handleUnpublish(item)}
                          >
                            取消发布
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            onClick={() =>
                              client
                                .graphql<any>({ query: publishAssessment, variables: { assessmentId: item.id } })
                                .then(() => dispatchAlert({ type: AlertType.SUCCESS, content: getText('teachers.assessments.find.published_successfully') }))
                                .then(getAssessments)
                                .catch(() => dispatchAlert({ type: AlertType.ERROR, content: getText('common.status.error') }))
                            }
                          >
                            {getText('common.actions.publish')}
                          </Button>
                        )
                      )}

                      {/* 对于已发布状态(PUBLISHED)的测试，显示取消发布按钮 */}
                      {item.status === AssessStatus.PUBLISHED && (
                        <Button
                          onClick={() => handleUnpublish(item)}
                        >
                          取消发布
                        </Button>
                      )}
                      
                      {/* 删除按钮 - 管理员可以删除任何测试，普通用户只能删除失败的测试 */}
                      {(adminInfo?.isAdmin || item.status === AssessStatus.FAILED) && (
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
                      )}
                    </SpaceBetween>
                  ),
                },
              ]}
              columnDisplay={[
                { id: 'name', visible: true },
                { id: 'course', visible: true },
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

      {/* 删除确认对话框 */}
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
          </SpaceBetween>
        )}
      </Modal>
    </>
  );
};
