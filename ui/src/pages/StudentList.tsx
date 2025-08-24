import { useState, useEffect, useContext, useCallback } from 'react';
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
  TextFilter,
  Pagination,
  ColumnLayout,
  Multiselect,
  FormField,
  Select
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { listStudents, listStudentGroups } from '../graphql/queries';
import { updateStudentGroup } from '../graphql/mutations';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { GroupManagement } from '../components/GroupManagementClean';
import { createTimestamp, formatRelativeTime } from '../utils/timeUtils';

const client = generateClient();

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
  name: string;
  email?: string | null;
  lastLoginAt?: string | null;
  assessmentCount?: number | null;
  groups?: StudentGroup[] | null;
}

const StudentList = () => {
  const dispatchAlert = useContext(DispatchAlertContext);
  
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<any[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showManageGroups, setShowManageGroups] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<{ label: string; value: string } | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [pageSize] = useState(10);

  // 加载学生和分组数据
  const loadStudentsAndGroups = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) {
      setLoading(true);
    }
    try {
      
      // 并行加载学生和分组数据
      const [studentsResponse, groupsResponse] = await Promise.all([
        client.graphql({ query: listStudents }),
        client.graphql({ query: listStudentGroups })
      ]);

      const studentsData = (studentsResponse as any).data.listStudents || [];
      const groupsData = (groupsResponse as any).data.listStudentGroups || [];

      // 处理学生数据，确保字段不为null
      const processedStudents = studentsData.map((student: any) => ({
        ...student,
        email: student.email || '',
        lastLoginAt: student.lastLoginAt || undefined,
        assessmentCount: student.assessmentCount || 0,
        groups: student.groups || []
      }));

      // 添加默认的"所有学生"分组
      const allStudentsGroup: StudentGroup = {
        id: 'ALL',
        name: '所有学生',
        description: '默认分组，包含所有学生',
        color: '#0073bb',
        createdBy: 'system',
        teachers: [],
        students: processedStudents.map((s: any) => s.id),
        createdAt: createTimestamp()
      };

      setStudents(processedStudents);
      setGroups([allStudentsGroup, ...groupsData]);
      
      // 只在首次加载时显示通知
      if (!initialized) {
        setInitialized(true);
        dispatchAlert({
          type: AlertType.SUCCESS,
          content: `成功加载 ${processedStudents.length} 名学生和 ${groupsData.length - 1} 个分组`
        });
      }

    } catch (error) {
      console.error('加载学生数据失败:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '加载学生数据失败，将使用模拟数据'
      });
      
      // 如果API失败，使用模拟数据作为后备
      loadMockData();
    } finally {
      setLoading(false);
    }
  }, [dispatchAlert, initialized]);

  // 后备模拟数据函数
  const loadMockData = () => {
    const mockGroups: StudentGroup[] = [
      {
        id: 'ALL',
        name: '所有学生',
        description: '默认分组，包含所有学生',
        color: '#0073bb',
        createdBy: 'system',
        teachers: [],
        students: ['student-1', 'student-2', 'student-3', 'student-4'],
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
        name: '张三',
        email: 'zhangsan@example.com',
        lastLoginAt: '2025-08-18T10:30:00Z',
        assessmentCount: 5,
        groups: [mockGroups[0], mockGroups[1]]
      },
      {
        id: 'student-2',
        name: '李四',
        email: 'lisi@example.com',
        lastLoginAt: '2025-08-17T14:15:00Z',
        assessmentCount: 3,
        groups: [mockGroups[0], mockGroups[1], mockGroups[2]]
      },
      {
        id: 'student-3',
        name: '王五',
        email: 'wangwu@example.com',
        lastLoginAt: '2025-08-16T09:45:00Z',
        assessmentCount: 7,
        groups: [mockGroups[0], mockGroups[2]]
      },
      {
        id: 'student-4',
        name: '赵六',
        email: 'zhaoliu@example.com',
        assessmentCount: 1,
        groups: [mockGroups[0]]
      }
    ];

    setStudents(mockStudents);
    setGroups(mockGroups);
  };

  // 过滤学生数据
  const filterStudents = useCallback(() => {
    let filtered = [...students];

    // 按文本过滤
    if (filterText) {
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(filterText.toLowerCase()) ||
        (student.email && student.email.toLowerCase().includes(filterText.toLowerCase()))
      );
    }

    // 按分组过滤
    if (selectedGroupFilter && selectedGroupFilter.value !== 'ALL') {
      filtered = filtered.filter(student => 
        student.groups && student.groups.some(group => group.id === selectedGroupFilter.value)
      );
    }

    setFilteredStudents(filtered);
  }, [students, filterText, selectedGroupFilter]);

  useEffect(() => {
    loadStudentsAndGroups();
  }, [loadStudentsAndGroups]);

  useEffect(() => {
    filterStudents();
  }, [filterStudents]);

  // 分页计算
  const startIndex = (currentPageIndex - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);
  const totalPages = Math.ceil(filteredStudents.length / pageSize);

  // 格式化最后登录时间
  const formatLastLogin = (lastLoginAt?: string | null) => {
    if (!lastLoginAt) return '从未登录';
    return formatRelativeTime(lastLoginAt);
  };

  // 加入分组
  const handleAddToGroup = async () => {
    if (selectedGroups.length === 0) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: '请选择至少一个分组'
      });
      return;
    }

    try {
      for (const group of selectedGroups) {
        const groupId = group.value;
        const targetGroup = groups.find(g => g.id === groupId);
        if (!targetGroup) continue;
        
        const newStudentIds = Array.from(new Set([...targetGroup.students, ...selectedStudents.map(s => s.id)]));
        
        await client.graphql({
          query: updateStudentGroup,
          variables: {
            id: groupId,
            input: {
              name: targetGroup.name,
              description: targetGroup.description,
              color: targetGroup.color,
              teachers: targetGroup.teachers,
              students: newStudentIds
            }
          }
        });
      }
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: `成功将 ${selectedStudents.length} 名学生添加到 ${selectedGroups.length} 个分组`
      });
      setShowGroupModal(false);
      setSelectedStudents([]);
      setSelectedGroups([]);
      await loadStudentsAndGroups(false); // 不显示加载状态，避免跳动
    } catch (error) {
      console.error('添加到分组失败:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '添加到分组失败'
      });
    }
  };

  if (loading) {
    return (
      <ContentLayout>
        <Container>
          <SpaceBetween size="l" alignItems="center">
            <Spinner size="big" />
            <Box>正在加载学生数据...</Box>
          </SpaceBetween>
        </Container>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout>
      <SpaceBetween size="l">
        <Container
          header={
            <Header
              variant="h1"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    onClick={() => setShowManageGroups(true)}
                  >
                    管理分组
                  </Button>
                  <Button
                    variant="primary"
                    disabled={selectedStudents.length === 0}
                    onClick={() => setShowGroupModal(true)}
                  >
                    加入分组 ({selectedStudents.length})
                  </Button>
                </SpaceBetween>
              }
            >
              学生管理
            </Header>
          }
        >
          <SpaceBetween size="l">
            {/* 数据统计 */}
            <ColumnLayout columns={3}>
              <Box>
                <Box variant="h3" color="text-label">总学生数</Box>
                <Box variant="h1">{students.length}</Box>
              </Box>
              <Box>
                <Box variant="h3" color="text-label">分组数量</Box>
                <Box variant="h1">{groups.length - 2}</Box>
              </Box>
              <Box>
                <Box variant="h3" color="text-label">活跃学生</Box>
                <Box variant="h1">{students.filter(s => s.lastLoginAt).length}</Box>
              </Box>
            </ColumnLayout>

            {/* 过滤器 */}
            <ColumnLayout columns={2}>
              <FormField label="搜索学生">
                <TextFilter
                  filteringText={filterText}
                  filteringPlaceholder="输入姓名或邮箱搜索"
                  onChange={({ detail }) => setFilterText(detail.filteringText)}
                />
              </FormField>
              
              <FormField label="按分组过滤">
                <Select
                  selectedOption={selectedGroupFilter}
                  onChange={({ detail }) => {
                    const option = detail.selectedOption;
                    setSelectedGroupFilter(option && option.value ? { label: option.label ?? '', value: option.value } : null);
                  }}
                  options={[
                    { label: '所有分组', value: 'ALL' },
                    ...groups.filter(g => g.id !== 'ALL').map(group => ({
                      label: group.name,
                      value: group.id
                    }))
                  ]}
                  placeholder="选择分组"
                />
              </FormField>
            </ColumnLayout>

            {/* 学生表格 */}
            <Table
              columnDefinitions={[
                {
                  id: 'name',
                  header: '姓名',
                  cell: (item) => item.name,
                  sortingField: 'name'
                },
                {
                  id: 'email',
                  header: '邮箱',
                  cell: (item) => item.email || '-',
                },
                {
                  id: 'lastLogin',
                  header: '最后登录',
                  cell: (item) => formatLastLogin(item.lastLoginAt),
                },
                {
                  id: 'assessmentCount',
                  header: '完成测试数',
                  cell: (item) => item.assessmentCount || 0,
                },
                {
                  id: 'groups',
                  header: '所属分组',
                  cell: (item) => (
                    <SpaceBetween direction="horizontal" size="xs">
                      {item.groups?.filter(g => g.id !== 'ALL').map(group => (
                        <Badge 
                          key={group.id} 
                          color={group.color === '#28a745' ? 'green' : 
                                 group.color === '#dc3545' ? 'red' : 'blue'}
                        >
                          {group.name}
                        </Badge>
                      )) || []}
                      {(!item.groups || item.groups.filter(g => g.id !== 'ALL').length === 0) && 
                        <Badge color="grey">无分组</Badge>
                      }
                    </SpaceBetween>
                  ),
                },
              ]}
              items={paginatedStudents}
              loadingText="正在加载..."
              trackBy="id"
              empty={
                <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
                  {filterText || selectedGroupFilter ? '没有找到符合条件的学生' : '暂无学生数据'}
                </Box>
              }
              selectedItems={selectedStudents}
              onSelectionChange={({ detail }) => setSelectedStudents(detail.selectedItems)}
              selectionType="multi"
              pagination={
                <Pagination
                  currentPageIndex={currentPageIndex}
                  onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
                  pagesCount={totalPages}
                />
              }
            />
          </SpaceBetween>
        </Container>

        {/* 加入分组对话框 */}
        <Modal
          visible={showGroupModal}
          onDismiss={() => setShowGroupModal(false)}
          header="将学生加入分组"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setShowGroupModal(false)}>
                  取消
                </Button>
                <Button 
                  variant="primary"
                  onClick={handleAddToGroup}
                >
                  确认
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            <Box>
              将选中的 <strong>{selectedStudents.length}</strong> 名学生加入到分组：
            </Box>
            <Box>
              {selectedStudents.map(student => (
                <div key={student.id}>• {student.name}</div>
              ))}
            </Box>
            
            <FormField label="选择分组">
              <Multiselect
                selectedOptions={selectedGroups}
                onChange={({ detail }) => setSelectedGroups([...detail.selectedOptions])}
                options={groups.filter(g => g.id !== 'ALL').map(group => ({
                  label: group.name,
                  value: group.id,
                  description: group.description
                }))}
                placeholder="选择要加入的分组"
                selectedAriaLabel="已选择"
              />
            </FormField>
          </SpaceBetween>
        </Modal>

        {/* 分组管理对话框 */}
        <Modal
          visible={showManageGroups}
          onDismiss={() => setShowManageGroups(false)}
          header="分组管理"
          size="large"
        >
          <GroupManagement
            groups={groups.filter(g => g.id !== 'ALL')}
            students={students}
            onGroupsChange={() => {
              // 重新加载数据，但不显示通知
              const reloadData = async () => {
                try {
                  const [studentsResponse, groupsResponse] = await Promise.all([
                    client.graphql({ query: listStudents }),
                    client.graphql({ query: listStudentGroups })
                  ]);

                  const studentsData = (studentsResponse as any).data.listStudents || [];
                  const groupsData = (groupsResponse as any).data.listStudentGroups || [];

                  const processedStudents = studentsData.map((student: any) => ({
                    ...student,
                    email: student.email || '',
                    lastLoginAt: student.lastLoginAt || undefined,
                    assessmentCount: student.assessmentCount || 0,
                    groups: student.groups || []
                  }));

                  const allStudentsGroup: StudentGroup = {
                    id: 'ALL',
                    name: '所有学生',
                    description: '默认分组，包含所有学生',
                    color: '#0073bb',
                    createdBy: 'system',
                    teachers: [],
                    students: processedStudents.map((s: any) => s.id),
                    createdAt: createTimestamp()
                  };

                  setStudents(processedStudents);
                  setGroups([allStudentsGroup, ...groupsData]);
                } catch (error) {
                  console.error('重新加载数据失败:', error);
                }
              };
              reloadData();
            }}
          />
        </Modal>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default StudentList;
