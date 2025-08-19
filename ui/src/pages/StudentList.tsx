import { useState, useEffect, useContext } from 'react';
import {
  Table,
  Header,
  SpaceBetween,
  Container,
  ContentLayout,
  Box,
  Button,
  Badge,
  Modal,
  Spinner,
  Alert,
  TextFilter,
  Pagination,
  ColumnLayout,
  Multiselect,
  FormField,
  Select
} from '@cloudscape-design/components';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { GroupManagement } from '../components/GroupManagementClean';

interface StudentGroup {
  id: string;
  name: string;
  description: string;
  color: string;
  createdBy: string;
  teachers: string[];
  students: string[];
  createdAt: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  lastLoginAt?: string;
  assessmentCount: number;
  groups: StudentGroup[];
}

export default () => {
  const dispatchAlert = useContext(DispatchAlertContext);
  
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showManageGroups, setShowManageGroups] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<any>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [pageSize] = useState(10);

  // 模拟数据 - 后续需要替换为真实的GraphQL查询
  const mockGroups: StudentGroup[] = [
    {
      id: 'ALL',
      name: '所有学生',
      description: '默认分组，包含所有学生',
      color: '#0073bb',
      createdBy: 'system',
      teachers: [],
      students: [],
      createdAt: '2025-01-01T00:00:00Z'
    },
    {
      id: 'group-1',
      name: '计算机科学班',
      description: '计算机科学专业学生',
      color: '#28a745',
      createdBy: 'teacher-1',
      teachers: ['teacher-1'],
      students: ['student-1', 'student-2'],
      createdAt: '2025-08-01T10:00:00Z'
    },
    {
      id: 'group-2',
      name: '数据结构学习组',
      description: '专门学习数据结构的小组',
      color: '#dc3545',
      createdBy: 'teacher-1',
      teachers: ['teacher-1'],
      students: ['student-2', 'student-3'],
      createdAt: '2025-08-05T14:30:00Z'
    }
  ];

  const mockStudents: Student[] = [
    {
      id: 'student-1',
      firstName: '张',
      lastName: '三',
      email: 'zhangsan@example.com',
      lastLoginAt: '2025-08-18T10:30:00Z',
      assessmentCount: 5,
      groups: [mockGroups[1]]
    },
    {
      id: 'student-2',
      firstName: '李',
      lastName: '四',
      email: 'lisi@example.com',
      lastLoginAt: '2025-08-17T15:20:00Z',
      assessmentCount: 3,
      groups: [mockGroups[1], mockGroups[2]]
    },
    {
      id: 'student-3',
      firstName: '王',
      lastName: '五',
      email: 'wangwu@example.com',
      lastLoginAt: '2025-08-16T09:45:00Z',
      assessmentCount: 7,
      groups: [mockGroups[2]]
    },
    {
      id: 'student-4',
      firstName: '赵',
      lastName: '六',
      email: 'zhaoliu@example.com',
      lastLoginAt: undefined,
      assessmentCount: 0,
      groups: []
    }
  ];

  useEffect(() => {
    loadStudentsAndGroups();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, filterText, selectedGroupFilter]);

  const loadStudentsAndGroups = async () => {
    setLoading(true);
    try {
      // 这里需要实现真实的GraphQL查询
      // const studentsResult = await client.graphql({ query: listStudentsWithGroups });
      // const groupsResult = await client.graphql({ query: listStudentGroups });
      
      // 暂时使用模拟数据
      setTimeout(() => {
        setStudents(mockStudents);
        setGroups(mockGroups);
        setLoading(false);
      }, 1000);
      
    } catch (error: any) {
      console.error('Error loading students and groups:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '加载学生列表失败，请稍后重试'
      });
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = students;

    // 按文本过滤
    if (filterText) {
      filtered = filtered.filter(student => 
        student.firstName.toLowerCase().includes(filterText.toLowerCase()) ||
        student.lastName.toLowerCase().includes(filterText.toLowerCase()) ||
        student.email.toLowerCase().includes(filterText.toLowerCase())
      );
    }

    // 按分组过滤
    if (selectedGroupFilter && selectedGroupFilter.value !== 'ALL') {
      filtered = filtered.filter(student => 
        student.groups.some(group => group.id === selectedGroupFilter.value)
      );
    }

    setFilteredStudents(filtered);
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '从未登录';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const getGroupTags = (studentGroups: StudentGroup[]) => {
    if (studentGroups.length === 0) {
      return <Badge color="grey">无分组</Badge>;
    }

    return (
      <SpaceBetween size="xs" direction="horizontal">
        {studentGroups.map(group => (
          <Button
            key={group.id}
            variant="inline-link"
            onClick={() => {
              setSelectedGroupFilter({ value: group.id, label: group.name });
            }}
          >
            <Badge color="blue">
              {group.name}
            </Badge>
          </Button>
        ))}
      </SpaceBetween>
    );
  };

  const handleAddToGroups = () => {
    if (selectedStudents.length === 0) {
      dispatchAlert({
        type: AlertType.WARNING,
        content: '请先选择要分组的学生'
      });
      return;
    }
    setShowGroupModal(true);
  };

  const paginatedStudents = filteredStudents.slice(
    (currentPageIndex - 1) * pageSize,
    currentPageIndex * pageSize
  );

  if (loading) {
    return (
      <ContentLayout>
        <Container>
          <SpaceBetween size="l" alignItems="center">
            <Spinner size="big" />
            <Box>加载学生列表中...</Box>
          </SpaceBetween>
        </Container>
      </ContentLayout>
    );
  }

  return (
    <>
      <ContentLayout>
        <SpaceBetween size="l">
          <Container
            header={
              <Header 
                variant="h1"
                actions={
                  <SpaceBetween size="s" direction="horizontal">
                    <Button 
                      variant="normal"
                      onClick={() => setShowManageGroups(true)}
                    >
                      管理分组
                    </Button>
                    <Button
                      variant="primary"
                      disabled={selectedStudents.length === 0}
                      onClick={handleAddToGroups}
                    >
                      加入分组 ({selectedStudents.length})
                    </Button>
                  </SpaceBetween>
                }
              >
                学生列表
              </Header>
            }
          >
            <SpaceBetween size="m">
              <ColumnLayout columns={4}>
                <Box>
                  <Box fontSize="heading-s">总学生数</Box>
                  <Box fontSize="heading-l">{students.length}</Box>
                </Box>
                <Box>
                  <Box fontSize="heading-s">活跃学生</Box>
                  <Box fontSize="heading-l">
                    {students.filter(s => s.lastLoginAt).length}
                  </Box>
                </Box>
                <Box>
                  <Box fontSize="heading-s">已分组学生</Box>
                  <Box fontSize="heading-l">
                    {students.filter(s => s.groups.length > 0).length}
                  </Box>
                </Box>
                <Box>
                  <Box fontSize="heading-s">分组总数</Box>
                  <Box fontSize="heading-l">{groups.length - 1}</Box>
                </Box>
              </ColumnLayout>
            </SpaceBetween>
          </Container>

          <Container>
            <Table
              columnDefinitions={[
                {
                  id: 'name',
                  header: '学生姓名',
                  cell: (item) => (
                    <SpaceBetween size="xs">
                      <Box fontWeight="bold">{item.lastName}{item.firstName}</Box>
                      <Box fontSize="body-s" color="text-status-inactive">{item.email}</Box>
                    </SpaceBetween>
                  ),
                  sortingField: 'lastName',
                },
                {
                  id: 'lastLogin',
                  header: '最近登录时间',
                  cell: (item) => formatDateTime(item.lastLoginAt),
                  sortingField: 'lastLoginAt',
                },
                {
                  id: 'assessmentCount',
                  header: '参加测试数量',
                  cell: (item) => (
                    <Badge color={item.assessmentCount > 0 ? 'green' : 'grey'}>
                      {item.assessmentCount}
                    </Badge>
                  ),
                  sortingField: 'assessmentCount',
                },
                {
                  id: 'groups',
                  header: '所在分组',
                  cell: (item) => getGroupTags(item.groups),
                },
                {
                  id: 'actions',
                  header: '操作',
                  cell: (item) => (
                    <SpaceBetween size="xs" direction="horizontal">
                      <Button
                        variant="normal"
                        onClick={() => {
                          // 查看学生详情
                          dispatchAlert({
                            type: AlertType.SUCCESS,
                            content: `查看 ${item.lastName}${item.firstName} 的详情`
                          });
                        }}
                      >
                        查看详情
                      </Button>
                    </SpaceBetween>
                  ),
                },
              ]}
              items={paginatedStudents}
              loadingText="加载中..."
              trackBy="id"
              selectedItems={selectedStudents}
              onSelectionChange={({ detail }) =>
                setSelectedStudents(detail.selectedItems)
              }
              selectionType="multi"
              empty={
                <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
                  <SpaceBetween size="m">
                    <Box>没有找到学生</Box>
                    <Alert>
                      请检查筛选条件或联系管理员添加学生。
                    </Alert>
                  </SpaceBetween>
                </Box>
              }
              filter={
                <SpaceBetween size="s" direction="horizontal">
                  <TextFilter
                    filteringPlaceholder="搜索学生姓名或邮箱"
                    filteringText={filterText}
                    onChange={({ detail }) => setFilterText(detail.filteringText)}
                  />
                  <FormField label="按分组筛选">
                    <Select
                      selectedOption={selectedGroupFilter}
                      onChange={({ detail }) => setSelectedGroupFilter(detail.selectedOption)}
                      options={[
                        { value: 'ALL', label: '所有学生' },
                        ...groups.filter(g => g.id !== 'ALL').map(g => ({
                          value: g.id,
                          label: g.name
                        }))
                      ]}
                      placeholder="选择分组"
                    />
                  </FormField>
                </SpaceBetween>
              }
              pagination={
                <Pagination
                  currentPageIndex={currentPageIndex}
                  pagesCount={Math.ceil(filteredStudents.length / pageSize)}
                  onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
                />
              }
              header={
                <Header
                  counter={`(${filteredStudents.length})`}
                  actions={
                    <SpaceBetween size="xs" direction="horizontal">
                      <Button
                        variant="normal"
                        onClick={loadStudentsAndGroups}
                      >
                        刷新
                      </Button>
                    </SpaceBetween>
                  }
                >
                  学生列表
                </Header>
              }
            />
          </Container>
        </SpaceBetween>
      </ContentLayout>

      {/* 加入分组模态框 */}
      <Modal
        visible={showGroupModal}
        onDismiss={() => setShowGroupModal(false)}
        header="将学生加入分组"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="link"
                onClick={() => setShowGroupModal(false)}
              >
                取消
              </Button>
              <Button 
                variant="primary"
                onClick={() => {
                  // 这里实现加入分组的逻辑
                  dispatchAlert({
                    type: AlertType.SUCCESS,
                    content: `已将 ${selectedStudents.length} 名学生加入选定分组`
                  });
                  setShowGroupModal(false);
                  setSelectedStudents([]);
                }}
              >
                确认加入
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          <Alert type="info">
            已选择 {selectedStudents.length} 名学生：
            {selectedStudents.map(s => s.lastName + s.firstName).join('、')}
          </Alert>
          
          <FormField label="选择要加入的分组（可多选）">
            <Multiselect
              selectedOptions={[]}
              onChange={() => {
                // 处理分组选择
              }}
              options={groups.filter(g => g.id !== 'ALL').map(g => ({
                value: g.id,
                label: g.name,
                description: g.description
              }))}
              placeholder="选择分组"
            />
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* 分组管理模态框 */}
      <Modal
        visible={showManageGroups}
        onDismiss={() => setShowManageGroups(false)}
        header="分组管理"
        size="max"
        footer={
          <Box float="right">
            <Button 
              variant="primary"
              onClick={() => setShowManageGroups(false)}
            >
              关闭
            </Button>
          </Box>
        }
      >
        <GroupManagement 
          groups={groups}
          students={students}
          onGroupsChange={setGroups}
        />
      </Modal>
    </>
  );
};
