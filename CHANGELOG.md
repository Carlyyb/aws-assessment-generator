# CHANGELOG


## 2025-08-16 by 邱语堂

### 新增与优化
- 支持批量选择课程，前端多选控件（Cloudscape Multiselect）支持搜索、全选、反选。
- 后端支持批量生成评估，返回每个课程的生成结果和状态，前端可批量展示。

### 主要修改文件及内容

1. `lib/schema.graphql`
   - GenerateAssessmentInput 新增 courseIds 字段，Query generateAssessment 支持批量返回评估ID。

2. `lib/questions-generation/lambdas/event-handler/index.ts`
   - handler 和 processEvent 支持批量处理 courseIds，返回每个课程的 assessmentId 和状态。
   - 兼容单/多课程输入，类型安全处理。

3. `lib/questions-generation/lambdas/event-handler/services/dataService.ts`
   - 新增 storeEmptyAssessmentsForCourses 方法，支持批量存储评估。
   - updateAssessment 支持多题型数组赋值。

4. `ui/src/pages/GenerateAssessments.tsx`
   - 课程选择由单选改为多选，使用 Cloudscape Multiselect。
   - 生成后批量展示每个课程的生成状态和结果。

### 影响范围
- 课程批量选择、批量生成评估、批量结果展示，提升用户体验和操作效率。
- 相关后端接口和前端页面均已适配批量逻辑。

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
