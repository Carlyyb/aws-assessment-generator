import { useState, useReducer, useEffect, useContext } from 'react';
import { Wizard } from '@cloudscape-design/components';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { Assessment, AssessType, MultiChoice, FreeText, SingleChoice, TrueFalse } from '../graphql/API'; // CHANGELOG 2025-08-15 by 邱语堂: 增加问题类型单选/判断
import { getAssessment } from '../graphql/queries';
import { upsertAssessment } from '../graphql/mutations';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { useBreadcrumb } from '../contexts/breadcrumbs';
import { QAView } from '../components/QAView';
import { FreeTextView } from '../components/FreeTextView';
import { removeTypenames } from '../helpers';
import { getText, getTextWithParams } from '../i18n/lang';

const client = generateClient();

export enum ActionTypes {
  Delete,
  Update,
  Put,
}

type Reducer = (state: Assessment, actions: { type: ActionTypes; stepIndex?: number; key?: string; content?: any }) => Assessment;

const reducer: Reducer = (state, actions) => {
  const { type, stepIndex, key, content } = actions;
  switch (type) {
    case ActionTypes.Put:
      return content;
    case ActionTypes.Delete: {
      let newQuestions: any[] = [];
      switch (state.assessType) {
        case AssessType.multiChoiceAssessment:
          newQuestions = state.multiChoiceAssessment?.filter((_, i) => i !== stepIndex!) || [];
          return { ...state, multiChoiceAssessment: newQuestions };
        case AssessType.freeTextAssessment:
          newQuestions = state.freeTextAssessment?.filter((_, i) => i !== stepIndex!) || [];
          return { ...state, freeTextAssessment: newQuestions };
        case AssessType.singleChoiceAssessment:
          newQuestions = state.singleChoiceAssessment?.filter((_, i) => i !== stepIndex!) || [];
          return { ...state, singleChoiceAssessment: newQuestions };
        case AssessType.trueFalseAssessment:
          newQuestions = state.trueFalseAssessment?.filter((_, i) => i !== stepIndex!) || [];
          return { ...state, trueFalseAssessment: newQuestions };
        default:
          return state;
      }
    }
    case ActionTypes.Update: {
      switch (state.assessType) {
        case AssessType.multiChoiceAssessment: {
          const newQuestions = state.multiChoiceAssessment?.map((section, i) => {
            if (stepIndex !== i) return section;
            const newSection: any = { ...section };
            newSection[key!] = content;
            return newSection;
          }) || [];
          return { ...state, multiChoiceAssessment: newQuestions };
        }
        case AssessType.freeTextAssessment: {
          const newQuestions = state.freeTextAssessment?.map((section, i) => {
            if (stepIndex !== i) return section;
            const newSection: any = { ...section };
            newSection[key!] = content;
            return newSection;
          }) || [];
          return { ...state, freeTextAssessment: newQuestions };
        }
        case AssessType.singleChoiceAssessment: {
          const newQuestions = state.singleChoiceAssessment?.map((section, i) => {
            if (stepIndex !== i) return section;
            const newSection: any = { ...section };
            newSection[key!] = content;
            return newSection;
          }) || [];
          return { ...state, singleChoiceAssessment: newQuestions };
        }
        case AssessType.trueFalseAssessment: {
          const newQuestions = state.trueFalseAssessment?.map((section, i) => {
            if (stepIndex !== i) return section;
            const newSection: any = { ...section };
            newSection[key!] = content;
            return newSection;
          }) || [];
          return { ...state, trueFalseAssessment: newQuestions };
        }
        default:
          return state;
      }
    }
    default:
      throw Error('Unknown Action');
  }
};

