// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * 班级管理 Lambda 函数
 * 处理班级创建、学生管理等操作
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
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
}

interface AddStudentToClassInput {
  classId: string;
  studentEmail: string;
}

interface Class {
  id: string;
  name: string;
  description?: string;
  teacherId: string;
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
  classes?: string[];
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
async function listClassesByTeacher(teacherId: string): Promise<Class[]> {
  try {
    const response = await docClient.send(new QueryCommand({
      TableName: CLASSES_TABLE_NAME,
      IndexName: 'teacherId-index',
      KeyConditionExpression: 'teacherId = :teacherId',
      ExpressionAttributeValues: {
        ':teacherId': teacherId
      }
    }));

    const classes = response.Items as Class[];
    
    // 为每个班级加载学生信息
    for (const classItem of classes) {
      classItem.students = await getClassStudents(classItem.id);
    }

    return classes;
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

    // 获取学生详细信息
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
 * 添加学生到班级
 */
async function addStudentToClass(input: AddStudentToClassInput): Promise<Class> {
  try {
    // 1. 验证班级是否存在
    const classItem = await getClassById(input.classId);
    if (!classItem) {
      throw new Error('Class not found');
    }

    // 2. 查找学生
    const student = await findStudentByEmail(input.studentEmail);
    if (!student) {
      throw new Error('Student not found');
    }

    // 3. 检查学生是否已在班级中
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

    // 4. 创建班级-学生关联
    const now = createTimestamp();
    await docClient.send(new PutCommand({
      TableName: CLASS_STUDENTS_TABLE_NAME,
      Item: {
        classId: input.classId,
        studentId: student.id,
        createdAt: now
      }
    }));

    // 5. 更新班级的更新时间
    await docClient.send(new UpdateCommand({
      TableName: CLASSES_TABLE_NAME,
      Key: { id: input.classId },
      UpdateExpression: 'SET updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':updatedAt': now
      }
    }));

    // 6. 返回更新后的班级信息
    return await getClassById(input.classId) as Class;
  } catch (error) {
    console.error('Error adding student to class:', error);
    throw error;
  }
}

/**
 * 从班级移除学生
 */
async function removeStudentFromClass(classId: string, studentId: string): Promise<Class> {
  try {
    // 1. 验证班级是否存在
    const classItem = await getClassById(classId);
    if (!classItem) {
      throw new Error('Class not found');
    }

    // 2. 删除班级-学生关联
    await docClient.send(new DeleteCommand({
      TableName: CLASS_STUDENTS_TABLE_NAME,
      Key: {
        classId,
        studentId
      }
    }));

    // 3. 更新班级的更新时间
    const now = createTimestamp();
    await docClient.send(new UpdateCommand({
      TableName: CLASSES_TABLE_NAME,
      Key: { id: classId },
      UpdateExpression: 'SET updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':updatedAt': now
      }
    }));

    // 4. 返回更新后的班级信息
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
        return await listClassesByTeacher(userId);

      case 'getClassById':
        return await getClassById(event.arguments.id);

      case 'addStudentToClass':
        if (!isTeacher && !isAdmin) {
          throw new Error('Unauthorized: Only teachers can manage class students');
        }
        return await addStudentToClass(event.arguments.input);

      case 'removeStudentFromClass':
        if (!isTeacher && !isAdmin) {
          throw new Error('Unauthorized: Only teachers can manage class students');
        }
        return await removeStudentFromClass(event.arguments.classId, event.arguments.studentId);

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
