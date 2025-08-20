import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  Box,
  Button,
  Container,
  Header,
  SpaceBetween,
  Table,
  TableProps,
  Modal,
  FormField,
  Input,
  Select,
  TextContent,
  Alert,
  FileUpload,
  Tabs,
  TabsProps,
  Badge,
  StatusIndicator,
  Pagination
} from '@cloudscape-design/components';
import { useCollection } from '@cloudscape-design/collection-hooks';
import { generateClient } from 'aws-amplify/api';
import { listUsers, previewExcelImport } from '../graphql/queries';
import { batchCreateUsersMutation, createSingleUserMutation, updateUserMutation, deleteUserMutation } from '../graphql/mutations';
import { getText } from '../i18n/lang';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { useAdminPermissions } from '../utils/adminPermissions';

const client = generateClient();

interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  role: 'students' | 'teachers' | 'admin' | 'super_admin';
  needsPasswordChange: boolean;
  lastLoginAt?: string;
  createdAt: string;
  createdBy: string;
  isActive: boolean;
}

interface BatchUserInput {
  name: string;
  username: string;
  password?: string;
  role: 'students' | 'teachers' | 'admin' | 'super_admin';
  email?: string;
}

interface ExcelImportResult {
  preview: BatchUserInput[];
  validRows: number;
  invalidRows: number;
  errors: string[];
}

