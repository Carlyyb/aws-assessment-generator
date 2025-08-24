import { useState, useEffect } from 'react';
import { Wizard, Container, Header, SpaceBetween, Box, Table, AppLayout } from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { StudentAssessment as RawStudentAssessment, AssessType, MultiChoice, SingleAnswer, TrueFalse } from '../graphql/API';
import { getStudentAssessment } from '../graphql/queries';
import { getText, getTextWithParams } from '../i18n/lang';

const client = generateClient();

type StudentAssessment = Omit<RawStudentAssessment, 'answers'> & { answers: [string | number] };

export default function ReviewAssessment() {
  const params = useParams();
  const navigate = useNavigate();

  const [studentAssessment, setStudentAssessment] = useState<StudentAssessment>();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(true); // 右侧工具栏开关状态

  useEffect(() => {
    const run = async () => {
      try {
        const resp = await (client.graphql<{ getStudentAssessment: RawStudentAssessment | null }>({
          query: getStudentAssessment,
          variables: { parentAssessId: params.id! },
        }) as Promise<{ data: { getStudentAssessment: RawStudentAssessment | null } }>);
        const result = resp.data.getStudentAssessment;
        if (!result) throw new Error('Not found');
        const parsedResult: StudentAssessment = { ...result, answers: JSON.parse(result.answers) };
        setStudentAssessment(parsedResult);
      } catch {
        // ignore
      }
    };
    if (params.id) run();
  }, [params.id]);

  if (!studentAssessment?.assessment) return null;

  const assessType = studentAssessment.assessment.assessType;

  const getQuestions = () => {
    if (!studentAssessment?.assessment || !assessType) return [];
    
    switch (assessType) {
      case AssessType.multiChoiceAssessment:
        return studentAssessment.assessment.multiChoiceAssessment || [];
      case AssessType.freeTextAssessment:
        return studentAssessment.assessment.freeTextAssessment || [];
      case AssessType.singleAnswerAssessment:
        return studentAssessment.assessment.singleAnswerAssessment || [];
      case AssessType.trueFalseAssessment:
        return studentAssessment.assessment.trueFalseAssessment || [];
      default:
        return [];
    }
  };

  // 辅助：格式化答案文本
  type MultiChoiceMaybeMulti = Omit<MultiChoice, 'correctAnswer'> & { correctAnswer: number | number[] };
  type AnswerValue = string | number | Array<string | number>;

  const toNumberArray = (v: AnswerValue): number[] => (Array.isArray(v) ? v : [v]).map((x) => Number(x));

  const formatAnswerText = (q: MultiChoice | SingleAnswer | TrueFalse, ans: AnswerValue): string => {
    if (assessType === AssessType.multiChoiceAssessment) {
      const mc = q as MultiChoice;
      const indices: number[] = toNumberArray(ans);
      const texts = indices
        .filter((i) => !isNaN(i) && i > 0 && (mc.answerChoices?.[i - 1] ?? undefined) !== undefined)
        .map((i) => mc.answerChoices![i - 1]);
      return texts.join(', ');
    }
    if (assessType === AssessType.singleAnswerAssessment) {
      const sa = q as SingleAnswer;
      const i = Number(ans);
      return i > 0 && sa.answerChoices?.[i - 1] ? sa.answerChoices[i - 1] : String(ans ?? '');
    }
    if (assessType === AssessType.trueFalseAssessment) {
      const tf = q as TrueFalse;
      const v = Array.isArray(ans) ? ans[0] : ans;
      if (typeof v === 'number') {
        const idx = v - 1;
        return tf.answerChoices?.[idx] ?? '';
      }
      return String(v ?? '');
    }
    // freeText 直接显示内容
    return String(ans ?? '');
  };

  const getCorrectAnswerText = (q: MultiChoice | SingleAnswer | TrueFalse): string => {
    if (assessType === AssessType.multiChoiceAssessment) {
      const mc = q as unknown as MultiChoiceMaybeMulti;
      const indices: number[] = Array.isArray(mc.correctAnswer) ? mc.correctAnswer.map((v) => +v) : [Number(mc.correctAnswer)];
      const texts = indices
        .filter((i) => !isNaN(i) && i > 0 && (mc.answerChoices?.[i - 1] ?? undefined) !== undefined)
        .map((i) => mc.answerChoices![i - 1]);
      return texts.join(', ');
    }
    if (assessType === AssessType.singleAnswerAssessment) {
      const sa = q as SingleAnswer;
      const i = Number(sa.correctAnswer);
      return i > 0 && sa.answerChoices?.[i - 1] ? sa.answerChoices[i - 1] : String(sa.correctAnswer ?? '');
    }
    if (assessType === AssessType.trueFalseAssessment) {
      const tf = q as TrueFalse;
      return String(tf.correctAnswer ?? '');
    }
    return '';
  };

  // 检查指定题目的答题是否正确
  const isQuestionCorrect = (questionIndex: number) => {
    if (!studentAssessment?.answers) return false;

    const questions = getQuestions();
    if (questionIndex >= questions.length) return false;

  const q = questions[questionIndex];
  const ua = studentAssessment.answers[questionIndex] as AnswerValue;

    switch (assessType) {
      case AssessType.multiChoiceAssessment: {
        const mc = q as unknown as MultiChoiceMaybeMulti;
        const correct: number[] = Array.isArray(mc.correctAnswer)
          ? mc.correctAnswer.map((v) => +v)
          : [Number(mc.correctAnswer)];
        const student: number[] = toNumberArray(ua);
        if (student.some((v) => !correct.includes(v))) return false; // 选了错误选项
        // 必须选全且不多不少
        return correct.length === student.length && correct.every((v) => student.includes(v));
      }
      case AssessType.singleAnswerAssessment: {
        const sa = q as SingleAnswer;
        return Number(ua) === Number(sa.correctAnswer);
      }
      case AssessType.trueFalseAssessment: {
        const tf = q as TrueFalse;
        const studentValue = typeof ua === 'number' ? tf.answerChoices?.[ua - 1] : String(ua);
        return studentValue === tf.correctAnswer;
      }
      case AssessType.freeTextAssessment: {
        const report = studentAssessment.report ? JSON.parse(studentAssessment.report) : {};
        const questionReport = report[questionIndex];
        if (questionReport && questionReport.rate !== undefined) {
          return questionReport.rate >= 0.7;
        }
        return false;
      }
      default:
        return false;
    }
  };

  // 渲染导航小方块
  const renderNavigationGrid = () => {
    const questions = getQuestions();
    if (questions.length === 0) return null;

    const navigationItems = [];
    for (let i = 0; i < questions.length; i += 7) {
      const row = questions.slice(i, i + 7).map((_, index) => {
        const questionIndex = i + index;
        const isActive = questionIndex === activeStepIndex;
        const isCorrect = isQuestionCorrect(questionIndex);
        
        // 确定背景色和文字色
        let backgroundColor, color;
        if (isActive) {
          backgroundColor = '#0073bb'; // 蓝色 - 当前活跃题目
          color = '#ffffff';
        } else if (isCorrect) {
          backgroundColor = '#28a745'; // 绿色 - 答对的题目
          color = '#ffffff';
        } else {
          backgroundColor = '#dc3545'; // 红色 - 答错的题目
          color = '#ffffff';
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
              if (!isActive) {
                e.currentTarget.style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.opacity = '1';
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

    const correctCount = questions.filter((_, index) => isQuestionCorrect(index)).length;
    const totalCount = questions.length;
    const scorePercentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    return (
      <Box padding="l">
        <SpaceBetween size="m">
          <div style={{ 
            textAlign: 'center', 
            fontWeight: 'bold', 
            fontSize: '16px',
            marginBottom: '16px'
          }}>
            答题回顾
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
            答对 {correctCount} / {totalCount} 题
            <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 'bold', color: scorePercentage >= 60 ? '#28a745' : '#dc3545' }}>
              得分: {scorePercentage}
            </div>
            <div style={{ marginTop: '8px' }}>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${scorePercentage}%`,
                  height: '100%',
                  backgroundColor: scorePercentage >= 60 ? '#28a745' : '#dc3545',
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
              答对
            </div>
            <div>
              <span style={{ 
                display: 'inline-block', 
                width: '12px', 
                height: '12px', 
                backgroundColor: '#dc3545', 
                marginRight: '8px',
                borderRadius: '2px'
              }}></span>
              答错
            </div>
          </div>
        </SpaceBetween>
      </Box>
    );
  };

  return (
    <AppLayout
      toolsOpen={toolsOpen}
      onToolsChange={({ detail }) => setToolsOpen(detail.open)}
      toolsWidth={300}
      tools={renderNavigationGrid()}
      content={
        <Wizard
          onSubmit={() => navigate('/assessments')}
          i18nStrings={{
            stepNumberLabel: (stepNumber) => getTextWithParams('students.assessments.review.question_number', { number: stepNumber }),
            collapsedStepsLabel: (stepNumber, stepsCount) => getTextWithParams('students.assessments.review.question_progress', { current: stepNumber, total: stepsCount }),
            cancelButton: getText('common.actions.cancel'),
            previousButton: getText('common.actions.previous'),
            nextButton: getText('common.actions.next'),
            submitButton: getText('common.actions.finish'),
            optional: getText('common.status.optional'),
          }}
          onCancel={() => navigate('/assessments')}
          onNavigate={({ detail }) => {
            setActiveStepIndex(detail.requestedStepIndex);
          }}
          activeStepIndex={activeStepIndex}
          allowSkipTo
          steps={getQuestions().map((assessment) => ({
              title: assessment.title,
              content: (
                <SpaceBetween size="l">
                  <Container header={<Header variant="h2">{getTextWithParams('students.assessments.review.question_title', { number: activeStepIndex + 1 })}</Header>}>
                    <Box variant="p">{assessment.question}</Box>
                  </Container>
                  <Container header={<Header variant="h2">{getText('students.assessments.review.answer')}</Header>}>
                    <SpaceBetween size="l">
                      {assessType === AssessType.multiChoiceAssessment || assessType === AssessType.singleAnswerAssessment ? (
                        ((assessment as MultiChoice | SingleAnswer).answerChoices || []).map((answerChoice, i) => (
                          <div
                            key={i}
                            style={{
                              border:
                                // 处理多选题的正确答案数组和单选题的单个答案
                                assessType === AssessType.multiChoiceAssessment
                                  ? (assessment as MultiChoice).correctAnswer!.includes(i + 1)
                                    ? `3px solid green`
                                    : studentAssessment.answers![activeStepIndex] === i + 1
                                    ? `3px solid red`
                                    : ''
                                  : (assessment as SingleAnswer).correctAnswer! - 1 === i
                                  ? `3px solid green`
                                  : studentAssessment.answers![activeStepIndex] === i + 1 &&
                                    studentAssessment.answers![activeStepIndex] !== (assessment as SingleAnswer).correctAnswer
                                  ? `3px solid red`
                                  : '',
                            }}
                          >
                            <Container>
                              <Box variant="p">{answerChoice}</Box>
                            </Container>
                          </div>
                        ))
                      ) : assessType === AssessType.trueFalseAssessment ? (
                        ((assessment as TrueFalse).answerChoices || []).map((answerChoice, i) => (
                          <div
                            key={i}
                            style={{
                              border:
                                (assessment as TrueFalse).correctAnswer === answerChoice
                                  ? `3px solid green`
                                  : studentAssessment.answers![activeStepIndex] === answerChoice &&
                                    studentAssessment.answers![activeStepIndex] !== (assessment as TrueFalse).correctAnswer
                                  ? `3px solid red`
                                  : '',
                            }}
                          >
                            <Container>
                              <Box variant="p">{answerChoice}</Box>
                            </Container>
                          </div>
                        ))
                      ) : (
                        <p style={{ whiteSpace: 'pre-wrap' }}>{studentAssessment.answers[activeStepIndex]}</p>
                      )}
                    </SpaceBetween>
                  </Container>
                  {JSON.parse(studentAssessment.report || '{}')[activeStepIndex] ? (
                    <>
                      <Container header={<Header variant="h2">{getText('students.assessments.review.rubric')}</Header>}>
                        <Table
                          columnDefinitions={[
                            {
                              id: 'weight',
                              header: getText('common.status.points'),
                              cell: (item) => item.weight,
                            },
                            {
                              id: 'point',
                              header: getText('common.status.description'),
                              cell: (item) => item.point,
                            },
                          ]}
                          items={studentAssessment.assessment!.freeTextAssessment![activeStepIndex].rubric}
                        />
                      </Container>
                      <Container header={<Header variant="h2">{getTextWithParams('students.assessments.review.points_with_rate', { rate: JSON.parse(studentAssessment.report!)[activeStepIndex].rate })}</Header>}>
                        <Box variant="p">{JSON.parse(studentAssessment.report!)[activeStepIndex].explanation}</Box>
                      </Container>
                    </>
                  ) : (
                    <Container header={<Header variant="h2">{getText('students.assessments.review.explanation')}</Header>}>
                      <SpaceBetween size="s">
                        {/* 判题符号 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isQuestionCorrect(activeStepIndex) ? (
                            <span style={{ color: '#28a745', fontSize: 20 }}>√</span>
                          ) : (
                            <span style={{ color: '#dc3545', fontSize: 20 }}>×</span>
                          )}
                          <span style={{ color: '#666', fontSize: 12 }}>
                            {isQuestionCorrect(activeStepIndex) ? '回答正确' : '回答错误'}
                          </span>
                        </div>
                        {/* 你的答案 / 正确答案 */}
                        {assessType !== AssessType.freeTextAssessment && (
                          <>
                            <Box variant="p">
                              <strong>你的答案：</strong>{' '}
                              {formatAnswerText(
                                assessment as MultiChoice | SingleAnswer | TrueFalse,
                                studentAssessment.answers[activeStepIndex] as AnswerValue
                              )}
                            </Box>
                            <Box variant="p">
                              <strong>正确答案：</strong>{' '}
                              {getCorrectAnswerText(assessment as MultiChoice | SingleAnswer | TrueFalse)}
                            </Box>
                          </>
                        )}
                        {/* 题目解析 */}
                        <Box variant="p">{(assessment as MultiChoice | SingleAnswer | TrueFalse).explanation}</Box>
                      </SpaceBetween>
                    </Container>
                  )}
                </SpaceBetween>
              ),
            }))}
        />
      }
      navigationHide
    />
  );
}
