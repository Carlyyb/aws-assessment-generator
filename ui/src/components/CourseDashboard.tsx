import { useState, useEffect, useContext } from 'react';
import {
  Box,
  Cards,
  SpaceBetween,
  Header,
  Container,
  ColumnLayout,
  StatusIndicator,
  ProgressBar,
  Badge,
  Button
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { listCourses, listAssessments, getKnowledgeBase } from '../graphql/queries';
import { Course } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { getText } from '../i18n/lang';

const client = generateClient();

interface CourseStats {
  course: Course;
  knowledgeBaseStatus: 'available' | 'missing' | 'loading';
  assessmentCount: number;
  lastActivity?: Date;
}

interface CourseDashboardProps {
  onManageKnowledgeBase: (course: Course) => void;
  onCreateAssessment: (course: Course) => void;
}

export default function CourseDashboard({ 
  onManageKnowledgeBase, 
  onCreateAssessment 
}: CourseDashboardProps) {
  const dispatchAlert = useContext(DispatchAlertContext);
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCourseStats = async () => {
    setLoading(true);
    try {
      // 加载所有课程
      const coursesResponse = await client.graphql<any>({
        query: listCourses
      });
      const courses = coursesResponse.data?.listCourses || [];

      // 加载所有评估
      const assessmentsResponse = await client.graphql<any>({
        query: listAssessments
      });
      const assessments = assessmentsResponse.data?.listAssessments || [];

      // 为每个课程计算统计信息
      const statsPromises = courses.map(async (course: Course) => {
        // 检查知识库状态
        let knowledgeBaseStatus: 'available' | 'missing' | 'loading' = 'loading';
        try {
          const kbResponse = await client.graphql<any>({
            query: getKnowledgeBase,
            variables: { courseId: course.id }
          });
          
          // 检查GraphQL错误
          if ((kbResponse as any).errors) {
            console.error('GraphQL errors for course', course.id, ':', (kbResponse as any).errors);
            knowledgeBaseStatus = 'missing';
          } else {
            const kb = (kbResponse as any).data?.getKnowledgeBase;
            knowledgeBaseStatus = kb?.knowledgeBaseId ? 'available' : 'missing';
          }
        } catch (error) {
          console.error('Error checking knowledge base status for course', course.id, ':', error);
          knowledgeBaseStatus = 'missing';
        }

        // 计算评估数量
        const courseAssessments = assessments.filter((assessment: any) => 
          assessment.courseId === course.id
        );
        
        // 获取最后活动时间
        const lastActivity = courseAssessments.length > 0 
          ? new Date(Math.max(...courseAssessments.map((a: any) => new Date(a.updatedAt).getTime())))
          : undefined;

        return {
          course,
          knowledgeBaseStatus,
          assessmentCount: courseAssessments.length,
          lastActivity
        };
      });

      const stats = await Promise.all(statsPromises);
      setCourseStats(stats);
    } catch (error) {
      console.error('Error loading course stats:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '加载课程统计信息失败'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourseStats();
  }, []);

  const getKnowledgeBaseStatusBadge = (status: 'available' | 'missing' | 'loading') => {
    switch (status) {
      case 'available':
        return <Badge color="green">{getText('teachers.settings.knowledge_base_manager.status.available')}</Badge>;
      case 'missing':
        return <Badge color="red">{getText('teachers.settings.knowledge_base_manager.status.missing')}</Badge>;
      case 'loading':
        return <Badge color="grey">{getText('teachers.settings.knowledge_base_manager.status.checking')}</Badge>;
    }
  };

  const getActivityStatus = (lastActivity?: Date) => {
    if (!lastActivity) {
      return <StatusIndicator type="stopped">{getText('teachers.settings.courses.dashboard.no_activity')}</StatusIndicator>;
    }
    
    const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceActivity === 0) {
      return <StatusIndicator type="success">{getText('teachers.settings.courses.dashboard.today')}</StatusIndicator>;
    } else if (daysSinceActivity <= 7) {
      return <StatusIndicator type="in-progress">{daysSinceActivity} {getText('teachers.settings.courses.dashboard.days_ago')}</StatusIndicator>;
    } else {
      return <StatusIndicator type="pending">{daysSinceActivity} {getText('teachers.settings.courses.dashboard.days_ago')}</StatusIndicator>;
    }
  };

  return (
    <Container header={<Header variant="h2">{getText('teachers.settings.courses.dashboard.course_overview')}</Header>}>
      <SpaceBetween size="l">
        {/* 整体统计 */}
        <ColumnLayout columns={4} variant="text-grid">
          <div>
            <Box variant="awsui-key-label">{getText('teachers.settings.courses.dashboard.total_courses_label')}</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {courseStats.length}
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label">{getText('teachers.settings.courses.dashboard.courses_with_kb_label')}</Box>
            <Box fontSize="display-l" fontWeight="bold" color="text-status-success">
              {courseStats.filter(s => s.knowledgeBaseStatus === 'available').length}
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label">{getText('teachers.settings.courses.dashboard.pending_tasks')}</Box>
            <Box fontSize="display-l" fontWeight="bold">
              {courseStats.reduce((sum, s) => sum + s.assessmentCount, 0)}
            </Box>
          </div>
          <div>
            <Box variant="awsui-key-label">{getText('teachers.settings.courses.dashboard.active_courses')}</Box>
            <Box fontSize="display-l" fontWeight="bold" color="text-status-info">
              {courseStats.filter(s => s.lastActivity && 
                Math.floor((Date.now() - s.lastActivity.getTime()) / (1000 * 60 * 60 * 24)) <= 7
              ).length}
            </Box>
          </div>
        </ColumnLayout>

        {/* 课程卡片 */}
        <Cards
          cardDefinition={{
            header: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                <Header variant="h3">{item.course.name}</Header>
                {getKnowledgeBaseStatusBadge(item.knowledgeBaseStatus)}
              </SpaceBetween>
            ),
            sections: [
              {
                id: 'description',
                header: getText('common.labels.description'),
                content: (item) => item.course.description || getText('common.status.empty')
              },
              {
                id: 'stats',
                header: getText('teachers.settings.courses.dashboard.statistics'),
                content: (item) => (
                  <ColumnLayout columns={2} variant="text-grid">
                    <div>
                      <Box variant="awsui-key-label">{getText('common.nav.assessments')}</Box>
                      <Box>{item.assessmentCount}</Box>
                    </div>
                    <div>
                      <Box variant="awsui-key-label">{getText('teachers.settings.courses.dashboard.last_activity')}</Box>
                      {getActivityStatus(item.lastActivity)}
                    </div>
                  </ColumnLayout>
                )
              },
              {
                id: 'actions',
                content: (item) => (
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button
                      variant="primary"
                      onClick={() => onCreateAssessment(item.course)}
                      disabled={item.knowledgeBaseStatus !== 'available'}
                    >
                      {getText('teachers.settings.courses.dashboard.create_assessment')}
                    </Button>
                    <Button
                      variant="normal"
                      iconName="folder"
                      onClick={() => onManageKnowledgeBase(item.course)}
                    >
                      {getText('teachers.settings.courses.manage_knowledge_base')}
                    </Button>
                  </SpaceBetween>
                )
              }
            ]
          }}
          cardsPerRow={[
            { cards: 1 },
            { minWidth: 500, cards: 2 },
            { minWidth: 800, cards: 3 }
          ]}
          items={courseStats}
          loadingText="加载中..."
          loading={loading}
          empty={
            <Box textAlign="center" color="inherit">
              <b>暂无课程</b>
              <Box variant="p" color="inherit">
                创建您的第一个课程开始使用
              </Box>
            </Box>
          }
          trackBy={(item) => item.course.id}
        />

        {/* 知识库健康度 */}
        <Container header={<Header variant="h3">知识库健康度</Header>}>
          <SpaceBetween size="s">
            <ProgressBar
              value={courseStats.length > 0 ? 
                (courseStats.filter(s => s.knowledgeBaseStatus === 'available').length / courseStats.length) * 100 : 0}
              additionalInfo={`${courseStats.filter(s => s.knowledgeBaseStatus === 'available').length} / ${courseStats.length} 个课程有知识库`}
              description="已配置知识库的课程百分比"
            />
            {courseStats.filter(s => s.knowledgeBaseStatus === 'missing').length > 0 && (
              <Box>
                <Box variant="small" color="text-status-warning">
                  <strong>需要注意：</strong> {courseStats.filter(s => s.knowledgeBaseStatus === 'missing').length} 个课程缺少知识库，无法生成测试
                </Box>
              </Box>
            )}
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </Container>
  );
}