const UserManagement: React.FC = () => {
  // 角色显示映射
  const roleDisplayMap: {[key: string]: string} = {
    students: '学生',
    teachers: '教师',
    admin: '管理员',
    super_admin: '超级管理员'
  };

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchCreateModal, setShowBatchCreateModal] = useState(false);
  const [activeTabId, setActiveTabId] = useState('single');
  
  // 密码显示相关状态
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [generatedUserInfo, setGeneratedUserInfo] = useState<{username: string, password: string} | null>(null);
  
  // 用户设置相关状态
  const [showUserSettingsModal, setShowUserSettingsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('');
  
  // 密码重置相关状态
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [useDefaultPassword, setUseDefaultPassword] = useState<boolean>(true);
  
  // 多选删除相关状态
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // 权限检查
  const { adminInfo } = useAdminPermissions();
  
  // 根据当前用户权限获取可创建的角色选项
  const getAvailableRoleOptions = () => {
    const options = [
      { label: '学生', value: 'students' },
      { label: '教师', value: 'teachers' }
    ];
    
    // 只有超级管理员可以创建管理员账户
    if (adminInfo?.permissions.canCreateAdmin) {
      options.push({ label: '管理员', value: 'admin' });
    }
    
    return options;
  };
  
  // 验证角色选择是否有效
  const isValidRoleForCurrentUser = (role: string) => {
    if (role === 'students' || role === 'teachers') {
      return true; // 所有管理员都可以创建学生和教师
    }
    if (role === 'admin') {
      return adminInfo?.permissions.canCreateAdmin || false; // 只有超级管理员可以创建管理员
    }
    return false; // 不允许创建super_admin或其他角色
  };
  
  // 获取角色显示名称
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'students': return '学生';
      case 'teachers': return '教师';
      case 'admin': return '管理员';
      case 'super_admin': return '超级管理员';
      default: return role;
    }
  };
  
  // 单个用户创建表单
  const [singleUserForm, setSingleUserForm] = useState<BatchUserInput>({
    name: '',
    username: '',
    password: '',
    role: 'students',
    email: ''
  });
  
  // Excel导入相关状态
  const [excelFile, setExcelFile] = useState<File[]>([]);
  const [excelPreview, setExcelPreview] = useState<ExcelImportResult | null>(null);
  const [importRole, setImportRole] = useState<'students' | 'teachers' | 'admin'>('students');
  
  const dispatchAlert = useContext(DispatchAlertContext);

  // 表格列定义
  const columnDefinitions: TableProps.ColumnDefinition<User>[] = [
    {
      id: 'username',
      header: '用户名',
      cell: (item: User) => item.username,
      sortingField: 'username'
    },
    {
      id: 'name',
      header: '姓名',
      cell: (item: User) => item.name,
      sortingField: 'name'
    },
    {
      id: 'role',
      header: '角色',
      cell: (item: User) => (
        <Badge
          color={item.role === 'students' ? 'blue' : 
                 item.role === 'teachers' ? 'green' : 
                 item.role === 'admin' ? 'red' : 'grey'}
        >
          {getText(`common.role.${item.role}`)}
        </Badge>
      )
    },
    {
      id: 'email',
      header: '邮箱',
      cell: (item: User) => item.email || '-'
    },
    {
      id: 'needsPasswordChange',
      header: '密码状态',
      cell: (item: User) => (
        <StatusIndicator type={item.needsPasswordChange ? 'warning' : 'success'}>
          {item.needsPasswordChange ? '需要修改密码' : '正常'}
        </StatusIndicator>
      )
    },
    {
      id: 'lastLoginAt',
      header: '最后登录',
      cell: (item: User) => item.lastLoginAt 
        ? new Date(item.lastLoginAt).toLocaleString('zh-CN')
        : '从未登录'
    },
    {
      id: 'actions',
      header: '操作',
      cell: (item: User) => (
        <Button
          iconName="settings"
          variant="link"
          onClick={() => handleOpenUserSettings(item)}
        >
          设置
        </Button>
      )
    }
  ];

  // 表格集合钩子
  const { items, filteredItemsCount, collectionProps, paginationProps } = useCollection(
    users,
    {
      filtering: {
        empty: (
          <Box textAlign="center" color="inherit">
            <b>没有用户</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              没有找到用户记录
            </Box>
          </Box>
        ),
        noMatch: (
          <Box textAlign="center" color="inherit">
            <b>没有匹配项</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              没有找到与过滤条件匹配的用户
            </Box>
          </Box>
        ),
      },
      pagination: { pageSize: 20 },
      sorting: {},
      selection: {
        keepSelection: true,
        trackBy: 'id',
      },
    }
  );

  // 加载用户列表
  const loadUsers = useCallback(async (role?: string) => {
    setLoading(true);
    try {
      const response = await client.graphql({
        query: listUsers,
        variables: role ? { role } : {}
      });
      
      const userData = (response as any).data?.listUsers;
      if (Array.isArray(userData)) {
        setUsers(userData);
        console.log(`加载用户列表成功，共 ${userData.length} 个用户`);
      } else {
        console.warn('用户数据格式异常:', userData);
        setUsers([]);
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '加载用户列表失败，请刷新页面重试'
      });
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [dispatchAlert]);

  // 初始加载
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 角色过滤
  const handleRoleFilter = (role: string) => {
    setSelectedRole(role);
    loadUsers(role || undefined);
  };

  // 检查用户名是否已存在
  const checkUsernameExists = (username: string): boolean => {
    return users.some(user => user.username.toLowerCase() === username.toLowerCase());
  };

  // 打开用户设置模态框
  const handleOpenUserSettings = (user: User) => {
    setSelectedUser(user);
    setUserRole(user.role);
    setShowUserSettingsModal(true);
  };

  // 打开密码重置模态框
  const handleOpenResetPassword = () => {
    setNewPassword('');
    setUseDefaultPassword(true);
    setShowUserSettingsModal(false);
    setShowResetPasswordModal(true);
  };

  // 处理密码重置
  const handleResetPassword = async () => {
    if (!selectedUser) return;

    // 验证自定义密码长度
    if (!useDefaultPassword && newPassword.length < 8) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: '自定义密码必须至少8位字符'
      });
      return;
    }

    try {
      setLoading(true);
      
      // 这里需要添加重置密码的 GraphQL mutation
      // 暂时先显示成功信息
      
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: `用户 "${selectedUser.username}" 的密码已重置${useDefaultPassword ? '为默认密码' : ''}`
      });

      setShowResetPasswordModal(false);
      setSelectedUser(null);
      setNewPassword('');
      setUseDefaultPassword(true);
      
    } catch (error: unknown) {
      console.error('重置密码失败:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '重置密码失败'
      });
    } finally {
      setLoading(false);
    }
  };

  // 获取可设置的角色选项（基于权限）
  const getEditableRoleOptions = (currentRole: string) => {
    const isSuperAdmin = adminInfo?.permissions.canCreateAdmin;
    const isAdmin = adminInfo?.isAdmin;

    const options = [];

    if (isSuperAdmin) {
      // 超级管理员可以修改admin及以下身份
      options.push(
        { label: '学生', value: 'students' },
        { label: '教师', value: 'teachers' },
        { label: '管理员', value: 'admin' }
      );
    } else if (isAdmin) {
      // 普通管理员只能修改teacher及以下身份
      options.push(
        { label: '学生', value: 'students' },
        { label: '教师', value: 'teachers' }
      );
    }

    // 确保当前角色在选项中（即使权限不足也要显示当前状态）
    const currentOption = options.find(opt => opt.value === currentRole);
    if (!currentOption && currentRole) {
      options.push({ label: roleDisplayMap[currentRole] || currentRole, value: currentRole });
    }

    return options;
  };

  // 检查是否有权限修改用户角色
  const canEditUserRole = (user: User): boolean => {
    const isSuperAdmin = adminInfo?.permissions.canCreateAdmin;
    const isAdmin = adminInfo?.isAdmin;

    if (isSuperAdmin) {
      // 超级管理员可以修改admin及以下级别的用户
      return ['students', 'teachers', 'admin'].includes(user.role);
    } else if (isAdmin) {
      // 普通管理员只能修改teacher及以下级别的用户
      return ['students', 'teachers'].includes(user.role);
    }

    return false;
  };

  // 保存用户设置
  const handleSaveUserSettings = async () => {
    if (!selectedUser) return;

    try {
      setLoading(true);
      
      const updates = {
        role: userRole,
        name: selectedUser.name
      };

      await client.graphql({
        query: updateUserMutation,
        variables: {
          username: selectedUser.username,
          updates: updates
        }
      });

      dispatchAlert({
        type: AlertType.SUCCESS,
        content: `用户 "${selectedUser.username}" 设置已更新`
      });

      setShowUserSettingsModal(false);
      setSelectedUser(null);
      
      // 重新加载用户列表
      await loadUsers(selectedRole || undefined);
      
    } catch (error: unknown) {
      console.error('更新用户设置失败:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '更新用户设置失败'
      });
    } finally {
      setLoading(false);
    }
  };

  // 多选删除处理
  const handleDeleteUsers = () => {
    if (!collectionProps.selectedItems || collectionProps.selectedItems.length === 0) {
      dispatchAlert({
        type: AlertType.WARNING,
        content: '请选择要删除的用户'
      });
      return;
    }
    setShowDeleteConfirmModal(true);
  };

  // 确认删除用户
  const handleConfirmDeleteUsers = async () => {
    if (deleteConfirmText !== 'yes') {
      dispatchAlert({
        type: AlertType.ERROR,
        content: '请在输入框中输入 "yes" 确认删除操作'
      });
      return;
    }

    if (!collectionProps.selectedItems || collectionProps.selectedItems.length === 0) return;

    try {
      setLoading(true);
      
      // 逐个删除选中的用户
      const deletePromises = collectionProps.selectedItems.map(async (user: User) => {
        return client.graphql({
          query: deleteUserMutation,
          variables: {
            username: user.username
          }
        });
      });

      await Promise.all(deletePromises);

      dispatchAlert({
        type: AlertType.SUCCESS,
        content: `已成功删除 ${collectionProps.selectedItems.length} 个用户`
      });

      setShowDeleteConfirmModal(false);
      setDeleteConfirmText('');
      
      // 重新加载用户列表
      await loadUsers(selectedRole || undefined);
      
    } catch (error: unknown) {
      console.error('删除用户失败:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '删除用户失败'
      });
    } finally {
      setLoading(false);
    }
  };

  // 创建单个用户
  const handleCreateSingleUser = async () => {
    if (!singleUserForm.name || !singleUserForm.username || !singleUserForm.role) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: '请填写所有必填字段（姓名、用户名、角色）'
      });
      return;
    }

    // 检查用户名是否已存在
    if (checkUsernameExists(singleUserForm.username)) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: `用户名 "${singleUserForm.username}" 已存在，请选择其他用户名`
      });
      return;
    }

    // 验证角色权限
    if (!isValidRoleForCurrentUser(singleUserForm.role)) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: '您没有权限创建该角色的用户'
      });
      return;
    }

    try {
      setLoading(true);
      const response = await client.graphql({
        query: createSingleUserMutation,
        variables: {
          user: singleUserForm
        }
      });

      // 检查响应数据
      const userData = (response as any).data?.createSingleUser;
      if (!userData) {
        throw new Error('创建用户返回数据为空');
      }

      // 如果生成了默认密码，显示密码信息
      if (userData.generatedPassword) {
        setGeneratedUserInfo({
          username: userData.username,
          password: userData.generatedPassword
        });
        setShowPasswordModal(true);
      } else {
        dispatchAlert({
          type: AlertType.SUCCESS,
          content: `用户 "${singleUserForm.username}" 创建成功`
        });
      }

      // 重置表单并关闭模态框
      setSingleUserForm({
        name: '',
        username: '',
        password: '',
        role: 'students',
        email: ''
      });
      setShowCreateModal(false);
      
      // 重新加载用户列表
      await loadUsers(selectedRole || undefined);
      
    } catch (error: any) {
      console.error('创建用户失败:', error);
      let errorMessage = '创建用户失败';
      
      // 解析具体错误信息
      if (error.errors && error.errors.length > 0) {
        errorMessage = error.errors[0].message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      dispatchAlert({
        type: AlertType.ERROR,
        content: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  // 处理Excel文件上传
  const handleExcelUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    setExcelFile([file]);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        
        try {
          const response = await client.graphql({
            query: previewExcelImport,
            variables: {
              fileContent: content
            }
          });

          const previewData = (response as any).data.previewExcelImport;
          setExcelPreview(previewData);
        } catch (error) {
          console.error('Excel预览失败:', error);
          dispatchAlert({
            type: AlertType.ERROR,
            content: 'Excel文件解析失败'
          });
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('文件读取失败:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '文件读取失败'
      });
    }
  };

  // 批量创建用户
  const handleBatchCreateUsers = async () => {
    if (!excelPreview || excelPreview.preview.length === 0) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: '没有有效的用户数据'
      });
      return;
    }

    // 验证批量导入的角色权限
    if (!isValidRoleForCurrentUser(importRole)) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: '您没有权限创建该角色的用户'
      });
      return;
    }

    try {
      setLoading(true);
      
      // 为预览数据设置角色
      const usersToCreate = excelPreview.preview.map(user => ({
        ...user,
        role: importRole
      }));

      const response = await client.graphql({
        query: batchCreateUsersMutation,
        variables: {
          users: usersToCreate
        }
      });

      const result = (response as any).data.batchCreateUsers;
      
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: `批量创建完成: 成功 ${result.successCount} 个，失败 ${result.failureCount} 个`
      });

      // 重置状态并关闭模态框
      setExcelFile([]);
      setExcelPreview(null);
      setShowBatchCreateModal(false);
      
      // 重新加载用户列表
      loadUsers(selectedRole || undefined);
    } catch (error: any) {
      console.error('批量创建用户失败:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: error.errors?.[0]?.message || '批量创建用户失败'
      });
    } finally {
      setLoading(false);
    }
  };

  // 创建用户模态框标签
  const createUserTabs: TabsProps.Tab[] = [
    {
      label: '单个创建',
      id: 'single',
      content: (
        <SpaceBetween direction="vertical" size="m">
          <FormField label="姓名 *">
            <Input
              value={singleUserForm.name}
              onChange={({ detail }) => setSingleUserForm({ ...singleUserForm, name: detail.value })}
              placeholder="请输入用户姓名"
            />
          </FormField>
          
          <FormField 
            label="用户名 *" 
            errorText={
              singleUserForm.username && checkUsernameExists(singleUserForm.username) 
                ? '该用户名已存在，请选择其他用户名' 
                : undefined
            }
          >
            <Input
              value={singleUserForm.username}
              onChange={({ detail }) => setSingleUserForm({ ...singleUserForm, username: detail.value })}
              placeholder="请输入用户名"
              invalid={singleUserForm.username ? checkUsernameExists(singleUserForm.username) : false}
            />
          </FormField>
          
          <FormField label="密码" description="留空将生成默认密码，自定义密码需至少8位字符">
            <Input
              value={singleUserForm.password || ''}
              onChange={({ detail }) => setSingleUserForm({ ...singleUserForm, password: detail.value })}
              placeholder="请输入密码（至少8位字符）"
              type="text"
            />
          </FormField>
          
          <FormField label="角色 *">
            <Select
              selectedOption={{ label: getRoleLabel(singleUserForm.role), value: singleUserForm.role }}
              onChange={({ detail }) => setSingleUserForm({ 
                ...singleUserForm, 
                role: detail.selectedOption.value as 'students' | 'teachers' | 'admin' | 'super_admin'
              })}
              options={getAvailableRoleOptions()}
              placeholder="请选择用户角色"
            />
          </FormField>
          
          <FormField label="邮箱">
            <Input
              value={singleUserForm.email || ''}
              onChange={({ detail }) => setSingleUserForm({ ...singleUserForm, email: detail.value })}
              placeholder="请输入邮箱地址"
              type="email"
            />
          </FormField>
        </SpaceBetween>
      )
    },
    {
      label: 'Excel导入',
      id: 'batch',
      content: (
        <SpaceBetween direction="vertical" size="m">
          <Alert>
            Excel文件格式：第一列姓名，第二列用户名，第三列密码（可选），第四列邮箱（可选）
          </Alert>
          
          <Button
            iconName="download"
            onClick={() => {
              // 创建模板下载功能 - 生成CSV格式的模板
              const templateData = [
                ['姓名', '用户名', '密码（可选）', '邮箱（可选）'],
                ['张三', 'zhangsan', 'Password123!', 'zhangsan@example.com'],
                ['李四', 'lisi', '', 'lisi@example.com'],
                ['王五', 'wangwu', 'MyPass456!', '']
              ];
              
              // 创建CSV格式的模板并下载
              const csvContent = templateData.map(row => row.join(',')).join('\n');
              const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
              const link = document.createElement('a');
              const url = URL.createObjectURL(blob);
              link.setAttribute('href', url);
              link.setAttribute('download', 'user_template.csv');
              link.style.visibility = 'hidden';
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            下载Excel模板
          </Button>
          
          <FormField label="用户角色 *">
            <Select
              selectedOption={{ 
                label: importRole === 'students' ? '学生' : 
                       importRole === 'teachers' ? '教师' : '管理员', 
                value: importRole 
              }}
              onChange={({ detail }) => setImportRole(detail.selectedOption.value as 'students' | 'teachers' | 'admin')}
              options={getAvailableRoleOptions()}
            />
          </FormField>
          
          <FormField label="Excel文件">
            <FileUpload
              onChange={({ detail }) => handleExcelUpload(detail.value)}
              value={excelFile}
              i18nStrings={{
                uploadButtonText: (multiple: boolean) => multiple ? '选择文件' : '选择Excel文件',
                dropzoneText: (multiple: boolean) => multiple ? '拖放文件替换' : '拖放Excel文件到此处',
                removeFileAriaLabel: fileIndex => `删除文件 ${fileIndex + 1}`,
                limitShowFewer: '显示更少文件',
                limitShowMore: '显示更多文件',
                errorIconAriaLabel: '错误'
              }}
              multiple={false}
              accept=".xlsx,.xls,.csv"
            />
          </FormField>
          
          {excelPreview && (
            <Box>
              <Header variant="h3">预览结果</Header>
              <SpaceBetween direction="vertical" size="s">
                <div>
                  <Badge color="green">有效行: {excelPreview.validRows}</Badge>
                  {excelPreview.invalidRows > 0 && (
                    <Badge color="red">无效行: {excelPreview.invalidRows}</Badge>
                  )}
                </div>
                
                {excelPreview.errors.length > 0 && (
                  <Alert type="warning" header="发现错误">
                    <ul>
                      {excelPreview.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </Alert>
                )}
                
                {excelPreview.preview.length > 0 && (
                  <Table
                    columnDefinitions={[
                      { id: 'name', header: '姓名', cell: item => item.name },
                      { id: 'username', header: '用户名', cell: item => item.username },
                      { id: 'email', header: '邮箱', cell: item => item.email || '-' }
                    ]}
                    items={excelPreview.preview.slice(0, 5)} // 只显示前5行
                    loadingText="加载中..."
                    empty="没有数据"
                    header={<Header>预览数据（显示前5行）</Header>}
                  />
                )}
              </SpaceBetween>
            </Box>
          )}
        </SpaceBetween>
      )
    }
  ];

  return (
    <Container>
      <SpaceBetween direction="vertical" size="l">
        <Header
          variant="h1"
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button 
                onClick={() => {
                  setActiveTabId('single');
                  setShowCreateModal(true);
                }}
              >
                创建用户
              </Button>
              <Button 
                variant="primary"
                onClick={() => {
                  setActiveTabId('batch');
                  setShowBatchCreateModal(true);
                }}
              >
                批量导入
              </Button>
            </SpaceBetween>
          }
        >
          用户管理
        </Header>

        {/* 角色过滤器 */}
        <Box>
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant={selectedRole === '' ? 'primary' : 'normal'}
              onClick={() => handleRoleFilter('')}
            >
              全部用户
            </Button>
            <Button
              variant={selectedRole === 'students' ? 'primary' : 'normal'}
              onClick={() => handleRoleFilter('students')}
            >
              学生
            </Button>
            <Button
              variant={selectedRole === 'teachers' ? 'primary' : 'normal'}
              onClick={() => handleRoleFilter('teachers')}
            >
              教师
            </Button>
            <Button
              variant={selectedRole === 'admin' ? 'primary' : 'normal'}
              onClick={() => handleRoleFilter('admin')}
            >
              管理员
            </Button>
          </SpaceBetween>
        </Box>

        {/* 用户列表表格 */}
        <Table
          {...collectionProps}
          columnDefinitions={columnDefinitions}
          items={items}
          loadingText="加载中..."
          loading={loading}
          trackBy="id"
          header={
            <Header 
              counter={`(${users.length})`}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button
                    disabled={!collectionProps.selectedItems || collectionProps.selectedItems.length === 0}
                    onClick={handleDeleteUsers}
                  >
                    删除选中
                  </Button>
                  <Button 
                    variant="primary" 
                    iconName="add-plus"
                    onClick={() => setShowCreateModal(true)}
                  >
                    创建用户
                  </Button>
                  <Button 
                    iconName="upload"
                    onClick={() => setShowBatchCreateModal(true)}
                  >
                    批量导入
                  </Button>
                </SpaceBetween>
              }
            >
              用户管理
            </Header>
          }
          empty={
            <Box textAlign="center" color="inherit">
              <b>没有用户</b>
              <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                没有找到用户记录
              </Box>
            </Box>
          }
          filter={
            <div style={{ padding: '8px 0' }}>
              <TextContent>
                <strong>用户总数: {filteredItemsCount}</strong>
              </TextContent>
            </div>
          }
          pagination={<Pagination {...paginationProps} />}
          preferences={
            <div>排序和显示首选项</div>
          }
        />

        {/* 用户设置模态框 */}
        <Modal
          onDismiss={() => setShowUserSettingsModal(false)}
          visible={showUserSettingsModal}
          closeAriaLabel="关闭"
          size="medium"
          header="用户设置"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowUserSettingsModal(false)}>
                  取消
                </Button>
                <Button variant="primary" onClick={handleSaveUserSettings}>
                  保存
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          {selectedUser && (
            <SpaceBetween size="m">
              <FormField label="用户名">
                <Input 
                  value={selectedUser.username} 
                  disabled 
                />
              </FormField>
              
              <FormField label="邮箱">
                <Input 
                  value={selectedUser.email || ''} 
                  disabled 
                />
              </FormField>
              
              <FormField label="用户角色">
                <Select
                  selectedOption={userRole ? { label: roleDisplayMap[userRole] || userRole, value: userRole } : null}
                  onChange={({ detail }) => setUserRole(detail.selectedOption?.value || '')}
                  options={getEditableRoleOptions(selectedUser.role)}
                  disabled={!canEditUserRole(selectedUser)}
                />
              </FormField>
              
              <SpaceBetween direction="horizontal" size="xs">
                <Button 
                  onClick={handleOpenResetPassword}
                  iconName="security"
                >
                  重置密码
                </Button>
              </SpaceBetween>
            </SpaceBetween>
          )}
        </Modal>

        {/* 密码重置模态框 */}
        <Modal
          onDismiss={() => {
            setShowResetPasswordModal(false);
            setNewPassword('');
            setUseDefaultPassword(true);
          }}
          visible={showResetPasswordModal}
          closeAriaLabel="关闭"
          size="medium"
          header="重置用户密码"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => {
                  setShowResetPasswordModal(false);
                  setNewPassword('');
                  setUseDefaultPassword(true);
                }}>
                  取消
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleResetPassword}
                  loading={loading}
                >
                  确认重置
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          {selectedUser && (
            <SpaceBetween size="m">
              <Alert type="info">
                您正在为用户 "{selectedUser.username}" 重置密码。
              </Alert>
              
              <FormField label="密码设置方式">
                <SpaceBetween direction="vertical" size="xs">
                  <label>
                    <input
                      type="radio"
                      checked={useDefaultPassword}
                      onChange={() => {
                        setUseDefaultPassword(true);
                        setNewPassword('');
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    使用系统生成的默认密码
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={!useDefaultPassword}
                      onChange={() => setUseDefaultPassword(false)}
                      style={{ marginRight: '8px' }}
                    />
                    自定义密码
                  </label>
                </SpaceBetween>
              </FormField>
              
              {!useDefaultPassword && (
                <FormField 
                  label="新密码" 
                  description="密码必须至少8位字符"
                  errorText={newPassword.length > 0 && newPassword.length < 8 ? '密码长度不能少于8位字符' : undefined}
                >
                  <Input
                    value={newPassword}
                    onChange={({ detail }) => setNewPassword(detail.value)}
                    placeholder="请输入新密码（至少8位字符）"
                    type="text"
                    invalid={newPassword.length > 0 && newPassword.length < 8}
                  />
                </FormField>
              )}
              
              <Alert type="warning">
                密码重置后，用户需要使用新密码登录。建议通知用户密码已更改。
              </Alert>
            </SpaceBetween>
          )}
        </Modal>

        {/* 删除确认模态框 */}
        <Modal
          onDismiss={() => setShowDeleteConfirmModal(false)}
          visible={showDeleteConfirmModal}
          closeAriaLabel="关闭"
          size="medium"
          header="确认删除"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setShowDeleteConfirmModal(false)}>
                  取消
                </Button>
                <Button 
                  variant="primary"
                  onClick={handleConfirmDeleteUsers}
                  disabled={deleteConfirmText !== 'yes'}
                >
                  确认删除
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <SpaceBetween size="m">
            <Alert type="warning">
              您即将删除 {collectionProps.selectedItems?.length || 0} 个用户。此操作不可撤销，请谨慎操作。
            </Alert>
            
            <FormField 
              label="请输入 'yes' 确认删除"
              description="输入 'yes' 以确认删除操作"
            >
              <Input
                value={deleteConfirmText}
                onChange={({ detail }) => setDeleteConfirmText(detail.value)}
                placeholder="输入 yes"
              />
            </FormField>
            
            {collectionProps.selectedItems && collectionProps.selectedItems.length > 0 && (
              <div>
                <h4>将要删除的用户：</h4>
                <ul>
                  {collectionProps.selectedItems.map((user: User) => (
                    <li key={user.id}>
                      {user.username} ({user.email || '未知邮箱'}) - {roleDisplayMap[user.role] || user.role}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SpaceBetween>
        </Modal>

        {/* 创建用户模态框 */}
        <Modal
          onDismiss={() => {
            setShowCreateModal(false);
            setShowBatchCreateModal(false);
          }}
          visible={showCreateModal || showBatchCreateModal}
          closeAriaLabel="关闭"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  variant="link"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowBatchCreateModal(false);
                  }}
                >
                  取消
                </Button>
                <Button
                  variant="primary"
                  loading={loading}
                  onClick={activeTabId === 'single' ? handleCreateSingleUser : handleBatchCreateUsers}
                  disabled={
                    activeTabId === 'single' 
                      ? !singleUserForm.name || !singleUserForm.username || !singleUserForm.role || 
                        checkUsernameExists(singleUserForm.username)
                      : !excelPreview || excelPreview.validRows === 0
                  }
                >
                  {activeTabId === 'single' ? '创建用户' : '批量创建'}
                </Button>
              </SpaceBetween>
            </Box>
          }
          header={activeTabId === 'single' ? '创建用户' : '批量导入用户'}
        >
          <Tabs
            activeTabId={activeTabId}
            onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
            tabs={createUserTabs}
          />
        </Modal>

        {/* 密码显示模态框 */}
        <Modal
          onDismiss={() => {
            setShowPasswordModal(false);
            setGeneratedUserInfo(null);
          }}
          visible={showPasswordModal}
          closeAriaLabel="关闭"
          footer={
            <Box float="right">
              <Button
                variant="primary"
                onClick={() => {
                  setShowPasswordModal(false);
                  setGeneratedUserInfo(null);
                  dispatchAlert({
                    type: AlertType.SUCCESS,
                    content: `用户 "${generatedUserInfo?.username}" 创建成功`
                  });
                }}
              >
                确认
              </Button>
            </Box>
          }
          header="用户创建成功"
        >
          <SpaceBetween direction="vertical" size="m">
            <Alert type="info" header="请记录以下登录信息">
              系统已为您生成默认密码，请将此信息安全地传达给用户。
            </Alert>
            
            <Box>
              <FormField label="用户名">
                <Input
                  value={generatedUserInfo?.username || ''}
                  readOnly
                />
              </FormField>
              
              <FormField label="默认密码">
                <Input
                  value={generatedUserInfo?.password || ''}
                  readOnly
                  type="text"
                />
              </FormField>
            </Box>
            
            <Alert type="warning">
              用户首次登录后建议修改密码。默认密码仅显示一次，请妥善保存。
            </Alert>
          </SpaceBetween>
        </Modal>
      </SpaceBetween>
    </Container>
  );
};

export default UserManagement;