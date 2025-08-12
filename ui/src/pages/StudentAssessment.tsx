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
} from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { MultiChoice, FreeText, AssessType, StudentAssessment } from '../graphql/API';
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
  const [questions, setQuestions] = useState<MultiChoice[] | FreeText[]>([]);
  const [assessType, setAssessType] = useState<AssessType>();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [score, setScore] = useState<number>();

  useEffect(() => {
    client
      .graphql<any>({ query: getStudentAssessment, variables: { parentAssessId: params.id! } })
      .then(({ data }) => {
        const result: StudentAssessment = data.getStudentAssessment;
        setAssessmentId(result.parentAssessId);
        setAssessType(result.assessment?.assessType);
        setQuestions(result.assessment![result.assessment!.assessType]!);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <Modal
        visible={score !== undefined}
        header={getText('pages.student_assessment.your_score')}
        footer={
          <Box float="right">
            <Button variant="primary" onClick={() => navigate('/assessments')}>
              {getText('common.finish')}
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
            {getText('common.review')}
          </Button>
        </SpaceBetween>
      </Modal>
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
          stepNumberLabel: (stepNumber) => getTextWithParams('pages.student_assessment.question_number', { number: stepNumber }),
          collapsedStepsLabel: (stepNumber, stepsCount) => getTextWithParams('pages.student_assessment.question_progress', { current: stepNumber, total: stepsCount }),
          skipToButtonLabel: (step, _stepNumber) => getTextWithParams('pages.student_assessment.skip_to', { title: step.title }),
          cancelButton: getText('common.cancel'),
          previousButton: getText('common.previous'),
          nextButton: getText('common.next'),
          submitButton: getText('common.submit'),
          optional: getText('common.optional'),
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
                <Container header={<Header variant="h2">{getTextWithParams('pages.student_assessment.question_title', { number: activeStepIndex + 1 })}</Header>}>
                  <Box variant="p">{q.question}</Box>
                </Container>
                <Container header={<Header variant="h2">{getText('assessment.answer')}</Header>}>
                  {assessType === AssessType.freeTextAssessment ? (
                    <FormField label={getText('pages.student_assessment.provide_answer')}>
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
                    <FormField label={getText('pages.student_assessment.choose_answer')}>
                      <Tiles
                        columns={1}
                        value={answers[activeStepIndex]}
                        items={(q as MultiChoice).answerChoices!.map((answerChoice, i) => ({ label: answerChoice, value: i.toString() }))}
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
      <Modal visible={showSpinner} header={<Header>{getText('pages.student_assessment.grading')}</Header>}>
        <SpaceBetween size="s" alignItems="center">
          <Spinner size="big" />
        </SpaceBetween>
      </Modal>
    </>
  );
};
