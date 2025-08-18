import { useState, useEffect } from 'react';
import { Table, Header, SpaceBetween, Container, ContentLayout, Button, Box, Pagination } from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { listStudentAssessments } from '../graphql/queries';
import { StudentAssessment } from '../graphql/API';
import { getText } from '../i18n/lang';

const client = generateClient();

export default () => {
  const navigate = useNavigate();

  const [assessments, setAssessments] = useState<StudentAssessment[]>([]);

  useEffect(() => {
    client
      .graphql<any>({ query: listStudentAssessments })
      .then(({ data }) => {
        const list = data.listStudentAssessments || [];
        setAssessments(list);
      })
      .catch(() => {});
  }, []);

  return (
    <ContentLayout>
      <Container
        header={
          <SpaceBetween size="l">
            <Header variant="h1"> {getText('students.assessments.list.title')} </Header>
          </SpaceBetween>
        }
      >
        <Table
          columnDefinitions={[
            {
              id: 'name',
              header: getText('students.assessments.list.table.name'),
              cell: (item) => item.assessment?.name || '-',
              sortingField: 'name',
            },
            {
              id: 'course',
              header: getText('students.assessments.list.table.course'),
              cell: (item) => item.assessment?.course?.name || '-',
              sortingField: 'course',
            },
            {
              id: 'deadline',
              header: getText('students.assessments.list.table.deadline'),
              cell: (item) => item.assessment?.deadline ? new Date(item.assessment.deadline).toDateString() : '-',
              sortingField: 'course',
            },
            {
              id: 'action',
              header: getText('students.assessments.list.table.action'),
              cell: (item) =>
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
              cell: (item) => (item.completed ? item.score + '%' : ''),
            },
          ]}
          columnDisplay={[
            { id: 'name', visible: true },
            { id: 'course', visible: true },
            { id: 'deadline', visible: true },
            { id: 'score', visible: true },
            { id: 'action', visible: true },
          ]}
          items={assessments}
          loadingText={getText('students.assessments.list.loading')}
          trackBy="id"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              {getText('students.assessments.list.empty')}
            </Box>
          }
          // filter={<TextFilter filteringPlaceholder="Find resources" filteringText="" />}
          pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        />
      </Container>
    </ContentLayout>
  );
};
