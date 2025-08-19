import { useState, useContext } from 'react';
import {
  Table,
  Header,
  SpaceBetween,
  Container,
  Box,
  Button,
  Badge,
  Modal,
  Alert,
  FormField,
  Input,
  Textarea,
  Tiles,
  ColumnLayout
} from '@cloudscape-design/components';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';

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
}

interface GroupManagementProps {
  groups: StudentGroup[];
  students: Student[];
  onGroupsChange: (groups: StudentGroup[]) => void;
}

export const GroupManagement = ({ groups, students, onGroupsChange }: GroupManagementProps) => {
  const dispatchAlert = useContext(DispatchAlertContext);
  
  const [selectedGroups, setSelectedGroups] = useState<StudentGroup[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<StudentGroup | null>(null);
  
  // 创建分组表单状态
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#0073bb');
  
  // 预设颜色
  const presetColors = [
    '#0073bb', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
    '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#6c757d'
  ];

  const getRandomColor = () => {
    return presetColors[Math.floor(Math.random() * presetColors.length)];
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: '分组名称不能为空'
      });
      return;
    }

    const newGroup: StudentGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      description: newGroupDescription.trim(),
      color: newGroupColor,
      createdBy: 'current-teacher', // 需要从上下文获取
      teachers: ['current-teacher'],
      students: [],
      createdAt: new Date().toISOString()
    };

    const updatedGroups = [...groups, newGroup];
    onGroupsChange(updatedGroups);
    
    // 重置表单
    setNewGroupName('');
    setNewGroupDescription('');
    setNewGroupColor('#0073bb');
    setShowCreateModal(false);
    
    dispatchAlert({
      type: AlertType.SUCCESS,
      content: `分组 "${newGroup.name}" 创建成功`
    });
  };

  const handleEditGroup = () => {
    if (!editingGroup || !newGroupName.trim()) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: '分组名称不能为空'
      });
      return;
    }

    const updatedGroups = groups.map(group => 
      group.id === editingGroup.id 
        ? { ...group, name: newGroupName.trim(), description: newGroupDescription.trim(), color: newGroupColor }
        : group
    );
    
    onGroupsChange(updatedGroups);
    setShowEditModal(false);
    setEditingGroup(null);
    
    dispatchAlert({
      type: AlertType.SUCCESS,
      content: `分组 "${newGroupName}" 更新成功`
    });
  };

  const handleDeleteGroups = () => {
    const groupsToDelete = selectedGroups.filter(g => g.id !== 'ALL');
    if (groupsToDelete.length === 0) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: '无法删除默认分组或未选择有效分组'
      });
      return;
    }

    const updatedGroups = groups.filter(group => 
      !groupsToDelete.some(deleteGroup => deleteGroup.id === group.id)
    );
    
    onGroupsChange(updatedGroups);
    setSelectedGroups([]);
    setShowDeleteModal(false);
    
    dispatchAlert({
      type: AlertType.SUCCESS,
      content: `已删除 ${groupsToDelete.length} 个分组`
    });
  };

  const handleCopyGroup = (group: StudentGroup) => {
    const copiedGroup: StudentGroup = {
      ...group,
      id: `group-${Date.now()}`,
      name: `${group.name} (副本)`,
      createdAt: new Date().toISOString(),
      students: [] // 复制分组时不复制学生
    };

    const updatedGroups = [...groups, copiedGroup];
    onGroupsChange(updatedGroups);
    
    dispatchAlert({
      type: AlertType.SUCCESS,
      content: `分组 "${group.name}" 复制成功`
    });
  };

  const openEditModal = (group: StudentGroup) => {
    setEditingGroup(group);
    setNewGroupName(group.name);
    setNewGroupDescription(group.description);
    setNewGroupColor(group.color);
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    setNewGroupName('');
    setNewGroupDescription('');
    setNewGroupColor(getRandomColor());
    setShowCreateModal(true);
  };

  const getStudentCount = (group: StudentGroup) => {
    if (group.id === 'ALL') {
      return students.length;
    }
    return group.students.length;
  };

  const getStudentNames = (group: StudentGroup) => {
    if (group.id === 'ALL') {
      return students.map(s => s.lastName + s.firstName);
    }
    return students
      .filter(s => group.students.includes(s.id))
      .map(s => s.lastName + s.firstName);
  };

  // 过滤掉ALL分组进行显示，但保留用于逻辑处理
  const displayGroups = groups.filter(g => g.id !== 'ALL');

  return (
    <>
      <SpaceBetween size="l">
        <ColumnLayout columns={3}>
          <Box>
            <Box fontSize="heading-s">总分组数</Box>
            <Box fontSize="heading-l">{displayGroups.length}</Box>
          </Box>
          <Box>
            <Box fontSize="heading-s">已选择分组</Box>
            <Box fontSize="heading-l">{selectedGroups.length}</Box>
          </Box>
          <Box>
            <Box fontSize="heading-s">活跃分组</Box>
            <Box fontSize="heading-l">
              {displayGroups.filter(g => g.students.length > 0).length}
            </Box>
          </Box>
        </ColumnLayout>

        <Container>
          <Table
            columnDefinitions={[
              {
                id: 'name',
                header: '分组名称',
                cell: (item) => (
                  <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: item.color,
                        display: 'inline-block'
                      }}
                    />
                    <Box fontWeight="bold">{item.name}</Box>
                  </SpaceBetween>
                ),
                sortingField: 'name',
              },
              {
                id: 'description',
                header: '描述',
                cell: (item) => item.description || '-',
              },
              {
                id: 'studentCount',
                header: '学生数量',
                cell: (item) => (
                  <Badge color={getStudentCount(item) > 0 ? 'green' : 'grey'}>
                    {getStudentCount(item)}
                  </Badge>
                ),
                sortingField: 'students',
              },
              {
                id: 'createdAt',
                header: '创建时间',
                cell: (item) => new Date(item.createdAt).toLocaleDateString('zh-CN'),
                sortingField: 'createdAt',
              },
              {
                id: 'actions',
                header: '操作',
                cell: (item) => (
                  <SpaceBetween size="xs" direction="horizontal">
                    <Button
                      variant="normal"
                      onClick={() => openEditModal(item)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="normal"
                      onClick={() => {
                        setEditingGroup(item);
                        setShowStudentsModal(true);
                      }}
                    >
                      管理学生
                    </Button>
                    <Button
                      variant="normal"
                      onClick={() => handleCopyGroup(item)}
                    >
                      复制
                    </Button>
                  </SpaceBetween>
                ),
              },
            ]}
            items={displayGroups}
            loadingText="加载中..."
            trackBy="id"
            selectedItems={selectedGroups}
            onSelectionChange={({ detail }) =>
              setSelectedGroups(detail.selectedItems)
            }
            selectionType="multi"
            empty={
              <Box margin={{ vertical: 'xs' }} textAlign="center" color="inherit">
                <SpaceBetween size="m">
                  <Box>暂无分组</Box>
                  <Button variant="primary" onClick={openCreateModal}>
                    创建第一个分组
                  </Button>
                </SpaceBetween>
              </Box>
            }
            header={
              <Header
                counter={`(${displayGroups.length})`}
                actions={
                  <SpaceBetween size="xs" direction="horizontal">
                    <Button
                      variant="normal"
                      disabled={selectedGroups.length === 0}
                      onClick={() => setShowDeleteModal(true)}
                    >
                      删除分组 ({selectedGroups.length})
                    </Button>
                    <Button
                      variant="primary"
                      onClick={openCreateModal}
                    >
                      创建分组
                    </Button>
                  </SpaceBetween>
                }
              >
                分组管理
              </Header>
            }
          />
        </Container>
      </SpaceBetween>

      {/* 创建分组模态框 */}
      <Modal
        visible={showCreateModal}
        onDismiss={() => setShowCreateModal(false)}
        header="创建新分组"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="link"
                onClick={() => setShowCreateModal(false)}
              >
                取消
              </Button>
              <Button 
                variant="primary"
                onClick={handleCreateGroup}
              >
                创建分组
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          <FormField label="分组名称" constraintText="必填">
            <Input
              value={newGroupName}
              onChange={({ detail }) => setNewGroupName(detail.value)}
              placeholder="输入分组名称"
            />
          </FormField>
          
          <FormField label="分组描述" constraintText="可选">
            <Textarea
              value={newGroupDescription}
              onChange={({ detail }) => setNewGroupDescription(detail.value)}
              placeholder="输入分组描述"
              rows={3}
            />
          </FormField>
          
          <FormField label="标签颜色">
            <SpaceBetween size="s">
              <Box>
                <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: newGroupColor,
                      border: '2px solid #ccc'
                    }}
                  />
                  <Box>当前颜色: {newGroupColor}</Box>
                </SpaceBetween>
              </Box>
              
              <Tiles
                value={newGroupColor}
                onChange={({ detail }) => setNewGroupColor(detail.value)}
                items={presetColors.map(color => ({
                  value: color,
                  label: (
                    <Box>
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          backgroundColor: color,
                          margin: '0 auto'
                        }}
                      />
                    </Box>
                  )
                }))}
                columns={5}
              />
              
              <Button
                variant="normal"
                onClick={() => setNewGroupColor(getRandomColor())}
              >
                随机颜色
              </Button>
            </SpaceBetween>
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* 编辑分组模态框 */}
      <Modal
        visible={showEditModal}
        onDismiss={() => setShowEditModal(false)}
        header={`编辑分组 - ${editingGroup?.name}`}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="link"
                onClick={() => setShowEditModal(false)}
              >
                取消
              </Button>
              <Button 
                variant="primary"
                onClick={handleEditGroup}
              >
                保存更改
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          <FormField label="分组名称" constraintText="必填">
            <Input
              value={newGroupName}
              onChange={({ detail }) => setNewGroupName(detail.value)}
              placeholder="输入分组名称"
            />
          </FormField>
          
          <FormField label="分组描述" constraintText="可选">
            <Textarea
              value={newGroupDescription}
              onChange={({ detail }) => setNewGroupDescription(detail.value)}
              placeholder="输入分组描述"
              rows={3}
            />
          </FormField>
          
          <FormField label="标签颜色">
            <SpaceBetween size="s">
              <Box>
                <SpaceBetween size="xs" direction="horizontal" alignItems="center">
                  <div
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: newGroupColor,
                      border: '2px solid #ccc'
                    }}
                  />
                  <Box>当前颜色: {newGroupColor}</Box>
                </SpaceBetween>
              </Box>
              
              <Tiles
                value={newGroupColor}
                onChange={({ detail }) => setNewGroupColor(detail.value)}
                items={presetColors.map(color => ({
                  value: color,
                  label: (
                    <Box>
                      <div
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '50%',
                          backgroundColor: color,
                          margin: '0 auto'
                        }}
                      />
                    </Box>
                  )
                }))}
                columns={5}
              />
            </SpaceBetween>
          </FormField>
        </SpaceBetween>
      </Modal>

      {/* 删除分组确认模态框 */}
      <Modal
        visible={showDeleteModal}
        onDismiss={() => setShowDeleteModal(false)}
        header="删除分组"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                variant="link"
                onClick={() => setShowDeleteModal(false)}
              >
                取消
              </Button>
              <Button 
                variant="primary"
                onClick={handleDeleteGroups}
              >
                确认删除
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          <Alert type="warning" header="警告">
            您确定要删除以下 {selectedGroups.filter(g => g.id !== 'ALL').length} 个分组吗？此操作不可撤销。
          </Alert>
          
          <Box>
            <strong>将要删除的分组：</strong>
            <ul>
              {selectedGroups.filter(g => g.id !== 'ALL').map(group => (
                <li key={group.id}>
                  {group.name} ({getStudentCount(group)} 名学生)
                </li>
              ))}
            </ul>
          </Box>
          
          <Alert type="info">
            删除分组后，分组中的学生不会被删除，但会失去分组关联。
          </Alert>
        </SpaceBetween>
      </Modal>

      {/* 管理学生模态框 */}
      <Modal
        visible={showStudentsModal}
        onDismiss={() => setShowStudentsModal(false)}
        header={`管理分组学生 - ${editingGroup?.name}`}
        size="large"
        footer={
          <Box float="right">
            <Button 
              variant="primary"
              onClick={() => setShowStudentsModal(false)}
            >
              关闭
            </Button>
          </Box>
        }
      >
        <SpaceBetween size="l">
          {editingGroup && (
            <>
              <Alert type="info">
                分组 "{editingGroup.name}" 当前有 {getStudentCount(editingGroup)} 名学生
              </Alert>
              
              <Box>
                <strong>学生列表：</strong>
                {getStudentNames(editingGroup).length > 0 ? (
                  <Box>{getStudentNames(editingGroup).join('、')}</Box>
                ) : (
                  <Box color="text-status-inactive">暂无学生</Box>
                )}
              </Box>
              
              <Alert>
                学生的批量添加和移除功能请在主学生列表页面使用多选功能进行操作。
              </Alert>
            </>
          )}
        </SpaceBetween>
      </Modal>
    </>
  );
};
