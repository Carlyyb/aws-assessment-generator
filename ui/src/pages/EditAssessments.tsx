import { useState, useReducer, useEffect, useContext } from 'react';
import { Wizard, AppLayout, Box, SpaceBetween } from '@cloudscape-design/components';
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
  const [navigationOpen, setNavigationOpen] = useState(true); // 导航栏开关状态
  const [modifiedQuestions, setModifiedQuestions] = useState<Set<number>>(new Set()); // 跟踪有未提交更改的题目

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

  // 包装的更新函数，用于跟踪修改状态
  const wrappedUpdateAssessment = (action: { type: ActionTypes; stepIndex?: number; key?: string; content?: any }) => {
    // 如果是更新操作，标记对应题目为已修改
    if (action.type === ActionTypes.Update && action.stepIndex !== undefined) {
      setModifiedQuestions(prev => new Set([...prev, action.stepIndex!]));
    }
    // 如果是删除操作，需要重新计算索引
    if (action.type === ActionTypes.Delete && action.stepIndex !== undefined) {
      setModifiedQuestions(prev => {
        const newSet = new Set<number>();
        prev.forEach(index => {
          if (index < action.stepIndex!) {
            newSet.add(index);
          } else if (index > action.stepIndex!) {
            newSet.add(index - 1);
          }
          // 被删除的题目不再添加到集合中
        });
        return newSet;
      });
    }
    // 调用原始的更新函数
    updateAssessment(action);
  };

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

  // 渲染导航小方块
  const renderNavigationGrid = () => {
    const questions = getQuestions();
    if (questions.length === 0) return null;

    const navigationItems = [];
    for (let i = 0; i < questions.length; i += 7) {
      const row = questions.slice(i, i + 7).map((_, index) => {
        const questionIndex = i + index;
        const isActive = questionIndex === activeStepIndex;
        const isModified = modifiedQuestions.has(questionIndex);
        
        // 确定背景色和文字色
        let backgroundColor, color;
        if (isActive) {
          backgroundColor = '#0073bb'; // 蓝色 - 当前活跃题目
          color = '#ffffff';
        } else if (isModified) {
          backgroundColor = '#28a745'; // 绿色 - 有未提交更改的题目
          color = '#ffffff';
        } else {
          backgroundColor = '#ffffff'; // 白色 - 普通题目
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
              if (!isActive && !isModified) {
                e.currentTarget.style.backgroundColor = '#f0f0f0';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive && !isModified) {
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

    return (
      <Box padding="l">
        <SpaceBetween size="m">
          <div style={{ 
            textAlign: 'center', 
            fontWeight: 'bold', 
            fontSize: '16px',
            marginBottom: '16px'
          }}>
            Assessment Navigation
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
            总共 {questions.length} 道题
            {modifiedQuestions.size > 0 && (
              <div style={{ marginTop: '8px', color: '#28a745' }}>
                {modifiedQuestions.size} 道题有未提交更改
              </div>
            )}
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
              有未提交更改
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
              普通题目
            </div>
          </div>
        </SpaceBetween>
      </Box>
    );
  };

  const steps = getQuestions().map((q) => ({
      title: q.title,
      content:
        assessment.assessType === AssessType.multiChoiceAssessment ? (    // CHANGELOG 2025-08-15 by 邱语堂: 增加问题类型单选/判断
        <QAView activeStepIndex={activeStepIndex} assessment={q as MultiChoice} updateAssessment={wrappedUpdateAssessment} />
      ) : assessment.assessType === AssessType.freeTextAssessment ? (
        <FreeTextView activeStepIndex={activeStepIndex} freetextAssessment={q as FreeText} updateAssessment={wrappedUpdateAssessment} />
      ) : assessment.assessType === AssessType.singleChoiceAssessment ? (
        <QAView activeStepIndex={activeStepIndex} assessment={q as SingleChoice} updateAssessment={wrappedUpdateAssessment} />
      ) : assessment.assessType === AssessType.trueFalseAssessment ? (
        <QAView activeStepIndex={activeStepIndex} assessment={q as TrueFalse} updateAssessment={wrappedUpdateAssessment} />
      ) : null,
    }));

  return (
    <AppLayout
      navigationOpen={navigationOpen}
      onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
      navigationWidth={340}
      navigation={renderNavigationGrid()}
      content={
        <Wizard
          onSubmit={() => {
            const { course, ...inputAssessment } = assessment;
            client
              .graphql<any>({ query: upsertAssessment, variables: { input: inputAssessment } })
              .then(() => {
                // 清理修改状态
                setModifiedQuestions(new Set());
                dispatchAlert({ type: AlertType.SUCCESS, content: getText('teachers.assessments.edit.update_success') });
              })
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
          onCancel={() => wrappedUpdateAssessment({ type: ActionTypes.Delete, stepIndex: activeStepIndex })}
          onNavigate={({ detail }) => setActiveStepIndex(detail.requestedStepIndex)}
          activeStepIndex={activeStepIndex}
          steps={steps}
        />
      }
      toolsHide
    />
  );
};
