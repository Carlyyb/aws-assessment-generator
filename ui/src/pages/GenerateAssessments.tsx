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
import { generateAssessment, listCourses, getAssessment, listAssessTemplates } from '../graphql/queries';
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
  const [course, setCourse] = useState<SelectProps.Option | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [assessId, setAssessId] = useState('');
  const [assessTemplates, setAssessTemplates] = useState<SelectProps.Option[]>([]);
  const [assessTemplate, setAssessTemplate] = useState<SelectProps.Option | null>(null);
  
  // 进度和日志状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [statusCheckCount, setStatusCheckCount] = useState(0); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [failureCount, setFailureCount] = useState(0); // eslint-disable-line @typescript-eslint/no-unused-vars

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
            updateStep('✅ 评估生成完成！正在跳转到编辑页面...', 100);
            setIsGenerating(false);
            setFailureCount(0); // 重置失败计数
            dispatchAlert({ type: AlertType.SUCCESS, content: getText('pages.generate_assessments.generate_success') });
            setTimeout(() => {
              navigate(`/edit-assessment/${assessId}`);
            }, 1000);
            return;
          }
          
          // 根据检查次数更新进度
          const estimatedProgress = Math.min(30 + (newCheckCount * 5), 90);
          setProgress(estimatedProgress);
          
          if (newCheckCount > 60) { // 超过 5 分钟（60 * 5秒 = 300秒）
            addLog('⚠️ 生成时间过长，可能遇到问题。请检查网络连接或稍后重试。');
            setIsGenerating(false);
            setFailureCount(0); // 重置失败计数
            dispatchAlert({ type: AlertType.ERROR, content: '评估生成超时，请稍后重试' });
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
                    setStatusCheckCount(0);
                    setFailureCount(0);
                    
                    updateStep('🚀 开始生成评估...', 5);
                    
                    // 验证必填字段
                    if (!name.trim()) {
                      throw new Error('请输入评估名称');
                    }
                    if (!course?.value) {
                      throw new Error('请选择课程');
                    }
                    if (files.length === 0) {
                      throw new Error('请上传至少一个文件');
                    }
                    
                    updateStep('📁 准备上传文件...', 10);
                    
                    const data = files.map((file) => ({
                      key: `Assessments/${userProfile?.userId}/${course?.value}/${file.name}`,
                      file,
                    }));
                    
                    addLog(`准备上传 ${files.length} 个文件`);
                    
                    updateStep('📤 正在上传文件到云存储...', 15);
                    
                    await Promise.all(
                      data.map(
                        ({ key, file }, index) => {
                          addLog(`上传文件 ${index + 1}/${files.length}: ${file.name}`);
                          return uploadData({
                            key,
                            data: file,
                          }).result;
                        }
                      )
                    );
                    
                    updateStep('✅ 文件上传完成', 25);
                    addLog('所有文件上传成功');
                    
                    updateStep('🤖 正在调用AI生成评估...', 30);
                    addLog('发送生成请求到后端服务...');
                    
                    const res = await client.graphql<any>({
                      query: generateAssessment,
                      variables: {
                        input: {
                          name,
                          lectureDate,
                          deadline,
                          courseId: course.value,
                          assessTemplateId: assessTemplate?.value,
                          locations: data.map(({ key }) => key),
                        },
                      },
                    });
                    
                    const id = res.data.generateAssessment;
                    setAssessId(id);
                    
                    addLog(`✅ 评估请求已提交，ID: ${id}`);
                    updateStep('⏳ 正在后台生成评估内容...', 35);
                    addLog('开始监控生成进度...');
                    
                  } catch (error: any) {
                    const errorMessage = error.message || '未知错误';
                    addLog(`❌ 生成失败: ${errorMessage}`);
                    setIsGenerating(false);
                    setFailureCount(0); // 重置失败计数
                    dispatchAlert({ type: AlertType.ERROR, content: `生成评估失败: ${errorMessage}` });
                  }
                }}
                variant="primary"
                disabled={isGenerating}
              >
                {isGenerating ? '生成中...' : getText('teachers.assessments.generate.title')}
              </Button>
            </SpaceBetween>
          }
          header={<Header variant="h1">{getText('teachers.assessments.generate.title')}</Header>}
        >
          <Container header={<Header variant="h1">{getText('teachers.assessments.generate.title')}</Header>}>
            <SpaceBetween size="l" alignItems="center">
              <Box padding="xxxl">
                <SpaceBetween size="xxl" direction="horizontal">
                  <FormField label={getText('teachers.assessments.generate.select_template')}>
                    <SpaceBetween size="l" direction="horizontal" alignItems="center">
                      <Checkbox checked={useDefault} onChange={({ detail }) => setUseDefault(detail.checked)}>
                        {getText('teachers.assessments.generate.use_default')}
                      </Checkbox>
                      <Select
                        options={assessTemplates}
                        selectedOption={assessTemplate}
                        onChange={({ detail }) => setAssessTemplate(detail.selectedOption)}
                        disabled={useDefault}
                      />
                    </SpaceBetween>
                  </FormField>
                  <FormField label={getText('common.labels.name')}>
                    <Input value={name} onChange={({ detail }) => setName(detail.value)} />
                  </FormField>
                  <FormField label={getText('teachers.assessments.generate.select_course')}>
                    <Select options={courses} selectedOption={course} onChange={({ detail }) => setCourse(detail.selectedOption)} />
                  </FormField>
                  <FormField label={getText('teachers.assessments.generate.lecture_date')}>
                    <DatePicker onChange={({ detail }) => setLectureDate(detail.value)} value={lectureDate} placeholder={getText('date_format.yyyy_mm_dd')} />
                  </FormField>
                  <FormField label={getText('common.labels.deadline')}>
                    <DatePicker onChange={({ detail }) => setDeadline(detail.value)} value={deadline} placeholder={getText('date_format.yyyy_mm_dd')} />
                  </FormField>
                  <FormField label={getText('teachers.assessments.generate.add_lecture_notes')}>
                    <FileUpload
                      multiple
                      onChange={({ detail }) => setFiles(detail.value)}
                      value={files}
                      i18nStrings={{
                        uploadButtonText: (e) => (e ? getText('common.upload.choose_files') : getText('common.upload.choose_file')),
                        dropzoneText: (e) => (e ? getText('common.upload.drop_files') : getText('common.upload.drop_file')),
                        removeFileAriaLabel: (e) => getTextWithParams('teachers.assessments.generate.remove_file', { index: e + 1 }),
                        limitShowFewer: getText('common.upload.show_fewer'),
                        limitShowMore: getText('common.upload.show_more'),
                        errorIconAriaLabel: getText('common.status.error'),
                      }}
                      showFileLastModified
                      showFileSize
                      showFileThumbnail
                      tokenLimit={3}
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
              <strong>正在生成评估</strong>
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
