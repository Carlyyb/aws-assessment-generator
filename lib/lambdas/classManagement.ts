// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 班级管理 Lambda 函数
 * 处理班级创建、学生管理等操作
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand, GetCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { createTimestamp } from '../utils/timeUtils';

// 客户端初始化
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);

// 环境变量
const CLASSES_TABLE_NAME = process.env.CLASSES_TABLE_NAME!;
const STUDENTS_TABLE_NAME = process.env.STUDENTS_TABLE_NAME!;
const CLASS_STUDENTS_TABLE_NAME = process.env.CLASS_STUDENTS_TABLE_NAME!;

// 接口定义
interface CreateClassInput {
  name: string;
  description?: string;
  accessibleTeachers?: string[];
}

interface UpdateClassPermissionsInput {
  classId: string;
  accessibleTeachers: string[];
}

interface AddStudentToClassInput {
  classId: string;
  studentIdentifier: string;  // 支持姓名或用户名搜索
}

interface AddStudentsToClassInput {
  classId: string;
  studentIdentifiers: string[];  // 支持姓名或用户名搜索的数组
}

interface Class {
  id: string;
  name: string;
  description?: string;
  teacherId: string;
  accessibleTeachers: string[];
  createdAt: string;
  updatedAt: string;
  students?: Student[];
}

interface Student {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  lastLoginAt?: string;
  assessmentCount?: number;
  groups?: string[]; // StudentGroup IDs
  classes?: string[]; // Class IDs
  needsPasswordChange?: boolean;
  phoneNumber?: string;
  createdAt: string;
  createdBy?: string;
}

/**
 * 检查用户是否有班级访问权限
 */
async function hasClassAccess(classId: string, username: string, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) {
    return true; // 管理员总是有权限
  }

  const classItem = await getClassById(classId);
  if (!classItem) {
    return false;
  }

  // 检查是否是班级创建者或在可访问老师列表中
  return classItem.teacherId === username || classItem.accessibleTeachers.includes(username);
}

/**
 * 更新班级权限
 */
async function updateClassPermissions(input: UpdateClassPermissionsInput): Promise<Class> {
  try {
    const now = createTimestamp();
    
    // 确保创建者始终在可访问列表中
    const classItem = await getClassById(input.classId);
    if (!classItem) {
      throw new Error('Class not found');
    }

    const accessibleTeachers = [...new Set([classItem.teacherId, ...input.accessibleTeachers])];

    await docClient.send(new UpdateCommand({
      TableName: CLASSES_TABLE_NAME,
      Key: { id: input.classId },
      UpdateExpression: 'SET accessibleTeachers = :accessibleTeachers, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':accessibleTeachers': accessibleTeachers,
        ':updatedAt': now
      }
    }));

    return await getClassById(input.classId) as Class;
  } catch (error) {
    console.error('Error updating class permissions:', error);
    throw error;
  }
}

/**
 * 生成唯一ID
 */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 获取用户信息
 */
async function getCurrentUser(event: AppSyncResolverEvent<any>): Promise<{ userId: string; username: string; groups: string[] }> {
  const identity = event.identity as any;
  if (!identity || !identity.claims) {
    throw new Error('Unauthorized: No valid identity found');
  }

  const userId = identity.claims.sub;
  const username = identity.claims['cognito:username'] || identity.username;
  const groups = identity.claims['cognito:groups'] || [];

  return { userId, username, groups };
}

/**
 * 创建班级
 */
async function createClass(input: CreateClassInput, teacherId: string): Promise<Class> {
  const classId = generateId();
  const now = createTimestamp();

  const classItem: Class = {
    id: classId,
    name: input.name,
    description: input.description,
    teacherId,
    accessibleTeachers: input.accessibleTeachers || [teacherId], // 默认创建者可访问
    createdAt: now,
    updatedAt: now
  };

  await docClient.send(new PutCommand({
    TableName: CLASSES_TABLE_NAME,
    Item: classItem
  }));

  return classItem;
}

/**
 * 获取教师的班级列表
 */
