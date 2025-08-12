import { useState, useEffect, useContext } from 'react';
import { Table, Header, SpaceBetween, Container, ContentLayout, Box, Pagination, Button, Modal } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { listAssessTemplates } from '../graphql/queries';
import { AssessTemplate } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import CreateTemplate from '../components/CreateTemplate';
import { getText } from '../i18n/lang';

const client = generateClient();

export default () => {
  const dispatchAlert = useContext(DispatchAlertContext);
  const [templates, setTemplates] = useState<AssessTemplate[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    client
      .graphql<any>({ query: listAssessTemplates })
      .then(({ data }) => setTemplates(data.listAssessTemplates || []))
      .catch(() => dispatchAlert({ type: AlertType.ERROR }));
  }, [showCreateModal]);

  return (
    <ContentLayout>
      <Modal header={getText('templates.create_new')} visible={showCreateModal} onDismiss={() => setShowCreateModal(false)}>
        <CreateTemplate onSubmit={() => setShowCreateModal(false)} onCancel={() => setShowCreateModal(false)} />
      </Modal>
      <Container
        header={
          <SpaceBetween size="l">
            <Header variant="h1">{getText('templates.title')}</Header>
          </SpaceBetween>
        }
      >
        <Table
          header={
            <Header>
              <Button iconName="add-plus" onClick={() => setShowCreateModal(true)}>
                {getText('templates.create_new')}
              </Button>
            </Header>
          }
          columnDefinitions={[
            {
              id: 'id',
              header: getText('templates.id'),
              cell: (item) => item.id,
            },
            {
              id: 'name',
              header: getText('common.name'),
              cell: (item) => item.name,
            },
            {
              id: 'docLang',
              header: getText('templates.lang'),
              cell: (item) => item.docLang,
            },
            {
              id: 'assessType',
              header: getText('templates.type'),
              cell: (item) => item.assessType,
            },
            {
              id: 'taxonomy',
              header: getText('templates.taxonomy'),
              cell: (item) => item.taxonomy,
            },
            {
              id: 'easyQuestions',
              header: getText('templates.easy'),
              cell: (item) => item.easyQuestions,
            },
            {
              id: 'mediumQuestions',
              header: getText('templates.medium'),
              cell: (item) => item.mediumQuestions,
            },
            {
              id: 'hardQuestions',
              header: getText('templates.hard'),
              cell: (item) => item.hardQuestions,
            },
            {
              id: 'totalQuestions',
              header: getText('templates.total'),
              cell: (item) => item.totalQuestions,
            },
            {
              id: 'createdAt',
              header: getText('templates.created_at'),
              cell: (item) => item.createdAt,
            },
          ]}
          columnDisplay={[
            { id: 'name', visible: true },
            { id: 'docLang', visible: true },
            { id: 'assessType', visible: true },
            { id: 'taxonomy', visible: true },
            { id: 'totalQuestions', visible: true },
            { id: 'easyQuestions', visible: true },
            { id: 'mediumQuestions', visible: true },
            { id: 'hardQuestions', visible: true },
            { id: 'createdAt', visible: true },
          ]}
          items={templates}
          loadingText={getText('common.loading')}
          pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
          trackBy="id"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              {getText('common.empty')}
            </Box>
          }
        />
      </Container>
    </ContentLayout>
  );
};
