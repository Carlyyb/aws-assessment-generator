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
  ColumnLayout,
  Spinner
} from '@cloudscape-design/components';
import { generateClient } from 'aws-amplify/api';
import { uploadData, list, remove } from 'aws-amplify/storage';
import { getKnowledgeBase, getIngestionJob } from '../graphql/queries';
import { createKnowledgeBase } from '../graphql/mutations';
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
  
  // 创建知识库相关状态
  const [isCreating, setIsCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState(0);
  const [createLogs, setCreateLogs] = useState<string[]>([]);
  const [currentCreateStep, setCurrentCreateStep] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // 添加创建日志函数
  const addCreateLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setCreateLogs(prev => [...prev, logMessage]);
    console.log(logMessage);
  };

  // 更新创建步骤和进度
  const updateCreateStep = (step: string, progressValue: number) => {
    setCurrentCreateStep(step);
    setCreateProgress(progressValue);
    addCreateLog(step);
  };

  // 等待处理完成
  const waitForIngestion = async (knowledgeBaseId: string, dataSourceId: string, ingestionJobId: string) => {
    let jobStatus = '';
    let attempts = 0;
    const maxAttempts = 60; // 最多等待5分钟（60 * 5秒）

    do {
      try {
        addCreateLog(getText('teachers.settings.knowledge_base_manager.creation_process.checking_status').replace('{attempt}', (attempts + 1).toString()));
        
        const response = await client.graphql<any>({
          query: getIngestionJob,
          variables: { 
            input: { 
              knowledgeBaseId, 
              dataSourceId, 
              ingestionJobId 
            } 
          },
        });
        
        jobStatus = response.data.getIngestionJob.status;
        addCreateLog(getText('teachers.settings.knowledge_base_manager.creation_process.current_status').replace('{status}', jobStatus));
        
        if (jobStatus === 'COMPLETE') {
          addCreateLog(getText('teachers.settings.knowledge_base_manager.creation_process.processing_complete'));
          break;
        }
        
        if (jobStatus === 'FAILED') {
          throw new Error(getText('teachers.settings.knowledge_base_manager.creation_process.processing_failed'));
        }
        
        // 更新进度
        const progress = Math.min(70 + (attempts * 0.5), 95);
        setCreateProgress(progress);
        
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error(getText('teachers.settings.knowledge_base_manager.creation_process.processing_timeout'));
        }
        
        await new Promise((resolve) => setTimeout(resolve, 5000)); // 等待5秒
      } catch (error) {
        addCreateLog(getText('teachers.settings.knowledge_base_manager.creation_process.status_check_error').replace('{error}', String(error)));
        throw error;
      }
    } while (jobStatus !== 'COMPLETE' && attempts < maxAttempts);
  };

  // 创建知识库
  const handleCreateKnowledgeBase = async () => {
    if (!files.length) {
      dispatchAlert({
        type: AlertType.ERROR,
        content: getText('teachers.settings.knowledge_base_manager.alerts.select_files_first')
      });
      return;
    }

    setIsCreating(true);
    setCreateProgress(0);
    setCreateLogs([]);
    setShowCreateModal(true);

    try {
      updateCreateStep(getText('teachers.settings.knowledge_base_manager.creation_process.starting'), 10);

      // 1. 准备文件上传
      updateCreateStep(getText('teachers.settings.knowledge_base_manager.creation_process.preparing_files'), 20);
      const fileData = files.map((file) => ({
        key: `KnowledgeBases/${userProfile?.userId}/${courseId}/${file.name}`,
        file,
      }));

      addCreateLog(getText('teachers.settings.knowledge_base_manager.creation_process.preparing_upload').replace('{count}', files.length.toString()));

      // 2. 上传文件到S3
      updateCreateStep(getText('teachers.settings.knowledge_base_manager.creation_process.uploading_to_cloud'), 30);
      await Promise.all(
        fileData.map(({ key, file }, index) => {
          addCreateLog(getText('teachers.settings.knowledge_base_manager.creation_process.uploading_file')
            .replace('{current}', (index + 1).toString())
            .replace('{total}', files.length.toString())
            .replace('{filename}', file.name));
          return uploadData({
            key,
            data: file,
          }).result;
        })
      );

      updateCreateStep(getText('teachers.settings.knowledge_base_manager.creation_process.upload_complete'), 50);
      addCreateLog(getText('teachers.settings.knowledge_base_manager.creation_process.all_files_uploaded'));

      // 3. 创建知识库
      updateCreateStep(getText('teachers.settings.knowledge_base_manager.creation_process.creating_kb'), 60);
      addCreateLog(getText('teachers.settings.knowledge_base_manager.creation_process.calling_api'));

      const response = await client.graphql<any>({
        query: createKnowledgeBase,
        variables: {
          courseId: courseId,
          locations: fileData.map(({ key }) => key),
        },
      });

      const result = response.data.createKnowledgeBase;
      addCreateLog(getText('teachers.settings.knowledge_base_manager.creation_process.request_submitted').replace('{jobId}', result.ingestionJobId));

      // 4. 等待知识库创建完成
      updateCreateStep(getText('teachers.settings.knowledge_base_manager.creation_process.processing_kb'), 70);
      await waitForIngestion(result.knowledgeBaseId, result.dataSourceId, result.ingestionJobId);

      updateCreateStep(getText('teachers.settings.knowledge_base_manager.creation_process.kb_complete'), 100);
      addCreateLog(getText('teachers.settings.knowledge_base_manager.create.success'));

      dispatchAlert({
        type: AlertType.SUCCESS,
        content: getText('teachers.settings.knowledge_base_manager.create.success')
      });

      setFiles([]);
      await loadKnowledgeBase();

      setTimeout(() => {
        setShowCreateModal(false);
        setIsCreating(false);
      }, 2000);

    } catch (error: any) {
      const errorMessage = error.message || getText('common.status.error');
      addCreateLog(getText('teachers.settings.knowledge_base_manager.creation_process.creation_failed_error').replace('{error}', errorMessage));
      updateCreateStep(getText('teachers.settings.knowledge_base_manager.creation_process.kb_failed'), 0);
      
      dispatchAlert({
        type: AlertType.ERROR,
        content: `${getText('teachers.settings.knowledge_base_manager.errors.create_failed')}: ${errorMessage}`
      });
      
      setIsCreating(false);
    }
  };

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
      dispatchAlert({
        type: AlertType.SUCCESS,
        content: getText('teachers.settings.knowledge_base_manager.alerts.upload_new_docs_processing')
      });
      
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
    if (!bytes) return getText('teachers.settings.knowledge_base_manager.files_table.unknown_size');
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
        return <StatusIndicator type="success">{getText('teachers.settings.knowledge_base_manager.kb_status.ready')}</StatusIndicator>;
      case 'in_progress':
      case 'running':
        return <StatusIndicator type="in-progress">{getText('teachers.settings.knowledge_base_manager.kb_status.processing')}</StatusIndicator>;
      case 'failed':
      case 'error':
        return <StatusIndicator type="error">{getText('teachers.settings.knowledge_base_manager.kb_status.failed')}</StatusIndicator>;
      default:
        return <StatusIndicator type="pending">{getText('teachers.settings.knowledge_base_manager.kb_status.unknown')}</StatusIndicator>;
    }
  };

  useEffect(() => {
    if (visible) {
      loadKnowledgeBase();
    }
  }, [visible, courseId]);

  return (
    <>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        header={`${courseName} - ${getText('teachers.settings.knowledge_base_manager.title')}`}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={onDismiss}>
                {getText('teachers.settings.knowledge_base_manager.modal.close')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          {loading ? (
            <Box textAlign="center">
              <StatusIndicator type="loading">{getText('common.status.loading')}</StatusIndicator>
            </Box>
          ) : !knowledgeBase ? (
            <Alert
              type="warning"
              header={getText('teachers.settings.knowledge_base_manager.alerts.not_created')}
              action={
                <Button
                  onClick={() => {
                    if (files.length === 0) {
                      dispatchAlert({
                        type: AlertType.ERROR,
                        content: getText('teachers.settings.knowledge_base_manager.alerts.select_files_first')
                      });
                      return;
                    }
                    handleCreateKnowledgeBase();
                  }}
                  disabled={isCreating}
                  loading={isCreating}
                >
                  {isCreating ? getText('teachers.settings.knowledge_base_manager.status.creating') : getText('teachers.settings.knowledge_base_manager.create.confirm')}
                </Button>
              }
            >
              {getText('teachers.settings.knowledge_base_manager.alerts.create_kb_description')}
              
              {/* 文件选择区域 */}
              <Box margin={{ top: 'm' }}>
                <FormField
                  label={getText('teachers.settings.knowledge_base_manager.file_selection.select_course_files')}
                  description={getText('teachers.settings.knowledge_base_manager.file_selection.supported_formats_description')}
                >
                  <FileUpload
                    multiple
                    value={files}
                    onChange={({ detail }) => setFiles(detail.value)}
                    accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx"
                    i18nStrings={{
                      uploadButtonText: (e) => (e ? getText('teachers.settings.knowledge_base_manager.file_selection.select_multiple_files') : getText('teachers.settings.knowledge_base_manager.file_selection.select_files')),
                      dropzoneText: (e) => (e ? getText('teachers.settings.knowledge_base_manager.file_selection.drop_multiple_files') : getText('teachers.settings.knowledge_base_manager.file_selection.drop_files_here')),
                      removeFileAriaLabel: (e) => `${getText('teachers.settings.knowledge_base_manager.file_selection.remove_file')} ${e + 1}`,
                      limitShowFewer: getText('teachers.settings.knowledge_base_manager.file_selection.show_fewer'),
                      limitShowMore: getText('teachers.settings.knowledge_base_manager.file_selection.show_more'),
                      errorIconAriaLabel: getText('teachers.settings.knowledge_base_manager.file_selection.error_icon'),
                    }}
                    showFileLastModified
                    showFileSize
                    showFileThumbnail
                  />
                </FormField>
              </Box>
            </Alert>
          ) : (
            <>
              {/* 知识库状态 */}
              <Container header={<Header variant="h2">{getText('teachers.settings.knowledge_base_manager.kb_status.status')}</Header>}>
                <ColumnLayout columns={3}>
                  <div>
                    <Box variant="awsui-key-label">{getText('teachers.settings.knowledge_base_manager.kb_status.kb_id')}</Box>
                    <Box>{knowledgeBase.knowledgeBaseId}</Box>
                  </div>
                  <div>
                    <Box variant="awsui-key-label">{getText('teachers.settings.knowledge_base_manager.kb_status.status')}</Box>
                    {getStatusIndicator(knowledgeBase.status)}
                  </div>
                  <div>
                    <Box variant="awsui-key-label">{getText('teachers.settings.knowledge_base_manager.kb_status.file_count')}</Box>
                    <Box>{getText('teachers.settings.knowledge_base_manager.kb_status.files_count').replace('{count}', uploadedFiles.length.toString())}</Box>
                  </div>
                </ColumnLayout>
              </Container>

              {/* 文件上传 */}
              <Container header={<Header variant="h2">{getText('teachers.settings.knowledge_base_manager.upload_section.upload_new_files')}</Header>}>
                <Form>
                  <SpaceBetween size="m">
                    <FormField
                      label={getText('teachers.settings.knowledge_base_manager.file_selection.select_files')}
                      description={getText('teachers.settings.knowledge_base_manager.file_selection.supported_formats_description')}
                    >
                      <FileUpload
                        multiple
                        value={files}
                        onChange={({ detail }) => setFiles(detail.value)}
                        accept=".pdf,.doc,.docx,.txt,.md,.ppt,.pptx"
                        i18nStrings={{
                          uploadButtonText: (e) => (e ? getText('teachers.settings.knowledge_base_manager.file_selection.select_multiple_files') : getText('teachers.settings.knowledge_base_manager.file_selection.select_files')),
                          dropzoneText: (e) => (e ? getText('teachers.settings.knowledge_base_manager.file_selection.drop_multiple_files') : getText('teachers.settings.knowledge_base_manager.file_selection.drop_files_here')),
                          removeFileAriaLabel: (e) => `${getText('teachers.settings.knowledge_base_manager.file_selection.remove_file')} ${e + 1}`,
                          limitShowFewer: getText('teachers.settings.knowledge_base_manager.file_selection.show_fewer'),
                          limitShowMore: getText('teachers.settings.knowledge_base_manager.file_selection.show_more'),
                          errorIconAriaLabel: getText('teachers.settings.knowledge_base_manager.file_selection.error_icon'),
                        }}
                        showFileLastModified
                        showFileSize
                        showFileThumbnail
                      />
                    </FormField>
                    
                    {isUploading && (
                      <ProgressBar
                        value={uploadProgress}
                        additionalInfo={getText('teachers.settings.knowledge_base_manager.upload_section.upload_progress').replace('{progress}', uploadProgress.toFixed(1))}
                        description={getText('teachers.settings.knowledge_base_manager.upload_section.uploading_files')}
                      />
                    )}
                    
                    <Button
                      variant="primary"
                      onClick={handleFileUpload}
                      disabled={!files.length || isUploading}
                      loading={isUploading}
                    >
                      {isUploading ? getText('teachers.settings.knowledge_base_manager.upload_section.uploading') : getText('teachers.settings.knowledge_base_manager.upload_section.upload_files')}
                    </Button>
                  </SpaceBetween>
                </Form>
              </Container>

              {/* 已上传文件列表 */}
              <Container header={<Header variant="h2">{getText('teachers.settings.knowledge_base_manager.files_table.uploaded_files')}</Header>}>
                <Table
                  columnDefinitions={[
                    {
                      id: 'name',
                      header: getText('teachers.settings.knowledge_base_manager.files_table.filename'),
                      cell: (item) => getFileName(item.key),
                      sortingField: 'name'
                    },
                    {
                      id: 'size',
                      header: getText('teachers.settings.knowledge_base_manager.files_table.size'),
                      cell: (item) => formatFileSize(item.size)
                    },
                    {
                      id: 'lastModified',
                      header: getText('teachers.settings.knowledge_base_manager.files_table.upload_time'),
                      cell: (item) => item.lastModified?.toLocaleString() || getText('teachers.settings.knowledge_base_manager.files_table.unknown_time')
                    },
                    {
                      id: 'actions',
                      header: getText('teachers.settings.knowledge_base_manager.files_table.actions'),
                      cell: (item) => (
                        <Button
                          variant="link"
                          iconName="remove"
                          onClick={() => {
                            setFileToDelete(item.key);
                            setShowDeleteModal(true);
                          }}
                        >
                          {getText('common.actions.delete')}
                        </Button>
                      )
                    }
                  ]}
                  items={uploadedFiles}
                  loadingText={getText('common.status.loading')}
                  trackBy="key"
                  empty={
                    <Box textAlign="center" color="inherit">
                      <b>{getText('teachers.settings.knowledge_base_manager.files_table.no_files')}</b>
                      <Box variant="p" color="inherit">
                        {getText('teachers.settings.knowledge_base_manager.files_table.upload_materials')}
                      </Box>
                    </Box>
                  }
                />
              </Container>

              {/* 处理任务状态 */}
              {ingestionJobs.length > 0 && (
                <Container header={<Header variant="h2">{getText('teachers.settings.knowledge_base_manager.ingestion_jobs.document_processing_status')}</Header>}>
                  <Table
                    columnDefinitions={[
                      {
                        id: 'jobId',
                        header: getText('teachers.settings.knowledge_base_manager.ingestion_jobs.job_id'),
                        cell: (item) => item.ingestionJobId
                      },
                      {
                        id: 'status',
                        header: getText('teachers.settings.knowledge_base_manager.kb_status.status'),
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
      </Modal>

      {/* 创建知识库进度对话框 */}
      <Modal 
        visible={showCreateModal} 
        onDismiss={() => {
          if (!isCreating) {
            setShowCreateModal(false);
            setCreateLogs([]);
            setCreateProgress(0);
            setCurrentCreateStep('');
          }
        }}
        header={<Header>{getText('teachers.settings.knowledge_base_manager.create.title')}</Header>}
        size="large"
      >
        <SpaceBetween size="l">
          {/* 进度条 */}
          <Box>
            <ProgressBar
              value={createProgress}
              additionalInfo={getText('teachers.settings.knowledge_base_manager.progress.completed_percentage').replace('{progress}', createProgress.toString())}
              description={currentCreateStep || getText('teachers.settings.knowledge_base_manager.progress.preparing')}
            />
          </Box>
          
          {/* 当前步骤显示 */}
          {currentCreateStep && (
            <Alert statusIconAriaLabel="Info" header={getText('teachers.settings.knowledge_base_manager.progress.preparing')}>
              {currentCreateStep}
            </Alert>
          )}
          
          {/* 实时日志 */}
          <Box>
            <Header variant="h3">{getText('teachers.settings.knowledge_base_manager.progress.creation_logs')}</Header>
            <div
              style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px',
                maxHeight: '300px',
                overflowY: 'auto',
                padding: '16px',
              }}
            >
              {createLogs.length > 0 ? (
                <div>
                  {createLogs.map((log, index) => (
                    <div key={index} style={{ marginBottom: '4px' }}>
                      {log}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#6c757d' }}>{getText('teachers.settings.knowledge_base_manager.progress.waiting')}</div>
              )}
            </div>
          </Box>
          
          {/* 加载指示器 */}
          {isCreating && (
            <SpaceBetween direction="horizontal" size="s" alignItems="center">
              <Spinner size="big" />
              <Box textAlign="center">
                <strong>{getText('teachers.settings.knowledge_base_manager.progress.creating')}</strong>
                <br />
                <small>{getText('teachers.settings.knowledge_base_manager.progress.please_wait')}</small>
              </Box>
            </SpaceBetween>
          )}
          
          {/* 按钮 */}
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              {isCreating ? (
                <Button 
                  variant="link" 
                  onClick={() => {
                    if (window.confirm(getText('teachers.settings.knowledge_base_manager.creation_process.confirm_cancel'))) {
                      setIsCreating(false);
                      setShowCreateModal(false);
                      setCreateLogs([]);
                      setCreateProgress(0);
                      setCurrentCreateStep('');
                    }
                  }}
                  disabled={createProgress === 100}
                >
                  {getText('teachers.settings.knowledge_base_manager.creation_process.cancel_creation')}
                </Button>
              ) : (
                <Button 
                  variant="link" 
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateLogs([]);
                    setCreateProgress(0);
                    setCurrentCreateStep('');
                  }}
                >
                  {getText('teachers.settings.knowledge_base_manager.modal.close')}
                </Button>
              )}
            </SpaceBetween>
          </Box>
        </SpaceBetween>
      </Modal>

      {/* 删除确认对话框 */}
      <Modal
        visible={showDeleteModal}
        onDismiss={() => setShowDeleteModal(false)}
        header={getText('teachers.settings.knowledge_base_manager.modal.confirm_delete')}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setShowDeleteModal(false)}>
                {getText('teachers.settings.knowledge_base_manager.modal.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => handleDeleteFile(fileToDelete)}
              >
                {getText('common.actions.delete')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <p>{getText('teachers.settings.knowledge_base_manager.modal.delete_file_warning').replace('{filename}', getFileName(fileToDelete))}</p>
      </Modal>
    </>
  );
}