async function listClassesByTeacher(username: string): Promise<Class[]> {
  try {
    // 获取所有班级
    const response = await docClient.send(new ScanCommand({
      TableName: CLASSES_TABLE_NAME
    }));

    const allClasses = response.Items as Class[];
    
    // 筛选用户有权限访问的班级
    const accessibleClasses = allClasses.filter(classItem => 
      classItem.teacherId === username || 
      (classItem.accessibleTeachers && classItem.accessibleTeachers.includes(username))
    );

    // 为每个班级加载学生信息
    for (const classItem of accessibleClasses) {
      classItem.students = await getClassStudents(classItem.id);
    }

    return accessibleClasses;
  } catch (error) {
    console.error('Error listing classes by teacher:', error);
    throw new Error('Failed to list classes');
  }
}

/**
 * 获取所有班级（管理员权限）
 */
async function listAllClasses(): Promise<Class[]> {
  try {
    const response = await docClient.send(new ScanCommand({
      TableName: CLASSES_TABLE_NAME
    }));

    const classes = response.Items as Class[];
    
    // 为每个班级加载学生信息
    for (const classItem of classes) {
      classItem.students = await getClassStudents(classItem.id);
    }

    return classes;
  } catch (error) {
    console.error('Error listing all classes:', error);
    throw new Error('Failed to list classes');
  }
}

/**
 * 根据ID获取班级
 */
async function getClassById(classId: string): Promise<Class | null> {
  try {
    const response = await docClient.send(new GetCommand({
      TableName: CLASSES_TABLE_NAME,
      Key: { id: classId }
    }));

    if (!response.Item) {
      return null;
    }

    const classItem = response.Item as Class;
    classItem.students = await getClassStudents(classId);

    return classItem;
  } catch (error) {
    console.error('Error getting class by ID:', error);
    throw new Error('Failed to get class');
  }
}

/**
 * 获取班级的学生列表
 */
async function getClassStudents(classId: string): Promise<Student[]> {
  try {
    // 首先从关联表获取学生ID列表
    const classStudentsResponse = await docClient.send(new QueryCommand({
      TableName: CLASS_STUDENTS_TABLE_NAME,
      IndexName: 'classId-index',
      KeyConditionExpression: 'classId = :classId',
      ExpressionAttributeValues: {
        ':classId': classId
      }
    }));

    if (!classStudentsResponse.Items || classStudentsResponse.Items.length === 0) {
      return [];
    }

    // 获取学生详细信息 - 使用统一的Students表
    const students: Student[] = [];
    for (const item of classStudentsResponse.Items) {
      try {
        const studentResponse = await docClient.send(new GetCommand({
          TableName: STUDENTS_TABLE_NAME,
          Key: { id: item.studentId }
        }));

        if (studentResponse.Item) {
          students.push(studentResponse.Item as Student);
        }
      } catch (error) {
        console.error('Error getting student:', error);
        // 继续处理其他学生
      }
    }

    return students;
  } catch (error) {
    console.error('Error getting class students:', error);
    return [];
  }
}

/**
 * 根据邮箱查找学生
 */
async function findStudentByEmail(email: string): Promise<Student | null> {
  try {
    const response = await docClient.send(new QueryCommand({
      TableName: STUDENTS_TABLE_NAME,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': email
      }
    }));

    if (!response.Items || response.Items.length === 0) {
      return null;
    }

    return response.Items[0] as Student;
  } catch (error) {
    console.error('Error finding student by email:', error);
    return null;
  }
}

/**
 * 根据姓名或用户名查找学生
 */
async function findStudentByNameOrUsername(identifier: string): Promise<Student | null> {
  try {
    // 首先尝试按用户名查找
    const usernameResponse = await docClient.send(new QueryCommand({
      TableName: STUDENTS_TABLE_NAME,
      IndexName: 'username-index',
      KeyConditionExpression: 'username = :username',
      ExpressionAttributeValues: {
        ':username': identifier
      }
    }));

    if (usernameResponse.Items && usernameResponse.Items.length > 0) {
      return usernameResponse.Items[0] as Student;
    }

    // 如果按用户名没找到，尝试按姓名查找
    const nameResponse = await docClient.send(new ScanCommand({
      TableName: STUDENTS_TABLE_NAME,
      FilterExpression: '#name = :name',
      ExpressionAttributeNames: {
        '#name': 'name'
      },
      ExpressionAttributeValues: {
        ':name': identifier
      }
    }));

    if (nameResponse.Items && nameResponse.Items.length > 0) {
      return nameResponse.Items[0] as Student;
    }

    return null;
  } catch (error) {
    console.error('Error finding student by name or username:', error);
    return null;
  }
}

