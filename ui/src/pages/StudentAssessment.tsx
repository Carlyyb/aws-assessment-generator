import { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  FormField,
  Button,
  Box,
  PieChart,
  Tiles,
  Modal,
  Textarea,
  Spinner,
  AppLayout,
  Alert,
  ProgressBar,
} from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { MultiChoice, FreeText, TrueFalse, SingleChoice, AssessType, StudentAssessment } from '../graphql/API';
import { getStudentAssessment } from '../graphql/queries';
import { gradeStudentAssessment } from '../graphql/mutations';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { getText, getTextWithParams } from '../i18n/lang';

const client = generateClient();

export default () => {
  const params = useParams();
  const navigate = useNavigate();
  const dispatchAlert = useContext(DispatchAlertContext);
  const [showSpinner, setShowSpinner] = useState(false);

  const [assessmentId, setAssessmentId] = useState<string>();
  const [questions, setQuestions] = useState<(MultiChoice | FreeText | TrueFalse | SingleChoice)[]>([]);
  const [assessType, setAssessType] = useState<AssessType>();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [score, setScore] = useState<number>();
  const [toolsOpen, setToolsOpen] = useState(true); // 右侧工具栏开关状态

  // 计时器相关状态
  const [isTimeLimited, setIsTimeLimited] = useState(false);
  const [timeLimit, setTimeLimit] = useState(0); // 时间限制（分钟）
  const [remainingTime, setRemainingTime] = useState(0); // 剩余时间（秒）
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    client
      .graphql<any>({ query: getStudentAssessment, variables: { parentAssessId: params.id! } })
      .then(({ data }) => {
        const result: StudentAssessment = data.getStudentAssessment;
        setAssessmentId(result.parentAssessId);
        setAssessType(result.assessment?.assessType);
        
        // 检查是否有时间限制
        const assessment = result.assessment as any;
        if (assessment?.timeLimited && assessment?.timeLimit) {
          setIsTimeLimited(true);
          setTimeLimit(assessment.timeLimit);
          setRemainingTime(assessment.timeLimit * 60); // 转换为秒
          setShowStartDialog(true); // 显示开始确认对话框
        }
        
        // 根据评估类型获取正确的问题数组
        let questionArray: (MultiChoice | FreeText | TrueFalse | SingleChoice)[] = [];
        if (result.assessment?.assessType === AssessType.multiChoiceAssessment && result.assessment.multiChoiceAssessment) {
          questionArray = result.assessment.multiChoiceAssessment;
        } else if (result.assessment?.assessType === AssessType.freeTextAssessment && result.assessment.freeTextAssessment) {
          questionArray = result.assessment.freeTextAssessment;
        } else if (result.assessment?.assessType === AssessType.trueFalseAssessment && result.assessment.trueFalseAssessment) {
          questionArray = result.assessment.trueFalseAssessment;
        } else if (result.assessment?.assessType === AssessType.singleChoiceAssessment && result.assessment.singleChoiceAssessment) {
          questionArray = result.assessment.singleChoiceAssessment;
        }
        
        setQuestions(questionArray);
        setAnswers(new Array(questionArray.length).fill(''));
      })
      .catch(() => {});
  }, []);

  // 开始计时器
  const startTimer = useCallback(() => {
    setHasStarted(true);
    setStartTime(new Date());
    setShowStartDialog(false);
    
    if (isTimeLimited) {
      timerRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            // 时间到，自动提交
            handleAutoSubmit();
            return 0;
          }
          
          // 剩余5分钟时显示警告
          if (prev === 300) {
            setShowTimeWarning(true);
          }
          
          return prev - 1;
        });
      }, 1000);
    }
  }, [isTimeLimited]);

  // 自动提交（时间到期）
  const handleAutoSubmit = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setShowSpinner(true);
    client
      .graphql<any>({
        query: gradeStudentAssessment,
        variables: {
          input: {
            parentAssessId: params.id!,
            answers: JSON.stringify(answers.map((answer) => (isNaN(+answer) ? answer : +answer + 1))),
          },
        },
      })
      .then(({ data }) => {
        const { score } = data.gradeStudentAssessment;
        setScore(score);
      })
      .catch(() => dispatchAlert({ type: AlertType.ERROR }))
      .finally(() => setShowSpinner(false));
  }, [answers, params.id, dispatchAlert]);

  // 格式化时间显示
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取已用时间
  const getElapsedTime = (): string => {
    if (!startTime) return '00:00';
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    return formatTime(elapsed);
  };

  // 清理计时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 最终提交处理
  const handleFinalSubmit = useCallback(() => {
    // 清理计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setShowSubmitConfirmation(false);
    setShowSpinner(true);
    
    client
      .graphql<any>({
        query: gradeStudentAssessment,
        variables: {
          input: {
            parentAssessId: params.id!,
            answers: JSON.stringify(answers.map((answer) => (isNaN(+answer) ? answer : +answer + 1))),
          },
        },
      })
      .then(({ data }) => {
        const { score } = data.gradeStudentAssessment;
        setScore(score);
      })
      .catch(() => dispatchAlert({ type: AlertType.ERROR }))
      .finally(() => setShowSpinner(false));
  }, [answers, params.id, dispatchAlert]);

  // 验证提交前的条件
  const validateSubmission = () => {
    const answeredCount = answers.filter(answer => answer !== undefined && answer !== '').length;
    const completionRate = answeredCount / questions.length;
    
    // 如果完成率低于50%，显示额外警告
    if (completionRate < 0.5) {
      return {
        canSubmit: true,
        showWarning: true,
        warningMessage: `您只完成了 ${Math.round(completionRate * 100)}% 的题目，确定要提交吗？`
      };
    }
    
    return {
      canSubmit: true,
      showWarning: false,
      warningMessage: ''
    };
  };

  // 处理提交按钮点击
  const handleSubmitClick = () => {
    const validation = validateSubmission();
    
    if (validation.canSubmit) {
      setShowSubmitConfirmation(true);
    }
  };

  // 渲染提交摘要
  const renderSubmissionSummary = () => {
    const answeredCount = answers.filter(answer => answer !== undefined && answer !== '').length;
    const unansweredQuestions = [];
    const completionRate = Math.round((answeredCount / questions.length) * 100);
    
    for (let i = 0; i < questions.length; i++) {
      if (!answers[i] || answers[i] === '') {
        unansweredQuestions.push(i + 1);
      }
    }

    return (
      <SpaceBetween size="m">
        <div>
          <strong>答题完成情况：</strong>
          <div>已完成：{answeredCount} / {questions.length} 题 ({completionRate}%)</div>
        </div>
        
        {unansweredQuestions.length > 0 && (
          <Alert type="warning">
            <strong>未完成题目：</strong>
            <div style={{ marginTop: '8px' }}>
              第 {unansweredQuestions.join('、')} 题未作答
            </div>
            <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
              未作答的题目将记为0分，建议返回检查。
            </div>
          </Alert>
        )}
        
        {completionRate === 100 && (
          <Alert type="success">
            <strong>太棒了！</strong>您已完成所有题目的作答。
          </Alert>
        )}
        
        <Alert type="info">
          <strong>重要提醒：</strong>
          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
            <li>提交后将无法修改答案</li>
            <li>未作答题目将自动计为错误</li>
            <li>请确认您的答案选择正确</li>
          </ul>
        </Alert>
        
        {hasStarted && startTime && (
          <div style={{ padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <strong>答题用时：</strong>{getElapsedTime()}
            {isTimeLimited && (
              <div style={{ marginTop: '4px', color: '#666' }}>
                剩余时间：{formatTime(remainingTime)}
              </div>
            )}
          </div>
        )}
      </SpaceBetween>
    );
  };

  // 渲染导航小方块
  const renderNavigationGrid = () => {
    if (questions.length === 0) return null;

    const navigationItems = [];
    for (let i = 0; i < questions.length; i += 7) {
      const row = questions.slice(i, i + 7).map((_, index) => {
        const questionIndex = i + index;
        const isActive = questionIndex === activeStepIndex;
        const hasAnswer = answers[questionIndex] !== undefined && answers[questionIndex] !== '';
        
        // 确定背景色和文字色
        let backgroundColor, color;
        if (isActive) {
          backgroundColor = '#0073bb'; // 蓝色 - 当前活跃题目
          color = '#ffffff';
        } else if (hasAnswer) {
          backgroundColor = '#28a745'; // 绿色 - 已填写答案的题目
          color = '#ffffff';
        } else {
          backgroundColor = '#ffffff'; // 白色 - 未填写的题目
          color = '#000000';
        }
        
        return (
          <div
            key={questionIndex}
            style={{
              minWidth: '40px',
              height: '40px',
              margin: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: isActive ? 'bold' : 'normal',
              backgroundColor,
              color,
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'all 0.2s ease'
            }}
            onClick={() => setActiveStepIndex(questionIndex)}
            onMouseEnter={(e) => {
              if (!isActive && !hasAnswer) {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive && !hasAnswer) {
                e.currentTarget.style.backgroundColor = '#ffffff';
              }
            }}
          >
            {questionIndex + 1}
          </div>
        );
      });
      
      navigationItems.push(
        <div key={`row-${i}`} style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          marginBottom: '8px' 
        }}>
          {row}
        </div>
      );
    }

    const answeredCount = answers.filter(answer => answer !== undefined && answer !== '').length;
    const totalCount = questions.length;

    return (
      <Box padding="l">
        <SpaceBetween size="m">
          <div style={{ 
            textAlign: 'center', 
            fontWeight: 'bold', 
            fontSize: '16px',
            marginBottom: '16px'
          }}>
            答题进度
          </div>
          <div>
            {navigationItems}
          </div>
          <div style={{ 
            textAlign: 'center', 
            fontSize: '12px', 
            color: '#666',
            marginTop: '16px'
          }}>
            已完成 {answeredCount} / {totalCount} 题
            <div style={{ marginTop: '8px' }}>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${totalCount > 0 ? (answeredCount / totalCount) * 100 : 0}%`,
                  height: '100%',
                  backgroundColor: '#28a745',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
            </div>
          </div>
          <div style={{ 
            textAlign: 'left', 
            fontSize: '11px', 
            color: '#666',
            marginTop: '12px',
            borderTop: '1px solid #eee',
            paddingTop: '12px'
          }}>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ 
                display: 'inline-block', 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#0073bb', 
                marginRight: '8px',
                borderRadius: '2px'
              }}></span>
              当前题目
            </div>
            <div style={{ marginBottom: '4px' }}>
              <span style={{ 
                display: 'inline-block', 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#28a745', 
                marginRight: '8px',
                borderRadius: '2px'
              }}></span>
              已填写答案
            </div>
            <div>
              <span style={{ 
                display: 'inline-block', 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#ffffff', 
                border: '1px solid #ccc',
                marginRight: '8px',
                borderRadius: '2px'
              }}></span>
              未填写
            </div>
          </div>
        </SpaceBetween>
      </Box>
    );
  };

  // 渲染右侧工具栏（包含导航网格和计时器）
  const renderToolsPanel = () => {
    return (
      <SpaceBetween size="l">
        {/* 计时器显示 */}
        {hasStarted && (
          <Container header={<Header variant="h3">答题时间</Header>}>
            <SpaceBetween size="s">
              {isTimeLimited ? (
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}>
                    剩余时间
                  </div>
                  <div 
                    style={{ 
                      fontSize: '24px', 
                      fontWeight: 'bold', 
                      textAlign: 'center',
                      color: remainingTime <= 300 ? '#d13212' : '#0073bb' // 5分钟内显示红色
                    }}
                  >
                    {formatTime(remainingTime)}
                  </div>
                  <ProgressBar
                    value={(remainingTime / (timeLimit * 60)) * 100}
                    status={remainingTime <= 300 ? 'error' : 'success'}
                  />
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}>
                    已用时间
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', textAlign: 'center', color: '#0073bb' }}>
                    {getElapsedTime()}
                  </div>
                </div>
              )}
            </SpaceBetween>
          </Container>
        )}
        
        {/* 导航网格 */}
        {renderNavigationGrid()}
      </SpaceBetween>
    );
  };

  return (
    <>
      {/* 开始确认对话框 */}
      <Modal
        visible={showStartDialog}
        header="开始评估"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => navigate('/assessments')}>取消</Button>
              <Button variant="primary" onClick={startTimer}>
                开始答题
              </Button>
            </SpaceBetween>
          </Box>
        }
        onDismiss={() => navigate('/assessments')}
      >
        <SpaceBetween size="m">
          <div>请确认您已准备好开始评估。</div>
          {isTimeLimited && (
            <Alert type="info">
              <strong>注意：</strong>此评估有时间限制，总时长为 {timeLimit} 分钟。一旦开始，计时器将开始倒计时，时间到期时会自动提交。
            </Alert>
          )}
          <div>点击"开始答题"按钮后，您将无法返回此页面。</div>
        </SpaceBetween>
      </Modal>

      {/* 时间警告对话框 */}
      <Modal
        visible={showTimeWarning}
        header="时间提醒"
        footer={
          <Box float="right">
            <Button variant="primary" onClick={() => setShowTimeWarning(false)}>
              我知道了
            </Button>
          </Box>
        }
        onDismiss={() => setShowTimeWarning(false)}
      >
        <Alert type="warning">
          <strong>时间提醒：</strong>您的答题时间还剩5分钟，请抓紧时间完成答题。
        </Alert>
      </Modal>

      {/* 最终提交确认对话框 */}
      <Modal
        visible={showSubmitConfirmation}
        header="确认提交"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setShowSubmitConfirmation(false)}>
                返回检查
              </Button>
              <Button variant="primary" onClick={handleFinalSubmit}>
                确认提交
              </Button>
            </SpaceBetween>
          </Box>
        }
        onDismiss={() => setShowSubmitConfirmation(false)}
      >
        <SpaceBetween size="m">
          {renderSubmissionSummary()}
        </SpaceBetween>
      </Modal>

      <Modal
        visible={score !== undefined}
        header={getText('student.assessments.detail.your_score')}
        footer={
          <Box float="right">
            <Button variant="primary" onClick={() => navigate('/assessments')}>
              {getText('common.actions.finish')}
            </Button>
          </Box>
        }
      >
        <SpaceBetween size="l">
          <PieChart
            hideFilter
            hideLegend
            variant="donut"
            data={[
              { title: getText('assessment.correct'), value: score! },
              { title: getText('assessment.incorrect'), value: 100 - score! },
            ]}
            innerMetricValue={`${score}%`}
          />
          <Button fullWidth onClick={() => navigate('/review/' + assessmentId)}>
            {getText('common.actions.review')}
          </Button>
        </SpaceBetween>
      </Modal>
      
      <AppLayout
        toolsOpen={toolsOpen}
        onToolsChange={({ detail }) => setToolsOpen(detail.open)}
        toolsWidth={300}
        tools={renderToolsPanel()}
        content={
          hasStarted ? (
            <Container>
              <SpaceBetween size="l">
                {/* 当前题目显示 */}
                <Container header={
                  <Header variant="h2">
                    {getTextWithParams('student.assessments.detail.question_title', { number: activeStepIndex + 1 })} / {questions.length}
                  </Header>
                }>
                  <Box variant="p">{questions[activeStepIndex]?.question}</Box>
                </Container>

                {/* 答题区域 */}
                <Container header={<Header variant="h2">{getText('assessment.answer')}</Header>}>
                  {assessType === AssessType.freeTextAssessment ? (
                    <FormField label={getText('student.assessments.detail.provide_answer')}>
                      <Textarea
                        value={answers[activeStepIndex] || ''}
                        onChange={({ detail }) => {
                          const newAnswers = [...answers];
                          newAnswers[activeStepIndex] = detail.value;
                          setAnswers(newAnswers);
                        }}
                      />
                    </FormField>
                  ) : (
                    <FormField label={getText('student.assessments.detail.choose_answer')}>
                      <Tiles
                        columns={1}
                        value={answers[activeStepIndex] || ''}
                        items={(questions[activeStepIndex] as MultiChoice | SingleChoice | TrueFalse).answerChoices!.map((answerChoice, i) => ({ 
                          label: answerChoice, 
                          value: i.toString() 
                        }))}
                        onChange={({ detail }) => {
                          const newAnswers = [...answers];
                          newAnswers[activeStepIndex] = detail.value;
                          setAnswers(newAnswers);
                        }}
                      />
                    </FormField>
                  )}
                </Container>

                {/* 导航和提交按钮 */}
                <Container>
                  <SpaceBetween direction="horizontal" size="s">
                    <Button 
                      disabled={activeStepIndex === 0}
                      onClick={() => setActiveStepIndex(Math.max(0, activeStepIndex - 1))}
                    >
                      上一题
                    </Button>
                    
                    {activeStepIndex < questions.length - 1 ? (
                      <Button 
                        variant="primary"
                        onClick={() => setActiveStepIndex(Math.min(questions.length - 1, activeStepIndex + 1))}
                      >
                        下一题
                      </Button>
                    ) : (
                      <Button 
                        variant="primary"
                        onClick={handleSubmitClick}
                      >
                        提交答案
                      </Button>
                    )}
                  </SpaceBetween>
                </Container>
              </SpaceBetween>
            </Container>
          ) : (
            <Container header={<Header variant="h1">等待开始</Header>}>
              <SpaceBetween size="l">
                <Alert type="info">
                  请点击右上角的开始按钮开始答题。
                </Alert>
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Button variant="primary" onClick={() => setShowStartDialog(true)}>
                    开始答题
                  </Button>
                </div>
              </SpaceBetween>
            </Container>
          )
        }
        navigationHide
      />
      
      <Modal visible={showSpinner} header={<Header>{getText('student.assessments.detail.grading')}</Header>}>
        <SpaceBetween size="s" alignItems="center">
          <Spinner size="big" />
        </SpaceBetween>
      </Modal>
    </>
  );
};
