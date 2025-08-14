import { useState, useEffect, useContext } from 'react';
import {
  Select,
  FileUpload,
  FormField,
  SpaceBetween,
  Box,
  Header,
  ContentLayout,
  Container,
  Form,
  Button,
  SelectProps,
  Modal,
  Spinner,
} from '@cloudscape-design/components';
import { uploadData } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/api';
import { getIngestionJob, listCourses } from '../graphql/queries';
import { createKnowledgeBase } from '../graphql/mutations';
import { Course } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { UserProfileContext } from '../contexts/userProfile';
import { getText, getTextWithParams } from '../i18n/lang';

const client = generateClient();

export default () => {
  const dispatchAlert = useContext(DispatchAlertContext);
  const userProfile = useContext(UserProfileContext);

  const [showSpinner, setShowSpinner] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [courses, setCourses] = useState<SelectProps.Option[]>([]);
  const [course, setCourse] = useState<SelectProps.Option | null>(null);

  useEffect(() => {
    client.graphql<any>({ query: listCourses }).then(({ data }) => {
      const list = data.listCourses;
      if (!list) return;
      const options = list.map((course: Course) => ({ label: course!.name!, value: course.id }));
      setCourses(options);
    });
  }, []);

  const waitForIngestion = async (knowledgeBaseId: string, dataSourceId: string, ingestionJobId: string) => {
    let jobStatus = '';
    do {
      const response = await client.graphql<any>({
        query: getIngestionJob,
        variables: { input: { knowledgeBaseId, dataSourceId, ingestionJobId } },
      });
      jobStatus = response.data.getIngestionJob.status;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } while (jobStatus !== 'COMPLETE');
  };

  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setShowSpinner(true);
          const data = files.map((file) => ({
            key: `KnowledgeBases/${userProfile?.userId}/${course?.value}/${file.name}`,
            file,
          }));
          try {
            await Promise.all(
              data.map(
                ({ key, file }) =>
                  uploadData({
                    key,
                    data: file,
                  }).result
              )
            );
            const knowledgeBaseResponse = await client.graphql<any>({
              query: createKnowledgeBase,
              variables: { courseId: course?.value, locations: data.map(({ key }) => key) },
            });
            const { knowledgeBaseId, dataSourceId, ingestionJobId } = knowledgeBaseResponse.data.createKnowledgeBase;
            if (!ingestionJobId) throw new Error('Failed to create Knowledge Base');
            await waitForIngestion(knowledgeBaseId, dataSourceId, ingestionJobId);
            setShowSpinner(false);
            dispatchAlert({ type: AlertType.SUCCESS, content: getText('teachers.settings.knowledge_base.created_successfully') });
          } catch (_e) {
            dispatchAlert({ type: AlertType.ERROR, content: getText('teachers.settings.knowledge_base.failed_to_create') });
          }
        }}
      >
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" variant="link">
                {getText('common.actions.cancel')}
              </Button>
              <Button variant="primary" disabled={!course || !files.length}>
                {getText('common.actions.submit')}
              </Button>
            </SpaceBetween>
          }
          header={<Header variant="h1">{getText('teachers.settings.knowledge_base.title')}</Header>}
        >
          <ContentLayout>
            <Container
              header={
                <SpaceBetween size="l">
                  <Header variant="h1">{getText('teachers.settings.knowledge_base.upload_document')}</Header>
                </SpaceBetween>
              }
            >
              <Box padding="xxxl">
                <SpaceBetween size="l" direction="horizontal" alignItems="start">
                  <FormField label={getText('teachers.settings.knowledge_base.choose_course')}>
                    <Select options={courses} selectedOption={course} onChange={({ detail }) => setCourse(detail.selectedOption)} />
                  </FormField>
                  <FormField>
                    <FileUpload
                      onChange={({ detail }) => setFiles(detail.value)}
                      value={files}
                      i18nStrings={{
                        uploadButtonText: (e) => (e ? getText('common.actions.choose_files') : getText('common.actions.choose_file')),
                        dropzoneText: (e) => (e ? getText('common.status.drop_files_to_upload') : getText('common.status.drop_file_to_upload')),
                        removeFileAriaLabel: (e) => getTextWithParams('teachers.settings.knowledge_base.remove_file', { index: e + 1 }),
                        limitShowFewer: getText('common.status.show_fewer_files'),
                        limitShowMore: getText('common.status.show_more_files'),
                        errorIconAriaLabel: getText('common.status.error'),
                      }}
                      showFileLastModified
                      showFileSize
                      showFileThumbnail
                      tokenLimit={3}
                    />
                  </FormField>
                </SpaceBetween>
              </Box>
            </Container>
          </ContentLayout>
        </Form>
      </form>
  <Modal visible={showSpinner} header={<Header>{getText('teachers.settings.knowledge_base.creating')}</Header>}>
        <SpaceBetween size="s" alignItems="center">
          <Spinner size="big" />
        </SpaceBetween>
      </Modal>
    </>
  );
};