/**
 * 添加学生到班级
 */
async function addStudentToClass(input: AddStudentToClassInput, username: string, isAdmin: boolean): Promise<Class> {
  try {
    // 1. 验证班级是否存在
    const classItem = await getClassById(input.classId);
    if (!classItem) {
      throw new Error('Class not found');
    }

    // 2. 检查权限
    const hasAccess = await hasClassAccess(input.classId, username, isAdmin);
    if (!hasAccess) {
      throw new Error('Unauthorized: You do not have permission to manage this class');
    }

    // 3. 查找学生
    const student = await findStudentByNameOrUsername(input.studentIdentifier);
    if (!student) {
      throw new Error('Student not found');
    }

    // 4. 检查学生是否已在班级中
    const existingAssociation = await docClient.send(new GetCommand({
      TableName: CLASS_STUDENTS_TABLE_NAME,
      Key: {
        classId: input.classId,
        studentId: student.id
      }
    }));

    if (existingAssociation.Item) {
      throw new Error('Student is already in this class');
    }

    // 5. 创建班级-学生关联
    const now = createTimestamp();
    await docClient.send(new PutCommand({
      TableName: CLASS_STUDENTS_TABLE_NAME,
      Item: {
        classId: input.classId,
        studentId: student.id,
        createdAt: now
      }
    }));

    // 6. 更新班级的更新时间
    await docClient.send(new UpdateCommand({
      TableName: CLASSES_TABLE_NAME,
      Key: { id: input.classId },
      UpdateExpression: 'SET updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':updatedAt': now
      }
    }));

    // 7. 更新学生记录中的班级列表
    const currentClasses = student.classes || [];
    if (!currentClasses.includes(input.classId)) {
      await docClient.send(new UpdateCommand({
        TableName: STUDENTS_TABLE_NAME,
        Key: { id: student.id },
        UpdateExpression: 'SET classes = list_append(if_not_exists(classes, :empty_list), :classId)',
        ExpressionAttributeValues: {
          ':empty_list': [],
          ':classId': [input.classId]
        }
      }));
    }

    // 8. 返回更新后的班级信息
    return await getClassById(input.classId) as Class;
  } catch (error) {
    console.error('Error adding student to class:', error);
    throw error;
  }
}

/**
 * 批量添加学生到班级
 */
