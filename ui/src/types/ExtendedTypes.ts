// 扩展Assessment类型以支持新字段
import { Assessment as BaseAssessment, StudentAssessment as BaseStudentAssessment } from '../graphql/API';

export interface ExtendedAssessment extends BaseAssessment {
  // 新增字段，带有默认值
  timeLimited?: boolean;        // 是否限制测试用时，默认false
  timeLimit?: number;           // 测试限制用时(minutes)，默认120
  allowAnswerChange?: boolean;  // 提交答案后是否允许修改，默认true
  studentGroups?: string[];     // 发布给的学生分组，默认['ALL']
  courses?: string[];           // 对应的课程列表
  attemptLimit?: number;        // 测试次数限制，默认1，-1表示无限次数
  scoreMethod?: 'highest' | 'average' | 'lowest';  // 成绩取最高分/平均分/最低分，默认highest
}

export interface ExtendedStudentAssessment extends BaseStudentAssessment {
  // 新增字段
  attemptCount?: number;        // 已测试次数，默认0
  duration?: number;            // 测试用时(minutes)
  scores?: number[];            // 测试分数列表，默认[]
  remainingAttempts?: number;   // 剩余测试次数，默认为attemptLimit-attemptCount
}

// 工具函数：为Assessment添加默认值
type AssessmentExtra = Partial<Pick<ExtendedAssessment,
  'timeLimited' | 'timeLimit' | 'allowAnswerChange' | 'studentGroups' | 'courses' | 'attemptLimit' | 'scoreMethod'
>>;

export const addAssessmentDefaults = (
  assessment?: BaseAssessment | null
): ExtendedAssessment => {
  // 允许 assessment 为空，返回带有安全默认值的扩展对象
  const base = (assessment ?? ({} as BaseAssessment)) as BaseAssessment;
  const extended = (assessment as unknown as (BaseAssessment & AssessmentExtra)) ?? ({} as AssessmentExtra);

  return {
    ...(assessment ? base : ({} as BaseAssessment)),
    timeLimited: extended?.timeLimited ?? false,
    timeLimit: extended?.timeLimit ?? 120,
    allowAnswerChange: extended?.allowAnswerChange ?? true,
    studentGroups: extended?.studentGroups ?? ['ALL'],
    courses: extended?.courses ?? (base?.courseId ? [base.courseId] : []),
    attemptLimit: extended?.attemptLimit ?? 1,
    scoreMethod: extended?.scoreMethod ?? 'highest'
  } as ExtendedAssessment;
};

// 工具函数：为StudentAssessment添加默认值
type StudentAssessmentExtra = Partial<{ attemptCount: number; duration: number; scores: number[] }>;

export const addStudentAssessmentDefaults = (
  studentAssessment: BaseStudentAssessment,
  assessment?: ExtendedAssessment | null
): ExtendedStudentAssessment => {
  const extended = (studentAssessment as unknown as (BaseStudentAssessment & StudentAssessmentExtra)) || {};
  const attemptCount = extended?.attemptCount ?? 0;
  const attemptLimit = assessment?.attemptLimit ?? 1;

  return {
    ...studentAssessment,
    attemptCount,
    duration: extended?.duration,
    scores: extended?.scores ?? [],
    remainingAttempts: attemptLimit === -1 ? -1 : Math.max(0, attemptLimit - attemptCount)
  } as ExtendedStudentAssessment;
};
