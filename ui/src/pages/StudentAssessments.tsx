import { useState, useEffect } from 'react';
import { Table, Header, SpaceBetween, Container, ContentLayout, Button, Box, Pagination, Tabs } from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { listStudentAssessments, listPublishedAssessments } from '../graphql/queries';
import { upsertStudentAssessment } from '../graphql/mutations';
import { StudentAssessment, Assessment } from '../graphql/API';
import { getText } from '../i18n/lang';
import { formatBeijingTime } from '../utils/timeUtils';

const client = generateClient();

export default function StudentAssessments() {
  const navigate = useNavigate();

  const [completedAssessments, setCompletedAssessments] = useState<StudentAssessment[]>([]);
  const [availableAssessments, setAvailableAssessments] = useState<Assessment[]>([]);
  const [activeTabId, setActiveTabId] = useState('available');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // 加载已完成的评估
      const completedResponse = await client.graphql({ query: listStudentAssessments });
      const completed = (completedResponse as any).data.listStudentAssessments || [];
      // 过滤掉无效的评估记录（主评估已被删除的记录）
      const validCompleted = completed.filter((item: StudentAssessment) => item.assessment != null);
      setCompletedAssessments(validCompleted);

      // 加载可参加的评估
      const availableResponse = await client.graphql({ query: listPublishedAssessments });
      const available = (availableResponse as any).data.listPublishedAssessments || [];
      
      // 过滤掉已经参加过的评估
      const alreadyTaken = new Set(completed.map((item: StudentAssessment) => item.parentAssessId));
      const filteredAvailable = available.filter((assessment: Assessment) => !alreadyTaken.has(assessment.id));
      setAvailableAssessments(filteredAvailable);
    } catch (error) {
      console.error('Error loading assessments:', error);
    }
  };

  const handleStartAssessment = async (assessment: Assessment) => {
    try {
      // 创建学生评估记录
      const studentAssessment = {
        parentAssessId: assessment.id,
        completed: false,
        score: 0,
        answers: "{}"
      };

      await client.graphql({
        query: upsertStudentAssessment,
        variables: { input: studentAssessment }
      });

      // 导航到评估页面
      navigate('/assessment/' + assessment.id);
    } catch (error) {
      console.error('Error starting assessment:', error);
    }
  };

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
              label: '可参加的评估',
              id: 'available',
              content: (
                <Table
                  columnDefinitions={[
                    {
                      id: 'name',
                      header: '评估名称',
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
                      cell: (item: Assessment) => (
                        <Button onClick={() => handleStartAssessment(item)}>
                          开始评估
                        </Button>
                      ),
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
                      暂无可参加的评估
                    </Box>
                  }
                  pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
                />
              ),
            },
            {
              label: '已参加的评估',
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
                            <Button onClick={() => navigate('/assessment/' + item.parentAssessId)}>{getText('students.assessments.list.actions.start')}</Button>
                          )
                        ) : (
                          <Box color="text-status-inactive">无效的评估</Box>
                        ),
                    },
                    {
                      id: 'score',
                      header: getText('students.assessments.list.table.score'),
                      cell: (item: StudentAssessment) => (item.completed ? item.score + '%' : ''),
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
