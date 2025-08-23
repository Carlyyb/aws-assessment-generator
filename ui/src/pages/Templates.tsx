import { useState, useEffect, useContext } from 'react';
import { Table, Header, SpaceBetween, Container, ContentLayout, Box, Pagination, Button, Modal } from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { listAssessTemplates } from '../graphql/queries';
import { deleteAssessTemplate } from '../graphql/mutations';
import { AssessTemplate } from '../graphql/API';
import { getAssessTypeText, getTaxonomyText } from '../utils/enumTranslations';
import { DispatchAlertContext } from '../contexts/alerts';
import { UserProfileContext } from '../contexts/userProfile';
import CreateTemplate from '../components/CreateTemplate';
import { getText } from '../i18n/lang';

const client = generateClient();

export default () => {
  const dispatchAlert = useContext(DispatchAlertContext);
  const userProfile = useContext(UserProfileContext);
  const [templates, setTemplates] = useState<AssessTemplate[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItems, setSelectedItems] = useState<AssessTemplate[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'multiple'>('single');
  const [templateToDelete, setTemplateToDelete] = useState<AssessTemplate | null>(null);
  
  // 加载测试模板列表
  const loadTemplates = () => {
    client
      .graphql<any>({ query: listAssessTemplates })
      .then(({ data, errors }) => {
        if (errors && errors.length > 0) {
          console.warn('GraphQL errors:', errors);
          const validTemplates = (data?.listAssessTemplates || []).filter((template: AssessTemplate) => {
            const validDocLang = template.docLang === 'zh' || template.docLang === 'en';
            return template && template.id && validDocLang;
          });

          if (validTemplates.length === 0) {
            dispatchAlert({ 
              type: 'warning', 
              content: getText('teachers.settings.templates.data_warning')
            });
          }

          setTemplates(validTemplates);
        } else {
          setTemplates(data?.listAssessTemplates || []);
        }
      });
  };

  // 删除单个测试模板
  const handleDeleteSingle = async (template: AssessTemplate) => {
    setTemplateToDelete(template);
    setDeleteTarget('single');
    setShowDeleteModal(true);
  };

  // 删除多个测试模板
  const handleDeleteMultiple = () => {
    if (selectedItems.length === 0) {
      dispatchAlert({
        type: 'warning',
        content: getText('teachers.settings.templates.no_templates_selected')
      });
      return;
    }
    setDeleteTarget('multiple');
    setShowDeleteModal(true);
  };

  // 确认删除
  const confirmDelete = async () => {
    if (!userProfile?.userId) {
      dispatchAlert({
        type: 'error',
        content: getText('common.error.user_not_authenticated')
      });
      return;
    }

    setIsDeleting(true);
    
    try {
      if (deleteTarget === 'single' && templateToDelete) {
        // 删除单个测试模板 - 使用当前用户的userId
        await client.graphql({
          query: deleteAssessTemplate,
          variables: { 
            id: templateToDelete.id,
            userId: userProfile.userId
          }
        });
        
        dispatchAlert({
          type: 'success',
          content: getText('teachers.settings.templates.delete_success')
        });
        
      } else if (deleteTarget === 'multiple') {
        // 批量删除测试模板 - 逐个删除，使用当前用户的userId
        const deletePromises = selectedItems.map(item => 
          client.graphql({
            query: deleteAssessTemplate,
            variables: { 
              id: item.id,
              userId: userProfile.userId
            }
          })
        );
        
        const results = await Promise.allSettled(deletePromises);
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        const failedCount = results.filter(r => r.status === 'rejected').length;
        
        if (failedCount === 0) {
          dispatchAlert({
            type: 'success',
            content: getText('teachers.settings.templates.delete_success')
          });
        } else {
          dispatchAlert({
            type: 'warning',
            content: getText('teachers.settings.templates.delete_partial_success')
              .replace('{deletedCount}', successCount.toString())
              .replace('{failedCount}', failedCount.toString())
          });
        }
        
        setSelectedItems([]);
      }
      
      // 重新加载列表
      loadTemplates();
      
    } catch (error) {
      console.error('Delete error:', error);
      dispatchAlert({
        type: 'error',
        content: getText('teachers.settings.templates.delete_error')
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setTemplateToDelete(null);
    }
  };

useEffect(() => {
  loadTemplates();
}, [showCreateModal]);


  return (
    <ContentLayout>
      <Modal header={getText('teachers.settings.templates.create_new')} visible={showCreateModal} onDismiss={() => setShowCreateModal(false)}>
        <CreateTemplate onSubmit={() => setShowCreateModal(false)} onCancel={() => setShowCreateModal(false)} />
      </Modal>
      
      <Modal
        header={getText('teachers.settings.templates.delete_confirm')}
        visible={showDeleteModal}
        onDismiss={() => setShowDeleteModal(false)}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowDeleteModal(false)}>
                {getText('common.actions.cancel')}
              </Button>
              <Button variant="primary" loading={isDeleting} onClick={confirmDelete}>
                {getText('common.actions.delete')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        {deleteTarget === 'single' && templateToDelete ? (
          <p>{getText('teachers.settings.templates.delete_confirm_single')}</p>
        ) : (
          <p>{getText('teachers.settings.templates.delete_confirm_multiple').replace('{count}', selectedItems.length.toString())}</p>
        )}
      </Modal>
      <Container
        header={
          <SpaceBetween size="l">
            <Header variant="h1">{getText('teachers.settings.templates.title')}</Header>
          </SpaceBetween>
        }
      >
        <Table
          selectionType="multi"
          selectedItems={selectedItems}
          onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
          header={
            <Header
              counter={selectedItems.length > 0 ? `(${selectedItems.length})` : undefined}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button 
                    iconName="remove" 
                    disabled={selectedItems.length === 0}
                    onClick={handleDeleteMultiple}
                  >
                    {getText('teachers.settings.templates.delete_selected')}
                  </Button>
                  <Button iconName="add-plus" onClick={() => setShowCreateModal(true)}>
                    {getText('teachers.settings.templates.create_new')}
                  </Button>
                </SpaceBetween>
              }
            >
              {getText('teachers.settings.templates.title')}
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
            {
              id: 'actions',
              header: getText('teachers.settings.templates.actions'),
              cell: (item) => (
                <Button
                  iconName="remove"
                  variant="icon"
                  onClick={() => handleDeleteSingle(item)}
                  ariaLabel={getText('teachers.settings.templates.delete_template')}
                />
              ),
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
            { id: 'actions', visible: true },
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
