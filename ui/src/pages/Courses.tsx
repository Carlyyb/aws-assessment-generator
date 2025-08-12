import { useState, useEffect, useContext } from 'react';
import { Table, Header, SpaceBetween, Container, ContentLayout, Box, Pagination, Button, Modal } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { listCourses } from '../graphql/queries';
import { Course } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import CreateCourse from '../components/CreateCourse';
import { getText } from '../i18n/lang';

const client = generateClient();

export default () => {
  const dispatchAlert = useContext(DispatchAlertContext);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    client
      .graphql<any>({ query: listCourses })
      .then(({ data }) => setCourses(data.listCourses || []))
      .catch(() => dispatchAlert({ type: AlertType.ERROR }));
  }, [showCreateModal]);

  return (
    <ContentLayout>
      <Modal header={getText('pages.courses.create_new')} visible={showCreateModal} onDismiss={() => setShowCreateModal(false)}>
        <CreateCourse onSubmit={() => setShowCreateModal(false)} onCancel={() => setShowCreateModal(false)} />
      </Modal>
      <Container
        header={
          <SpaceBetween size="l">
            <Header variant="h1">{getText('pages.courses.title')}</Header>
          </SpaceBetween>
        }
      >
        <Table
          header={
            <Header>
              <Button iconName="add-plus" onClick={() => setShowCreateModal(true)}>
                {getText('pages.courses.new_course')}
              </Button>
            </Header>
          }
          columnDefinitions={[
            {
              id: 'id',
              header: getText('common.id'),
              cell: (item) => item.id,
            },
            {
              id: 'name',
              header: getText('common.name'),
              cell: (item) => item.name,
            },
            {
              id: 'description',
              header: getText('common.description'),
              cell: (item) => item.description,
            },
          ]}
          columnDisplay={[
            { id: 'id', visible: true },
            { id: 'name', visible: true },
            { id: 'description', visible: true },
          ]}
          items={courses}
          loadingText={getText('common.loading')}
          pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
          trackBy="id"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              {getText('common.empty')}
            </Box>
          }
          // filter={<TextFilter filteringPlaceholder="Find courses" filteringText="" />}
        />
      </Container>
    </ContentLayout>
  );
};
