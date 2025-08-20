import { AppSyncResolverHandler } from 'aws-lambda';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

const dynamodb = DynamoDBDocument.from(new DynamoDB());
const CLASS_TABLE = process.env.CLASS_TABLE!;
const STUDENT_TABLE = process.env.STUDENT_TABLE!;

export const listClassesByTeacher: AppSyncResolverHandler<void, any> = async (event) => {
  const teacherId = event.identity?.claims?.sub;
  if (!teacherId) throw new Error('Unauthorized');

  const params = {
    TableName: CLASS_TABLE,
    IndexName: 'byTeacher',
    KeyConditionExpression: 'teacherId = :teacherId',
    ExpressionAttributeValues: {
      ':teacherId': teacherId
    }
  };

  try {
    const result = await dynamodb.query(params);
    return result.Items;
  } catch (error) {
    console.error('Error listing classes:', error);
    throw error;
  }
};

export const createClass: AppSyncResolverHandler<any, any> = async (event) => {
  const teacherId = event.identity?.claims?.sub;
  if (!teacherId) throw new Error('Unauthorized');

  const { name, description } = event.arguments.input;
  const timestamp = new Date().toISOString();

  const classItem = {
    id: `class_${Date.now()}`,
    name,
    description,
    teacherId,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  try {
    await dynamodb.put({
      TableName: CLASS_TABLE,
      Item: classItem
    });
    return classItem;
  } catch (error) {
    console.error('Error creating class:', error);
    throw error;
  }
};

export const addStudentToClass: AppSyncResolverHandler<any, any> = async (event) => {
  const teacherId = event.identity?.claims?.sub;
  if (!teacherId) throw new Error('Unauthorized');

  const { classId, studentEmail } = event.arguments.input;

  // 检查班级是否存在且属于当前教师
  const classResult = await dynamodb.get({
    TableName: CLASS_TABLE,
    Key: { id: classId }
  });

  if (!classResult.Item || classResult.Item.teacherId !== teacherId) {
    throw new Error('Class not found or unauthorized');
  }

  // 查找或创建学生
  let student;
  const studentResult = await dynamodb.query({
    TableName: STUDENT_TABLE,
    IndexName: 'byEmail',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': studentEmail }
  });

  if (studentResult.Items?.length) {
    student = studentResult.Items[0];
  } else {
    student = {
      id: `student_${Date.now()}`,
      email: studentEmail,
      name: studentEmail.split('@')[0], // 临时使用邮箱前缀作为名字
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dynamodb.put({
      TableName: STUDENT_TABLE,
      Item: student
    });
  }

  // 添加学生到班级
  const classUpdate = await dynamodb.update({
    TableName: CLASS_TABLE,
    Key: { id: classId },
    UpdateExpression: 'SET students = list_append(if_not_exists(students, :empty_list), :student)',
    ExpressionAttributeValues: {
      ':student': [student],
      ':empty_list': []
    },
    ReturnValues: 'ALL_NEW'
  });

  return classUpdate.Attributes;
};

export const removeStudentFromClass: AppSyncResolverHandler<any, any> = async (event) => {
  const teacherId = event.identity?.claims?.sub;
  if (!teacherId) throw new Error('Unauthorized');

  const { classId, studentId } = event.arguments;

  // 获取班级信息
  const classResult = await dynamodb.get({
    TableName: CLASS_TABLE,
    Key: { id: classId }
  });

  if (!classResult.Item || classResult.Item.teacherId !== teacherId) {
    throw new Error('Class not found or unauthorized');
  }

  // 移除学生
  const updatedStudents = (classResult.Item.students || []).filter(
    (student: any) => student.id !== studentId
  );

  const classUpdate = await dynamodb.update({
    TableName: CLASS_TABLE,
    Key: { id: classId },
    UpdateExpression: 'SET students = :students',
    ExpressionAttributeValues: {
      ':students': updatedStudents
    },
    ReturnValues: 'ALL_NEW'
  });

  return classUpdate.Attributes;
};
