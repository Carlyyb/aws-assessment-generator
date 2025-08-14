# CHANGELOG

## 2025-08-15 by 邱语堂

### 新增与优化
- 新增题型支持：单选题（SingleChoice）、判断题（TrueFalse）。

### 主要修改文件及内容

1. `lib/questions-generation/lambdas/event-handler/services/prompts.ts`
   - getInitialQuestionsPrompt：完善题型拼接，支持单选题和判断题。
   - improveQuestionPrompt：完善题型拼接，支持单选题和判断题。
   - getRelevantDocumentsPrompt：参数类型兼容单选/判断。
   - 相关注释和CHANGELOG标记。

2. `lib/questions-generation/lambdas/event-handler/services/genAiService.ts`
   - 所有相关函数参数类型兼容单选题和判断题。
   - improveQuestions、improveQuestion等处理流程支持新题型。
   - 相关注释和CHANGELOG标记。

3. `lib/questions-generation/lambdas/event-handler/models/question.ts`
   - QuestionType类型新增'singleChoice'和'trueFalse'。
   - 相关注释和CHANGELOG标记。

4. `ui/src/graphql/API.ts`
   - 新增TrueFalse和SingleChoice类型定义。
   - Assessment、AssessmentInput等结构体支持新题型。

5. `ui/src/components/QAView.tsx`
   - 组件逻辑完善，支持单选题和判断题的渲染与编辑。
   - 判断题、单选题的选项与答案处理逻辑。
   - 相关注释和CHANGELOG标记。

6. `ui\src\pages\EditAssessments.tsx`
   - 组件逻辑完善，支持对单选、判断的题目内容的修改、删除和保存
   - 相关注释和CHANGELOG标记。

### 影响范围
- 题目生成、优化、展示、编辑等支持多选、简答、单选、判断四类题型。
- 
---
各文件内也标注了CHANGELOG注释。
由于对整个项目每个文件不够熟悉，可能遗漏部分项目功能不清楚，可能没有实现题型的兼容，
