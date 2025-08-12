import { useState, useContext, useEffect } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  Button,
  Form,
  FormField,
  Box,
  Select,
  SelectProps,
  Checkbox,
  FileUpload,
  Input,
  DatePicker,
  Spinner,
  Modal,
} from '@cloudscape-design/components';
import { uploadData } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/api';
import { useNavigate } from 'react-router-dom';
import { generateAssessment, listCourses, getAssessment, listAssessTemplates } from '../graphql/queries';
import { Course, AssessStatus, AssessTemplate } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { UserProfileContext } from '../contexts/userProfile';
import { getText, getTextWithParams } from '../i18n/lang';

const client = generateClient();

export default () => {
  const navigate = useNavigate();
  const dispatchAlert = useContext(DispatchAlertContext);
  const userProfile = useContext(UserProfileContext);

  const [name, setName] = useState('');
  const [lectureDate, setLectureDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [useDefault, setUseDefault] = useState(true);
  const [courses, setCourses] = useState<SelectProps.Option[]>([]);
  const [course, setCourse] = useState<SelectProps.Option | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [assessId, setAssessId] = useState('');
  const [assessTemplates, setAssessTemplates] = useState<SelectProps.Option[]>([]);
  const [assessTemplate, setAssessTemplate] = useState<SelectProps.Option | null>(null);

  useEffect(() => {
    client.graphql<any>({ query: listAssessTemplates }).then(({ data }) => {
      const list = data.listAssessTemplates;
      if (!list) return;
      const options = list.map((assessTemplate: AssessTemplate) => ({ label: assessTemplate.name, value: assessTemplate.id }));
      setAssessTemplates(options);
    });
  }, []);

  function checkStatus() {
    setTimeout(() => {
      client.graphql<any>({ query: getAssessment, variables: { id: assessId } }).then(({ data }) => {
        const { status } = data.getAssessment;
        if (status === AssessStatus.CREATED) {
          dispatchAlert({ type: AlertType.SUCCESS, content: getText('pages.generate_assessments.generate_success') });
          return navigate(`/edit-assessment/${assessId}`);
        }
        checkStatus();
      });
    }, 1000);
  }

  useEffect(() => {
    if (!assessId) return;
    checkStatus();
  }, [assessId]);

  useEffect(() => {
    client.graphql<any>({ query: listCourses }).then(({ data }) => {
      const list = data.listCourses;
      if (!list) return;
      const options = list.map((course: Course) => ({ label: course!.name!, value: course.id }));
      setCourses(options);
    });
  }, []);

  return (
    <>
      <form onSubmit={(e) => e.preventDefault()}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" variant="link">
                {getText('common.cancel')}
              </Button>
              <Button
                onClick={async () => {
                  const data = files.map((file) => ({
                    key: `Assessments/${userProfile?.userId}/${course?.value}/${file.name}`,
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
                    //TODO implement validation
                    if (!(course && course.value)) {
                      throw new Error('Invalid course');
                    }
                    const res = await client.graphql<any>({
                      query: generateAssessment,
                      variables: {
                        input: {
                          name,
                          lectureDate,
                          deadline,
                          courseId: course.value,
                          assessTemplateId: assessTemplate?.value,
                          locations: data.map(({ key }) => key),
                        },
                      },
                    });
                    const id = res.data.generateAssessment;
                    setAssessId(id);
                  } catch (_e) {
                    dispatchAlert({ type: AlertType.ERROR, content: getText('assessment.failed_to_generate') });
                  }
                }}
                variant="primary"
              >
                {getText('assessment.generate_assessment')}
              </Button>
            </SpaceBetween>
          }
          header={<Header variant="h1">{getText('pages.generate_assessments.title')}</Header>}
        >
          <Container header={<Header variant="h1">{getText('pages.generate_assessments.title')}</Header>}>
            <SpaceBetween size="l" alignItems="center">
              <Box padding="xxxl">
                <SpaceBetween size="xxl" direction="horizontal">
                  <FormField label={getText('pages.generate_assessments.select_template')}>
                    <SpaceBetween size="l" direction="horizontal" alignItems="center">
                      <Checkbox checked={useDefault} onChange={({ detail }) => setUseDefault(detail.checked)}>
                        {getText('pages.generate_assessments.use_default')}
                      </Checkbox>
                      <Select
                        options={assessTemplates}
                        selectedOption={assessTemplate}
                        onChange={({ detail }) => setAssessTemplate(detail.selectedOption)}
                        disabled={useDefault}
                      />
                    </SpaceBetween>
                  </FormField>
                  <FormField label={getText('common.name')}>
                    <Input value={name} onChange={({ detail }) => setName(detail.value)} />
                  </FormField>
                  <FormField label={getText('pages.generate_assessments.select_course')}>
                    <Select options={courses} selectedOption={course} onChange={({ detail }) => setCourse(detail.selectedOption)} />
                  </FormField>
                  <FormField label={getText('pages.student.lecture_date')}>
                    <DatePicker onChange={({ detail }) => setLectureDate(detail.value)} value={lectureDate} placeholder={getText('date_format.yyyy_mm_dd')} />
                  </FormField>
                  <FormField label={getText('common.deadline')}>
                    <DatePicker onChange={({ detail }) => setDeadline(detail.value)} value={deadline} placeholder={getText('date_format.yyyy_mm_dd')} />
                  </FormField>
                  <FormField label={getText('pages.generate_assessments.add_lecture_notes')}>
                    <FileUpload
                      multiple
                      onChange={({ detail }) => setFiles(detail.value)}
                      value={files}
                      i18nStrings={{
                        uploadButtonText: (e) => (e ? getText('common.choose_files') : getText('common.choose_file')),
                        dropzoneText: (e) => (e ? getText('common.drop_files_to_upload') : getText('common.drop_file_to_upload')),
                        removeFileAriaLabel: (e) => getTextWithParams('pages.generate_assessments.remove_file', { index: e + 1 }),
                        limitShowFewer: getText('common.show_fewer_files'),
                        limitShowMore: getText('common.show_more_files'),
                        errorIconAriaLabel: getText('common.error'),
                      }}
                      showFileLastModified
                      showFileSize
                      showFileThumbnail
                      tokenLimit={3}
                    />
                  </FormField>
                </SpaceBetween>
              </Box>
            </SpaceBetween>
          </Container>
        </Form>
      </form>
      <Modal visible={!!assessId} header={<Header>{getText('pages.generate_assessments.generating')}</Header>}>
        <SpaceBetween size="s" alignItems="center">
          <Spinner size="big" />
        </SpaceBetween>
      </Modal>
    </>
  );
};