async function addStudentsToClass(input: AddStudentsToClassInput, username: string, isAdmin: boolean): Promise<Class> {
  try {
    // 1. 验证班级是否存在
    const classItem = await getClassById(input.classId);
    if (!classItem) {
      throw new Error('Class not found');
    }

    // 2. 检查权限
    const hasAccess = await hasClassAccess(input.classId, username, isAdmin);
    if (!hasAccess) {
      throw new Error('Unauthorized: You do not have permission to manage this class');
    }

    // 3. 查找所有学生
    const studentPromises = input.studentIdentifiers.map(identifier => findStudentByNameOrUsername(identifier));
    const students = (await Promise.all(studentPromises)).filter(s => s !== null) as Student[];
    
    if (students.length === 0) {
      // 如果没有找到任何有效的学生，直接返回班级信息
      return await getClassById(input.classId) as Class;
    }

    // 4. 过滤掉已在班级中的学生
    const currentStudents = await getClassStudents(input.classId);
    const currentStudentIds = new Set(currentStudents.map(s => s.id));
    const studentsToAdd = students.filter(s => !currentStudentIds.has(s.id));

    if (studentsToAdd.length === 0) {
      // 如果所有学生都已在班级中，直接返回
      return await getClassById(input.classId) as Class;
    }

    // 5. 批量创建班级-学生关联
    const now = createTimestamp();
    const putRequests = studentsToAdd.map(student => ({
      PutRequest: {
        Item: {
          classId: input.classId,
          studentId: student.id,
          createdAt: now
        }
      }
    }));

    // DynamoDB BatchWriteCommand 一次最多处理25个项目
    for (let i = 0; i < putRequests.length; i += 25) {
      const batch = putRequests.slice(i, i + 25);
      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [CLASS_STUDENTS_TABLE_NAME]: batch
        }
      }));
    }

    // 6. 批量更新学生记录中的班级列表
    const updateStudentPromises = studentsToAdd.map(student => {
      const currentClasses = student.classes || [];
      if (!currentClasses.includes(input.classId)) {
        return docClient.send(new UpdateCommand({
          TableName: STUDENTS_TABLE_NAME,
          Key: { id: student.id },
          UpdateExpression: 'SET classes = list_append(if_not_exists(classes, :empty_list), :classId)',
          ExpressionAttributeValues: {
            ':empty_list': [],
            ':classId': [input.classId]
          }
        }));
      }
      return Promise.resolve();
    });
    await Promise.all(updateStudentPromises);

    // 7. 更新班级的更新时间
    await docClient.send(new UpdateCommand({
      TableName: CLASSES_TABLE_NAME,
      Key: { id: input.classId },
      UpdateExpression: 'SET updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':updatedAt': now
      }
    }));

    // 8. 返回更新后的班级信息
    return await getClassById(input.classId) as Class;
  } catch (error) {
    console.error('Error adding students to class:', error);
    throw error;
  }
}

/**
 * 从班级移除学生
 */
async function removeStudentFromClass(classId: string, studentId: string, username: string, isAdmin: boolean): Promise<Class> {
  try {
    // 1. 验证班级是否存在
    const classItem = await getClassById(classId);
    if (!classItem) {
      throw new Error('Class not found');
    }

    // 2. 检查权限
    const hasAccess = await hasClassAccess(classId, username, isAdmin);
    if (!hasAccess) {
      throw new Error('Unauthorized: You do not have permission to manage this class');
    }

    // 3. 删除班级-学生关联
    await docClient.send(new DeleteCommand({
      TableName: CLASS_STUDENTS_TABLE_NAME,
      Key: {
        classId,
        studentId
      }
    }));

    // 4. 更新班级的更新时间
    const now = createTimestamp();
    await docClient.send(new UpdateCommand({
      TableName: CLASSES_TABLE_NAME,
      Key: { id: classId },
      UpdateExpression: 'SET updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':updatedAt': now
      }
    }));

    // 5. 更新学生记录中的班级列表，移除当前班级
    const student = await docClient.send(new GetCommand({
      TableName: STUDENTS_TABLE_NAME,
      Key: { id: studentId }
    }));

    if (student.Item && student.Item.classes) {
      const updatedClasses = student.Item.classes.filter((cId: string) => cId !== classId);
      await docClient.send(new UpdateCommand({
        TableName: STUDENTS_TABLE_NAME,
        Key: { id: studentId },
        UpdateExpression: 'SET classes = :classes',
        ExpressionAttributeValues: {
          ':classes': updatedClasses
        }
      }));
    }

    // 6. 返回更新后的班级信息
    return await getClassById(classId) as Class;
  } catch (error) {
    console.error('Error removing student from class:', error);
    throw error;
  }
}

/**
 * 更新班级信息
 */
async function updateClass(classId: string, input: CreateClassInput, teacherId: string): Promise<Class> {
  try {
    // 1. 验证班级是否存在且属于该教师
    const existingClass = await getClassById(classId);
    if (!existingClass) {
      throw new Error('Class not found');
    }

    if (existingClass.teacherId !== teacherId) {
      throw new Error('Unauthorized: You can only update your own classes');
    }

    // 2. 更新班级信息
    const now = createTimestamp();
    await docClient.send(new UpdateCommand({
      TableName: CLASSES_TABLE_NAME,
      Key: { id: classId },
      UpdateExpression: 'SET #name = :name, description = :description, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#name': 'name'
      },
      ExpressionAttributeValues: {
        ':name': input.name,
        ':description': input.description,
        ':updatedAt': now
      }
    }));

    // 3. 返回更新后的班级信息
    return await getClassById(classId) as Class;
  } catch (error) {
    console.error('Error updating class:', error);
    throw error;
  }
}

