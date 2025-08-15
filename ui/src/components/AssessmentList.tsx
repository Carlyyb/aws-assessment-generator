import React from 'react';
import { Table, Box } from '@cloudscape-design/components';
import { Assessment } from '../graphql/API';
import { getAssessTypeText } from '../utils/enumTranslations';
import { getText } from '../i18n/lang';

interface AssessmentListProps {
  assessments: Assessment[];
  onSelectionChange?: (selectedItems: Assessment[]) => void;
}

/**
 * 测试列表组件 - 展示如何在表格中使用多语言化的枚举值
 */
export const AssessmentList: React.FC<AssessmentListProps> = ({
  assessments,
  onSelectionChange,
}) => {
  const columnDefinitions = [
    {
      id: 'name',
      header: getText('common.name'),
      cell: (assessment: Assessment) => assessment.name,
      sortingField: 'name',
    },
    {
      id: 'assessType',
      header: getText('common.assessment_type'),
      cell: (assessment: Assessment) => (
        <Box>{getAssessTypeText(assessment.assessType)}</Box>
      ),
      sortingField: 'assessType',
    },
    {
      id: 'course',
      header: getText('common.course'),
      cell: (assessment: Assessment) => assessment.course?.name || '-',
      sortingField: 'course.name',
    },
    {
      id: 'lectureDate',
      header: getText('common.lecture_date'),
      cell: (assessment: Assessment) => assessment.lectureDate,
      sortingField: 'lectureDate',
    },
    {
      id: 'deadline',
      header: getText('common.deadline'),
      cell: (assessment: Assessment) => assessment.deadline,
      sortingField: 'deadline',
    },
    {
      id: 'status',
      header: getText('common.status'),
      cell: (assessment: Assessment) => assessment.status,
      sortingField: 'status',
    },
  ];

  return (
    <Table
      columnDefinitions={columnDefinitions}
      items={assessments}
      selectionType="multi"
      onSelectionChange={({ detail }) => {
        if (onSelectionChange) {
          onSelectionChange(detail.selectedItems);
        }
      }}
      sortingDisabled={false}
      empty={
        <Box textAlign="center" color="inherit">
          <b>{getText('common.status.empty')}</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            {getText('teachers.assessments.no_assessments_found')}
          </Box>
        </Box>
      }
      header={
        <Box variant="h1">
          {getText('teachers.assessments.title')}
        </Box>
      }
    />
  );
};
