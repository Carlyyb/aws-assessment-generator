// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';
import {
  aws_appsync,
  aws_cognito,
  aws_dynamodb,
  aws_iam,
  aws_lambda,
  aws_lambda_nodejs,
  aws_logs,
  Duration,
  NestedStack,
  NestedStackProps,
  RemovalPolicy,
  Stack,
} from 'aws-cdk-lib';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import path from 'path';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { ManagedPolicy, Policy, PolicyStatement, PolicyDocument } from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { KeyCondition } from 'aws-cdk-lib/aws-appsync';

export const feedbacksDbName = 'feedbacks';
export const feedbacksTableName = 'feedbacks';

interface DataStackProps extends NestedStackProps {
  userPool: aws_cognito.UserPool;
  artifactsUploadBucket: s3.Bucket;
  documentProcessorLambda: NodejsFunction;
  postConfirmationLambda: NodejsFunction;
  kbTable: TableV2;
  logQueryFunction?: NodejsFunction; // 添加可选的日志查询函数
}

export class DataStack extends NestedStack {
  public readonly api: aws_appsync.GraphqlApi;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);
    const { userPool, kbTable } = props;
    const artifactsUploadBucket = props.artifactsUploadBucket;
    const documentProcessorLambda = props.documentProcessorLambda;

    const api = new aws_appsync.GraphqlApi(this, 'Api', {
      name: 'Api',
      definition: aws_appsync.Definition.fromFile('lib/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: aws_appsync.AuthorizationType.USER_POOL,
          userPoolConfig: { userPool },
        },
      },
      logConfig: { retention: aws_logs.RetentionDays.ONE_WEEK, fieldLogLevel: aws_appsync.FieldLogLevel.ALL },
      xrayEnabled: true,
    });

    /////////// Settings

    const settingsTable = new aws_dynamodb.TableV2(this, 'SettingsTable', {
      partitionKey: { name: 'userId', type: aws_dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const settingsDs = api.addDynamoDbDataSource('SettingsDataSource', settingsTable);

    settingsDs.createResolver('QueryGetSettingsResolver', {
      typeName: 'Query',
      fieldName: 'getSettings',
      code: aws_appsync.Code.fromAsset('lib/resolvers/getSettings.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    settingsDs.createResolver('MutationUpsertSettingsResolver', {
      typeName: 'Mutation',
      fieldName: 'upsertSettings',
      code: aws_appsync.Code.fromAsset('lib/resolvers/upsertSettings.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    /////////// Users

    const usersTable = new aws_dynamodb.TableV2(this, 'UsersTable', {
      partitionKey: { name: 'id', type: aws_dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /////////// Students

    const studentsTable = new aws_dynamodb.TableV2(this, 'StudentsTable', {
      partitionKey: { name: 'id', type: aws_dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      globalSecondaryIndexes: [
        {
          indexName: 'email-index',
          partitionKey: { name: 'email', type: aws_dynamodb.AttributeType.STRING },
        }
      ]
    });

    /////////// Student Groups

    const studentGroupsTable = new aws_dynamodb.TableV2(this, 'StudentGroupsTable', {
      partitionKey: { name: 'id', type: aws_dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /////////// Classes - 暂时注释

    // const classesTable = new aws_dynamodb.TableV2(this, 'ClassesTable', {
    //   partitionKey: { name: 'id', type: aws_dynamodb.AttributeType.STRING },
    //   removalPolicy: RemovalPolicy.DESTROY,
    //   globalSecondaryIndexes: [
    //     {
    //       indexName: 'teacherId-index',
    //       partitionKey: { name: 'teacherId', type: aws_dynamodb.AttributeType.STRING },
    //     }
    //   ]
    // });

    /////////// Class-Student Associations - 暂时注释

    // const classStudentsTable = new aws_dynamodb.TableV2(this, 'ClassStudentsTable', {
    //   partitionKey: { name: 'classId', type: aws_dynamodb.AttributeType.STRING },
    //   sortKey: { name: 'studentId', type: aws_dynamodb.AttributeType.STRING },
    //   removalPolicy: RemovalPolicy.DESTROY,
    //   globalSecondaryIndexes: [
    //     {
    //       indexName: 'classId-index',
    //       partitionKey: { name: 'classId', type: aws_dynamodb.AttributeType.STRING },
    //     },
    //     {
    //       indexName: 'studentId-index',
    //       partitionKey: { name: 'studentId', type: aws_dynamodb.AttributeType.STRING },
    //     }
    //   ]
    // });

    // 将用户表名保存到SSM参数
    new StringParameter(this, 'UsersTableNameParameter', {
      parameterName: '/gen-assess/users-table-name',
      stringValue: usersTable.tableName,
      description: 'Users table name for GenAssess application'
    });

    // 创建用户管理 Lambda 函数
    const userManagementFunction = new NodejsFunction(this, 'UserManagementFunction', {
      entry: path.join(__dirname, 'lambdas', 'userManagement.ts'),
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(30),
      memorySize: 512,
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USERS_TABLE_NAME: usersTable.tableName,
        STUDENTS_TABLE_NAME: studentsTable.tableName,
        STUDENT_GROUPS_TABLE_NAME: studentGroupsTable.tableName,
        REGION: Stack.of(this).region
      },
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb', '@aws-sdk/client-cognito-identity-provider', '@aws-sdk/client-ssm'],
      }
    });

    // 创建密码修改 Lambda 函数
    const changePasswordFunction = new NodejsFunction(this, 'ChangePasswordFunction', {
      entry: path.join(__dirname, 'resolvers', 'changePassword.ts'),
      runtime: aws_lambda.Runtime.NODEJS_18_X,
      timeout: Duration.seconds(30),
      memorySize: 256,
      environment: {
        REGION: Stack.of(this).region
      },
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/client-cognito-identity-provider', '@aws-sdk/client-ssm', '@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
      }
    });

    // 给密码修改函数权限
    usersTable.grantReadWriteData(changePasswordFunction);
    changePasswordFunction.addToRolePolicy(new aws_iam.PolicyStatement({
      effect: aws_iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminInitiateAuth'
      ],
      resources: [userPool.userPoolArn]
    }));
    changePasswordFunction.addToRolePolicy(new aws_iam.PolicyStatement({
      effect: aws_iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters'
      ],
      resources: [`arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/gen-assess/*`]
    }));

    // 给 Lambda 函数权限访问 DynamoDB、Cognito 和 SSM
    usersTable.grantReadWriteData(userManagementFunction);
    studentsTable.grantReadWriteData(userManagementFunction);
    studentGroupsTable.grantReadWriteData(userManagementFunction);
    userManagementFunction.addToRolePolicy(new aws_iam.PolicyStatement({
      effect: aws_iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminGetUser',
        'cognito-idp:ListUsers'
      ],
      resources: [userPool.userPoolArn]
    }));
    userManagementFunction.addToRolePolicy(new aws_iam.PolicyStatement({
      effect: aws_iam.Effect.ALLOW,
      actions: [
        'ssm:GetParameter',
        'ssm:GetParameters'
      ],
      resources: [`arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/gen-assess/*`]
    }));

    // 创建 Lambda 数据源
    const userManagementDs = api.addLambdaDataSource('UserManagementDataSource', userManagementFunction);
    const changePasswordDs = api.addLambdaDataSource('ChangePasswordDataSource', changePasswordFunction);

    // 创建用户管理相关的 resolver
    userManagementDs.createResolver('QueryListUsersResolver', {
      typeName: 'Query',
      fieldName: 'listUsers',
      code: aws_appsync.Code.fromAsset('lib/resolvers/listUsers.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    userManagementDs.createResolver('MutationCreateSingleUserResolver', {
      typeName: 'Mutation',
      fieldName: 'createSingleUser',
      code: aws_appsync.Code.fromAsset('lib/resolvers/createSingleUser.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    userManagementDs.createResolver('MutationBatchCreateUsersResolver', {
      typeName: 'Mutation',
      fieldName: 'batchCreateUsers',
      code: aws_appsync.Code.fromAsset('lib/resolvers/batchCreateUsers.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    userManagementDs.createResolver('MutationUpdateUserResolver', {
      typeName: 'Mutation',
      fieldName: 'updateUser',
      code: aws_appsync.Code.fromAsset('lib/resolvers/updateUser.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    userManagementDs.createResolver('MutationDeleteUserResolver', {
      typeName: 'Mutation',
      fieldName: 'deleteUser',
      code: aws_appsync.Code.fromAsset('lib/resolvers/deleteUser.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    userManagementDs.createResolver('QueryPreviewExcelImportResolver', {
      typeName: 'Query',
      fieldName: 'previewExcelImport',
      code: aws_appsync.Code.fromAsset('lib/resolvers/previewExcelImport.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    userManagementDs.createResolver('MutationResetUserPasswordResolver', {
      typeName: 'Mutation',
      fieldName: 'resetUserPassword',
      code: aws_appsync.Code.fromAsset('lib/resolvers/resetUserPassword.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    // 密码修改解析器
    changePasswordDs.createResolver('MutationChangePasswordResolver', {
      typeName: 'Mutation',
      fieldName: 'changePassword',
      code: aws_appsync.Code.fromAsset('lib/resolvers/lambdaResolver.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    // 分组管理resolvers
    userManagementDs.createResolver('QueryListStudentGroupsResolver', {
      typeName: 'Query',
      fieldName: 'listStudentGroups',
      code: aws_appsync.Code.fromAsset('lib/resolvers/listStudentGroups.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    userManagementDs.createResolver('MutationCreateStudentGroupResolver', {
      typeName: 'Mutation',
      fieldName: 'createStudentGroup',
      code: aws_appsync.Code.fromAsset('lib/resolvers/createStudentGroup.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    userManagementDs.createResolver('MutationUpdateStudentGroupResolver', {
      typeName: 'Mutation',
      fieldName: 'updateStudentGroup',
      code: aws_appsync.Code.fromAsset('lib/resolvers/updateStudentGroup.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    userManagementDs.createResolver('MutationDeleteStudentGroupResolver', {
      typeName: 'Mutation',
      fieldName: 'deleteStudentGroup',
      code: aws_appsync.Code.fromAsset('lib/resolvers/deleteStudentGroup.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    /////////// Class Management - 暂时注释

    // // 创建班级管理 Lambda 函数
    // const classManagementFunction = new NodejsFunction(this, 'ClassManagementFunction', {
    //   entry: path.join(__dirname, 'lambdas', 'classManagement.ts'),
    //   runtime: aws_lambda.Runtime.NODEJS_18_X,
    //   timeout: Duration.seconds(30),
    //   memorySize: 512,
    //   environment: {
    //     CLASSES_TABLE_NAME: classesTable.tableName,
    //     STUDENTS_TABLE_NAME: studentsTable.tableName,
    //     CLASS_STUDENTS_TABLE_NAME: classStudentsTable.tableName,
    //     REGION: Stack.of(this).region
    //   },
    //   bundling: {
    //     minify: true,
    //     externalModules: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
    //   }
    // });

    // // 给班级管理函数权限
    // classesTable.grantReadWriteData(classManagementFunction);
    // studentsTable.grantReadWriteData(classManagementFunction);
    // classStudentsTable.grantReadWriteData(classManagementFunction);

    // // 创建班级管理 Lambda 数据源
    // const classManagementDs = api.addLambdaDataSource('ClassManagementDataSource', classManagementFunction);

    // // 创建班级管理相关的 resolver
    // classManagementDs.createResolver('QueryListClassesResolver', {
    //   typeName: 'Query',
    //   fieldName: 'listClasses',
    //   code: aws_appsync.Code.fromAsset('lib/resolvers/class.ts'),
    //   runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    // });

    // classManagementDs.createResolver('QueryListClassesByTeacherResolver', {
    //   typeName: 'Query',
    //   fieldName: 'listClassesByTeacher',
    //   code: aws_appsync.Code.fromAsset('lib/resolvers/class.ts'),
    //   runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    // });

    // classManagementDs.createResolver('QueryGetClassByIdResolver', {
    //   typeName: 'Query',
    //   fieldName: 'getClassById',
    //   code: aws_appsync.Code.fromAsset('lib/resolvers/class.ts'),
    //   runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    // });

    // classManagementDs.createResolver('MutationCreateClassResolver', {
    //   typeName: 'Mutation',
    //   fieldName: 'createClass',
    //   code: aws_appsync.Code.fromAsset('lib/resolvers/class.ts'),
    //   runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    // });

    // classManagementDs.createResolver('MutationUpdateClassResolver', {
    //   typeName: 'Mutation',
    //   fieldName: 'updateClass',
    //   code: aws_appsync.Code.fromAsset('lib/resolvers/class.ts'),
    //   runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    // });

    // classManagementDs.createResolver('MutationDeleteClassResolver', {
    //   typeName: 'Mutation',
    //   fieldName: 'deleteClass',
    //   code: aws_appsync.Code.fromAsset('lib/resolvers/class.ts'),
    //   runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    // });

    // classManagementDs.createResolver('MutationAddStudentToClassResolver', {
    //   typeName: 'Mutation',
    //   fieldName: 'addStudentToClass',
    //   code: aws_appsync.Code.fromAsset('lib/resolvers/class.ts'),
    //   runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    // });

    // classManagementDs.createResolver('MutationAddStudentsToClassResolver', {
    //   typeName: 'Mutation',
    //   fieldName: 'addStudentsToClass',
    //   code: aws_appsync.Code.fromAsset('lib/resolvers/class.ts'),
    //   runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    // });

    // classManagementDs.createResolver('MutationRemoveStudentFromClassResolver', {
    //   typeName: 'Mutation',
    //   fieldName: 'removeStudentFromClass',
    //   code: aws_appsync.Code.fromAsset('lib/resolvers/class.ts'),
    //   runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    // });

    // classManagementDs.createResolver('MutationUpdateClassPermissionsResolver', {
    //   typeName: 'Mutation',
    //   fieldName: 'updateClassPermissions',
    //   code: aws_appsync.Code.fromAsset('lib/resolvers/class.ts'),
    //   runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    // });

    /////////// Courses

    const coursesTable = new aws_dynamodb.TableV2(this, 'CoursesTable', {
      partitionKey: { name: 'id', type: aws_dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const coursesDs = api.addDynamoDbDataSource('CoursesDataSource', coursesTable);

    coursesDs.createResolver('QueryListCoursesResolver', {
      typeName: 'Query',
      fieldName: 'listCourses',
      requestMappingTemplate: aws_appsync.MappingTemplate.dynamoDbScanTable(),
      responseMappingTemplate: aws_appsync.MappingTemplate.dynamoDbResultList(),
    });

    coursesDs.createResolver('MutationUpsertCourseResolver', {
      typeName: 'Mutation',
      fieldName: 'upsertCourse',
      code: aws_appsync.Code.fromAsset('lib/resolvers/upsertCourse.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    coursesDs.createResolver('AssessmentCourseResolver', {
      typeName: 'Assessment',
      fieldName: 'course',
      code: aws_appsync.Code.fromAsset('lib/resolvers/getCourse.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    // 删除知识库Lambda函数
    const deleteKnowledgeBaseFn = new NodejsFunction(this, 'DeleteKnowledgeBaseFn', {
      entry: 'lib/lambdas/deleteKnowledgeBase.ts',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      bundling: {
        minify: true,
      },
      environment: {
        KB_TABLE: kbTable.tableName,
        KB_STAGING_BUCKET: artifactsUploadBucket.bucketName,
      },
    });

    // 为删除知识库Lambda添加权限
    deleteKnowledgeBaseFn.addToRolePolicy(
      new PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        resources: ['*'],
        actions: [
          'bedrock:DeleteKnowledgeBase',
          'bedrock:DeleteDataSource',
          'bedrock:GetKnowledgeBase',
          'bedrock:ListDataSources',
        ],
      })
    );

    // S3权限
    deleteKnowledgeBaseFn.addToRolePolicy(
      new PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        resources: [
          artifactsUploadBucket.bucketArn,
          `${artifactsUploadBucket.bucketArn}/*`,
        ],
        actions: [
          's3:DeleteObject',
          's3:ListBucket',
        ],
      })
    );

    // DynamoDB权限
    kbTable.grantReadWriteData(deleteKnowledgeBaseFn);

    const deleteKnowledgeBaseDs = api.addLambdaDataSource('DeleteKnowledgeBaseDs', deleteKnowledgeBaseFn);

    deleteKnowledgeBaseDs.createResolver('DeleteKnowledgeBaseResolver', {
      typeName: 'Mutation',
      fieldName: 'deleteKnowledgeBase',
      code: aws_appsync.Code.fromAsset('lib/resolvers/deleteKnowledgeBase.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    // 删除课程的Pipeline Resolver - 先删除课程，然后清理知识库
    const deleteCourseFunction = new aws_appsync.AppsyncFunction(this, 'DeleteCourseFunction', {
      api,
      dataSource: coursesDs,
      name: 'DeleteCourseFunction',
      code: aws_appsync.Code.fromAsset('lib/resolvers/deleteCourse.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    const cleanupKnowledgeBaseFunction = new aws_appsync.AppsyncFunction(this, 'CleanupKnowledgeBaseFunction', {
      api,
      dataSource: deleteKnowledgeBaseDs,
      name: 'CleanupKnowledgeBaseFunction',
      code: aws_appsync.Code.fromAsset('lib/resolvers/cleanupKnowledgeBase.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    new aws_appsync.Resolver(this, 'MutationDeleteCourseResolver', {
      api,
      typeName: 'Mutation',
      fieldName: 'deleteCourse',
      pipelineConfig: [deleteCourseFunction, cleanupKnowledgeBaseFunction],
      requestMappingTemplate: aws_appsync.MappingTemplate.fromString('{}'),
      responseMappingTemplate: aws_appsync.MappingTemplate.fromString('$util.toJson($ctx.result)'),
    });

    const studentsTableParam = new StringParameter(this, 'StudentsTableParameter', {
      parameterName: '/gen-assess/student-table-name',
      stringValue: studentsTable.tableName,
    });
    const policy = new Policy(this, 'lambdaPolicyDdb', {
      statements: [
        new PolicyStatement({
          actions: ['dynamodb:*'],
          resources: [studentsTable.tableArn],
        }),
      ],
    });
    if (!props.postConfirmationLambda.role) {
      throw new Error('err');
    }
    policy.attachToRole(props.postConfirmationLambda.role);

    // 添加listStudents resolver到userManagement Lambda数据源
    userManagementDs.createResolver('QueryListStudentsResolver', {
      typeName: 'Query',
      fieldName: 'listStudents',
      code: aws_appsync.Code.fromAsset('lib/resolvers/listStudents.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    /////////// AssessTemplates

    const assessTemplatesTable = new aws_dynamodb.TableV2(this, 'AssessTemplatesTable', {
      partitionKey: { name: 'userId', type: aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: aws_dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const assessTemplateDs = api.addDynamoDbDataSource('AssessTemplatesDataSource', assessTemplatesTable);

    assessTemplateDs.createResolver('MutationCreateAssessTemplateResolver', {
      typeName: 'Mutation',
      fieldName: 'createAssessTemplate',
      code: aws_appsync.Code.fromAsset('lib/resolvers/createAssessTemplate.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    assessTemplateDs.createResolver('QueryListAssessTemplatesResolver', {
      typeName: 'Query',
      fieldName: 'listAssessTemplates',
      code: aws_appsync.Code.fromAsset('lib/resolvers/listAssessTemplates.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    assessTemplateDs.createResolver('MutationDeleteAssessTemplateResolver', {
      typeName: 'Mutation',
      fieldName: 'deleteAssessTemplate',
      code: aws_appsync.Code.fromAsset('lib/resolvers/deleteAssessTemplate.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    /////////// Assessments

    const assessmentsTable = new aws_dynamodb.TableV2(this, 'AssessmentsTable', {
      partitionKey: { name: 'userId', type: aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'id', type: aws_dynamodb.AttributeType.STRING },
      globalSecondaryIndexes: [
        {
          indexName: 'id-only',
          partitionKey: { name: 'id', type: aws_dynamodb.AttributeType.STRING },
        },
      ],
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const assessmentsDs = api.addDynamoDbDataSource('AssessmentsDataSource', assessmentsTable);

    assessmentsDs.createResolver('MutationUpsertAssessmentResolver', {
      typeName: 'Mutation',
      fieldName: 'upsertAssessment',
      code: aws_appsync.Code.fromAsset('lib/resolvers/upsertAssessment.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    // 创建 listAssessments 解析器 - 直接使用 DynamoDB 数据源
    assessmentsDs.createResolver('QueryListAssessmentsResolver', {
      typeName: 'Query',
      fieldName: 'listAssessments',
      code: aws_appsync.Code.fromAsset('lib/resolvers/listAssessments.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    // 学生查看已发布测试的resolver
    assessmentsDs.createResolver('QueryListPublishedAssessmentsResolver', {
      typeName: 'Query',
      fieldName: 'listPublishedAssessments',
      code: aws_appsync.Code.fromAsset('lib/resolvers/listPublishedAssessments.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    assessmentsDs.createResolver('QueryGetAssessmentResolver', {
      typeName: 'Query',
      fieldName: 'getAssessment',
      code: aws_appsync.Code.fromAsset('lib/resolvers/getAssessment.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    /////////// StudentAssessments

    const studentAssessmentsTable = new aws_dynamodb.TableV2(this, 'StudentAssessmentsTable', {
      partitionKey: { name: 'userId', type: aws_dynamodb.AttributeType.STRING },
      sortKey: { name: 'parentAssessId', type: aws_dynamodb.AttributeType.STRING },
      globalSecondaryIndexes: [
        {
          indexName: 'ParentAssessIdIndex',
          partitionKey: { name: 'parentAssessId', type: aws_dynamodb.AttributeType.STRING },
        }
      ],
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const studentAssessmentsDs = api.addDynamoDbDataSource('StudentAssessmentsDataSource', studentAssessmentsTable);

    studentAssessmentsDs.createResolver('MutationUpsertStudentAssessmentResolver', {
      typeName: 'Mutation',
      fieldName: 'upsertStudentAssessment',
      code: aws_appsync.Code.fromAsset('lib/resolvers/upsertStudentAssessment.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    studentAssessmentsDs.createResolver('QueryListStudentAssessmentsResolver', {
      typeName: 'Query',
      fieldName: 'listStudentAssessments',
      code: aws_appsync.Code.fromAsset('lib/resolvers/listStudentAssessments.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    studentAssessmentsDs.createResolver('QueryListMyStudentAssessmentsResolver', {
      typeName: 'Query',
      fieldName: 'listMyStudentAssessments',
      requestMappingTemplate: aws_appsync.MappingTemplate.dynamoDbQuery(KeyCondition.eq('userId', '$ctx.args.studentId')),
      responseMappingTemplate: aws_appsync.MappingTemplate.dynamoDbResultList(),
    });

    // 创建 getStudentAssessment 解析器 - 直接使用 DynamoDB 数据源
    studentAssessmentsDs.createResolver('QueryGetStudentAssessmentResolver', {
      typeName: 'Query',
      fieldName: 'getStudentAssessment',
      code: aws_appsync.Code.fromAsset('lib/resolvers/getStudentAssessment.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    assessmentsDs.createResolver('ParentAssessmentResolver', {
      typeName: 'StudentAssessment',
      fieldName: 'assessment',
      code: aws_appsync.Code.fromAsset('lib/resolvers/getParentAssessment.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    const QUESTIONS_GENERATOR_NAME = 'QuestionsGenerator';
    const NAMESPACE = 'genassess-rag';
    const assessmentLambdaRole = new aws_iam.Role(this, `AssessmentLambdaRole`, {
      assumedBy: new aws_iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole')],
    });

    //Add Bedrock permissions on the Lambda function - comprehensive permissions for knowledge base operations
    assessmentLambdaRole.addToPolicy(
      new PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        resources: ['*'],
        actions: [
          // 知识库管理
          'bedrock:GetKnowledgeBase',
          'bedrock:CreateKnowledgeBase',
          'bedrock:UpdateKnowledgeBase',
          'bedrock:DeleteKnowledgeBase',
          'bedrock:ListKnowledgeBases',
          
          // 数据摄取
          'bedrock:StartIngestionJob',
          'bedrock:GetIngestionJob',
          'bedrock:ListIngestionJobs',
          'bedrock:StopIngestionJob',
          
          // 模型调用
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
          'bedrock:GetFoundationModel',
          'bedrock:ListFoundationModels',
          
          // 内容检索和生成
          'bedrock:Retrieve',
          'bedrock:RetrieveAndGenerate',
          'bedrock:GenerateQuery',
          
          // Agent相关（如果需要）
          'bedrock:InvokeAgent',
          'bedrock:GetAgent',
          'bedrock:ListAgents'
        ],
      })
    );

    // Creating the log group.
    const logGroup = new LogGroup(this, 'LogGroup', {
      logGroupName: `/${NAMESPACE}/${cdk.Stack.of(this).stackName}/${QUESTIONS_GENERATOR_NAME}/${this.node.addr}`,
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const questionsGenerator = new NodejsFunction(this, QUESTIONS_GENERATOR_NAME, {
      description: 'Generates questions',
      entry: path.resolve(__dirname, 'questions-generation', 'lambdas', 'event-handler', 'index.ts'),
      memorySize: 512,
      role: assessmentLambdaRole,
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      timeout: Duration.minutes(15),
      logGroup: logGroup,
      environment: {
        POWERTOOLS_SERVICE_NAME: 'questions-generator',
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        Q_GENERATION_BUCKET: artifactsUploadBucket.bucketName,
        ASSESSMENTS_TABLE: assessmentsTable.tableName,
        KB_TABLE: kbTable.tableName,
        ASSESS_TEMPLATE_TABLE: assessTemplatesTable.tableName,
      },
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/client-s3', '@aws-sdk/client-sns'],
      },
    });
    artifactsUploadBucket.grantRead(questionsGenerator);
    assessmentsTable.grantReadWriteData(questionsGenerator);
    kbTable.grantReadData(questionsGenerator);
    assessTemplatesTable.grantReadData(questionsGenerator);

    const qaGeneratorWrapper = new NodejsFunction(this, `${QUESTIONS_GENERATOR_NAME}-wrapper`, {
      description: 'Wraps around the Question generator ',
      entry: path.resolve(__dirname, 'questions-generation', 'lambdas', 'wrapper', 'index.ts'),
      memorySize: 512,
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      timeout: Duration.seconds(30),
      environment: {
        POWERTOOLS_SERVICE_NAME: 'questions-generator-wrapper',
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
        QA_LAMBDA_NAME: questionsGenerator.functionName,
        ASSESSMENTS_TABLE: assessmentsTable.tableName,
        ASSESS_TEMPLATE_TABLE: assessTemplatesTable.tableName,
      },
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/client-lambda'],
      },
    });
    questionsGenerator.grantInvoke(qaGeneratorWrapper);
    assessmentsTable.grantReadWriteData(qaGeneratorWrapper);
    assessTemplatesTable.grantReadData(qaGeneratorWrapper);

    /////////// Publish Assessment

    const publishFn = new aws_lambda_nodejs.NodejsFunction(this, 'PublishFn', {
      entry: 'lib/lambdas/publishAssessment.ts',
      runtime: Runtime.NODEJS_20_X,
      environment: {
        region: this.region,
        studentsTable: studentsTable.tableName,
        studentAssessmentsTable: studentAssessmentsTable.tableName,
        assessmentsTable: assessmentsTable.tableName,
      },
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/client-dynamodb'],
      },
    });
    studentsTable.grantReadData(publishFn);
    assessmentsTable.grantReadWriteData(publishFn);
    studentAssessmentsTable.grantReadWriteData(publishFn);
    const publishAssessmentDs = api.addLambdaDataSource('PublishAssessmentDataSource', publishFn);

    publishAssessmentDs.createResolver('PublishAssessmentResolver', {
      typeName: 'Query',
      fieldName: 'publishAssessment',
      code: aws_appsync.Code.fromAsset('lib/resolvers/publishAssessment.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    /////////// Unpublish Assessment

    const unpublishFn = new aws_lambda_nodejs.NodejsFunction(this, 'UnpublishFn', {
      entry: 'lib/lambdas/unpublishAssessment.ts',
      runtime: Runtime.NODEJS_20_X,
      environment: {
        region: this.region,
        assessmentsTable: assessmentsTable.tableName,
        studentAssessmentsTable: studentAssessmentsTable.tableName,
      },
      bundling: {
        minify: true,
        externalModules: ['@aws-sdk/client-dynamodb'],
      },
    });
    assessmentsTable.grantReadWriteData(unpublishFn);
    studentAssessmentsTable.grantReadWriteData(unpublishFn);
    const unpublishAssessmentDs = api.addLambdaDataSource('UnpublishAssessmentDataSource', unpublishFn);

    unpublishAssessmentDs.createResolver('UnpublishAssessmentResolver', {
      typeName: 'Mutation',
      fieldName: 'unpublishAssessment',
      code: aws_appsync.Code.fromAsset('lib/resolvers/unpublishAssessment.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    /////////// Delete Assessment Lambda Function

    // 创建删除评估的 Lambda 函数
    const deleteAssessmentLambda = new NodejsFunction(this, 'DeleteAssessmentLambda', {
      entry: path.join(__dirname, 'lambda', 'deleteAssessmentHandler.ts'),
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.minutes(5),
      tracing: Tracing.ACTIVE,
      environment: {
        ASSESSMENTS_TABLE: assessmentsTable.tableName,
        STUDENT_ASSESSMENTS_TABLE: studentAssessmentsTable.tableName,
      },
      logGroup: new LogGroup(this, 'DeleteAssessmentLambdaLogGroup', {
        logGroupName: `/aws/lambda/delete-assessment-handler`,
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    // 给 Lambda 函数权限访问 DynamoDB 表
    assessmentsTable.grantReadWriteData(deleteAssessmentLambda);
    studentAssessmentsTable.grantReadWriteData(deleteAssessmentLambda);

    // 创建 Lambda 数据源
    const deleteAssessmentDs = api.addLambdaDataSource('DeleteAssessmentDs', deleteAssessmentLambda);

    deleteAssessmentDs.createResolver('DeleteAssessmentResolver', {
      typeName: 'Mutation',
      fieldName: 'deleteAssessment',
      code: aws_appsync.Code.fromAsset('lib/resolvers/deleteAssessment.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    /////////// Create KnowledgeBase
    const createKnowledgeBaseDs = api.addLambdaDataSource('CreateKnowledgeBaseDs', documentProcessorLambda);

    createKnowledgeBaseDs.createResolver('CreateKnowledgeBaseResolver', {
      typeName: 'Mutation',
      fieldName: 'createKnowledgeBase',
      code: aws_appsync.Code.fromAsset('lib/resolvers/invokeLambda.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    /////////// Get KnowledgeBase
    const kbTableDs = api.addDynamoDbDataSource('KnowledgeBaseDataSource', kbTable);

    kbTableDs.createResolver('GetKnowledgeBaseResolver', {
      typeName: 'Query',
      fieldName: 'getKnowledgeBase',
      code: aws_appsync.Code.fromAsset('lib/resolvers/getKnowledgeBase.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    /////////// Generate Assessment
    const generateAssessmentDs = api.addLambdaDataSource('GenerateAssessmentDs', qaGeneratorWrapper);

    generateAssessmentDs.createResolver('GenerateAssessmentResolver', {
      typeName: 'Query',
      fieldName: 'generateAssessment',
      code: aws_appsync.Code.fromAsset('lib/resolvers/lambdaResolver.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    /////////// Grade Assessment

    const gradeAssessmentFn = new NodejsFunction(this, 'GradeAssessmentFn', {
      description: 'Grade Assessment',
      entry: 'lib/lambdas/gradeAssessment.ts',
      memorySize: 512,
      role: assessmentLambdaRole,
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      timeout: Duration.minutes(15),
      environment: {
        POWERTOOLS_SERVICE_NAME: 'assessment-grader',
        POWERTOOLS_METRICS_NAMESPACE: NAMESPACE,
      },
      bundling: {
        minify: true,
      },
    });
    gradeAssessmentFn.addToRolePolicy(
      new PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        resources: ['*'],
        actions: ['bedrock:InvokeModel'],
      })
    );

    const gradeAssessmentDs = api.addLambdaDataSource('GradeAssessmentDs', gradeAssessmentFn);

    new aws_appsync.Resolver(this, 'GradeStudentAssessmentResolver', {
      api,
      typeName: 'Mutation',
      fieldName: 'gradeStudentAssessment',
      code: aws_appsync.Code.fromInline(`
          export function request(ctx) {
          return {};
        }

        export function response(ctx) {
          return ctx.prev.result;
        }
      `),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
      pipelineConfig: [
        new aws_appsync.AppsyncFunction(this, 'GetParentAssessmentFn', {
          api,
          name: 'getParentAssessmentFn',
          dataSource: assessmentsDs,
          code: aws_appsync.Code.fromAsset('lib/resolvers/getParentAssessment.ts'),
          runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
        }),
        new aws_appsync.AppsyncFunction(this, 'GradeStudentAssessmentFn', {
          api,
          name: 'gradeStudentAssessment',
          dataSource: gradeAssessmentDs,
          requestMappingTemplate: aws_appsync.MappingTemplate.lambdaRequest(),
          responseMappingTemplate: aws_appsync.MappingTemplate.lambdaResult(),
        }),
        new aws_appsync.AppsyncFunction(this, 'UpsertStudentAssessmentFn', {
          api,
          name: 'upsertStudentAssessmentFn',
          dataSource: studentAssessmentsDs,
          code: aws_appsync.Code.fromAsset('lib/resolvers/upsertStudentAssessment.ts'),
          runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
        }),
      ],
    });

    ///////// Bedrock

    const getIngestionJobFn = new NodejsFunction(this, 'GetIngestionJobFn', {
      entry: 'lib/lambdas/getIngestionJob.ts',
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      tracing: Tracing.ACTIVE,
      bundling: {
        minify: true,
      },
    });
    getIngestionJobFn.addToRolePolicy(
      new PolicyStatement({
        effect: aws_iam.Effect.ALLOW,
        resources: ['*'],
        actions: ['bedrock:*'],
      })
    );

    const getIngestionJobDs = api.addLambdaDataSource('GetIngestionJobDs', getIngestionJobFn);

    getIngestionJobDs.createResolver('GetIngestionJobResolver', {
      typeName: 'Query',
      fieldName: 'getIngestionJob',
      code: aws_appsync.Code.fromAsset('lib/resolvers/invokeLambda.ts'),
      runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
    });

    ///////// 日志查询系统
    if (props.logQueryFunction) {
      const logQueryDs = api.addLambdaDataSource('LogQueryDs', props.logQueryFunction);

      logQueryDs.createResolver('QueryLogsResolver', {
        typeName: 'Query',
        fieldName: 'queryLogs',
        code: aws_appsync.Code.fromAsset('lib/resolvers/lambdaResolver.ts'),
        runtime: aws_appsync.FunctionRuntime.JS_1_0_0,
      });
    }

    this.api = api;
  }
}
