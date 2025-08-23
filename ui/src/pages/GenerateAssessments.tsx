/* eslint-disable react-refresh/only-export-components */
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
  TimeInput,
  Spinner,
  Modal,
  ProgressBar,
  Alert,
  Textarea,
} from '@cloudscape-design/components';
import { uploadData } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/api';
import { useNavigate } from 'react-router-dom';
import { generateAssessment, listCourses, getAssessment, listAssessTemplates, getKnowledgeBase } from '../graphql/queries';
import { Course, AssessStatus, AssessTemplate } from '../graphql/API';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { UserProfileContext } from '../contexts/userProfile';
import { getText, getTextWithParams } from '../i18n/lang';
import { getBeijingTimeString } from '../utils/timeUtils';

const client = generateClient();

export default () => {
  const navigate = useNavigate();
  const dispatchAlert = useContext(DispatchAlertContext);
  const userProfile = useContext(UserProfileContext);

  const [name, setName] = useState('');
  const [lectureDate, setLectureDate] = useState('');
  const [lectureTime, setLectureTime] = useState('09:00');
  const [deadline, setDeadline] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');
  const [useDefault, setUseDefault] = useState(true);
  const [courses, setCourses] = useState<SelectProps.Option[]>([]);
  const [course, setCourse] = useState<SelectProps.Option | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [assessId, setAssessId] = useState('');
  const [assessTemplates, setAssessTemplates] = useState<SelectProps.Option[]>([]);
  const [assessTemplate, setAssessTemplate] = useState<SelectProps.Option | null>(null);
  const [knowledgeBaseStatus, setKnowledgeBaseStatus] = useState<'checking' | 'available' | 'missing' | null>(null);
  
  // 自定义prompt状态
  const [customPrompt, setCustomPrompt] = useState('');
  
  // 进度和日志状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [_statusCheckCount, setStatusCheckCount] = useState(0);
  const [_failureCount, setFailureCount] = useState(0);

  // 添加日志函数
  const addLog = (message: string) => {
    const timestamp = getBeijingTimeString();
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
    if (!courseId) {
      setKnowledgeBaseStatus(null);
      return;
    }
    
    setKnowledgeBaseStatus('checking');
    try {
      const kbResponse = await client.graphql<any>({
        query: getKnowledgeBase,
        variables: { courseId }
      });
      
      // 检查GraphQL错误
      if ((kbResponse as any).errors) {
        console.error('GraphQL errors when checking knowledge base:', (kbResponse as any).errors);
        setKnowledgeBaseStatus('missing');
        return;
      }
      
      const knowledgeBase = kbResponse.data.getKnowledgeBase;
      if (knowledgeBase && knowledgeBase.knowledgeBaseId) {
        setKnowledgeBaseStatus('available');
      } else {
        setKnowledgeBaseStatus('missing');
      }
    } catch (error) {
      console.error('Error checking knowledge base status:', error);
      setKnowledgeBaseStatus('missing');
    }
  };

  // 当课程改变时检查知识库状态
  useEffect(() => {
    if (course?.value) {
      checkKnowledgeBaseStatus(course.value);
    } else {
      setKnowledgeBaseStatus(null);
    }
  }, [course]);

  // 加载测试模板列表 - 模仿Templates.tsx的实现
  const loadTemplates = () => {
    client
      .graphql<any>({ query: listAssessTemplates })
      .then(({ data, errors }) => {
        if (errors && errors.length > 0) {
          console.warn('GraphQL errors:', errors);
          const validTemplates = (data?.listAssessTemplates || []).filter((template: AssessTemplate) => {
            const validDocLang = template.docLang === 'zh' || template.docLang === 'en';
            return template && template.id && template.name && validDocLang;
          });

          if (validTemplates.length === 0) {
            dispatchAlert({ 
              type: 'warning', 
              content: '没有找到有效的测试模板数据，请先创建测试模板'
            });
          }
          console.log('Valid templates:', validTemplates);
          const options = validTemplates.map((assessTemplate: AssessTemplate) => ({ 
            label: assessTemplate.name, 
            value: assessTemplate.id 
          }));
          setAssessTemplates(options);
        } else {
          const list = data?.listAssessTemplates || [];
          // 过滤掉无效的测试模板记录
          //console.log('All templates before filter:', list);
          const validList = list.filter((assessTemplate: AssessTemplate) => {
            const validDocLang = assessTemplate.docLang === 'zh' || assessTemplate.docLang === 'en';
            return assessTemplate && assessTemplate.id && assessTemplate.name && validDocLang;
          });
          //console.log('Valid templates after filter:', validList);
          const options = validList.map((assessTemplate: AssessTemplate) => ({ 
            label: assessTemplate.name, 
            value: assessTemplate.id 
          }));
          setAssessTemplates(options);
        }
      })
      .catch((error) => {
        console.error('Error fetching templates:', error);
        dispatchAlert({ 
          type: AlertType.ERROR, 
          content: '加载测试模板列表失败，请刷新页面重试'
        });
      });
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  function checkStatus() {
    setTimeout(async () => {
      setStatusCheckCount(prev => {
        const newCheckCount = prev + 1;
        
        addLog(`检查生成状态... (第 ${newCheckCount} 次)`);
        
        client.graphql<any>({ query: getAssessment, variables: { id: assessId } }).then(({ data, errors }) => {
          // 检查GraphQL错误
          if (errors && errors.length > 0) {
            addLog(`❌ 状态查询错误: ${JSON.stringify(errors)}`);
            setFailureCount(prev => prev + 1);
            checkStatus();
            return;
          }

          const assessment = data.getAssessment;
          if (!assessment) {
            addLog(`❌ 找不到评估记录 ID: ${assessId}`);
            setFailureCount(prev => prev + 1);
            checkStatus();
            return;
          }

          const { status } = assessment;
          
          addLog(`当前状态: ${status}`);
          
          if (status === AssessStatus.CREATED) {
            updateStep('✅ 测试生成完成！正在跳转到编辑页面...', 100);
            setIsGenerating(false);
            setFailureCount(0); // 重置失败计数
            dispatchAlert({ type: AlertType.SUCCESS, content: getText('pages.generate_assessments.generate_success') });
            // 立即关闭模态窗口并跳转到编辑页面
            setAssessId('');
            setLogs([]);
            setProgress(0);
            setCurrentStep('');
            setStatusCheckCount(0);
            navigate(`/edit-assessment/${assessId}`);
            return;
          }
          
          // 处理失败状态
          if (status === AssessStatus.FAILED) {
            addLog('❌ 测试生成失败');
            updateStep('❌ 测试生成失败', 0);
            
            setIsGenerating(false);
            setFailureCount(0); // 重置失败计数
            
            // 提供详细的错误信息和建议 - 改进错误消息
            const errorMessage = '测试生成失败。可能的原因包括：\n\n' +
              '1. 📄 文档处理问题：\n' +
              '   • 上传的文件格式不支持或损坏\n' +
              '   • 文档内容无法提取或过于简短\n' +
              '   • 文档语言与系统设置不匹配\n\n' +
              '2. 🧠 知识库问题：\n' +
              '   • 知识库中缺少足够的内容\n' +
              '   • 文档索引尚未完成处理\n' +
              '   • 知识库配置错误\n\n' +
              '3. 🤖 AI服务问题：\n' +
              '   • Bedrock服务暂时不可用\n' +
              '   • 模型调用限制或配额超出\n' +
              '   • 网络连接问题\n\n' +
              '4. ⚙️ 测试模板配置问题：\n' +
              '   • 选择的测试模板参数不合理\n' +
              '   • 题目数量设置过高\n\n' +
              '💡 建议解决方案：\n' +
              '• 检查上传的文件是否为有效的课程材料\n' +
              '• 确保知识库中有足够的文档内容\n' +
              '• 尝试使用更简单的测试模板设置\n' +
              '• 稍后重试，可能是服务暂时繁忙\n' +
              '• 联系管理员查看详细日志信息\n\n';       
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
      <Container
        header={
          <Header
            variant="h1"
            description="创建个性化的课程测试评估，支持多种文档格式和自定义学习目标"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button 
                  variant="primary" 
                  iconName="download"
                  onClick={() => window.open('/docs/assessment-guide.pdf', '_blank')}
                >
                  使用指南
                </Button>
              </SpaceBetween>
            }
          >
            {getText('common.nav.generate_assessments')}
          </Header>
        }
        disableContentPaddings={false}
      >
        <SpaceBetween size="l">
          <form onSubmit={(e) => e.preventDefault()}>
            <Form
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button formAction="none" variant="link">
                    {getText('common.actions.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    loading={isGenerating}
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
                    if (!course?.value) {
                      throw new Error('请选择课程');
                    }
                    
                    // 验证至少有文件或自定义prompt之一
                    if (files.length === 0 && !customPrompt.trim()) {
                      throw new Error('请上传至少一个课程文件或输入自定义学习目标。\n\n您可以：\n1. 上传课程材料（PDF、DOC、DOCX、TXT等）\n2. 或者在"自定义学习目标"中输入要考核的知识点');
                    }

                    // 验证文件（如果有上传文件的话）
                    if (files.length > 0) {
                      updateStep('🔍 验证上传文件...', 8);
                      const invalidFiles = files.filter(file => {
                        const validExtensions = ['.pdf', '.doc', '.docx', '.txt', '.md'];
                        const fileName = file.name.toLowerCase();
                        const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
                        const isValidSize = file.size > 0 && file.size < 50 * 1024 * 1024; // 小于50MB
                        return !hasValidExtension || !isValidSize;
                      });

                      if (invalidFiles.length > 0) {
                        const invalidFileNames = invalidFiles.map(f => f.name).join(', ');
                        throw new Error(`以下文件格式不支持或文件过大：${invalidFileNames}\n\n支持的格式：PDF、DOC、DOCX、TXT、MD\n最大文件大小：50MB`);
                      }
                      
                      addLog(`验证完成，准备处理 ${files.length} 个有效文件`);
                    } else {
                      addLog(`使用自定义学习目标模式，不上传文件`);
                    }                    // 验证测试模板选择
                    if (!useDefault && !assessTemplate?.value) {
                      throw new Error('请选择测试测试模板或使用默认测试模板');
                    }

                    if (!useDefault && assessTemplate?.value) {
                      addLog(`使用自定义测试模板：${assessTemplate.label}`);
                    } else {
                      addLog('使用默认测试模板设置');
                    }
                    
                    updateStep('📁 准备上传文件...', 10);
                    
                    // 检查知识库状态
                    updateStep('🔍 检查课程知识库状态...', 12);
                    addLog('正在检查课程知识库...');
                    
                    try {
                      const kbResponse = await client.graphql<any>({
                        query: getKnowledgeBase,
                        variables: { courseId: course.value }
                      });
                      
                      // 检查GraphQL错误
                      if ((kbResponse as any).errors && (kbResponse as any).errors.length > 0) {
                        addLog(`知识库查询返回错误: ${JSON.stringify((kbResponse as any).errors)}`);
                        throw new Error('知识库查询失败，请稍后重试');
                      }
                      
                      const knowledgeBase = kbResponse.data.getKnowledgeBase;
                      if (!knowledgeBase || !knowledgeBase.knowledgeBaseId) {
                        addLog('❌ 该课程没有关联的知识库');
                        throw new Error(`该课程尚未创建知识库。\n\n请按以下步骤操作：\n1. 先上传课程文件到知识库\n2. 等待文档处理完成\n3. 再尝试生成测试\n\n提示：您可以在课程管理页面创建知识库`);
                      }
                      
                      addLog(`✅ 知识库检查通过，ID: ${knowledgeBase.knowledgeBaseId}`);
                      
                      // 检查知识库状态
                      if (knowledgeBase.status && knowledgeBase.status !== 'ACTIVE') {
                        addLog(`⚠️ 知识库状态: ${knowledgeBase.status}`);
                        if (knowledgeBase.status === 'CREATING' || knowledgeBase.status === 'UPDATING') {
                          throw new Error('知识库正在创建或更新中，请稍后重试');
                        }
                      }
                      
                    } catch (error: any) {
                      // 如果是我们抛出的错误，直接抛出
                      if (error.message.includes('该课程尚未创建知识库') || 
                          error.message.includes('知识库正在创建') ||
                          error.message.includes('知识库查询失败')) {
                        throw error;
                      }
                      // 其他错误也视为知识库不存在
                      addLog(`❌ 知识库检查失败: ${error.message || error}`);
                      throw new Error('无法访问课程知识库，请确保已为该课程创建知识库');
                    }
                    
                    let uploadedFileKeys: string[] = [];
                    
                    // 只有在有文件时才进行上传
                    if (files.length > 0) {
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
                      
                      uploadedFileKeys = data.map(({ key }) => key);
                      updateStep('✅ 文件上传完成', 25);
                      addLog('所有文件上传成功');
                    } else {
                      updateStep('📝 使用自定义学习目标，跳过文件上传', 25);
                      addLog('使用自定义学习目标模式');
                    }
                    
                    updateStep('🤖 正在调用AI生成测试...', 30);
                    addLog('发送生成请求到后端服务...');
                    
                    const res = await client.graphql<any>({
                      query: generateAssessment,
                      variables: {
                        input: {
                          name,
                          lectureDate: lectureDate && lectureTime ? `${lectureDate}T${lectureTime}:00.000Z` : lectureDate,
                          deadline: deadline && deadlineTime ? `${deadline}T${deadlineTime}:00.000Z` : deadline,
                          courseId: course.value,
                          assessTemplateId: assessTemplate?.value,
                          locations: uploadedFileKeys,
                          customPrompt: customPrompt.trim() || null,
                        },
                      },
                    });
                    
                    console.log('generateAssessment API 响应:', res);
                    console.log('返回的ID:', res.data.generateAssessment);
                    
                    const id = res.data.generateAssessment;
                    setAssessId(id);
                    
                    addLog(`✅ 测试请求已提交，ID: ${id}`);
                    console.log('生成测试的地方测试请求id为', id);
                    updateStep('⏳ 正在后台生成测试内容...', 35);
                    addLog('开始监控生成进度...');
                    
                  } catch (error: any) {
                    const errorMessage = error.message || '未知错误';
                    addLog(`❌ 生成失败: ${errorMessage}`);
                    setIsGenerating(false);
                    setFailureCount(0); // 重置失败计数
                    dispatchAlert({ type: AlertType.ERROR, content: `生成测试失败: ${errorMessage}` });
                  }
                }}
                disabled={isGenerating || knowledgeBaseStatus === 'missing' || knowledgeBaseStatus === 'checking'}
              >
                {isGenerating ? '生成中...' : getText('teachers.assessments.generate.title')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
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
                    <SpaceBetween size="s">
                      <Select options={courses} selectedOption={course} onChange={({ detail }) => setCourse(detail.selectedOption)} />
                      {knowledgeBaseStatus === 'checking' && (
                        <Alert statusIconAriaLabel="Info" header="检查中">
                          正在检查课程知识库状态...
                        </Alert>
                      )}
                      {knowledgeBaseStatus === 'missing' && (
                        <Alert type="warning" statusIconAriaLabel="Warning" header="缺少知识库">
                          该课程尚未创建知识库。请先上传课程文件到知识库，然后等待处理完成后再生成测试。
                        </Alert>
                      )}
                      {knowledgeBaseStatus === 'available' && (
                        <Alert type="success" statusIconAriaLabel="Success" header="知识库就绪">
                          课程知识库已创建，可以生成测试。
                        </Alert>
                      )}
                    </SpaceBetween>
                  </FormField>
                  <FormField label={getText('teachers.assessments.generate.lecture_date')}>
                    <SpaceBetween direction="horizontal" size="xs">
                      <DatePicker 
                        onChange={({ detail }) => setLectureDate(detail.value)} 
                        value={lectureDate} 
                        placeholder={getText('date_format.yyyy_mm_dd')} 
                      />
                      <TimeInput
                        onChange={({ detail }) => setLectureTime(detail.value)}
                        value={lectureTime}
                        format="hh:mm"
                        placeholder="时间"
                      />
                    </SpaceBetween>
                  </FormField>
                  <FormField label={getText('common.labels.deadline')}>
                    <SpaceBetween direction="horizontal" size="xs">
                      <DatePicker 
                        onChange={({ detail }) => setDeadline(detail.value)} 
                        value={deadline} 
                        placeholder={getText('date_format.yyyy_mm_dd')} 
                      />
                      <TimeInput
                        onChange={({ detail }) => setDeadlineTime(detail.value)}
                        value={deadlineTime}
                        format="hh:mm"
                        placeholder="时间"
                      />
                    </SpaceBetween>
                  </FormField>
                  
                  {/* 自定义学习目标输入框 */}
                  <FormField 
                    label="自定义学习目标（可选）"
                    description="如果您有特定的学习目标或知识点要考核，可以在此输入。这将作为测试生成的主要依据。如果不填写，系统将基于上传的讲义文件生成题目。"
                  >
                    <Textarea
                      value={customPrompt}
                      onChange={({ detail }) => setCustomPrompt(detail.value)}
                      placeholder="例如：请基于以下学习目标生成测试题目：
1. 理解大语言模型的“黑箱”现象
2. 理解大语言模型的基本原理与架构
3. 应用大语言模型进行文本生成与处理
4. 分析和评估大语言模型的局限性与伦理问题"
                      rows={6}
                    />
                  </FormField>
                  
                  <FormField 
                    label={files.length > 0 || !customPrompt.trim() ? getText('teachers.assessments.generate.add_lecture_notes') : getText('teachers.assessments.generate.add_lecture_notes') + "（可选）"}
                    description={customPrompt.trim() 
                      ? "您已输入自定义学习目标。可以选择性地上传课程文档作为补充材料，或跳过此步骤。" 
                      : "请上传课程相关的文档材料（如讲义、教材、作业等），系统将基于这些材料生成测试题目。支持PDF、DOC、DOCX、TXT等格式。"
                    }
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
          </Form>
        </form>
      </SpaceBetween>
    </Container>
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
            <Header variant="h3">📋 生成日志</Header>
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
                    <div key={index} style={{ 
                      marginBottom: '4px',
                      color: log.includes('❌') ? '#dc3545' :
                             log.includes('⚠️') ? '#856404' :
                             log.includes('✅') ? '#28a745' :
                             log.includes('🔍') || log.includes('📋') ? '#007bff' : '#495057'
                    }}>
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
