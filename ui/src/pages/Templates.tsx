import { useState, useEffect, useContext } from 'react';
import { Table, Header, SpaceBetween, Container, ContentLayout, Box, Pagination, Button, Modal } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { listAssessTemplates } from '../graphql/queries';
import { AssessTemplate } from '../graphql/API';
import { getAssessTypeText, getTaxonomyText } from '../utils/enumTranslations';
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
      .then(({ data, errors }) => {
        if (errors && errors.length > 0) {
          console.warn('GraphQL errors:', errors);
          // 即使有错误，也尝试使用可用的数据
          const validTemplates = (data?.listAssessTemplates || []).filter((template: AssessTemplate) => {
            // 过滤掉无效的模板记录
            return template && template.id;
          });
          setTemplates(validTemplates);
          dispatchAlert({ 
            type: 'warning', 
            content: getText('teachers.settings.templates.data_warning') || '部分模板数据存在问题，已过滤显示' 
          });
        } else {
          setTemplates(data.listAssessTemplates || []);
        }
      })
      .catch((error) => {
        console.error('Error fetching templates:', error);
        dispatchAlert({ type: AlertType.ERROR });
      });
  }, [showCreateModal]);

  return (
    <ContentLayout>
  <Modal header={getText('teachers.settings.templates.create_new')} visible={showCreateModal} onDismiss={() => setShowCreateModal(false)}>
        <CreateTemplate onSubmit={() => setShowCreateModal(false)} onCancel={() => setShowCreateModal(false)} />
      </Modal>
      <Container
        header={
          <SpaceBetween size="l">
            <Header variant="h1">{getText('teachers.settings.templates.title')}</Header>
          </SpaceBetween>
        }
      >
        <Table
          header={
            <Header>
              <Button iconName="add-plus" onClick={() => setShowCreateModal(true)}>
                {getText('teachers.settings.templates.create_new')}
              </Button>
            </Header>
          }
          columnDefinitions={[
            {
              id: 'id',
              header: getText('teachers.settings.templates.id'),
              cell: (item) => item.id,
            },
            {
              id: 'name',
              header: getText('common.labels.name'),
              cell: (item) => item.name,
            },
            {
              id: 'docLang',
              header: getText('teachers.settings.templates.lang'),
              cell: (item) => item.docLang || '-',
            },
            {
              id: 'assessType',
              header: getText('teachers.settings.templates.type'),
              cell: (item) => item.assessType ? getAssessTypeText(item.assessType) : '-',
            },
            {
              id: 'taxonomy',
              header: getText('teachers.settings.templates.taxonomy'),
              cell: (item) => item.taxonomy ? getTaxonomyText(item.taxonomy) : '-',
            },
            {
              id: 'easyQuestions',
              header: getText('teachers.settings.templates.difficulty.easy'),
              cell: (item) => item.easyQuestions,
            },
            {
              id: 'mediumQuestions',
              header: getText('teachers.settings.templates.difficulty.medium'),
              cell: (item) => item.mediumQuestions,
            },
            {
              id: 'hardQuestions',
              header: getText('teachers.settings.templates.difficulty.hard'),
              cell: (item) => item.hardQuestions,
            },
            {
              id: 'totalQuestions',
              header: getText('teachers.settings.templates.difficulty.total'),
              cell: (item) => item.totalQuestions,
            },
            {
              id: 'createdAt',
              header: getText('teachers.settings.templates.created_at'),
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
          loadingText={getText('common.status.loading')}
          pagination={<Pagination currentPageIndex={1} pagesCount={1} />}
          trackBy="id"
          empty={
            <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
              {getText('common.status.empty')}
            </Box>
          }
        />
      </Container>
    </ContentLayout>
  );
};
