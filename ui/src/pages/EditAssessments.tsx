/* eslint-disable react-refresh/only-export-components */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useReducer, useEffect, useContext, useCallback, useMemo } from 'react';
import { Wizard, AppLayout, Button, SpaceBetween, Box, Header, Container, Modal, Alert } from '@cloudscape-design/components';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { Assessment, AssessType, MultiChoice, FreeText, SingleAnswer, TrueFalse } from '../graphql/API'; // CHANGELOG 2025-08-15 by 邱语堂: 增加问题类型单选/判断
import { getAssessment } from '../graphql/queries';
import { upsertAssessment } from '../graphql/mutations';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { useBreadcrumb } from '../contexts/breadcrumbs';
import { QAView } from '../components/QAView';
import { FreeTextView } from '../components/FreeTextView';
import { AddQuestionModal } from '../components/AddQuestionModal';
import { getText, getTextWithParams } from '../i18n/lang';
import { removeTypenames } from '../helpers';

const client = generateClient();

export enum ActionTypes {
  Delete,
  Update,
  Put,
  Add,
}

type Reducer = (state: Assessment, actions: { type: ActionTypes; stepIndex?: number; key?: string; content?: any; questionType?: AssessType }) => Assessment;

const reducer: Reducer = (state, actions) => {
  const { type, stepIndex, key, content, questionType } = actions;
  switch (type) {
    case ActionTypes.Put:
      return content;
    case ActionTypes.Add: {
      if (!questionType || !content) return state;
      
      switch (questionType) {
        case AssessType.multiChoiceAssessment: {
          const newMultiChoice = [...(state.multiChoiceAssessment || []), content];
          return { ...state, multiChoiceAssessment: newMultiChoice, assessType: questionType };
        }
        case AssessType.freeTextAssessment: {
          const newFreeText = [...(state.freeTextAssessment || []), content];
          return { ...state, freeTextAssessment: newFreeText, assessType: questionType };
        }
        case AssessType.singleAnswerAssessment: {
          const newSingleAnswer = [...(state.singleAnswerAssessment || []), content];
          return { ...state, singleAnswerAssessment: newSingleAnswer, assessType: questionType };
        }
        case AssessType.trueFalseAssessment: {
          const newTrueFalse = [...(state.trueFalseAssessment || []), content];
          return { ...state, trueFalseAssessment: newTrueFalse, assessType: questionType };
        }
        default:
          return state;
      }
    }
    case ActionTypes.Delete: {
      let newQuestions: any[] = [];
      switch (state.assessType) {
        case AssessType.multiChoiceAssessment:
          newQuestions = state.multiChoiceAssessment?.filter((_, i) => i !== stepIndex!) || [];
          return { ...state, multiChoiceAssessment: newQuestions };
        case AssessType.freeTextAssessment:
          newQuestions = state.freeTextAssessment?.filter((_, i) => i !== stepIndex!) || [];
          return { ...state, freeTextAssessment: newQuestions };
        case AssessType.singleAnswerAssessment:
          newQuestions = state.singleAnswerAssessment?.filter((_, i) => i !== stepIndex!) || [];
          return { ...state, singleAnswerAssessment: newQuestions };
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
        case AssessType.singleAnswerAssessment: {
          const newQuestions = state.singleAnswerAssessment?.map((section, i) => {
            if (stepIndex !== i) return section;
            const newSection: any = { ...section };
            newSection[key!] = content;
            return newSection;
          }) || [];
          return { ...state, singleAnswerAssessment: newQuestions };
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

  const [assessment, dispatch] = useReducer(reducer, {} as Assessment);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false); // 添加题目模态窗口状态
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // 跟踪未保存的更改
  const [showUnsavedChangesModal, setShowUnsavedChangesModal] = useState(false); // 显示未保存更改提醒
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null); // 待处理的导航
  const [toolsOpen, setToolsOpen] = useState(false); // 工具栏开关状态
  const [isDataLoaded, setIsDataLoaded] = useState(false); // 标记数据是否已加载
  
  // 创建包装函数来跟踪修改状态
  const updateAssessment = (props: { type: ActionTypes; stepIndex?: number; key?: string; content?: any; questionType?: AssessType }) => {
    dispatch(props);
    if (isDataLoaded) {
      setHasUnsavedChanges(true);
    }
  };

  // 加载评估数据 - 只在组件挂载时执行一次
  useEffect(() => {
    if (!params.id) return;
    let cancelled = false; // 防止卸载后继续设置状态
    
    client
      .graphql<any>({ query: getAssessment, variables: { id: params.id } })
      .then(({ data }) => {
        const result = data.getAssessment;
        if (!result) throw new Error();
        const { updatedAt, ...content } = removeTypenames(result);
        if (cancelled) return;
        dispatch({ type: ActionTypes.Put, content }); // 直接调用 dispatch，避免循环依赖
        
        // 设置面包屑覆盖，使测试名称显示在面包屑中
        if (content.name) {
          setOverride(`/edit-assessment/${params.id}`, content.name);
        }
        
        setIsDataLoaded(true); // 标记数据已加载
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // 注意：不要把 setOverride 放入依赖，否则其引用变化会导致重复拉取与刷新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // 组件卸载时清理面包屑覆盖
  useEffect(() => {
    return () => {
      if (params.id) {
        removeOverride(`/edit-assessment/${params.id}`);
      }
    };
    // 注意：不将 removeOverride 放入依赖，避免其引用变化导致重复注册清理函数
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // 监听页面离开事件
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        //event.returnValue = '您有未保存的更改，确定要离开吗？';
        return '您有未保存的更改，确定要离开吗？';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // 自定义导航拦截
  const handleNavigation = useCallback((path: string) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(path);
      setShowUnsavedChangesModal(true);
    } else {
      navigate(path);
    }
  }, [hasUnsavedChanges, navigate]);

  // 确认放弃更改
  const handleDiscardChanges = () => {
    setHasUnsavedChanges(false);
    setShowUnsavedChangesModal(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  // 取消导航
  const handleCancelNavigation = () => {
    setShowUnsavedChangesModal(false);
    setPendingNavigation(null);
  };

  // 保存评估
  const handleSaveAssessment = async () => {
    try {
      const { course, ...inputAssessment } = assessment;
      await client.graphql<any>({ query: upsertAssessment, variables: { input: inputAssessment } });
      setHasUnsavedChanges(false);
      dispatchAlert({ type: AlertType.SUCCESS, content: getText('teachers.assessments.edit.update_success') });
    } catch (error) {
      dispatchAlert({ type: AlertType.ERROR, content: getText('common.status.error') });
    }
  };

  // 渲染工具栏内容
  const renderToolsPanel = () => (
    <Container header={<Header variant="h2">编辑工具</Header>}>
      <SpaceBetween size="m">
        <Box>
          <Header variant="h3">快速操作</Header>
          <SpaceBetween size="s">
            <Button
              variant="primary"
              iconName="add-plus"
              onClick={() => setShowAddQuestionModal(true)}
              fullWidth
            >
              添加新题目
            </Button>
            <Button
              variant="normal"
              iconName="upload"
              onClick={handleSaveAssessment}
              disabled={!hasUnsavedChanges}
              fullWidth
            >
              保存评估
            </Button>
            <Button
              variant="normal"
              iconName="external"
              onClick={() => handleNavigation('/assessments/find-assessments')}
              fullWidth
            >
              返回评估列表
            </Button>
          </SpaceBetween>
        </Box>
        
        <Box>
          <Header variant="h3">评估信息</Header>
          <SpaceBetween size="s">
            <Box>
              <strong>评估名称：</strong>
              <Box variant="span">{assessment.name || '未命名评估'}</Box>
            </Box>
            <Box>
              <strong>题目数量：</strong>
              <Box variant="span">{questions.length} 题</Box>
            </Box>
            <Box>
              <strong>题目类型：</strong>
              <Box variant="span">
                {assessment.assessType === AssessType.multiChoiceAssessment && '多选题'}
                {assessment.assessType === AssessType.freeTextAssessment && '问答题'}
                {assessment.assessType === AssessType.singleAnswerAssessment && '单选题'}
                {assessment.assessType === AssessType.trueFalseAssessment && '判断题'}
              </Box>
            </Box>
            {hasUnsavedChanges && (
              <Alert type="warning">
                有未保存的更改
              </Alert>
            )}
          </SpaceBetween>
        </Box>
      </SpaceBetween>
    </Container>
  );

  // 包装的更新函数
  const wrappedUpdateAssessment = (action: { type: ActionTypes; stepIndex?: number; key?: string; content?: any; questionType?: AssessType }) => {
    // 调用原始的更新函数
    updateAssessment(action);
    
    // 如果是添加操作，跳转到新添加的题目
    if (action.type === ActionTypes.Add) {
      // 新题目将被添加到数组末尾，所以索引是当前长度
      setActiveStepIndex(questions.length); // questions.length 即为新题目的索引
    }
  };

  // 处理添加新题目
  const handleAddQuestion = (newQuestion: MultiChoice | FreeText | SingleAnswer | TrueFalse, questionType: AssessType) => {
    wrappedUpdateAssessment({
      type: ActionTypes.Add,
      content: newQuestion,
      questionType
    });
    setShowAddQuestionModal(false);
  };

  // 使用 useMemo 缓存题目列表，避免不必要的重新计算
  const questions = useMemo(() => {
    if (!assessment || !assessment.assessType) return [];
    
    switch (assessment.assessType) {
      case AssessType.multiChoiceAssessment:
        return assessment.multiChoiceAssessment || [];
      case AssessType.freeTextAssessment:
        return assessment.freeTextAssessment || [];
      case AssessType.singleAnswerAssessment:
        return assessment.singleAnswerAssessment || [];
      case AssessType.trueFalseAssessment:
        return assessment.trueFalseAssessment || [];
      default:
        return [];
    }
  }, [assessment]);

  const steps = questions.map((q: MultiChoice | FreeText | SingleAnswer | TrueFalse) => ({
      title: q.title,
      content:
        assessment.assessType === AssessType.multiChoiceAssessment ? (    // CHANGELOG 2025-08-15 by 邱语堂: 增加问题类型单选/判断
        <QAView activeStepIndex={activeStepIndex} assessment={q as MultiChoice} updateAssessment={wrappedUpdateAssessment} />
      ) : assessment.assessType === AssessType.freeTextAssessment ? (
        <FreeTextView activeStepIndex={activeStepIndex} freetextAssessment={q as FreeText} updateAssessment={wrappedUpdateAssessment} />
      ) : assessment.assessType === AssessType.singleAnswerAssessment ? (
        <QAView activeStepIndex={activeStepIndex} assessment={q as SingleAnswer} updateAssessment={wrappedUpdateAssessment} />
      ) : assessment.assessType === AssessType.trueFalseAssessment ? (
        <QAView activeStepIndex={activeStepIndex} assessment={q as TrueFalse} updateAssessment={wrappedUpdateAssessment} />
      ) : null,
    }));

  return (
    <>
      <AppLayout
        toolsOpen={toolsOpen}
        onToolsChange={({ detail }) => setToolsOpen(detail.open)}
        toolsWidth={300}
        tools={renderToolsPanel()}
        content={
          <SpaceBetween size="l">
            {/* 添加题目按钮 */}
            <Button
              variant="primary"
              iconName="add-plus"
              onClick={() => setShowAddQuestionModal(true)}
            >
              {getText('teachers.assessments.edit.add_question')}
            </Button>
            
            <Wizard
              onSubmit={() => {
                const { course, ...inputAssessment } = assessment;
                client
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .graphql<any>({ query: upsertAssessment, variables: { input: inputAssessment } })
                  .then(() => {
                    setHasUnsavedChanges(false);
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
          </SpaceBetween>
        }
        navigationHide
      />
      
      {/* 添加题目模态窗口 */}
      <AddQuestionModal
        visible={showAddQuestionModal}
        onDismiss={() => setShowAddQuestionModal(false)}
        onAddQuestion={handleAddQuestion}
        assessmentType={assessment.assessType || AssessType.multiChoiceAssessment}
      />

      {/* 未保存更改提醒对话框 */}
      <Modal
        visible={showUnsavedChangesModal}
        onDismiss={handleCancelNavigation}
        header="确认离开"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={handleCancelNavigation}>
                取消
              </Button>
              <Button onClick={handleSaveAssessment}>
                保存并离开
              </Button>
              <Button variant="primary" onClick={handleDiscardChanges}>
                放弃更改
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Alert type="warning">
          您有未保存的更改。选择保存并离开，或者放弃所有更改继续离开。
        </Alert>
      </Modal>
    </>
  );
};
