/* tslint:disable */
/* eslint-disable */
// this is an auto generated file. This will be overwritten
// Manual additions for user management

export const getSettings = /* GraphQL */ `
  query GetSettings {
    getSettings {
      uiLang
      globalLogo
      themeSettings
    }
  }
`;
export const listCourses = /* GraphQL */ `
  query ListCourses {
    listCourses {
      id
      name
      description
    }
  }
`;
export const listStudents = /* GraphQL */ `
  query ListStudents {
    listStudents {
      id
      name
      email
      lastLoginAt
      assessmentCount
      groups {
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
  }
`;
export const listStudentGroups = /* GraphQL */ `
  query ListStudentGroups {
    listStudentGroups {
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
export const getAssessment = /* GraphQL */ `
  query GetAssessment($id: ID!) {
    getAssessment(id: $id) {
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
      singleAnswerAssessment {
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
export const listAssessments = /* GraphQL */ `
  query ListAssessments {
    listAssessments {
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
      singleAnswerAssessment {
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
export const listAllAssessments = /* GraphQL */ `
  query ListAllAssessments {
    listAllAssessments {
      id
      name
      courseId
      lectureDate
      deadline
      updatedAt
      assessType
      userId
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
      singleAnswerAssessment {
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
export const listAssessTemplates = /* GraphQL */ `
  query ListAssessTemplates {
    listAssessTemplates {
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
export const listPublishedAssessments = /* GraphQL */ `
  query ListPublishedAssessments {
    listPublishedAssessments {
      id
      name
      courseId
      lectureDate
      deadline
      updatedAt
      assessType
      published
      status
      timeLimited
      timeLimit
      allowAnswerChange
      studentGroups
      courses
      attemptLimit
      scoreMethod
      course {
        id
        name
        description
      }
    }
  }
`;
export const getStudentAssessment = /* GraphQL */ `
  query GetStudentAssessment($parentAssessId: ID!) {
    getStudentAssessment(parentAssessId: $parentAssessId) {
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
        singleAnswerAssessment {
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
export const listStudentAssessments = /* GraphQL */ `
  query ListStudentAssessments {
    listStudentAssessments {
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
        singleAnswerAssessment {
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
export const listMyStudentAssessments = /* GraphQL */ `
  query ListMyStudentAssessments($studentId: ID!) {
    listMyStudentAssessments(studentId: $studentId) {
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
        singleAnswerAssessment {
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
export const generateAssessment = /* GraphQL */ `
  query GenerateAssessment($input: GenerateAssessmentInput) {
    generateAssessment(input: $input)
  }
`;
export const getKnowledgeBase = /* GraphQL */ `
  query GetKnowledgeBase($courseId: ID) {
    getKnowledgeBase(courseId: $courseId) {
      userId
      courseId
      indexName
      knowledgeBaseId
      kbDataSourceId
      s3prefix
      status
    }
  }
`;
export const getIngestionJob = /* GraphQL */ `
  query GetIngestionJob($input: IngestionJobInput) {
    getIngestionJob(input: $input) {
      ingestionJobId
      knowledgeBaseId
      dataSourceId
      status
    }
  }
`;

// User Management Queries
export const listUsers = /* GraphQL */ `
  query ListUsers($role: UserRole) {
    listUsers(role: $role) {
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

export const getUser = /* GraphQL */ `
  query GetUser($username: String!) {
    getUser(username: $username) {
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

export const getCurrentUser = /* GraphQL */ `
  query GetCurrentUser {
    getCurrentUser {
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

export const previewExcelImport = /* GraphQL */ `
  query PreviewExcelImport($fileContent: String!) {
    previewExcelImport(fileContent: $fileContent) {
      previewData {
        name
        username
        password
        role
        email
      }
      totalRows
      validRows
      invalidRows
      errors
    }
  }
`;

export const checkPasswordResetToken = /* GraphQL */ `
  query CheckPasswordResetToken($token: String!) {
    checkPasswordResetToken(token: $token)
  }
`;
