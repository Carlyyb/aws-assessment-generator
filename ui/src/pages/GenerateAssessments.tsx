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
  Multiselect,
  SelectProps,
  Checkbox,
  FileUpload,
  Input,
  DatePicker,
  Spinner,
  Modal,
  ProgressBar,
  Alert,
} from '@cloudscape-design/components';
import { uploadData } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/api';
import { useNavigate } from 'react-router-dom';
import { generateAssessment, listCourses, getAssessment, listAssessTemplates, getKnowledgeBase } from '../graphql/queries';
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
  // CHANGELOG 2025-08-15 by 邱语堂: 课程选择由单选改为多选
  const [selectedCourses, setSelectedCourses] = useState<SelectProps.Option[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [assessId, setAssessId] = useState('');
  const [assessTemplates, setAssessTemplates] = useState<SelectProps.Option[]>([]);
  const [assessTemplate, setAssessTemplate] = useState<SelectProps.Option | null>(null);
  // 单课程状态（兼容旧逻辑）
  const [knowledgeBaseStatus, setKnowledgeBaseStatus] = useState<'checking' | 'available' | 'missing' | null>(null);
  // 批量课程知识库状态
  const [knowledgeBaseStatusMap, setKnowledgeBaseStatusMap] = useState<Record<string, 'checking' | 'available' | 'missing'>>({});
  
  // 进度和日志状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [_statusCheckCount, setStatusCheckCount] = useState(0);
  const [_failureCount, setFailureCount] = useState(0);

  // 添加日志函数
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev, logMessage]);
    console.log(logMessage); // 同时输出到控制台
  };

  // 更新步骤和进度
  const updateStep = (step: string, progressValue: number) => {
    setCurrentStep(step);
    setProgress(progressValue);
    addLog(step);
  };

  // 检查知识库状态
  const checkKnowledgeBaseStatus = async (courseId: string) => {
    if (!courseId) return;
    // 批量状态：先置为 checking
    setKnowledgeBaseStatusMap(prev => ({ ...prev, [courseId]: 'checking' }));
    try {
      const kbResponse = await client.graphql<any>({
        query: getKnowledgeBase,
        variables: { courseId }
      });
      const knowledgeBase = kbResponse.data.getKnowledgeBase;
      setKnowledgeBaseStatusMap(prev => ({
        ...prev,
        [courseId]: knowledgeBase && knowledgeBase.knowledgeBaseId ? 'available' : 'missing',
      }));
    } catch (error) {
      setKnowledgeBaseStatusMap(prev => ({ ...prev, [courseId]: 'missing' }));
    }
  };

  // 当课程改变时检查知识库状态
  // CHANGELOG 2025-08-15 by 邱语堂: 批量为每个课程检查知识库
  useEffect(() => {
    if (selectedCourses.length > 0) {
      // 批量检查每个课程的知识库状态
      selectedCourses.forEach((course: SelectProps.Option) => {
        checkKnowledgeBaseStatus(course.value as string);
      });
    } else {
      setKnowledgeBaseStatus(null);
      setKnowledgeBaseStatusMap({});
    }
  }, [selectedCourses]);

  useEffect(() => {
    client.graphql<any>({ query: listAssessTemplates }).then(({ data, errors }) => {
      if (errors && errors.length > 0) {
        console.warn('GraphQL errors:', errors);
      }
      
      const list = data?.listAssessTemplates;
      if (!list) return;
      
      // 过滤掉无效的模板记录
      const validList = list.filter((assessTemplate: AssessTemplate) => {
        return assessTemplate && assessTemplate.id && assessTemplate.name;
      });
      
      const options = validList.map((assessTemplate: AssessTemplate) => ({ 
        label: assessTemplate.name, 
        value: assessTemplate.id 
      }));
      setAssessTemplates(options);
    }).catch((error) => {
      console.error('Error fetching templates:', error);
    });
  }, []);

  function checkStatus() {
    setTimeout(() => {
      setStatusCheckCount(prev => {
        const newCheckCount = prev + 1;
        
        addLog(`检查生成状态... (第 ${newCheckCount} 次)`);
        
        client.graphql<any>({ query: getAssessment, variables: { id: assessId } }).then(({ data }) => {
          const assessment = data.getAssessment;
          const { status } = assessment;
          
          addLog(`当前状态: ${status}`);
          
          if (status === AssessStatus.CREATED) {
            updateStep('✅ 测试生成完成！正在跳转到编辑页面...', 100);
            setIsGenerating(false);
            setFailureCount(0); // 重置失败计数
            dispatchAlert({ type: AlertType.SUCCESS, content: getText('pages.generate_assessments.generate_success') });
            setTimeout(() => {
              navigate(`/edit-assessment/${assessId}`);
            }, 1000);
            return;
          }
          
          // 处理失败状态
          if (status === AssessStatus.FAILED) {
            addLog('❌ 测试生成失败');
            updateStep('❌ 测试生成失败', 0);
            setIsGenerating(false);
            setFailureCount(0); // 重置失败计数
            
            // 提供详细的错误信息和建议
            const errorMessage = '测试生成失败。可能的原因：\n' +
              '1. 未上传课程文件 - 请确保上传了相关的课程材料\n' +
              '2. 知识库未创建 - 请先为该课程创建知识库\n' +
              '3. Bedrock服务问题 - 请稍后重试\n\n' +
              '建议：请确保已上传课程文件并等待知识库创建完成后再试';
            
            dispatchAlert({ 
              type: AlertType.ERROR, 
              content: errorMessage
            });
            return;
          }
          
          // 根据检查次数更新进度
          const estimatedProgress = Math.min(30 + (newCheckCount * 5), 90);
          setProgress(estimatedProgress);
          
          if (newCheckCount > 60) { // 超过 5 分钟（60 * 5秒 = 300秒）
            addLog('⚠️ 生成时间过长，可能遇到问题。请检查网络连接或稍后重试。');
            setIsGenerating(false);
            setFailureCount(0); // 重置失败计数
            dispatchAlert({ type: AlertType.ERROR, content: '测试生成超时，请稍后重试' });
            return;
          }
          
          // 重置失败计数（成功获取状态）
          setFailureCount(0);
          checkStatus();
        }).catch((error) => {
          setFailureCount(prevFailures => {
            const newFailureCount = prevFailures + 1;
            addLog(`❌ 状态检查失败 (${newFailureCount}/5): ${error.message || error}`);
            console.error('Status check error:', error);
            
            if (newFailureCount >= 5) {
              addLog('❌ 连续5次状态检查失败，停止生成');
              setIsGenerating(false);
              dispatchAlert({ type: AlertType.ERROR, content: '网络连接不稳定，请检查网络后重试' });
              return newFailureCount;
            }
            
            // 继续重试
            checkStatus();
            return newFailureCount;
          });
        });
        
        return newCheckCount;
      });
    }, 5000); // 每5秒检查一次
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
                {getText('common.actions.cancel')}
              </Button>
              <Button
                onClick={async () => {
                  try {
                    // 重置状态
                    setIsGenerating(true);
                    setProgress(0);
                    setLogs([]);
                    <Button
                      onClick={async () => {
                        // CHANGELOG 2025-08-15 by 邱语堂: 批量生成逻辑整体包裹进 try/catch，修复类型声明
                        try
                         {
                          // 重置状态
                          setIsGenerating(true);
                          setProgress(0);
                          setLogs([]);
                          setStatusCheckCount(0);
                          setFailureCount(0);

                          updateStep('🚀 开始生成测试...', 5);
              <Button
                onClick={async () => {
                  try {
                    // 重置状态
                    setIsGenerating(true);
                    setProgress(0);
                    setLogs([]);
                    setStatusCheckCount(0);
                    setFailureCount(0);

                    updateStep('🚀 开始生成测试...', 5);

                    // 验证必填字段
                    if (!name.trim()) {
                      throw new Error('请输入测试名称');
                    }
                    if (selectedCourses.length === 0) {
                      throw new Error('请选择课程');
                    }
                    if (files.length === 0) {
                      throw new Error('请上传至少一个课程文件。\n\n系统需要基于上传的课程材料来生成测试题目。\n支持的文件格式：PDF、DOC、DOCX、TXT等');
                    }

                    updateStep('📁 准备上传文件...', 10);

                    // 检查知识库状态
                    updateStep('🔍 检查课程知识库状态...', 12);
                    addLog('正在检查课程知识库...');

                    for (const course of selectedCourses) {
                      try {
                        const kbResponse = await client.graphql<any>({
                          query: getKnowledgeBase,
                          variables: { courseId: course.value }
                        });
                        const knowledgeBase = kbResponse.data.getKnowledgeBase;
                        if (!knowledgeBase || !knowledgeBase.knowledgeBaseId) {
                          throw new Error(`课程 ${course.label} 尚未创建知识库。\n\n请按以下步骤操作：\n1. 先上传课程文件到知识库\n2. 等待文档处理完成\n3. 再尝试生成测试\n\n提示：您可以在课程管理页面创建知识库`);
                        }
                        addLog(`✅ 课程 ${course.label} 知识库检查通过，ID: ${knowledgeBase.knowledgeBaseId}`);
                      } catch (error: unknown) {
                        const err = error as Error;
                        if (err.message && err.message.includes('尚未创建知识库')) {
                          throw err;
                        }
                        throw new Error(`无法访问课程 ${course.label} 的知识库，请确保已为该课程创建知识库`);
                      }
                    }

                    // 批量生成每个课程的文件路径
                    type UploadData = { key: string; file: File };
                    const data: UploadData[] = [];
                    selectedCourses.forEach(course => {
                      files.forEach(file => {
                        data.push({
                          key: `Assessments/${userProfile?.userId}/${course.value}/${file.name}`,
                          file,
                        });
                      });
                    });

                    addLog(`准备上传 ${data.length} 个文件`);

                    updateStep('📤 正在上传文件到云存储...', 15);

                    await Promise.all(
                      data.map(
                        ({ key, file }, index) => {
                          addLog(`上传文件 ${index + 1}/${data.length}: ${file.name}`);
                          return uploadData({
                            key,
                            data: file,
                          }).result;
                        }
                      )
                    );

                    updateStep('✅ 文件上传完成', 25);
                    addLog('所有文件上传成功');

                    updateStep('🤖 正在调用AI生成测试...', 30);
                    addLog('发送生成请求到后端服务...');

                    for (const course of selectedCourses) {
                      const res = await client.graphql<any>({
                        query: generateAssessment,
                        variables: {
                          input: {
                            name,
                            lectureDate,
                            deadline,
                            courseId: course.value,
                            assessTemplateId: assessTemplate?.value,
                            locations: data
                              .filter(d => d.key.includes(`/${course.value}/`))
                              .map(d => d.key),
                          },
                        },
                      });
                      const id = res.data.generateAssessment;
                      setAssessId(id);
                      addLog(`✅ 课程 ${course.label} 测试请求已提交，ID: ${id}`);
                      updateStep(`⏳ 正在后台为课程 ${course.label} 生成测试内容...`, 35);
                      addLog(`开始监控课程 ${course.label} 的生成进度...`);
                    }

                  } catch (error: unknown) {
                    const err = error as Error;
                    const errorMessage = err.message || '未知错误';
                    addLog(`❌ 生成失败: ${errorMessage}`);
                    setIsGenerating(false);
                    setFailureCount(0); // 重置失败计数
                    dispatchAlert({ type: AlertType.ERROR, content: `生成测试失败: ${errorMessage}` });
                  }
                }}
                variant="primary"
                disabled={isGenerating || knowledgeBaseStatus === 'missing' || knowledgeBaseStatus === 'checking'}
              >
                {isGenerating ? '生成中...' : getText('teachers.assessments.generate.title')}
              </Button>
                    <SpaceBetween size="s">
                      <Multiselect
                        options={courses}
                        selectedOptions={selectedCourses}
                        onChange={(
                          { detail }: { detail: { selectedOptions: SelectProps.Option[] } }
                        ) => setSelectedCourses(detail.selectedOptions)}
                        placeholder={getText('teachers.assessments.generate.select_course') + '（可多选）'}
                      />
                      {/* 知识库状态提示可根据第一个选中的课程显示 */}
                      {/* 批量显示所有选中课程的知识库状态 */}
                      {selectedCourses.length > 0 && (
                        <Box>
                          {selectedCourses.map((course: SelectProps.Option) => {
                            const status = knowledgeBaseStatusMap[course.value as string];
                            if (!status) return null;
                            if (status === 'checking') {
                              return (
                                <Alert key={course.value} statusIconAriaLabel="Info" header={`课程 ${course.label}：检查中`}>
                                  正在检查课程知识库状态...
                                </Alert>
                              );
                            }
                            if (status === 'missing') {
                              return (
                                <Alert key={course.value} type="warning" statusIconAriaLabel="Warning" header={`课程 ${course.label}：缺少知识库`}>
                                  该课程尚未创建知识库。请先上传课程文件到知识库，然后等待处理完成后再生成测试。
                                </Alert>
                              );
                            }
                            if (status === 'available') {
                              return (
                                <Alert key={course.value} type="success" statusIconAriaLabel="Success" header={`课程 ${course.label}：知识库就绪`}>
                                  课程知识库已创建，可以生成测试。
                                </Alert>
                              );
                            }
                            return null;
                          })}
                        </Box>
                      )}
                    </SpaceBetween>
                  </FormField>
                  <FormField label={getText('teachers.assessments.generate.lecture_date')}>
                    <DatePicker onChange={({ detail }) => setLectureDate(detail.value)} value={lectureDate} placeholder={getText('date_format.yyyy_mm_dd')} />
                  </FormField>
                  <FormField label={getText('common.labels.deadline')}>
                    <DatePicker onChange={({ detail }) => setDeadline(detail.value)} value={deadline} placeholder={getText('date_format.yyyy_mm_dd')} />
                  </FormField>
                  <FormField 
                    label={getText('teachers.assessments.generate.add_lecture_notes')}
                    description="请上传课程相关的文档材料（如讲义、教材、作业等），系统将基于这些材料生成测试题目。支持PDF、DOC、DOCX、TXT等格式。"
                  >
                    <FileUpload
                      multiple
                      onChange={({ detail }) => setFiles(detail.value)}
                      value={files}
                      i18nStrings={{
                        uploadButtonText: (e) => (e ? getText('common.upload.choose_files') : getText('common.upload.choose_file')),
                        dropzoneText: (e) => (e ? '拖拽多个课程文件到此处' : '拖拽课程文件到此处'),
                        removeFileAriaLabel: (e) => getTextWithParams('teachers.assessments.generate.remove_file', { index: e + 1 }),
                        limitShowFewer: getText('common.upload.show_fewer'),
                        limitShowMore: getText('common.upload.show_more'),
                        errorIconAriaLabel: getText('common.status.error'),
                      }}
                      showFileLastModified
                      showFileSize
                      showFileThumbnail
                      tokenLimit={3}
                      accept=".pdf,.doc,.docx,.txt,.md"
                    />
                  </FormField>
                </SpaceBetween>
              </Box>
            </SpaceBetween>
          </Container>
        </Form>
      </form>
      <Modal 
        visible={isGenerating || !!assessId} 
        onDismiss={() => {
          if (!isGenerating) {
            setAssessId('');
            setLogs([]);
            setProgress(0);
            setCurrentStep('');
            setStatusCheckCount(0);
            setFailureCount(0);
          }
        }}
        header={<Header>{getText('teachers.assessments.generate.generating')}</Header>}
        size="large"
      >
        <SpaceBetween size="l">
          {/* 进度条 */}
          <Box>
            <ProgressBar
              value={progress}
              additionalInfo={`${progress}% 完成`}
              description={currentStep || '准备中...'}
            />
          </Box>
          
          {/* 当前步骤显示 */}
          {currentStep && (
            <Alert statusIconAriaLabel="Info" header="当前进度">
              {currentStep}
            </Alert>
          )}
          
          {/* 实时日志 */}
          <Box>
            <Header variant="h3">生成日志</Header>
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
              {logs.length > 0 ? (
                <div>
                  {logs.map((log, index) => (
                    <div key={index} style={{ marginBottom: '4px' }}>
                      {log}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#6c757d' }}>等待开始...</div>
              )}
            </div>
          </Box>
          
          {/* 加载指示器 */}
          <SpaceBetween size="s" alignItems="center">
            <Spinner size="big" />
            <Box textAlign="center">
              <strong>正在生成测试</strong>
              <br />
              <small>这可能需要几分钟时间，请耐心等待...</small>
            </Box>
          </SpaceBetween>
          
          {/* 取消按钮 */}
          <SpaceBetween direction="horizontal" size="xs">
            <Button 
              variant="link" 
              onClick={() => {
                if (window.confirm('确定要取消生成吗？')) {
                  setIsGenerating(false);
                  setAssessId('');
                  setLogs([]);
                  setProgress(0);
                  setCurrentStep('');
                  setStatusCheckCount(0);
                  setFailureCount(0);
                }
              }}
              disabled={progress === 100}
            >
              取消生成
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      </Modal>
    </>
  );
};