/**
 * 删除班级
 */
async function deleteClass(classId: string, teacherId: string): Promise<boolean> {
  try {
    // 1. 验证班级是否存在且属于该教师
    const existingClass = await getClassById(classId);
    if (!existingClass) {
      throw new Error('Class not found');
    }

    if (existingClass.teacherId !== teacherId) {
      throw new Error('Unauthorized: You can only delete your own classes');
    }

    // 2. 删除所有班级-学生关联
    const classStudentsResponse = await docClient.send(new QueryCommand({
      TableName: CLASS_STUDENTS_TABLE_NAME,
      IndexName: 'classId-index',
      KeyConditionExpression: 'classId = :classId',
      ExpressionAttributeValues: {
        ':classId': classId
      }
    }));

    if (classStudentsResponse.Items) {
      for (const item of classStudentsResponse.Items) {
        await docClient.send(new DeleteCommand({
          TableName: CLASS_STUDENTS_TABLE_NAME,
          Key: {
            classId: item.classId,
            studentId: item.studentId
          }
        }));
      }
    }

    // 3. 删除班级
    await docClient.send(new DeleteCommand({
      TableName: CLASSES_TABLE_NAME,
      Key: { id: classId }
    }));

    return true;
  } catch (error) {
    console.error('Error deleting class:', error);
    throw error;
  }
}

/**
 * Lambda 处理器主函数
 */
export const handler = async (event: AppSyncResolverEvent<any>): Promise<any> => {
  console.log('Class Management Lambda Event:', JSON.stringify(event, null, 2));

  try {
    const { fieldName } = event.info;
    const { userId, username, groups } = await getCurrentUser(event);

    // 权限检查
    const isTeacher = groups.includes('teachers');
    const isAdmin = groups.includes('admin');

    switch (fieldName) {
      case 'createClass':
        if (!isTeacher && !isAdmin) {
          throw new Error('Unauthorized: Only teachers can create classes');
        }
        return await createClass(event.arguments.input, userId);

      case 'listClasses':
        if (!isAdmin) {
          throw new Error('Unauthorized: Only admins can list all classes');
        }
        return await listAllClasses();

      case 'listClassesByTeacher':
        if (!isTeacher && !isAdmin) {
          throw new Error('Unauthorized: Only teachers can list classes');
        }
        return await listClassesByTeacher(username);

      case 'getClassById':
        return await getClassById(event.arguments.id);

      case 'addStudentToClass':
        if (!isTeacher && !isAdmin) {
          throw new Error('Unauthorized: Only teachers can manage class students');
        }
        return await addStudentToClass(event.arguments.input, username, isAdmin);

      case 'addStudentsToClass':
        if (!isTeacher && !isAdmin) {
          throw new Error('Unauthorized: Only teachers can manage class students');
        }
        return await addStudentsToClass(event.arguments.input, username, isAdmin);

      case 'removeStudentFromClass':
        if (!isTeacher && !isAdmin) {
          throw new Error('Unauthorized: Only teachers can manage class students');
        }
        return await removeStudentFromClass(event.arguments.classId, event.arguments.studentId, username, isAdmin);

      case 'updateClassPermissions':
        if (!isAdmin) {
          throw new Error('Unauthorized: Only admins can update class permissions');
        }
        return await updateClassPermissions(event.arguments.input);

      case 'updateClass':
        if (!isTeacher && !isAdmin) {
          throw new Error('Unauthorized: Only teachers can update classes');
        }
        return await updateClass(event.arguments.id, event.arguments.input, userId);

      case 'deleteClass':
        if (!isTeacher && !isAdmin) {
          throw new Error('Unauthorized: Only teachers can delete classes');
        }
        return await deleteClass(event.arguments.id, userId);

      default:
        throw new Error(`Unknown field: ${fieldName}`);
    }
  } catch (error) {
    console.error('Class Management Lambda Error:', error);
    throw error;
  }
};
