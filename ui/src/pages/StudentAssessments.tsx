import { useState, useEffect, useCallback } from 'react';
import { Table, Header, SpaceBetween, Container, ContentLayout, Button, Box, Pagination, Tabs } from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { listStudentAssessments, listPublishedAssessments, getCurrentUser } from '../graphql/queries';
import { StudentAssessment, Assessment } from '../graphql/API';
import { getText } from '../i18n/lang';
import { formatBeijingTime } from '../utils/timeUtils';
import { addAssessmentDefaults, ExtendedAssessment } from '../types/ExtendedTypes';

const client = generateClient();

export default function StudentAssessments() {
  const navigate = useNavigate();

  const [completedAssessments, setCompletedAssessments] = useState<StudentAssessment[]>([]);
  const [availableAssessments, setAvailableAssessments] = useState<Assessment[]>([]);
  const [activeTabId, setActiveTabId] = useState('available');

  // 判断按钮状态和文本
  const getAssessmentButtonConfig = (assessment: ExtendedAssessment, studentAssessment?: StudentAssessment) => {
    if (!studentAssessment) {
      // 从未参加过
      return {
        text: getText('students.assessments.list.actions.start'),
        disabled: false,
        action: () => navigate('/assessments/' + assessment.id)
      };
    }

    const attemptLimit = assessment.attemptLimit || 1;
    const allowAnswerChange = assessment.allowAnswerChange ?? true;
    const attemptCount = (studentAssessment as any).attemptCount || 0;
    const remainingAttempts = (studentAssessment as any).remainingAttempts ?? 0;

    if (attemptLimit === 1) {
      if (allowAnswerChange && studentAssessment.completed) {
        // 允许修改答案
        return {
          text: '修改答案',
          disabled: false,
          action: () => navigate('/assessments/' + assessment.id)
        };
      } else if (studentAssessment.completed) {
        // 已完成，不允许修改
        return {
          text: '查看结果',
          disabled: false,
          action: () => navigate('/review/' + assessment.id)
        };
      } else {
        // 未完成
        return {
          text: '继续测试',
          disabled: false,
          action: () => navigate('/assessments/' + assessment.id)
        };
      }
    } else {
      // 多次尝试模式
      if (remainingAttempts > 0 || attemptLimit === -1) {
        return {
          text: attemptCount === 0 ? '开始测试' : `重新测试 (剩余${remainingAttempts === -1 ? '无限' : remainingAttempts}次)`,
          disabled: false,
          action: () => navigate('/assessments/' + assessment.id)
        };
      } else {
        // 次数已用尽
        return {
          text: '查看结果',
          disabled: false,
          action: () => navigate('/review/' + assessment.id)
        };
      }
    }
  };

  const loadData = useCallback(async () => {
    try {
      // 加载当前用户信息
      const userResponse = await client.graphql({ query: getCurrentUser });
      const user = (userResponse as any).data.getCurrentUser;
      
      // 加载已完成的测试
      const completedResponse = await client.graphql({ query: listStudentAssessments });
      const completed = (completedResponse as any).data.listStudentAssessments || [];
      // 过滤掉无效的测试记录（主测试已被删除的记录）
      const validCompleted = completed.filter((item: StudentAssessment) => item.assessment != null);
      setCompletedAssessments(validCompleted);

      // 加载可参加的测试
      const availableResponse = await client.graphql({ query: listPublishedAssessments });
      const available = (availableResponse as any).data.listPublishedAssessments || [];
      
      // 不再过滤已经参加过的测试，而是根据测试设置来决定是否允许重新参加
      let filteredAvailable = [...available];
      
      // 根据学生分组过滤测试
      if (user && user.studentGroups && user.studentGroups.length > 0) {
        const userGroups = user.studentGroups;
        filteredAvailable = filteredAvailable.filter((assessment: Assessment) => {
          const extendedAssessment = addAssessmentDefaults(assessment);
          if (!extendedAssessment.studentGroups || extendedAssessment.studentGroups.length === 0) {
            return true; // 如果测试没有设置分组，则默认所有人都可见
          }
          if (extendedAssessment.studentGroups.includes('ALL')) {
            return true; // 发布给"所有学生"
          }
          // 检查测试分组和用户分组是否有交集
          return extendedAssessment.studentGroups.some(group => userGroups.includes(group));
        });
      }
      
      setAvailableAssessments(filteredAvailable);
    } catch (error) {
      console.error('Error loading assessments:', error);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <ContentLayout>
      <Container
        header={
          <SpaceBetween size="l">
            <Header variant="h1">{getText('students.assessments.list.title')}</Header>
          </SpaceBetween>
        }
      >
        <Tabs
          activeTabId={activeTabId}
          onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
          tabs={[
            {
              label: '可参加的测试',
              id: 'available',
              content: (
                <Table
                  columnDefinitions={[
                    {
                      id: 'name',
                      header: '测试名称',
                      cell: (item: Assessment) => item.name || '-',
                      sortingField: 'name',
                    },
                    {
                      id: 'course',
                      header: '课程',
                      cell: (item: Assessment) => item.course?.name || '-',
                      sortingField: 'course',
                    },
                    {
                      id: 'deadline',
                      header: '截止时间',
                      cell: (item: Assessment) => item.deadline ? formatBeijingTime(item.deadline, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Shanghai'
                      }) : '-',
                      sortingField: 'deadline',
                    },
                    {
                      id: 'action',
                      header: '操作',
                      cell: (item: Assessment) => {
                        const extendedAssessment = addAssessmentDefaults(item);
                        // 查找对应的学生测试记录
                        const studentAssessment = completedAssessments.find(sa => sa.parentAssessId === item.id);
                        const buttonConfig = getAssessmentButtonConfig(extendedAssessment, studentAssessment);
                        
                        return (
                          <Button 
                            onClick={buttonConfig.action}
                            disabled={buttonConfig.disabled}
                          >
                            {buttonConfig.text}
                          </Button>
                        );
                      },
                    },
                  ]}
                  columnDisplay={[
                    { id: 'name', visible: true },
                    { id: 'course', visible: true },
                    { id: 'deadline', visible: true },
                    { id: 'action', visible: true },
                  ]}
                  items={availableAssessments}
                  loadingText="加载中..."
                  trackBy="id"
                  empty={
                    <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
                      暂无可参加的测试
                    </Box>
                  }
                  pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
                />
              ),
            },
            {
              label: '已参加的测试',
              id: 'completed',
              content: (
                <Table
                  columnDefinitions={[
                    {
                      id: 'name',
                      header: getText('students.assessments.list.table.name'),
                      cell: (item: StudentAssessment) => item.assessment?.name || '-',
                      sortingField: 'name',
                    },
                    {
                      id: 'course',
                      header: getText('students.assessments.list.table.course'),
                      cell: (item: StudentAssessment) => item.assessment?.course?.name || '-',
                      sortingField: 'course',
                    },
                    {
                      id: 'deadline',
                      header: getText('students.assessments.list.table.deadline'),
                      cell: (item: StudentAssessment) => item.assessment?.deadline ? formatBeijingTime(item.assessment.deadline, {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Shanghai'
                      }) : '-',
                      sortingField: 'course',
                    },
                    {
                      id: 'action',
                      header: getText('students.assessments.list.table.action'),
                      cell: (item: StudentAssessment) =>
                        item.assessment ? (
                          item.completed ? (
                            <Button onClick={() => navigate('/review/' + item.parentAssessId)}>{getText('students.assessments.list.actions.review')}</Button>
                          ) : (
                            <Button onClick={() => navigate('/assessments/' + item.parentAssessId)}>{getText('students.assessments.list.actions.start')}</Button>
                          )
                        ) : (
                          <Box color="text-status-inactive">无效的测试</Box>
                        ),
                    },
                    {
                      id: 'score',
                      header: getText('students.assessments.list.table.score'),
                      cell: (item: StudentAssessment) => (item.completed ? item.score + '分' : ''),
                    },
                  ]}
                  columnDisplay={[
                    { id: 'name', visible: true },
                    { id: 'course', visible: true },
                    { id: 'deadline', visible: true },
                    { id: 'score', visible: true },
                    { id: 'action', visible: true },
                  ]}
                  items={completedAssessments}
                  loadingText={getText('students.assessments.list.loading')}
                  trackBy="id"
                  empty={
                    <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
                      {getText('students.assessments.list.empty')}
                    </Box>
                  }
                  pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
                />
              ),
            },
          ]}
        />
      </Container>
    </ContentLayout>
  );
}
