/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const upsertSettings = /* GraphQL */ `
  mutation UpsertSettings($input: UpsertSettingsInput) {
    upsertSettings(input: $input) {
      uiLang
      globalLogo
      themeSettings
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

// User Management Mutations
export const batchCreateUsersMutation = /* GraphQL */ `
  mutation BatchCreateUsers($users: [BatchUserInput!]!) {
    batchCreateUsers(users: $users) {
      success {
        id
        username
        name
        email
        phoneNumber
        role
        needsPasswordChange
        createdAt
        createdBy
        isActive
      }
      failures {
        username
        name
        error
        reason
      }
      totalCount
      successCount
      failureCount
    }
  }
`;

export const createSingleUserMutation = /* GraphQL */ `
  mutation CreateSingleUser($user: BatchUserInput!) {
    createSingleUser(user: $user) {
      id
      username
      name
      email
      role
      needsPasswordChange
      createdAt
      createdBy
      isActive
    }
  }
`;

export const deleteUserMutation = /* GraphQL */ `
  mutation DeleteUser($username: String!) {
    deleteUser(username: $username)
  }
`;

export const updateUserMutation = /* GraphQL */ `
  mutation UpdateUser($username: String!, $updates: BatchUserInput!) {
    updateUser(username: $username, updates: $updates) {
      id
      username
      name
      email
      phoneNumber
      role
      needsPasswordChange
      lastLoginAt
      createdAt
      createdBy
      isActive
    }
  }
`;

export const changePasswordMutation = /* GraphQL */ `
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input)
  }
`;

export const requestPasswordResetMutation = /* GraphQL */ `
  mutation RequestPasswordReset($input: PasswordResetRequestInput!) {
    requestPasswordReset(input: $input)
  }
`;

export const confirmPasswordResetMutation = /* GraphQL */ `
  mutation ConfirmPasswordReset($input: PasswordResetConfirmInput!) {
    confirmPasswordReset(input: $input)
  }
`;

export const forcePasswordResetMutation = /* GraphQL */ `
  mutation ForcePasswordReset($username: String!) {
    forcePasswordReset(username: $username)
  }
`;

export const resetUserPasswordMutation = /* GraphQL */ `
  mutation ResetUserPassword($username: String!, $customPassword: String) {
    resetUserPassword(username: $username, customPassword: $customPassword) {
      success
      username
      newPassword
      isDefaultPassword
    }
  }
`;
export const createStudentGroup = /* GraphQL */ `
  mutation CreateStudentGroup($input: StudentGroupInput!) {
    createStudentGroup(input: $input) {
      id
      name
      description
      color
      createdBy
      teachers
      students
      createdAt
    }
  }
`;
export const updateStudentGroup = /* GraphQL */ `
  mutation UpdateStudentGroup($id: ID!, $input: StudentGroupInput!) {
    updateStudentGroup(id: $id, input: $input) {
      id
      name
      description
      color
      createdBy
      teachers
      students
      createdAt
    }
  }
`;
export const deleteStudentGroup = /* GraphQL */ `
  mutation DeleteStudentGroup($id: ID!) {
    deleteStudentGroup(id: $id)
  }
`;
