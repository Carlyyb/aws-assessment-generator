import { useState, useEffect, useContext } from 'react';
import {
  Box,
  Button,
  SpaceBetween,
  Alert,
  Modal,
  Header,
  Container,
  StatusIndicator,
  ProgressBar,
  Table,
  FileUpload,
  Form,
  FormField,
  ColumnLayout
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { uploadData, list, remove } from 'aws-amplify/storage';
import { getKnowledgeBase, getIngestionJob } from '../graphql/queries';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { getText } from '../i18n/lang';
import { UserProfileContext } from '../contexts/userProfile';

const client = generateClient();

interface KnowledgeBaseManagerProps {
  courseId: string;
  courseName: string;
  visible: boolean;
  onDismiss: () => void;
}

interface FileItem {
  key: string;
  size?: number;
  lastModified?: Date;
}

interface IngestionJob {
  ingestionJobId: string;
  status: string;
  knowledgeBaseId: string;
  dataSourceId: string;
}

export default function KnowledgeBaseManager({ 
  courseId, 
  courseName, 
  visible, 
  onDismiss 
}: KnowledgeBaseManagerProps) {
  const dispatchAlert = useContext(DispatchAlertContext);
  const userProfile = useContext(UserProfileContext);
  
  // 状态管理
  const [knowledgeBase, setKnowledgeBase] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [ingestionJobs, setIngestionJobs] = useState<IngestionJob[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<string>('');

  // 加载知识库信息
  const loadKnowledgeBase = async () => {
    setLoading(true);
    try {
      const response = await client.graphql<any>({
        query: getKnowledgeBase,
        variables: { courseId }
      });
      
      const kb = (response as any).data?.getKnowledgeBase;
      setKnowledgeBase(kb);
      
      if (kb?.knowledgeBaseId) {
        await loadUploadedFiles();
        await loadIngestionJobs();
      }
    } catch (error) {
      console.error('Error loading knowledge base:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载已上传的文件
  const loadUploadedFiles = async () => {
    if (!userProfile?.userId || !knowledgeBase?.s3prefix) return;
    
    try {
      const result = await list({
        prefix: knowledgeBase.s3prefix,
      });
      
      const fileItems = result.items?.map(item => ({
        key: item.key!,
        size: item.size,
        lastModified: item.lastModified,
      })) || [];
      
      setUploadedFiles(fileItems);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  // 加载处理任务
  const loadIngestionJobs = async () => {
    if (!knowledgeBase?.knowledgeBaseId) return;
    
    try {
      const response = await client.graphql<any>({
        query: getIngestionJob,
        variables: {
          input: {
            knowledgeBaseId: knowledgeBase.knowledgeBaseId,
            dataSourceId: knowledgeBase.kbDataSourceId
          }
        }
      });
      
      const job = (response as any).data?.getIngestionJob;
      if (job) {
        setIngestionJobs([job]);
      }
    } catch (error) {
      console.error('Error loading ingestion jobs:', error);
    }
  };

  // 上传文件
  const handleFileUpload = async () => {
    if (!files.length || !userProfile?.userId || !knowledgeBase?.s3prefix) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const totalFiles = files.length;
      const uploadPromises = files.map(async (file, index) => {
        const key = `${knowledgeBase.s3prefix}${file.name}`;
        
        const result = await uploadData({
          key,
          data: file,
          options: {
            onProgress: ({ transferredBytes, totalBytes }) => {
              const fileProgress = totalBytes ? (transferredBytes / totalBytes) * 100 : 0;
              const overallProgress = ((index + fileProgress / 100) / totalFiles) * 100;
              setUploadProgress(overallProgress);
            }
          }
        }).result;
        
        return result;
      });
      
      await Promise.all(uploadPromises);
      
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: getText('teachers.settings.knowledge_base_manager.upload.success').replace('{count}', files.length.toString())
      });
      
      setFiles([]);
      await loadUploadedFiles();
      await triggerIngestion();
      
    } catch (error) {
      console.error('Upload error:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: getText('teachers.settings.knowledge_base_manager.errors.upload_failed')
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // 触发文档处理
  const triggerIngestion = async () => {
    if (!knowledgeBase?.knowledgeBaseId) return;
    
    try {
      // 这里需要调用触发ingestion的API
      // 可能需要在后端添加相应的resolver
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: '正在处理新上传的文档，这可能需要几分钟时间'
      });
      
      // 定期检查处理状态
      setTimeout(() => {
        loadIngestionJobs();
      }, 5000);
      
    } catch (error) {
      console.error('Error triggering ingestion:', error);
    }
  };

  // 删除文件
  const handleDeleteFile = async (fileKey: string) => {
    try {
      await remove({ key: fileKey });
      
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: getText('teachers.settings.knowledge_base_manager.documents.delete_success')
      });
      
      await loadUploadedFiles();
      setShowDeleteModal(false);
      setFileToDelete('');
      
    } catch (error) {
      console.error('Delete error:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: getText('teachers.settings.knowledge_base_manager.errors.delete_failed')
      });
    }
  };

  // 获取文件名
  const getFileName = (key: string) => {
    return key.split('/').pop() || key;
  };

  // 格式化文件大小
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // 获取状态指示器
  const getStatusIndicator = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'complete':
      case 'completed':
        return <StatusIndicator type="success">就绪</StatusIndicator>;
      case 'in_progress':
      case 'running':
        return <StatusIndicator type="in-progress">处理中</StatusIndicator>;
      case 'failed':
      case 'error':
        return <StatusIndicator type="error">失败</StatusIndicator>;
      default:
        return <StatusIndicator type="pending">未知</StatusIndicator>;
    }
  };

  useEffect(() => {
    if (visible) {
      loadKnowledgeBase();
    }
  }, [visible, courseId]);

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      header={`${courseName} - 知识库管理`}
      size="large"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              关闭
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        {loading ? (
          <Box textAlign="center">
            <StatusIndicator type="loading">加载中...</StatusIndicator>
          </Box>
        ) : !knowledgeBase ? (
          <Alert
            type="warning"
            header="知识库未创建"
            action={
              <Button
                onClick={() => {
                  // 这里需要调用创建知识库的API
                  dispatchAlert({
                    type: AlertType.SUCCESS,
                    content: '创建知识库功能需要后端支持'
                  });
                }}
              >
                创建知识库
              </Button>
            }
          >
            该课程还没有关联的知识库。创建知识库后，您可以上传课程材料用于生成测试。
          </Alert>
        ) : (
          <>
            {/* 知识库状态 */}
            <Container header={<Header variant="h2">知识库状态</Header>}>
              <ColumnLayout columns={3}>
                <div>
                  <Box variant="awsui-key-label">知识库ID</Box>
                  <Box>{knowledgeBase.knowledgeBaseId}</Box>
                </div>
                <div>
                  <Box variant="awsui-key-label">状态</Box>
                  {getStatusIndicator(knowledgeBase.status)}
                </div>
                <div>
                  <Box variant="awsui-key-label">文件数量</Box>
                  <Box>{uploadedFiles.length} 个文件</Box>
                </div>
              </ColumnLayout>
            </Container>

            {/* 文件上传 */}
            <Container header={<Header variant="h2">上传新文件</Header>}>
              <Form>
                <SpaceBetween size="m">
                  <FormField
                    label="选择文件"
                    description="支持PDF、DOC、DOCX、TXT、MD等格式的课程材料"
                  >
                    <FileUpload
                      multiple
                      value={files}
                      onChange={({ detail }) => setFiles(detail.value)}
                      accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx"
                      i18nStrings={{
                        uploadButtonText: (e) => (e ? '选择多个文件' : '选择文件'),
                        dropzoneText: (e) => (e ? '拖拽多个文件到此处' : '拖拽文件到此处'),
                        removeFileAriaLabel: (e) => `删除文件 ${e + 1}`,
                        limitShowFewer: '显示更少',
                        limitShowMore: '显示更多',
                        errorIconAriaLabel: '错误',
                      }}
                      showFileLastModified
                      showFileSize
                      showFileThumbnail
                    />
                  </FormField>
                  
                  {isUploading && (
                    <ProgressBar
                      value={uploadProgress}
                      additionalInfo={`${uploadProgress.toFixed(1)}% 完成`}
                      description="正在上传文件..."
                    />
                  )}
                  
                  <Button
                    variant="primary"
                    onClick={handleFileUpload}
                    disabled={!files.length || isUploading}
                    loading={isUploading}
                  >
                    {isUploading ? '上传中...' : '上传文件'}
                  </Button>
                </SpaceBetween>
              </Form>
            </Container>

            {/* 已上传文件列表 */}
            <Container header={<Header variant="h2">已上传文件</Header>}>
              <Table
                columnDefinitions={[
                  {
                    id: 'name',
                    header: '文件名',
                    cell: (item) => getFileName(item.key),
                    sortingField: 'name'
                  },
                  {
                    id: 'size',
                    header: '大小',
                    cell: (item) => formatFileSize(item.size)
                  },
                  {
                    id: 'lastModified',
                    header: '上传时间',
                    cell: (item) => item.lastModified?.toLocaleString() || '未知'
                  },
                  {
                    id: 'actions',
                    header: '操作',
                    cell: (item) => (
                      <Button
                        variant="link"
                        iconName="remove"
                        onClick={() => {
                          setFileToDelete(item.key);
                          setShowDeleteModal(true);
                        }}
                      >
                        删除
                      </Button>
                    )
                  }
                ]}
                items={uploadedFiles}
                loadingText="加载中..."
                trackBy="key"
                empty={
                  <Box textAlign="center" color="inherit">
                    <b>暂无文件</b>
                    <Box variant="p" color="inherit">
                      上传课程材料以开始使用知识库功能
                    </Box>
                  </Box>
                }
              />
            </Container>

            {/* 处理任务状态 */}
            {ingestionJobs.length > 0 && (
              <Container header={<Header variant="h2">文档处理状态</Header>}>
                <Table
                  columnDefinitions={[
                    {
                      id: 'jobId',
                      header: '任务ID',
                      cell: (item) => item.ingestionJobId
                    },
                    {
                      id: 'status',
                      header: '状态',
                      cell: (item) => getStatusIndicator(item.status)
                    }
                  ]}
                  items={ingestionJobs}
                  trackBy="ingestionJobId"
                />
              </Container>
            )}
          </>
        )}
      </SpaceBetween>

      {/* 删除确认对话框 */}
      <Modal
        visible={showDeleteModal}
        onDismiss={() => setShowDeleteModal(false)}
        header="确认删除"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowDeleteModal(false)}>
                取消
              </Button>
              <Button
                variant="primary"
                onClick={() => handleDeleteFile(fileToDelete)}
              >
                删除
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <p>确定要删除文件 "{getFileName(fileToDelete)}" 吗？此操作不可撤销。</p>
      </Modal>
    </Modal>
  );
}
