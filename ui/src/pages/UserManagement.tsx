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
import { batchCreateUsersMutation, createSingleUserMutation } from '../graphql/mutations';
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
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBatchCreateModal, setShowBatchCreateModal] = useState(false);
  const [activeTabId, setActiveTabId] = useState('single');
  
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
  const [importRole, setImportRole] = useState<'students' | 'teachers'>('students');
  
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
      id: 'createdAt',
      header: '创建时间',
      cell: (item: User) => new Date(item.createdAt).toLocaleString('zh-CN'),
      sortingField: 'createdAt'
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
      
      const userData = (response as any).data.listUsers;
      setUsers(userData || []);
    } catch (error) {
      console.error('加载用户列表失败:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '加载用户列表失败'
      });
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

  // 创建单个用户
  const handleCreateSingleUser = async () => {
    if (!singleUserForm.name || !singleUserForm.username) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: '请填写必填字段'
      });
      return;
    }

    try {
      setLoading(true);
      await client.graphql({
        query: createSingleUserMutation,
        variables: {
          user: singleUserForm
        }
      });

      dispatchAlert({
        type: AlertType.SUCCESS,
        content: '用户创建成功'
      });

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
      loadUsers(selectedRole || undefined);
    } catch (error: any) {
      console.error('创建用户失败:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: error.errors?.[0]?.message || '创建用户失败'
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
          
          <FormField label="用户名 *">
            <Input
              value={singleUserForm.username}
              onChange={({ detail }) => setSingleUserForm({ ...singleUserForm, username: detail.value })}
              placeholder="请输入用户名"
            />
          </FormField>
          
          <FormField label="密码" description="留空将生成默认密码">
            <Input
              value={singleUserForm.password || ''}
              onChange={({ detail }) => setSingleUserForm({ ...singleUserForm, password: detail.value })}
              placeholder="请输入密码"
              type="password"
            />
          </FormField>
          
          <FormField label="角色">
            <Select
              selectedOption={{ label: getRoleLabel(singleUserForm.role), value: singleUserForm.role }}
              onChange={({ detail }) => setSingleUserForm({ 
                ...singleUserForm, 
                role: detail.selectedOption.value as 'students' | 'teachers' | 'admin' | 'super_admin'
              })}
              options={getAvailableRoleOptions()}
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
              // 从S3下载实际的Excel模板文件
              const templateUrl = 'https://genassessstack-ragstackne-artifactsuploadbucket58a-vjnqte10ccbn.s3.us-west-2.amazonaws.com/public/template/Template.csv';
              
              // 创建下载链接
              const link = document.createElement('a');
              link.href = templateUrl;
              link.download = 'UserImportTemplate.csv';
              link.target = '_blank'; // 在新窗口打开，避免跨域问题
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            下载Excel模板
          </Button>
          
          <FormField label="用户角色">
            <Select
              selectedOption={{ label: importRole === 'students' ? '学生' : '教师', value: importRole }}
              onChange={({ detail }) => setImportRole(detail.selectedOption.value as 'students' | 'teachers')}
              options={[
                { label: '学生', value: 'students' },
                { label: '教师', value: 'teachers' }
              ]}
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
                      ? !singleUserForm.name || !singleUserForm.username
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
      </SpaceBetween>
    </Container>
  );
};

export default UserManagement;