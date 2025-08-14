import { useState, useEffect, useContext } from 'react';
import { Table, Header, SpaceBetween, Container, ContentLayout, Link, Box, Button, Pagination } from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { listAssessments, publishAssessment } from '../graphql/queries';
import { Assessment, AssessStatus } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { getText } from '../i18n/lang';

const client = generateClient();

export default () => {
  const navigate = useNavigate();

  const dispatchAlert = useContext(DispatchAlertContext);
  const [assessments, setAssessments] = useState<Assessment[]>([]);

  const getAssessments = () => {
    client
      .graphql<any>({ query: listAssessments })
      .then(({ data }) => setAssessments(data.listAssessments || []))
      .catch(() => dispatchAlert({ type: AlertType.ERROR }));
  };

  useEffect(getAssessments, []);

  return (
    <ContentLayout>
      <Container
        header={
          <SpaceBetween size="l">
            <Header variant="h1">{getText('teachers.assessments.find.title')}</Header>
          </SpaceBetween>
        }
      >
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
              cell: (item) => item.status,
            },
            {
              id: 'edit',
              header: '',
              cell: (item) =>
                item.published || item.status !== AssessStatus.CREATED ? null : (
                  <Link
                    href={`/edit-assessment/${item.id}`}
                    onFollow={(e) => {
                      e.preventDefault();
                      navigate(e.detail.href!);
                    }}
                  >
                    {getText('common.actions.edit')}
                  </Link>
                ),
            },
            {
              id: 'publish',
              header: '',
              cell: (item) =>
                item.status === AssessStatus.CREATED ? (
                  <Button
                    wrapText={false}
                    disabled={!!item.published}
                    onClick={() =>
                      client
                        .graphql<any>({ query: publishAssessment, variables: { assessmentId: item.id } })
                        .then(() => dispatchAlert({ type: AlertType.SUCCESS, content: getText('teachers.assessments.find.published_successfully') }))
                        .then(getAssessments)
                        .catch(() => dispatchAlert({ type: AlertType.ERROR, content: getText('common.status.error') }))
                    }
                  >
                    {item.published ? getText('common.status.published') : getText('common.actions.publish')}
                  </Button>
                ) : null,
            },
          ]}
          columnDisplay={[
            { id: 'name', visible: true },
            { id: 'course', visible: true },
            { id: 'lectureDate', visible: true },
            { id: 'deadline', visible: true },
            { id: 'updatedAt', visible: true },
            { id: 'status', visible: true },
            { id: 'edit', visible: true },
            { id: 'publish', visible: true },
          ]}
          items={assessments}
          loadingText={getText('common.status.loading')}
          trackBy="id"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              {getText('common.status.empty')}
            </Box>
          }
          // filter={<TextFilter filteringPlaceholder="Find resources" filteringText="" />}
          pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
        />
      </Container>
    </ContentLayout>
  );
};
