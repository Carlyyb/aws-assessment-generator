import { useState, useEffect } from 'react';
import {
  Table,
  Header,
  SpaceBetween,
  Container,
  Button,
  Modal,
  Form,
  FormField,
  Input,
  TextContent,
  Box,
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { getText } from '../i18n/lang';
import { useContext } from 'react';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';

interface Student {
  id: string;
  name: string;
  email: string;
}

interface Class {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  accessibleTeachers: string[];
  students: Student[];
  createdAt: string;
  updatedAt: string;
}

interface Teacher {
  username: string;
  name: string;
  email?: string;
}

const client = generateClient();

export default function ClassManagement() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);
  const [isAddStudentModalVisible, setAddStudentModalVisible] = useState(false);
  const [isPermissionsModalVisible, setPermissionsModalVisible] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassDescription, setNewClassDescription] = useState('');
  const [newStudentIdentifier, setNewStudentIdentifier] = useState('');
  const [availableTeachers, setAvailableTeachers] = useState<Teacher[]>([]);
  const [selectedTeachers, setSelectedTeachers] = useState<string[]>([]);
  const dispatchAlert = useContext(DispatchAlertContext);

  useEffect(() => {
    loadClasses();
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      const response = await client.graphql<any>({
        query: `query ListTeachers {
          listUsers(role: teachers) {
            username
            name
            email
          }
        }`
      });
      setAvailableTeachers(response.data.listUsers);
    } catch (error) {
      console.error('Error loading teachers:', error);
    }
  };

  const loadClasses = async () => {
    try {
      const response = await client.graphql<any>({
        query: `query ListClassesByTeacher {
          listClassesByTeacher {
            id
            name
            description
            teacherId
            accessibleTeachers
            createdAt
            updatedAt
            students {
              id
              name
              email
            }
          }
        }`
      });
      setClasses(response.data.listClassesByTeacher);
    } catch (error) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: getText('teachers.class.load_error'),
      });
    }
  };

  const handleCreateClass = async () => {
    try {
      await client.graphql<any>({
        query: `mutation CreateClass($input: CreateClassInput!) {
          createClass(input: $input) {
            id
            name
            description
          }
        }`,
        variables: {
          input: {
            name: newClassName,
            description: newClassDescription,
          },
        },
      });

      setCreateModalVisible(false);
      setNewClassName('');
      setNewClassDescription('');
      loadClasses();
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: getText('teachers.class.create_success'),
      });
    } catch (error) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: getText('teachers.class.create_error'),
      });
    }
  };

  const handleAddStudent = async () => {
    if (!selectedClass) return;

    try {
      await client.graphql<any>({
        query: `mutation AddStudentToClass($input: AddStudentToClassInput!) {
          addStudentToClass(input: $input) {
            id
            students {
              id
              name
              email
            }
          }
        }`,
        variables: {
          input: {
            classId: selectedClass.id,
            studentIdentifier: newStudentIdentifier,
          },
        },
      });

      setAddStudentModalVisible(false);
      setNewStudentEmail('');
      loadClasses();
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: getText('teachers.class.add_student_success'),
      });
    } catch (error) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: getText('teachers.class.add_student_error'),
      });
    }
  };

  const handleUpdatePermissions = async () => {
    if (!selectedClass) return;

    try {
      await client.graphql<any>({
        query: `mutation UpdateClassPermissions($input: UpdateClassPermissionsInput!) {
          updateClassPermissions(input: $input) {
            id
            name
            accessibleTeachers
          }
        }`,
        variables: {
          input: {
            classId: selectedClass.id,
            accessibleTeachers: selectedTeachers,
          },
        },
      });

      setPermissionsModalVisible(false);
      setSelectedTeachers([]);
      loadClasses();
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: getText('teachers.class.update_permissions_success'),
      });
    } catch (error) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: getText('teachers.class.update_permissions_error'),
      });
    }
  };

  const openPermissionsModal = (classItem: Class) => {
    setSelectedClass(classItem);
    setSelectedTeachers(classItem.accessibleTeachers || []);
    setPermissionsModalVisible(true);
  };

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header
            variant="h1"
            actions={
              <Button
                variant="primary"
                onClick={() => setCreateModalVisible(true)}
              >
                {getText('teachers.class.create')}
              </Button>
            }
          >
            {getText('teachers.class.title')}
          </Header>
        }
      >
        <Table
          columnDefinitions={[
            {
              id: 'name',
              header: getText('teachers.class.name'),
              cell: item => item.name,
            },
            {
              id: 'description',
              header: getText('teachers.class.description'),
              cell: item => item.description,
            },
            {
              id: 'studentCount',
              header: getText('teachers.class.student_count'),
              cell: item => item.students?.length || 0,
            },
            {
              id: 'actions',
              header: getText('common.actions.title'),
              cell: item => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    onClick={() => {
                      setSelectedClass(item);
                      setAddStudentModalVisible(true);
                    }}
                  >
                    {getText('teachers.class.add_student')}
                  </Button>
                  <Button
                    variant="normal"
                    onClick={() => openPermissionsModal(item)}
                  >
                    {getText('teachers.class.manage_permissions')}
                  </Button>
                </SpaceBetween>
              ),
            },
          ]}
          items={classes}
          empty={
            <Box textAlign="center" color="inherit">
              <TextContent>
                <p>{getText('teachers.class.no_classes')}</p>
              </TextContent>
            </Box>
          }
        />
      </Container>

      <Modal
        visible={isCreateModalVisible}
        onDismiss={() => setCreateModalVisible(false)}
        header={getText('teachers.class.create')}
      >
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setCreateModalVisible(false)}
              >
                {getText('common.actions.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateClass}
                disabled={!newClassName}
              >
                {getText('common.actions.create')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField label={getText('teachers.class.name')}>
              <Input
                value={newClassName}
                onChange={({ detail }) => setNewClassName(detail.value)}
              />
            </FormField>
            <FormField label={getText('teachers.class.description')}>
              <Input
                value={newClassDescription}
                onChange={({ detail }) => setNewClassDescription(detail.value)}
              />
            </FormField>
          </SpaceBetween>
        </Form>
      </Modal>

      <Modal
        visible={isAddStudentModalVisible}
        onDismiss={() => setAddStudentModalVisible(false)}
        header={getText('teachers.class.add_student')}
      >
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setAddStudentModalVisible(false)}
              >
                {getText('common.actions.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleAddStudent}
                disabled={!newStudentEmail}
              >
                {getText('common.actions.add')}
              </Button>
            </SpaceBetween>
          }
        >
          <FormField
            label={getText('teachers.class.student_email')}
            description={getText('teachers.class.student_email_description')}
          >
            <Input
              value={newStudentEmail}
              onChange={({ detail }) => setNewStudentEmail(detail.value)}
              type="email"
            />
          </FormField>
        </Form>
      </Modal>

      <Modal
        visible={isPermissionsModalVisible}
        onDismiss={() => setPermissionsModalVisible(false)}
        header={getText('teachers.class.manage_permissions')}
        size="medium"
      >
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => setPermissionsModalVisible(false)}
              >
                {getText('common.actions.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdatePermissions}
              >
                {getText('common.actions.save')}
              </Button>
            </SpaceBetween>
          }
        >
          <FormField
            label={getText('teachers.class.accessible_teachers')}
            description={getText('teachers.class.accessible_teachers_description')}
          >
            <Table
              columnDefinitions={[
                {
                  id: 'select',
                  header: '',
                  cell: (teacher) => (
                    <input
                      type="checkbox"
                      checked={selectedTeachers.includes(teacher.username)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTeachers([...selectedTeachers, teacher.username]);
                        } else {
                          setSelectedTeachers(selectedTeachers.filter(t => t !== teacher.username));
                        }
                      }}
                    />
                  ),
                  width: 50,
                },
                {
                  id: 'name',
                  header: getText('common.name'),
                  cell: (teacher) => teacher.name,
                },
                {
                  id: 'username',
                  header: getText('common.username'),
                  cell: (teacher) => teacher.username,
                },
                {
                  id: 'email',
                  header: getText('common.email'),
                  cell: (teacher) => teacher.email || '-',
                },
              ]}
              items={availableTeachers}
              empty={
                <Box textAlign="center" color="inherit">
                  <TextContent>
                    <p>{getText('teachers.class.no_teachers')}</p>
                  </TextContent>
                </Box>
              }
            />
          </FormField>
        </Form>
      </Modal>
    </SpaceBetween>
  );
}
