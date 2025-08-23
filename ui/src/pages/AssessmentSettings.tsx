import { useState, useEffect, useContext, useCallback } from 'react';
import {
  Container,
  Header,
  SpaceBetween,
  FormField,
  Input,
  Select,
  Button,
  Box,
  Alert,
  Toggle,
  ColumnLayout,
  Multiselect,
  Spinner,
  ContentLayout
} from '@cloudscape-design/components';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import { getAssessment, listCourses, listStudentGroups } from '../graphql/queries';
import { upsertAssessment } from '../graphql/mutations';
import { DispatchAlertContext, AlertType } from '../contexts/alerts';
import { ExtendedAssessment, addAssessmentDefaults } from '../types/ExtendedTypes';

const client = generateClient();

interface Course {
  id: string;
  name: string;
  description?: string;
}

interface StudentGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
}

const AssessmentSettings = () => {
  const params = useParams();
  const navigate = useNavigate();
  const dispatchAlert = useContext(DispatchAlertContext);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assessment, setAssessment] = useState<ExtendedAssessment | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [availableGroups, setAvailableGroups] = useState<StudentGroup[]>([]);
  
  // 表单状态
  const [timeLimited, setTimeLimited] = useState(false);
  const [timeLimit, setTimeLimit] = useState('120');
  const [allowAnswerChange, setAllowAnswerChange] = useState(true);
  const [selectedGroups, setSelectedGroups] = useState<readonly string[]>(['ALL']);
  const [selectedCourses, setSelectedCourses] = useState<readonly string[]>([]);
  const [attemptLimit, setAttemptLimit] = useState('1');
  const [scoreMethod, setScoreMethod] = useState('highest');

  // 分数计算方法选项
  const scoreMethodOptions = [
    { label: '最高分', value: 'highest' },
    { label: '平均分', value: 'average' },
    { label: '最低分', value: 'lowest' }
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 加载评估数据
      const assessmentResponse = await client.graphql({
        query: getAssessment,
        variables: { id: params.id! }
      });
      
      const assessmentData = (assessmentResponse as any).data.getAssessment;
      const extendedAssessment = addAssessmentDefaults(assessmentData);
      setAssessment(extendedAssessment);
      
      // 设置表单默认值，使用安全的默认值
      setTimeLimited(extendedAssessment.timeLimited ?? false);
      setTimeLimit((extendedAssessment.timeLimit ?? 120).toString());
      setAllowAnswerChange(extendedAssessment.allowAnswerChange ?? true);
      setSelectedGroups(extendedAssessment.studentGroups ?? ['ALL']);
      setSelectedCourses(extendedAssessment.courses ?? []);
      setAttemptLimit((extendedAssessment.attemptLimit ?? 1) === -1 ? '-1' : (extendedAssessment.attemptLimit ?? 1).toString());
      setScoreMethod(extendedAssessment.scoreMethod ?? 'highest');

      // 加载课程列表
      const coursesResponse = await client.graphql({
        query: listCourses
      });
      
      setCourses((coursesResponse as any).data.listCourses || []);

      // 加载学生分组（真实API）
      const groupsResponse = await client.graphql({
        query: listStudentGroups
      });
      const groups = (
        (groupsResponse as { data?: { listStudentGroups?: StudentGroup[] } }).data?.listStudentGroups || []
      ) as StudentGroup[];
      // 确保至少包含默认分组
      const hasAll = groups.some(g => g.id === 'ALL');
      const normalizedGroups: StudentGroup[] = hasAll
        ? groups
        : [{ id: 'ALL', name: '所有学生', description: '系统默认分组，包含所有学生', color: '#0073bb' }, ...groups];
      setAvailableGroups(normalizedGroups);
      
    } catch (error) {
      console.error('Failed to load assessment data:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '加载评估数据失败，请稍后重试'
      });
    } finally {
      setLoading(false);
    }
  }, [params.id, dispatchAlert]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!assessment) return;
    
    setSaving(true);
    try {
      // 仅构造 GraphQL AssessmentInput 允许的字段
      const baseAssessment = {
        id: assessment.id,
        name: assessment.name,
        courseId: assessment.courseId,
        lectureDate: assessment.lectureDate,
        deadline: assessment.deadline,
        assessType: assessment.assessType,
        multiChoiceAssessment: assessment.multiChoiceAssessment,
        freeTextAssessment: assessment.freeTextAssessment,
        trueFalseAssessment: assessment.trueFalseAssessment,
        singleAnswerAssessment: assessment.singleAnswerAssessment,
        published: assessment.published,
        status: assessment.status,
        // 扩展设置字段（schema 已支持）
        timeLimited,
        timeLimit: parseInt(timeLimit, 10),
        allowAnswerChange,
        studentGroups: Array.from(selectedGroups),
        courses: Array.from(selectedCourses),
        attemptLimit: parseInt(attemptLimit, 10),
        scoreMethod
  };
      
      await client.graphql({
        query: upsertAssessment,
        variables: { input: baseAssessment }
      });

      dispatchAlert({
        type: AlertType.SUCCESS,
        content: '测验设置保存成功'
      });
      
      navigate('/assessments/find-assessments');
    } catch (error) {
      console.error('Failed to save assessment settings:', error);
      dispatchAlert({
        type: AlertType.ERROR,
        content: '保存设置失败，请稍后重试'
      });
    } finally {
      setSaving(false);
    }
  };

  const validateTimeLimit = (value: string) => {
    const num = parseInt(value, 10);
    return !isNaN(num) && num > 0;
  };

  const validateAttemptLimit = (value: string) => {
    const num = parseInt(value, 10);
    return value === '-1' || (!isNaN(num) && num > 0);
  };

  if (loading) {
    return (
      <ContentLayout>
        <Container>
          <SpaceBetween size="l" alignItems="center">
            <Spinner size="big" />
            <Box>加载测验设置中...</Box>
          </SpaceBetween>
        </Container>
      </ContentLayout>
    );
  }

  if (!assessment) {
    return (
      <ContentLayout>
        <Container>
          <Alert type="error">
            未找到评估数据，请检查评估ID是否正确。
          </Alert>
        </Container>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout>
      <SpaceBetween size="l">
        <Container
          header={
            <Header
              variant="h1"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button onClick={() => navigate('/assessments/find-assessments')}>
                    取消
                  </Button>
                  <Button
                    variant="primary"
                    loading={saving}
                    onClick={handleSave}
                    disabled={
                      !validateTimeLimit(timeLimit) || 
                      !validateAttemptLimit(attemptLimit) ||
                      selectedGroups.length === 0
                    }
                  >
                    保存设置
                  </Button>
                </SpaceBetween>
              }
            >
              测验设置 - {assessment.name}
            </Header>
          }
        >
          <SpaceBetween size="l">
            <Alert type="info">
              在这里配置测验的高级设置，包括时间限制、学生分组、测试次数等。
            </Alert>

            <ColumnLayout columns={2}>
              {/* 时间设置 */}
              <SpaceBetween size="m">
                <Header variant="h3">时间设置</Header>
                
                <FormField label="是否限制测试用时">
                  <Toggle
                    checked={timeLimited}
                    onChange={({ detail }) => setTimeLimited(detail.checked)}
                  >
                    {timeLimited ? '启用时间限制' : '不限制时间'}
                  </Toggle>
                </FormField>

                {timeLimited && (
                  <FormField 
                    label="测试限制用时（分钟）"
                    constraintText="设置学生完成测试的最长时间"
                    errorText={!validateTimeLimit(timeLimit) ? '请输入有效的时间（大于0的整数）' : ''}
                  >
                    <Input
                      value={timeLimit}
                      onChange={({ detail }) => setTimeLimit(detail.value)}
                      type="number"
                      placeholder="120"
                    />
                  </FormField>
                )}

                <FormField label="提交答案后是否允许修改">
                  <Toggle
                    checked={allowAnswerChange}
                    onChange={({ detail }) => setAllowAnswerChange(detail.checked)}
                  >
                    {allowAnswerChange ? '允许修改答案' : '提交后不可修改'}
                  </Toggle>
                </FormField>
              </SpaceBetween>

              {/* 学生和课程设置 */}
              <SpaceBetween size="m">
                <Header variant="h3">学生和课程设置</Header>
                
                <FormField 
                  label="发布给的学生分组"
                  constraintText="选择哪些学生分组可以看到这个测验"
                >
                  <Multiselect
                    selectedOptions={selectedGroups.map(groupId => {
                      const group = availableGroups.find(g => g.id === groupId);
                      return {
                        label: group?.name || groupId,
                        value: groupId,
                        description: group?.description
                      };
                    })}
                    onChange={({ detail }) => 
                      setSelectedGroups(detail.selectedOptions.map(option => option.value!))
                    }
                    options={availableGroups.map(group => ({
                      label: group.name,
                      value: group.id,
                      description: group.description
                    }))}
                    placeholder="选择学生分组"
                    selectedAriaLabel="已选择"
                  />
                </FormField>

                <FormField 
                  label="对应的课程列表"
                  constraintText="选择相关课程（用于分类，与RAG知识库无关）"
                >
                  <Multiselect
                    selectedOptions={selectedCourses.map(courseId => {
                      const course = courses.find(c => c.id === courseId);
                      return {
                        label: course?.name || courseId,
                        value: courseId,
                        description: course?.description
                      };
                    })}
                    onChange={({ detail }) => 
                      setSelectedCourses(detail.selectedOptions.map(option => option.value!))
                    }
                    options={courses.map(course => ({
                      label: course.name,
                      value: course.id,
                      description: course.description
                    }))}
                    placeholder="选择相关课程"
                    selectedAriaLabel="已选择"
                  />
                </FormField>
              </SpaceBetween>
            </ColumnLayout>

            {/* 测试次数和评分设置 */}
            <Container header={<Header variant="h3">测试次数和评分设置</Header>}>
              <ColumnLayout columns={2}>
                <FormField 
                  label="测试次数限制"
                  constraintText="设置学生可以参加测试的次数（-1表示无限次数）"
                  errorText={!validateAttemptLimit(attemptLimit) ? '请输入有效的次数（-1或大于0的整数）' : ''}
                >
                  <Select
                    selectedOption={
                      attemptLimit === '-1' 
                        ? { label: '无限次数', value: '-1' }
                        : { label: `${attemptLimit} 次`, value: attemptLimit }
                    }
                    onChange={({ detail }) => setAttemptLimit(detail.selectedOption.value!)}
                    options={[
                      { label: '无限次数', value: '-1' },
                      { label: '1 次', value: '1' },
                      { label: '2 次', value: '2' },
                      { label: '3 次', value: '3' },
                      { label: '5 次', value: '5' },
                      { label: '10 次', value: '10' }
                    ]}
                    placeholder="选择测试次数"
                  />
                </FormField>

                <FormField 
                  label="成绩计算方法"
                  constraintText="当学生多次参加测试时，如何计算最终成绩"
                >
                  <Select
                    selectedOption={scoreMethodOptions.find(option => option.value === scoreMethod) || null}
                    onChange={({ detail }) => setScoreMethod(detail.selectedOption.value!)}
                    options={scoreMethodOptions}
                    placeholder="选择计分方法"
                  />
                </FormField>
              </ColumnLayout>
            </Container>

            {/* 当前设置预览 */}
            <Container header={<Header variant="h3">当前设置预览</Header>}>
              <ColumnLayout columns={2}>
                <Box>
                  <SpaceBetween size="xs">
                    <div><strong>时间限制:</strong> {timeLimited ? `${timeLimit} 分钟` : '无限制'}</div>
                    <div><strong>答案修改:</strong> {allowAnswerChange ? '允许' : '不允许'}</div>
                    <div><strong>测试次数:</strong> {attemptLimit === '-1' ? '无限制' : `${attemptLimit} 次`}</div>
                  </SpaceBetween>
                </Box>
                <Box>
                  <SpaceBetween size="xs">
                    <div><strong>学生分组:</strong> {selectedGroups.length} 个分组</div>
                    <div><strong>关联课程:</strong> {selectedCourses.length} 门课程</div>
                    <div><strong>计分方法:</strong> {scoreMethodOptions.find(opt => opt.value === scoreMethod)?.label}</div>
                  </SpaceBetween>
                </Box>
              </ColumnLayout>
            </Container>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default AssessmentSettings;
