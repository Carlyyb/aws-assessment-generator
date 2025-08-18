import { useState, useEffect, useContext } from 'react';
import {
  Wizard,
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
  const [navigationOpen, setNavigationOpen] = useState(true); // 导航栏开关状态

  useEffect(() => {
    client
      .graphql<any>({ query: getStudentAssessment, variables: { parentAssessId: params.id! } })
      .then(({ data }) => {
        const result: StudentAssessment = data.getStudentAssessment;
        setAssessmentId(result.parentAssessId);
        setAssessType(result.assessment?.assessType);
        
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
      })
      .catch(() => {});
  }, []);

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

  return (
    <>
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
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        navigationWidth={340}
        navigation={renderNavigationGrid()}
        content={
          <Wizard
            onSubmit={() => {
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
            }}
            i18nStrings={{
              stepNumberLabel: (stepNumber) => getTextWithParams('student.assessments.detail.question_number', { number: stepNumber }),
              collapsedStepsLabel: (stepNumber, stepsCount) => getTextWithParams('student.assessments.detail.question_progress', { current: stepNumber, total: stepsCount }),
              skipToButtonLabel: (step, _stepNumber) => getTextWithParams('student.assessments.detail.skip_to', { title: step.title }),
              cancelButton: getText('common.actions.cancel'),
              previousButton: getText('common.actions.previous'),
              nextButton: getText('common.actions.next'),
              submitButton: getText('common.actions.submit'),
              optional: getText('common.labels.optional'),
            }}
            onCancel={() => navigate('/assessments')}
            onNavigate={({ detail }) => {
              setActiveStepIndex(detail.requestedStepIndex);
            }}
            activeStepIndex={activeStepIndex}
            allowSkipTo
            steps={questions.map((q) => {
              return {
                title: q.title,
                content: (
                  <SpaceBetween size="l">
                    <Container header={<Header variant="h2">{getTextWithParams('student.assessments.detail.question_title', { number: activeStepIndex + 1 })}</Header>}>
                      <Box variant="p">{q.question}</Box>
                    </Container>
                    <Container header={<Header variant="h2">{getText('assessment.answer')}</Header>}>
                      {assessType === AssessType.freeTextAssessment ? (
                        <FormField label={getText('student.assessments.detail.provide_answer')}>
                          <Textarea
                            value={answers[activeStepIndex]}
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
                            value={answers[activeStepIndex]}
                            items={(q as MultiChoice | SingleChoice | TrueFalse).answerChoices!.map((answerChoice, i) => ({ label: answerChoice, value: i.toString() }))}
                            onChange={({ detail }) => {
                              const newAnswers = [...answers];
                              newAnswers[activeStepIndex] = detail.value;
                              setAnswers(newAnswers);
                            }}
                          />
                        </FormField>
                      )}
                    </Container>
                  </SpaceBetween>
                ),
              };
            })}
          />
        }
        toolsHide
      />
      
      <Modal visible={showSpinner} header={<Header>{getText('student.assessments.detail.grading')}</Header>}>
        <SpaceBetween size="s" alignItems="center">
          <Spinner size="big" />
        </SpaceBetween>
      </Modal>
    </>
  );
};
