import UserSettings from './pages/UserSettings';
import TemplateSettings from './pages/TemplateSettings';
import Section from './pages/Section';
import HomePage from './pages/HomePage';
import ManageKnowledgeBases from './pages/ManageKnowledgeBases';
import Templates from './pages/Templates';
import FindAssessments from './pages/FindAssessments';
import StudentAssessments from './pages/StudentAssessments';
import GenerateAssessments from './pages/GenerateAssessments';
import EditAssessments from './pages/EditAssessments';
import LogManagement from './pages/LogManagement';
// import FindStudent from './pages/FindStudent';
import MyDashboard from './pages/MyDashboard';
import StudentAssessment from './pages/StudentAssessment';
import ReviewAssessment from './pages/ReviewAssessment';
import Courses from './pages/Courses';

export const routes = {
  teachers: [
    {
      path: '/',
      element: <HomePage />,
      children: [
        {
          path: 'settings',
          element: <UserSettings />,
        },
        {
          path: 'management',
          element: <Section id={0} />,
          children: [
            {
              path: 'template-settings',
              element: <TemplateSettings />,
            },
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
              path: 'log-management',
              element: <LogManagement />,
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
      ],
    },
    { path: 'edit-assessment/:id', element: <EditAssessments />, children: [] },
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
};
