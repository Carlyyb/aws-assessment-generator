import { useState, useEffect } from 'react';
import {
  Table,
  Header,
  SpaceBetween,
  Container,
  Button,
  Box,
  ColumnLayout,
  TextContent,
  Modal,
  Form,
  FormField,
  Input,
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { useParams, useNavigate } from 'react-router-dom';
import { getText } from '../i18n/lang';
import { useContext } from 'react';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';

interface Student {
  id: string;
  name: string;
  email: string;
}

interface ClassDetails {
  id: string;
  name: string;
  description: string;
  students: Student[];
  createdAt: string;
  updatedAt: string;
}

const client = generateClient();

export default function ClassDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoveModalVisible, setRemoveModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const dispatchAlert = useContext(DispatchAlertContext);

  useEffect(() => {
    loadClassDetails();
  }, [id]);

  const loadClassDetails = async () => {
    try {
      const response = await client.graphql<any>({
        query: \`query GetClass($id: ID!) {
          getClassById(id: $id) {
            id
            name
            description
            students {
              id
              name
              email
            }
            createdAt
            updatedAt
          }
        }\`,
        variables: { id }
      });
      setClassDetails(response.data.getClassById);
    } catch (error) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: getText('teachers.class.load_error')
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveStudent = async () => {
    if (!selectedStudent) return;

    try {
      await client.graphql<any>({
        query: \`mutation RemoveStudent($classId: ID!, $studentId: ID!) {
          removeStudentFromClass(classId: $classId, studentId: $studentId) {
            id
            students {
              id
              name
              email
            }
          }
        }\`,
        variables: {
          classId: id,
          studentId: selectedStudent.id
        }
      });

      setRemoveModalVisible(false);
      setSelectedStudent(null);
      loadClassDetails();
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: getText('teachers.class.remove_student_success')
      });
    } catch (error) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: getText('teachers.class.remove_student_error')
      });
    }
  };

  if (isLoading) {
    return <div>{getText('common.loading')}</div>;
  }

  if (!classDetails) {
    return <div>{getText('teachers.class.not_found')}</div>;
  }

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h1"
            actions={
              <Button
                onClick={() => navigate('/management/class-management')}
              >
                {getText('common.actions.back')}
              </Button>
            }
          >
            {classDetails.name}
          </Header>
        }
      >
        <ColumnLayout columns={2}>
          <TextContent>
            <h3>{getText('teachers.class.description')}</h3>
            <p>{classDetails.description || getText('common.none')}</p>
          </TextContent>
          <TextContent>
            <h3>{getText('teachers.class.student_count')}</h3>
            <p>{classDetails.students?.length || 0}</p>
          </TextContent>
        </ColumnLayout>
      </Container>

      <Container
        header={
          <Header variant="h2">
            {getText('teachers.class.students')}
          </Header>
        }
      >
        <Table
          columnDefinitions={[
            {
              id: 'name',
              header: getText('teachers.class.student_name'),
              cell: item => item.name
            },
            {
              id: 'email',
              header: getText('teachers.class.student_email'),
              cell: item => item.email
            },
            {
              id: 'actions',
              header: getText('common.actions.title'),
              cell: item => (
                <Button
                  variant="link"
                  onClick={() => {
                    setSelectedStudent(item);
                    setRemoveModalVisible(true);
                  }}
                >
                  {getText('common.actions.remove')}
                </Button>
              )
            }
          ]}
          items={classDetails.students || []}
          empty={
            <Box textAlign="center" color="inherit">
              <TextContent>
                <p>{getText('teachers.class.no_students')}</p>
              </TextContent>
            </Box>
          }
        />
      </Container>

      <Modal
        visible={isRemoveModalVisible}
        onDismiss={() => setRemoveModalVisible(false)}
        header={getText('teachers.class.remove_student')}
      >
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setRemoveModalVisible(false)}
              >
                {getText('common.actions.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleRemoveStudent}
              >
                {getText('common.actions.confirm')}
              </Button>
            </SpaceBetween>
          }
        >
          <TextContent>
            <p>
              {getText('teachers.class.remove_student_confirmation', {
                name: selectedStudent?.name
              })}
            </p>
          </TextContent>
        </Form>
      </Modal>
    </SpaceBetween>
  );
}
