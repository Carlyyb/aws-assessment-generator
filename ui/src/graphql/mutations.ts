/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const upsertSettings = /* GraphQL */ `
  mutation UpsertSettings($input: UpsertSettingsInput) {
    upsertSettings(input: $input) {
      uiLang
    }
  }
`;
export const upsertCourse = /* GraphQL */ `
  mutation UpsertCourse($input: CourseInput) {
    upsertCourse(input: $input) {
      id
      name
      description
    }
  }
`;
export const deleteCourse = /* GraphQL */ `
  mutation DeleteCourse($id: ID!) {
    deleteCourse(id: $id)
  }
`;
export const createAssessTemplate = /* GraphQL */ `
  mutation CreateAssessTemplate($input: AssessTemplateInput) {
    createAssessTemplate(input: $input) {
      id
      name
      docLang
      assessType
      taxonomy
      totalQuestions
      easyQuestions
      mediumQuestions
      hardQuestions
      createdAt
    }
  }
`;
export const deleteAssessTemplate = /* GraphQL */ `
  mutation DeleteAssessTemplate($id: ID!, $userId: ID!) {
    deleteAssessTemplate(id: $id, userId: $userId)
  }
`;
export const upsertAssessment = /* GraphQL */ `
  mutation UpsertAssessment($input: AssessmentInput) {
    upsertAssessment(input: $input) {
      id
      name
      courseId
      lectureDate
      deadline
      updatedAt
      assessType
      multiChoiceAssessment {
        title
        question
        answerChoices
        correctAnswer
        explanation
      }
      freeTextAssessment {
        title
        question
        rubric {
          weight
          point
        }
      }
      singleChoiceAssessment {
        title
        question
        answerChoices
        correctAnswer
        explanation
      }
      trueFalseAssessment {
        title
        question
        answerChoices
        correctAnswer
        explanation
      }
      published
      status
      course {
        id
        name
        description
      }
    }
  }
`;
export const upsertStudentAssessment = /* GraphQL */ `
  mutation UpsertStudentAssessment($input: StudentAssessmentInput) {
    upsertStudentAssessment(input: $input) {
      parentAssessId
      assessment {
        id
        name
        courseId
        lectureDate
        deadline
        updatedAt
        assessType
        multiChoiceAssessment {
          title
          question
          answerChoices
          correctAnswer
          explanation
        }
        freeTextAssessment {
          title
          question
          rubric {
            weight
            point
          }
        }
        singleChoiceAssessment {
          title
          question
          answerChoices
          correctAnswer
          explanation
        }
        trueFalseAssessment {
          title
          question
          answerChoices
          correctAnswer
          explanation
        }
        published
        status
        course {
          id
          name
          description
        }
      }
      answers
      completed
      score
      report
      updatedAt
    }
  }
`;
export const gradeStudentAssessment = /* GraphQL */ `
  mutation GradeStudentAssessment($input: StudentAssessmentInput) {
    gradeStudentAssessment(input: $input) {
      parentAssessId
      assessment {
        id
        name
        courseId
        lectureDate
        deadline
        updatedAt
        assessType
        multiChoiceAssessment {
          title
          question
          answerChoices
          correctAnswer
          explanation
        }
        freeTextAssessment {
          title
          question
          rubric {
            weight
            point
          }
        }
        singleChoiceAssessment {
          title
          question
          answerChoices
          correctAnswer
          explanation
        }
        trueFalseAssessment {
          title
          question
          answerChoices
          correctAnswer
          explanation
        }
        published
        status
        course {
          id
          name
          description
        }
      }
      answers
      completed
      score
      report
      updatedAt
    }
  }
`;
export const createKnowledgeBase = /* GraphQL */ `
  mutation CreateKnowledgeBase($courseId: ID, $locations: [String]) {
    createKnowledgeBase(courseId: $courseId, locations: $locations) {
      ingestionJobId
      knowledgeBaseId
      dataSourceId
      status
    }
  }
`;

export const deleteAssessment = /* GraphQL */ `
  mutation DeleteAssessment($id: ID!) {
    deleteAssessment(id: $id)
  }
`;

export const unpublishAssessment = /* GraphQL */ `
  mutation UnpublishAssessment($assessmentId: ID!) {
    unpublishAssessment(assessmentId: $assessmentId)
  }
`;
