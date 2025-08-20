import UserSettings from './pages/UserSettings';
import Section from './pages/Section';
import HomePage from './pages/HomePage';
import ManageKnowledgeBases from './pages/ManageKnowledgeBases';
import Templates from './pages/Templates';
import FindAssessments from './pages/FindAssessments';
import StudentAssessments from './pages/StudentAssessments';
import GenerateAssessments from './pages/GenerateAssessments';
import EditAssessments from './pages/EditAssessments';
import MyDashboard from './pages/MyDashboard';
import StudentAssessment from './pages/StudentAssessment';
import ReviewAssessment from './pages/ReviewAssessment';
import Courses from './pages/Courses';
import StudentList from './pages/StudentList';
import AssessmentResults from './pages/AssessmentResults';
import AssessmentSettings from './pages/AssessmentSettings';
import UserManagement from './pages/UserManagement';

export const routes = {
  teachers: [
    {
      path: '/',
      element: <HomePage />,
      children: [
        {
          path: 'management',
          element: <Section id={0} />,
          children: [
            {
              path: 'manage-knowledge-bases',
              element: <ManageKnowledgeBases />,
            },
            {
              path: 'templates',
              element: <Templates />,
            },
            {
              path: 'courses',
              element: <Courses />,
            },
            {
              path: 'student-list',
              element: <StudentList />,
            },
            {
              path: 'user-management',
              element: <UserManagement />,
            },
          ],
        },
        {
          path: 'assessments',
          element: <Section id={1} />,
          children: [
            {
              path: 'find-assessments',
              element: <FindAssessments />,
            },
            {
              path: 'generate-assessments',
              element: <GenerateAssessments />,
            },
          ],
        },
        {
          path: 'settings',
          element: <UserSettings />,
        }
      ],
    },
    { path: 'edit-assessment/:id', element: <EditAssessments />, children: [] },
    { path: 'assessment-results/:id', element: <AssessmentResults />, children: [] },
    { path: 'assessment-settings/:id', element: <AssessmentSettings />, children: [] },
  ],
  students: [
    {
      path: '/',
      element: <HomePage />,
      children: [
        {
          path: 'settings',
          element: <UserSettings />,
        },
        {
          path: 'dashboard',
          element: <MyDashboard />,
        },
        {
          path: 'assessments',
          element: <StudentAssessments />,
        },
      ],
    },
    { path: 'assessment/:id', element: <StudentAssessment />, children: [] },
    { path: 'review/:id', element: <ReviewAssessment />, children: [] },
  ],
  // 管理员路由配置（继承教师所有功能 + 额外管理功能）
  admin: [
    {
      path: '/',
      element: <HomePage />,
      children: [
        {
          path: 'management',
          element: <Section id={0} />,
          children: [
            {
              path: 'manage-knowledge-bases',
              element: <ManageKnowledgeBases />,
            },
            {
              path: 'templates',
              element: <Templates />,
            },
            {
              path: 'courses',
              element: <Courses />,
            },
            {
              path: 'student-list',
              element: <StudentList />,
            },
            {
              path: 'user-management',
              element: <UserManagement />,
            },
          ],
        },
        {
          path: 'assessments',
          element: <Section id={1} />,
          children: [
            {
              path: 'find-assessments',
              element: <FindAssessments />,
            },
            {
              path: 'generate-assessments',
              element: <GenerateAssessments />,
            },
          ],
        },
        {
          path: 'settings',
          element: <UserSettings />,
        }
      ],
    },
    { path: 'edit-assessment/:id', element: <EditAssessments />, children: [] },
    { path: 'assessment-results/:id', element: <AssessmentResults />, children: [] },
    { path: 'assessment-settings/:id', element: <AssessmentSettings />, children: [] },
  ],
  // 超级管理员路由配置（继承管理员所有功能，但不包括日志管理）
  super_admin: [
    {
      path: '/',
      element: <HomePage />,
      children: [
        {
          path: 'management',
          element: <Section id={0} />,
          children: [
            {
              path: 'manage-knowledge-bases',
              element: <ManageKnowledgeBases />,
            },
            {
              path: 'templates',
              element: <Templates />,
            },
            {
              path: 'courses',
              element: <Courses />,
            },
            {
              path: 'student-list',
              element: <StudentList />,
            },
            {
              path: 'user-management',
              element: <UserManagement />,
            },
          ],
        },
        {
          path: 'assessments',
          element: <Section id={1} />,
          children: [
            {
              path: 'find-assessments',
              element: <FindAssessments />,
            },
            {
              path: 'generate-assessments',
              element: <GenerateAssessments />,
            },
          ],
        },
        {
          path: 'settings',
          element: <UserSettings />,
        }
      ],
    },
    { path: 'edit-assessment/:id', element: <EditAssessments />, children: [] },
    { path: 'assessment-results/:id', element: <AssessmentResults />, children: [] },
    { path: 'assessment-settings/:id', element: <AssessmentSettings />, children: [] },
  ],
};
