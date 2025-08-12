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
            <Header variant="h1"> {getText('studentAssessments.title')} </Header>
          </SpaceBetween>
        }
      >
        <Table
          columnDefinitions={[
            {
              id: 'name',
              header: getText('studentAssessments.table.name'),
              cell: (item) => item.assessment!.name,
              sortingField: 'name',
            },
            {
              id: 'course',
              header: getText('studentAssessments.table.course'),
              cell: (item) => item.assessment!.course?.name,
              sortingField: 'course',
            },
            {
              id: 'deadline',
              header: getText('studentAssessments.table.deadline'),
              cell: (item) => new Date(item.assessment!.deadline).toDateString(),
              sortingField: 'course',
            },
            {
              id: 'action',
              header: getText('studentAssessments.table.action'),
              cell: (item) =>
                item.completed ? (
                  <Button onClick={() => navigate('/review/' + item.parentAssessId)}>{getText('studentAssessments.actions.review')}</Button>
                ) : (
                  <Button onClick={() => navigate('/assessment/' + item.parentAssessId)}>{getText('studentAssessments.actions.start')}</Button>
                ),
            },
            {
              id: 'score',
              header: getText('studentAssessments.table.score'),
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
          loadingText={getText('studentAssessments.loading')}
          trackBy="id"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              {getText('studentAssessments.empty')}
            </Box>
          }
          // filter={<TextFilter filteringPlaceholder="Find resources" filteringText="" />}
          pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        />
      </Container>
    </ContentLayout>
  );
};
