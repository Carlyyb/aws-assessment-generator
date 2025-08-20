// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Excel导入预览解析器
 * 解析Excel文件内容并返回用户创建预览
 * 支持的Excel格式：第一列姓名，第二列用户名，第三列密码（可选）
 */

import { AppSyncResolverEvent } from 'aws-lambda';
import { UserRole } from '../config/adminConfig';

interface BatchUserInput {
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  email?: string;
  phoneNumber?: string;
}

interface ExcelImportResult {
  preview: BatchUserInput[];
  validRows: number;
  invalidRows: number;
  errors: string[];
}

/**
 * 检查管理员权限
 */
async function checkAdminPermission(event: AppSyncResolverEvent<any>): Promise<boolean> {
  // 获取用户组信息
  const groups = (event.identity as any)?.groups || [];
  return groups.includes('admin') || groups.includes('super_admin');
}

/**
 * 解析CSV格式的Excel内容
 */
function parseCSVContent(csvContent: string): { rows: string[][], errors: string[] } {
  const errors: string[] = [];
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    errors.push('文件内容为空');
    return { rows: [], errors };
  }
  
  const rows: string[][] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // 简单的CSV解析，支持逗号分隔
    const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
    
    if (columns.length < 2) {
      errors.push(`第 ${i + 1} 行格式错误：至少需要姓名和用户名两列`);
      continue;
    }
    
    rows.push(columns);
  }
  
  return { rows, errors };
}

/**
 * 验证用户名格式
 */
function validateUsername(username: string): boolean {
  // 用户名应该是3-50个字符，只允许字母、数字、下划线和点
  return /^[a-zA-Z0-9._]{3,50}$/.test(username);
}

/**
 * 验证姓名格式
 */
function validateName(name: string): boolean {
  // 姓名应该是1-100个字符，不能为空
  return name && name.length >= 1 && name.length <= 100;
}

/**
 * 验证邮箱格式
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证手机号格式（中国大陆）
 */
function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * 将行数据转换为用户输入
 */
function convertRowToUserInput(row: string[], defaultRole: UserRole, rowIndex: number): { user?: BatchUserInput, error?: string } {
  const [name, username, password, email, phoneNumber] = row;
  
  // 验证必填字段
  if (!validateName(name)) {
    return { error: `第 ${rowIndex + 1} 行：姓名格式错误` };
  }
  
  if (!validateUsername(username)) {
    return { error: `第 ${rowIndex + 1} 行：用户名格式错误（3-50个字符，只允许字母数字下划线和点）` };
  }
  
  // 验证可选字段
  if (email && !validateEmail(email)) {
    return { error: `第 ${rowIndex + 1} 行：邮箱格式错误` };
  }
  
  if (phoneNumber && !validatePhoneNumber(phoneNumber)) {
    return { error: `第 ${rowIndex + 1} 行：手机号格式错误` };
  }
  
  const user: BatchUserInput = {
    name: name.trim(),
    username: username.trim(),
    role: defaultRole,
    ...(password && { password: password.trim() }),
    ...(email && { email: email.trim() }),
    ...(phoneNumber && { phoneNumber: phoneNumber.trim() })
  };
  
  return { user };
}

/**
 * Excel导入预览主函数
 */
export const handler = async (event: AppSyncResolverEvent<{ fileContent: string }>): Promise<ExcelImportResult> => {
  console.log('Excel导入预览请求:', JSON.stringify({ ...event, arguments: { fileContent: '[FILE_CONTENT]' } }, null, 2));

  const { fileContent } = event.arguments;

  // 检查权限
  if (!await checkAdminPermission(event)) {
    throw new Error('没有权限执行此操作');
  }

  if (!fileContent || fileContent.trim() === '') {
    throw new Error('文件内容不能为空');
  }

  const result: ExcelImportResult = {
    preview: [],
    validRows: 0,
    invalidRows: 0,
    errors: []
  };

  try {
    // 解析CSV内容
    const { rows, errors: parseErrors } = parseCSVContent(fileContent);
    result.errors.push(...parseErrors);
    
    if (rows.length === 0) {
      result.errors.push('没有找到有效的数据行');
      return result;
    }
    
    // 假设默认角色为学生，实际使用时可以通过参数传入
    const defaultRole = UserRole.STUDENT;
    
    // 处理每一行数据
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const { user, error } = convertRowToUserInput(row, defaultRole, i);
      
      if (error) {
        result.errors.push(error);
        result.invalidRows++;
      } else if (user) {
        result.preview.push(user);
        result.validRows++;
      }
    }
    
    // 检查重复的用户名
    const usernameSet = new Set<string>();
    const duplicateUsernames: string[] = [];
    
    for (const user of result.preview) {
      if (usernameSet.has(user.username)) {
        duplicateUsernames.push(user.username);
      } else {
        usernameSet.add(user.username);
      }
    }
    
    if (duplicateUsernames.length > 0) {
      result.errors.push(`发现重复的用户名: ${duplicateUsernames.join(', ')}`);
    }
    
    console.log(`Excel导入预览完成: 有效行 ${result.validRows}, 无效行 ${result.invalidRows}, 错误 ${result.errors.length}`);
    return result;
    
  } catch (error: any) {
    console.error('Excel导入预览失败:', error);
    result.errors.push(`解析文件失败: ${error.message}`);
    return result;
  }
};