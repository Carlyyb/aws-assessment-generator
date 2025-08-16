import { useState, useEffect } from 'react';
import { Wizard, Container, Header, SpaceBetween, Box, Table } from '@cloudscape-design/components';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { StudentAssessment as RawStudentAssessment, AssessType, MultiChoice, SingleChoice, TrueFalse } from '../graphql/API';
import { getStudentAssessment } from '../graphql/queries';
import { getText, getTextWithParams } from '../i18n/lang';

const client = generateClient();

type StudentAssessment = Omit<RawStudentAssessment, 'answers'> & { answers: [string | number] };

export default () => {
  const params = useParams();
  const navigate = useNavigate();

  const [studentAssessment, setStudentAssessment] = useState<StudentAssessment>();
  const [activeStepIndex, setActiveStepIndex] = useState(0);

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
      case AssessType.singleChoiceAssessment:
        return studentAssessment.assessment.singleChoiceAssessment || [];
      case AssessType.trueFalseAssessment:
        return studentAssessment.assessment.trueFalseAssessment || [];
      default:
        return [];
    }
  };

  return (
    <Wizard
      onSubmit={() => navigate('/assessments')}
      i18nStrings={{
        stepNumberLabel: (stepNumber) => getTextWithParams('teachers.assessments.review.question_number', { number: stepNumber }),
        collapsedStepsLabel: (stepNumber, stepsCount) => getTextWithParams('teachers.assessments.review.question_progress', { current: stepNumber, total: stepsCount }),
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
              <Container header={<Header variant="h2">{getTextWithParams('teachers.assessments.review.question_title', { number: activeStepIndex + 1 })}</Header>}>
                <Box variant="p">{assessment.question}</Box>
              </Container>
              <Container header={<Header variant="h2">{getText('teachers.assessments.review.answer')}</Header>}>
                <SpaceBetween size="l">
                  {assessType === AssessType.multiChoiceAssessment || assessType === AssessType.singleChoiceAssessment ? (
                    (assessment as MultiChoice | SingleChoice).answerChoices.map((answerChoice, i) => (
                      <div
                        key={i}
                        style={{
                          border:
                            (assessment as MultiChoice | SingleChoice).correctAnswer! - 1 === i
                              ? `3px solid green`
                              : studentAssessment.answers![activeStepIndex] === i + 1 &&
                                studentAssessment.answers![activeStepIndex] !== (assessment as MultiChoice | SingleChoice).correctAnswer
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
                    (assessment as TrueFalse).answerChoices.map((answerChoice, i) => (
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
                  <Container header={<Header variant="h2">{getText('teachers.assessments.review.rubric')}</Header>}>
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
                  <Container header={<Header variant="h2">{getTextWithParams('teachers.assessments.review.points_with_rate', { rate: JSON.parse(studentAssessment.report!)[activeStepIndex].rate })}</Header>}>
                    <Box variant="p">{JSON.parse(studentAssessment.report!)[activeStepIndex].explanation}</Box>
                  </Container>
                </>
              ) : (
                <Container header={<Header variant="h2">{getText('teachers.assessments.review.explanation')}</Header>}>
                  <Box variant="p">{(assessment as MultiChoice | SingleChoice | TrueFalse).explanation}</Box>
                </Container>
              )}
            </SpaceBetween>
          ),
        }))}
    />
  );
};
