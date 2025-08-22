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

export default () => {
  const params = useParams();
  const navigate = useNavigate();

  const [studentAssessment, setStudentAssessment] = useState<StudentAssessment>();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(true); // 右侧工具栏开关状态

  useEffect(() => {
    client
      .graphql<any>({ query: getStudentAssessment, variables: { parentAssessId: params.id! } })
      .then(({ data }) => {
        const result: RawStudentAssessment = data.getStudentAssessment;
        if (!result) throw new Error();
        const parsedResult: StudentAssessment = { ...result, answers: JSON.parse(result.answers) };
        setStudentAssessment(parsedResult);
      })
      .catch(() => {});
  }, []);

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

  // 检查指定题目的答题是否正确
  const isQuestionCorrect = (questionIndex: number) => {
    if (!studentAssessment?.answers) return false;
    
    const questions = getQuestions();
    if (questionIndex >= questions.length) return false;
    
    const question = questions[questionIndex];
    const userAnswer = studentAssessment.answers[questionIndex];
    
    switch (assessType) {
      case AssessType.multiChoiceAssessment:
      case AssessType.singleAnswerAssessment:
        return userAnswer === (question as MultiChoice | SingleAnswer).correctAnswer;
      case AssessType.trueFalseAssessment:
        return userAnswer === (question as TrueFalse).correctAnswer;
      case AssessType.freeTextAssessment:
        // 对于自由文本题，从报告中获取评分信息
        const report = studentAssessment.report ? JSON.parse(studentAssessment.report) : {};
        const questionReport = report[questionIndex];
        // 如果有评分报告，根据评分判断（这里假设评分超过一定阈值算正确）
        if (questionReport && questionReport.rate !== undefined) {
          return questionReport.rate >= 0.7; // 70%以上算正确
        }
        return false; // 没有评分信息时默认为错误
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
              得分: {scorePercentage}%
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
                                (assessment as MultiChoice | SingleAnswer).correctAnswer! - 1 === i
                                  ? `3px solid green`
                                  : studentAssessment.answers![activeStepIndex] === i + 1 &&
                                    studentAssessment.answers![activeStepIndex] !== (assessment as MultiChoice | SingleAnswer).correctAnswer
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
                      <Box variant="p">{(assessment as MultiChoice | SingleAnswer | TrueFalse).explanation}</Box>
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
};
