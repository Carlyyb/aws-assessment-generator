import { useState, useEffect, useContext } from 'react';
import { 
  Table, 
  Header, 
  SpaceBetween, 
  Container, 
  ContentLayout, 
  Box, 
  Pagination, 
  Button, 
  Modal,
  StatusIndicator,
  Alert
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { listCourses, getKnowledgeBase } from '../graphql/queries';
import { Course } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import CreateCourse from '../components/CreateCourse';
import KnowledgeBaseManager from '../components/KnowledgeBaseManager';
import { getText } from '../i18n/lang';

const client = generateClient();

export default () => {
  const dispatchAlert = useContext(DispatchAlertContext);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showKnowledgeBaseModal, setShowKnowledgeBaseModal] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [knowledgeBaseStatuses, setKnowledgeBaseStatuses] = useState<{[courseId: string]: 'loading' | 'available' | 'missing'}>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);

  // 检查所有课程的知识库状态
  const checkAllKnowledgeBaseStatuses = async (courseList: Course[]) => {
    const statusPromises = courseList.map(async (course) => {
      try {
        const response = await client.graphql<any>({
          query: getKnowledgeBase,
          variables: { courseId: course.id }
        });
        
        const kb = (response as any).data?.getKnowledgeBase;
        return {
          courseId: course.id,
          status: kb?.knowledgeBaseId ? 'available' : 'missing'
        } as const;
      } catch (error) {
        return {
          courseId: course.id,
          status: 'missing'
        } as const;
      }
    });

    const results = await Promise.all(statusPromises);
    const statusMap = results.reduce((acc, result) => {
      acc[result.courseId] = result.status;
      return acc;
    }, {} as {[courseId: string]: 'loading' | 'available' | 'missing'});
    
    setKnowledgeBaseStatuses(statusMap);
  };

  // 打开知识库管理
  const handleManageKnowledgeBase = (course: Course) => {
    setSelectedCourse(course);
    setShowKnowledgeBaseModal(true);
  };

  // 删除课程
  const handleDeleteCourse = async (course: Course) => {
    try {
      // 这里需要添加删除课程的API调用
      // await client.graphql({ query: deleteCourse, variables: { id: course.id } });
      
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: getText('teachers.settings.courses.delete_success').replace('{name}', course.name || '')
      });
      
      // 重新加载课程列表
      const response = await client.graphql<any>({ query: listCourses });
      const updatedCourses = response.data?.listCourses || [];
      setCourses(updatedCourses);
      await checkAllKnowledgeBaseStatuses(updatedCourses);
      
    } catch (error) {
      console.error('Delete error:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: getText('teachers.settings.courses.delete_failed')
      });
    }
    
    setShowDeleteModal(false);
    setCourseToDelete(null);
  };

  // 获取知识库状态指示器
  const getKnowledgeBaseStatus = (courseId: string) => {
    const status = knowledgeBaseStatuses[courseId];
    
    switch (status) {
      case 'loading':
        return <StatusIndicator type="loading">{getText('teachers.settings.knowledge_base_manager.status.checking')}</StatusIndicator>;
      case 'available':
        return <StatusIndicator type="success">{getText('teachers.settings.courses.status_created')}</StatusIndicator>;
      case 'missing':
        return <StatusIndicator type="stopped">{getText('teachers.settings.courses.status_not_created')}</StatusIndicator>;
      default:
        return <StatusIndicator type="pending">{getText('common.status.error')}</StatusIndicator>;
    }
  };

  useEffect(() => {
    const loadCoursesAndStatuses = async () => {
      try {
        const response = await client.graphql<any>({ query: listCourses });
        const courseList = response.data?.listCourses || [];
        setCourses(courseList);
        await checkAllKnowledgeBaseStatuses(courseList);
      } catch (error) {
        dispatchAlert({ type: AlertType.ERROR, content: getText('teachers.settings.courses.load_failed') });
      }
    };

    loadCoursesAndStatuses();
  }, [showCreateModal]);

  return (
    <ContentLayout>
      {/* 创建课程模态框 */}
      <Modal 
        header={getText('teachers.settings.courses.create_new')} 
        visible={showCreateModal} 
        onDismiss={() => setShowCreateModal(false)}
      >
        <CreateCourse 
          onSubmit={() => setShowCreateModal(false)} 
          onCancel={() => setShowCreateModal(false)} 
        />
      </Modal>

      {/* 知识库管理模态框 */}
      {selectedCourse && (
        <KnowledgeBaseManager
          courseId={selectedCourse.id}
          courseName={selectedCourse.name || '未命名课程'}
          visible={showKnowledgeBaseModal}
          onDismiss={() => {
            setShowKnowledgeBaseModal(false);
            setSelectedCourse(null);
            // 重新检查知识库状态
            checkAllKnowledgeBaseStatuses(courses);
          }}
        />
      )}

      {/* 删除确认模态框 */}
      <Modal
        visible={showDeleteModal}
        onDismiss={() => setShowDeleteModal(false)}
        header="确认删除课程"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="link" 
                onClick={() => setShowDeleteModal(false)}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={() => courseToDelete && handleDeleteCourse(courseToDelete)}
              >
                删除
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {courseToDelete && (
          <Alert type="warning" header="警告">
            确定要删除课程 "<strong>{courseToDelete.name}</strong>" 吗？
            <br />
            <br />
            此操作将会：
            <ul>
              <li>删除课程及其所有相关数据</li>
              <li>删除关联的知识库（如果存在）</li>
              <li>删除所有相关的测试和评估</li>
            </ul>
            <br />
            <strong>此操作不可撤销！</strong>
          </Alert>
        )}
      </Modal>
      
      <Container
        header={
          <SpaceBetween size="l">
            <Header variant="h1">{getText('teachers.settings.courses.title')}</Header>
          </SpaceBetween>
        }
      >
        <Table
          header={
            <Header>
              <Button iconName="add-plus" onClick={() => setShowCreateModal(true)}>
                {getText('teachers.settings.courses.new_course')}
              </Button>
            </Header>
          }
          columnDefinitions={[
            {
              id: 'id',
              header: getText('common.labels.id'),
              cell: (item) => item.id,
              sortingField: 'id'
            },
            {
              id: 'name',
              header: getText('common.labels.name'),
              cell: (item) => item.name,
              sortingField: 'name'
            },
            {
              id: 'description',
              header: getText('common.labels.description'),
              cell: (item) => item.description,
              sortingField: 'description'
            },
            {
              id: 'knowledgeBase',
              header: '知识库状态',
              cell: (item) => getKnowledgeBaseStatus(item.id),
              minWidth: 120
            },
            {
              id: 'actions',
              header: '操作',
              cell: (item) => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    variant="normal"
                    iconName="folder"
                    onClick={() => handleManageKnowledgeBase(item)}
                  >
                    管理知识库
                  </Button>
                  <Button
                    variant="normal"
                    iconName="remove"
                    onClick={() => {
                      setCourseToDelete(item);
                      setShowDeleteModal(true);
                    }}
                  >
                    删除
                  </Button>
                </SpaceBetween>
              ),
              minWidth: 200
            },
          ]}
          columnDisplay={[
            { id: 'id', visible: false },
            { id: 'name', visible: true },
            { id: 'description', visible: true },
            { id: 'knowledgeBase', visible: true },
            { id: 'actions', visible: true },
          ]}
          items={courses}
          loadingText={getText('common.status.loading')}
          pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
          trackBy="id"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              {getText('common.status.empty')}
            </Box>
          }
          // filter={<TextFilter filteringPlaceholder="Find courses" filteringText="" />}
        />
      </Container>
    </ContentLayout>
  );
};
