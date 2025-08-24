import { Container, Header, SpaceBetween, Button, Textarea, Tiles } from '@cloudscape-design/components';
import { ActionTypes } from '../pages/EditAssessments';
import { getText, getTextWithParams } from '../i18n/lang';
import { MultiChoice, FreeText, TrueFalse, SingleAnswer } from '../graphql/API'; // CHANGELOG 2025-08-15 by 邱语堂: 增加问题类型单选/判断


type QAViewProps = {
  activeStepIndex: number;
  assessment: MultiChoice | FreeText | TrueFalse | SingleAnswer;    // CHANGELOG 2025-08-15 by 邱语堂: 增加问题类型单选/判断
  updateAssessment: (props: { type: ActionTypes; stepIndex: number; key: string; content: any }) => void;
};

export const QAView = ({ activeStepIndex, assessment, updateAssessment }: QAViewProps) => {
  // 判断题型
  const isMultiChoice = 'answerChoices' in assessment && Array.isArray(assessment.correctAnswer);  
  const isSingleAnswer = 'answerChoices' in assessment && typeof assessment.correctAnswer === 'number' && assessment.answerChoices.length >= 3;  // CHANGELOG 2025-08-15 by 邱语堂: 增加问题类型单选/判断（单选默认四个选项）
  const isTrueFalse = 'answerChoices' in assessment && typeof assessment.correctAnswer === 'string' && assessment.answerChoices.length === 2;     //  单选默认四个选项，判断默认两个选项
  const isFreeText = 'rubric' in assessment;  

  return (
    <SpaceBetween size="l">
      <Container header={<Header variant="h2">{getTextWithParams('components.assessment.question_number', { number: activeStepIndex + 1 })}</Header>}>
        <Textarea
          onChange={({ detail }) =>
            updateAssessment({ type: ActionTypes.Update, stepIndex: activeStepIndex, key: 'question', content: detail.value })
          }
          value={assessment.question}
        />
      </Container>

      {(isMultiChoice || isSingleAnswer || isTrueFalse) && (      // CHANGELOG 2025-08-15 by 邱语堂: 修改函数校验逻辑，兼容新题型，判断和单选
        <Container header={<Header variant="h2">{getText('components.assessment.edit_answers')}</Header>}>
          <SpaceBetween size="l" direction="horizontal" alignItems="center">
            {assessment.answerChoices?.map((answerChoice, answerIndex) => (
              <Container
                key={`answer-${answerIndex}`}
                header={
                  <Header
                    variant="h2"
                    actions={
                      assessment.answerChoices && assessment.answerChoices.length > 2 ? (
                        <Button
                          iconName="close"
                          variant="icon"
                          onClick={() => {
                            const newAnswerChoices = assessment.answerChoices.filter((_a, i) => answerIndex !== i);
                            updateAssessment({
                              type: ActionTypes.Update,
                              stepIndex: activeStepIndex,
                              key: 'answerChoices',
                              content: newAnswerChoices,
                            });
                            
                            // 更新正确答案索引
                            if (isMultiChoice) {
                              const correctAnswers = Array.isArray(assessment.correctAnswer) 
                                ? assessment.correctAnswer 
                                : [assessment.correctAnswer as number];
                              const newCorrectAnswers = correctAnswers
                                .filter(ans => (ans as number) !== (answerIndex + 1))
                                .map(ans => (ans as number) > (answerIndex + 1) ? (ans as number) - 1 : (ans as number));
                              
                              if (newCorrectAnswers.length === 0) {
                                newCorrectAnswers.push(1);
                              }
                              
                              updateAssessment({
                                type: ActionTypes.Update,
                                stepIndex: activeStepIndex,
                                key: 'correctAnswer',
                                content: newCorrectAnswers,
                              });
                            } else if (isSingleAnswer) {
                              const currentCorrect = assessment.correctAnswer as number;
                              let newCorrect = currentCorrect;
                              if (currentCorrect === (answerIndex + 1)) {
                                newCorrect = 1; // 重置为第一个选项
                              } else if (currentCorrect > (answerIndex + 1)) {
                                newCorrect = currentCorrect - 1;
                              }
                              
                              updateAssessment({
                                type: ActionTypes.Update,
                                stepIndex: activeStepIndex,
                                key: 'correctAnswer',
                                content: newCorrect,
                              });
                            }
                          }}
                        />
                      ) : undefined
                    }
                  />
                }
              >
                <Textarea
                  onChange={({ detail }) =>
                    updateAssessment({
                      type: ActionTypes.Update,
                      stepIndex: activeStepIndex,
                      key: 'answerChoices',
                      content: assessment.answerChoices.map((answerChoice, i) => (answerIndex === i ? detail.value : answerChoice)),
                    })
                  }
                  value={answerChoice!}
                />
              </Container>
            ))}
            {!isTrueFalse && (
              <Container>
                <Button
                  iconName="add-plus"
                  variant="icon"
                  onClick={() =>
                    updateAssessment({
                      type: ActionTypes.Update,
                      stepIndex: activeStepIndex,
                      key: 'answerChoices',
                      content: [...(assessment.answerChoices || []), ''],
                    })
                  }
                />
              </Container>
            )}
          </SpaceBetween>
        </Container>
      )}

      {isMultiChoice && (
        <Container header={<Header variant="h2">{getText('components.assessment.choose_multiple_answers')}</Header>}>
          <SpaceBetween size="s">
            {assessment.answerChoices.map((answerChoice, i) => {
              const correctAnswers = Array.isArray(assessment.correctAnswer) 
                ? assessment.correctAnswer 
                : [assessment.correctAnswer];
              const isSelected = correctAnswers.includes(i + 1);
              
              return (
                <Tiles
                  key={`answer-${i}`}
                  value={isSelected ? "selected" : "unselected"}
                  items={[
                    { label: `${String.fromCharCode(65 + i)}: ${answerChoice}`, value: "selected" }
                  ]}
                  onChange={() => {
                    let newCorrectAnswers = [...correctAnswers];
                    if (isSelected) {
                      // 取消选择
                      newCorrectAnswers = newCorrectAnswers.filter(ans => ans !== (i + 1));
                    } else {
                      // 添加选择
                      newCorrectAnswers.push(i + 1);
                    }
                    // 确保至少有一个答案被选中
                    if (newCorrectAnswers.length === 0) {
                      newCorrectAnswers = [1];
                    }
                    newCorrectAnswers.sort();
                    
                    updateAssessment({
                      type: ActionTypes.Update,
                      stepIndex: activeStepIndex,
                      key: 'correctAnswer',
                      content: newCorrectAnswers,
                    });
                  }}
                />
              );
            })}
          </SpaceBetween>
        </Container>
      )}

      {isSingleAnswer && (
        <Container header={<Header variant="h2">{getText('components.assessment.choose_answer')}</Header>}>
          <Tiles
            value={((assessment.correctAnswer as number) - 1).toString()}
            items={assessment.answerChoices.map((answerChoice, i) => ({ label: answerChoice, value: i.toString() }))}
            onChange={({ detail }) =>
              updateAssessment({
                type: ActionTypes.Update,
                stepIndex: activeStepIndex,
                key: 'correctAnswer',
                content: +detail.value + 1,
              })
            }
          />
        </Container>
      )}

      {isTrueFalse && (
        <Container header={<Header variant="h2">{getText('components.assessment.choose_answer')}</Header>}>
          <Tiles
            value={assessment.correctAnswer as string}
            items={assessment.answerChoices.map((answerChoice) => ({ label: answerChoice, value: answerChoice }))}
            onChange={({ detail }) =>
              updateAssessment({
                type: ActionTypes.Update,
                stepIndex: activeStepIndex,
                key: 'correctAnswer',
                content: detail.value,
              })
            }
          />
        </Container>
      )}

      {(isMultiChoice || isSingleAnswer || isTrueFalse) && (
        <Container header={<Header variant="h2">{getText('components.assessment.explanation')}</Header>}>
          <Textarea
            onChange={({ detail }) =>
              updateAssessment({ type: ActionTypes.Update, stepIndex: activeStepIndex, key: 'explanation', content: detail.value })
            }
            value={assessment.explanation}
          />
        </Container>
      )}

      {isFreeText && (
        <Container header={<Header variant="h2">{getText('components.assessment.rubric')}</Header>}>
          {/* 简答题评分点展示与编辑，可根据实际需求扩展 */}
          {assessment.rubric.map((rubricItem, idx) => (
            <Container key={`rubric-${idx}`}>
              <Textarea
                value={rubricItem.point}
                onChange={({ detail }) => {
                  const newRubric = assessment.rubric.map((item, i) =>
                    i === idx ? { ...item, point: detail.value } : item
                  );
                  updateAssessment({
                    type: ActionTypes.Update,
                    stepIndex: activeStepIndex,
                    key: 'rubric',
                    content: newRubric,
                  });
                }}
              />
              <Textarea
                value={rubricItem.weight.toString()}
                onChange={({ detail }) => {
                  const newRubric = assessment.rubric.map((item, i) =>
                    i === idx ? { ...item, weight: Number(detail.value) } : item
                  );
                  updateAssessment({
                    type: ActionTypes.Update,
                    stepIndex: activeStepIndex,
                    key: 'rubric',
                    content: newRubric,
                  });
                }}
              />
            </Container>
          ))}
        </Container>
      )}
    </SpaceBetween>
  );
};