export default () => {
  const params = useParams();
  const navigate = useNavigate();
  const dispatchAlert = useContext(DispatchAlertContext);
  const { setOverride, removeOverride } = useBreadcrumb();

  const [assessment, updateAssessment] = useReducer(reducer, {} as Assessment);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    client
      .graphql<any>({ query: getAssessment, variables: { id: params.id! } })
      .then(({ data }) => {
        const result = data.getAssessment;
        if (!result) throw new Error();
        const { updatedAt, ...content } = removeTypenames(result);
        updateAssessment({ type: ActionTypes.Put, content });
        
        // 设置面包屑覆盖，使测试名称显示在面包屑中
        if (content.name) {
          setOverride(`/edit-assessment/${params.id}`, content.name);
        }
      })
      .catch(() => {});
  }, [params.id, setOverride]);

  // 组件卸载时清理面包屑覆盖
  useEffect(() => {
    return () => {
      if (params.id) {
        removeOverride(`/edit-assessment/${params.id}`);
      }
    };
  }, [params.id, removeOverride]);

  const getQuestions = () => {
    if (!assessment || !assessment.assessType) return [];
    
    switch (assessment.assessType) {
      case AssessType.multiChoiceAssessment:
        return assessment.multiChoiceAssessment || [];
      case AssessType.freeTextAssessment:
        return assessment.freeTextAssessment || [];
      case AssessType.singleChoiceAssessment:
        return assessment.singleChoiceAssessment || [];
      case AssessType.trueFalseAssessment:
        return assessment.trueFalseAssessment || [];
      default:
        return [];
    }
  };

  const steps = getQuestions().map((q) => ({
      title: q.title,
      content:
        assessment.assessType === AssessType.multiChoiceAssessment ? (    // CHANGELOG 2025-08-15 by 邱语堂: 增加问题类型单选/判断
        <QAView activeStepIndex={activeStepIndex} assessment={q as MultiChoice} updateAssessment={updateAssessment} />
      ) : assessment.assessType === AssessType.freeTextAssessment ? (
        <FreeTextView activeStepIndex={activeStepIndex} freetextAssessment={q as FreeText} updateAssessment={updateAssessment} />
      ) : assessment.assessType === AssessType.singleChoiceAssessment ? (
        <QAView activeStepIndex={activeStepIndex} assessment={q as SingleChoice} updateAssessment={updateAssessment} />
      ) : assessment.assessType === AssessType.trueFalseAssessment ? (
        <QAView activeStepIndex={activeStepIndex} assessment={q as TrueFalse} updateAssessment={updateAssessment} />
      ) : null,
    }));

  return (
    <Wizard
      onSubmit={() => {
        const { course, ...inputAssessment } = assessment;
        client
          .graphql<any>({ query: upsertAssessment, variables: { input: inputAssessment } })
          .then(() => dispatchAlert({ type: AlertType.SUCCESS, content: getText('teachers.assessments.edit.update_success') }))
          .then(() => navigate('/assessments/find-assessments'))
          .catch(() => dispatchAlert({ type: AlertType.ERROR, content: getText('common.status.error') }));
      }}
      i18nStrings={{
        stepNumberLabel: (stepNumber) => getTextWithParams('teachers.assessments.edit.question_number', { number: stepNumber }),
        collapsedStepsLabel: (stepNumber, stepsCount) => getTextWithParams('teachers.assessments.edit.question_progress', { current: stepNumber, total: stepsCount }),
        skipToButtonLabel: (step, _stepNumber) => getTextWithParams('teachers.assessments.edit.skip_to', { title: step.title }),
        cancelButton: getText('teachers.assessments.edit.delete_question'),
        previousButton: getText('common.actions.previous'),
        nextButton: getText('common.actions.next'),
        submitButton: getText('common.actions.submit'),
        optional: getText('common.status.optional'),
      }}
      onCancel={() => updateAssessment({ type: ActionTypes.Delete, stepIndex: activeStepIndex })}
      onNavigate={({ detail }) => setActiveStepIndex(detail.requestedStepIndex)}
      activeStepIndex={activeStepIndex}
      steps={steps}
    />
  );
};
