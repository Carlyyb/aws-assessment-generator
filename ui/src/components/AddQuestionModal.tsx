import React, { useState, useEffect } from 'react';
import {
  Modal,
  Box,
  SpaceBetween,
  Button,
  FormField,
  Input,
  Textarea,
  Select,
  SelectProps,
  Container,
  Header,
  Alert
} from '@cloudscape-design/components';
import { AssessType, MultiChoiceInput, FreeTextInput, SingleAnswerInput, TrueFalseInput, RubricInput } from '../graphql/API';

interface AddQuestionModalProps {
  visible: boolean;
  onDismiss: () => void;
  onAddQuestion: (question: any, questionType: AssessType) => void;
  assessmentType: AssessType;
}

export const AddQuestionModal: React.FC<AddQuestionModalProps> = ({
  visible,
  onDismiss,
  onAddQuestion,
  assessmentType
}) => {
  const [questionType, setQuestionType] = useState<SelectProps.Option | null>(null);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [explanation, setExplanation] = useState('');
  
  // 选择题相关状态
  const [answerChoices, setAnswerChoices] = useState<string[]>(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState<number | string | null>(null);
  
  // 简答题相关状态
  const [rubric, setRubric] = useState<RubricInput[]>([{ weight: 1, point: '' }]);

  // 题型选项
  const questionTypeOptions: SelectProps.Option[] = [
    { label: '多选题', value: AssessType.multiChoiceAssessment },
    { label: '单选题', value: AssessType.singleAnswerAssessment },
    { label: '判断题', value: AssessType.trueFalseAssessment },
    { label: '简答题', value: AssessType.freeTextAssessment }
  ];

  // 根据当前测试类型设置默认题型
  useEffect(() => {
    const defaultOption = questionTypeOptions.find(option => option.value === assessmentType);
    if (defaultOption) {
      setQuestionType(defaultOption);
    }
  }, [assessmentType]);

  // 当题型改变时重置相关状态
  useEffect(() => {
    if (questionType?.value === AssessType.trueFalseAssessment) {
      setAnswerChoices(['正确', '错误']);
      setCorrectAnswer(null);
    } else if (questionType?.value === AssessType.singleAnswerAssessment || questionType?.value === AssessType.multiChoiceAssessment) {
      setAnswerChoices(['', '', '', '']);
      setCorrectAnswer(null);
    } else if (questionType?.value === AssessType.freeTextAssessment) {
      setRubric([{ weight: 1, point: '' }]);
    }
  }, [questionType]);

  const resetForm = () => {
    setTitle('');
    setQuestion('');
    setExplanation('');
    setAnswerChoices(['', '', '', '']);
    setCorrectAnswer(null);
    setRubric([{ weight: 1, point: '' }]);
  };

  const handleSubmit = () => {
    if (!questionType || !title.trim() || !question.trim()) {
      return;
    }

    let newQuestion: any;

    switch (questionType.value) {
      case AssessType.multiChoiceAssessment:
        newQuestion = {
          title: title.trim(),
          question: question.trim(),
          answerChoices: answerChoices.filter(choice => choice.trim() !== ''),
          correctAnswer: [typeof correctAnswer === 'number' ? correctAnswer : 1],
          explanation: explanation.trim()
        } as MultiChoiceInput;
        break;

      case AssessType.singleAnswerAssessment:
        newQuestion = {
          title: title.trim(),
          question: question.trim(),
          answerChoices: answerChoices.filter(choice => choice.trim() !== ''),
          correctAnswer: typeof correctAnswer === 'number' ? correctAnswer : 1,
          explanation: explanation.trim()
        } as SingleAnswerInput;
        break;

      case AssessType.trueFalseAssessment:
        newQuestion = {
          title: title.trim(),
          question: question.trim(),
          answerChoices: ['正确', '错误'],
          correctAnswer: typeof correctAnswer === 'string' ? correctAnswer : '正确',
          explanation: explanation.trim()
        } as TrueFalseInput;
        break;

      case AssessType.freeTextAssessment:
        newQuestion = {
          title: title.trim(),
          question: question.trim(),
          rubric: rubric.filter(item => item.point.trim() !== '')
        } as FreeTextInput;
        break;

      default:
        return;
    }

    onAddQuestion(newQuestion, questionType.value as AssessType);
    resetForm();
    onDismiss();
  };

  const addAnswerChoice = () => {
    setAnswerChoices([...answerChoices, '']);
  };

  const removeAnswerChoice = (index: number) => {
    if (answerChoices.length > 2) {
      const newChoices = answerChoices.filter((_, i) => i !== index);
      setAnswerChoices(newChoices);
      // 如果删除的是当前正确答案，重置正确答案
      if (typeof correctAnswer === 'number' && correctAnswer === index + 1) {
        setCorrectAnswer(null);
      } else if (typeof correctAnswer === 'number' && correctAnswer > index + 1) {
        setCorrectAnswer(correctAnswer - 1);
      }
    }
  };

  const updateAnswerChoice = (index: number, value: string) => {
    const newChoices = [...answerChoices];
    newChoices[index] = value;
    setAnswerChoices(newChoices);
  };

  const addRubricItem = () => {
    setRubric([...rubric, { weight: 1, point: '' }]);
  };

  const removeRubricItem = (index: number) => {
    if (rubric.length > 1) {
      setRubric(rubric.filter((_, i) => i !== index));
    }
  };

  const updateRubricItem = (index: number, field: 'weight' | 'point', value: string | number) => {
    const newRubric = [...rubric];
    newRubric[index] = { ...newRubric[index], [field]: value };
    setRubric(newRubric);
  };

  const isFormValid = () => {
    if (!questionType || !title.trim() || !question.trim()) {
      return false;
    }

    if (questionType.value === AssessType.multiChoiceAssessment || questionType.value === AssessType.singleAnswerAssessment) {
      const validChoices = answerChoices.filter(choice => choice.trim() !== '');
      return validChoices.length >= 2 && correctAnswer !== null;
    }

    if (questionType.value === AssessType.trueFalseAssessment) {
      return correctAnswer !== null;
    }

    if (questionType.value === AssessType.freeTextAssessment) {
      return rubric.some(item => item.point.trim() !== '');
    }

    return true;
  };

  return (
    <Modal
      visible={visible}
      onDismiss={() => {
        resetForm();
        onDismiss();
      }}
      header={<Header variant="h2">添加新题目</Header>}
      size="large"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                resetForm();
                onDismiss();
              }}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!isFormValid()}
            >
              添加题目
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <Alert type="info">
          添加的新题目将插入到当前题目列表的末尾。
        </Alert>

        <FormField label="题目类型">
          <Select
            selectedOption={questionType}
            onChange={({ detail }) => setQuestionType(detail.selectedOption)}
            options={questionTypeOptions}
            placeholder="选择题目类型"
          />
        </FormField>

        <FormField label="题目标题" stretch>
          <Input
            value={title}
            onChange={({ detail }) => setTitle(detail.value)}
            placeholder="输入题目标题"
          />
        </FormField>

        <FormField label="题目内容" stretch>
          <Textarea
            value={question}
            onChange={({ detail }) => setQuestion(detail.value)}
            placeholder="输入题目内容"
            rows={4}
          />
        </FormField>

        {/* 选择题选项 */}
        {questionType && (questionType.value === AssessType.multiChoiceAssessment || questionType.value === AssessType.singleAnswerAssessment) && (
          <Container header={<Header variant="h3">答案选项</Header>}>
            <SpaceBetween size="m">
              {answerChoices.map((choice, index) => (
                <FormField
                  key={index}
                  label={`选项 ${String.fromCharCode(65 + index)}`}
                  stretch
                >
                  <SpaceBetween size="xs" direction="horizontal">
                    <Input
                      value={choice}
                      onChange={({ detail }) => updateAnswerChoice(index, detail.value)}
                      placeholder={`输入选项 ${String.fromCharCode(65 + index)}`}
                    />
                    {answerChoices.length > 2 && (
                      <Button
                        iconName="remove"
                        variant="icon"
                        onClick={() => removeAnswerChoice(index)}
                      />
                    )}
                  </SpaceBetween>
                </FormField>
              ))}
              <Button
                iconName="add-plus"
                onClick={addAnswerChoice}
              >
                添加选项
              </Button>

              <FormField label="正确答案">
                <Select
                  selectedOption={
                    typeof correctAnswer === 'number'
                      ? { label: `选项 ${String.fromCharCode(64 + correctAnswer)}`, value: correctAnswer.toString() }
                      : null
                  }
                  onChange={({ detail }) => setCorrectAnswer(parseInt(detail.selectedOption?.value || '1'))}
                  options={answerChoices
                    .map((choice, index) => ({
                      label: `选项 ${String.fromCharCode(65 + index)}${choice.trim() ? `: ${choice}` : ''}`,
                      value: (index + 1).toString()
                    }))
                    .filter((_, index) => answerChoices[index].trim() !== '')
                  }
                  placeholder="选择正确答案"
                />
              </FormField>
            </SpaceBetween>
          </Container>
        )}

        {/* 判断题选项 */}
        {questionType && questionType.value === AssessType.trueFalseAssessment && (
          <Container header={<Header variant="h3">正确答案</Header>}>
            <Select
              selectedOption={
                typeof correctAnswer === 'string'
                  ? { label: correctAnswer, value: correctAnswer }
                  : null
              }
              onChange={({ detail }) => setCorrectAnswer(detail.selectedOption?.value as string)}
              options={[
                { label: '正确', value: '正确' },
                { label: '错误', value: '错误' }
              ]}
              placeholder="选择正确答案"
            />
          </Container>
        )}

        {/* 简答题评分点 */}
        {questionType && questionType.value === AssessType.freeTextAssessment && (
          <Container header={<Header variant="h3">评分标准</Header>}>
            <SpaceBetween size="m">
              {rubric.map((item, index) => (
                <SpaceBetween key={index} size="xs" direction="horizontal">
                  <FormField label="分值" stretch>
                    <Input
                      type="number"
                      value={item.weight.toString()}
                      onChange={({ detail }) => updateRubricItem(index, 'weight', parseInt(detail.value) || 0)}
                    />
                  </FormField>
                  <FormField label="评分点描述" stretch>
                    <Textarea
                      value={item.point}
                      onChange={({ detail }) => updateRubricItem(index, 'point', detail.value)}
                      placeholder="描述此评分点的要求"
                    />
                  </FormField>
                  {rubric.length > 1 && (
                    <Button
                      iconName="remove"
                      variant="icon"
                      onClick={() => removeRubricItem(index)}
                    />
                  )}
                </SpaceBetween>
              ))}
              <Button
                iconName="add-plus"
                onClick={addRubricItem}
              >
                添加评分点
              </Button>
            </SpaceBetween>
          </Container>
        )}

        {/* 解释说明 */}
        {questionType && questionType.value !== AssessType.freeTextAssessment && (
          <FormField label="答案解释（可选）" stretch>
            <Textarea
              value={explanation}
              onChange={({ detail }) => setExplanation(detail.value)}
              placeholder="输入答案解释"
              rows={3}
            />
          </FormField>
        )}
      </SpaceBetween>
    </Modal>
  );
};
