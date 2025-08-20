// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

/**
 * Cognito权限服务
 * 
 * 使用Cognito原生API来进行权限检查，替代硬编码的邮箱列表
 * 这样更安全、更灵活，并且符合AWS最佳实践
 */

import { CognitoIdentityProviderClient, AdminGetUserCommand, AdminListGroupsForUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { UserRole, hasAdminPermission, hasSuperAdminPermission, hasTeacherPermission, hasStudentPermission, getUserHighestRole, hasPermission } from '../config/adminConfig';

export interface UserPermissionInfo {
  userId: string;
  username: string;
  email?: string;
  groups: string[];
  highestRole: UserRole;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isTeacher: boolean;
  isStudent: boolean;
}

export class CognitoPermissionService {
  private cognitoClient: CognitoIdentityProviderClient;
  private userPoolId: string;

  constructor(userPoolId: string, region: string = 'us-west-2') {
    this.userPoolId = userPoolId;
    this.cognitoClient = new CognitoIdentityProviderClient({ region });
  }

  /**
   * 从JWT token中解析用户组信息
   * 这是最高效的方法，因为用户组信息已经包含在token中
   */
  public getUserGroupsFromToken(decodedToken: any): string[] {
    try {
      // Cognito在ID token中以 'cognito:groups' 字段存储用户组
      const groups = decodedToken['cognito:groups'] || [];
      return Array.isArray(groups) ? groups : [];
    } catch (error) {
      console.error('Error parsing user groups from token:', error);
      return [];
    }
  }

  /**
   * 通过Cognito API获取用户的组信息
   * 当token中的信息不够时使用这个方法
   */
  public async getUserGroupsFromCognito(username: string): Promise<string[]> {
    try {
      const command = new AdminListGroupsForUserCommand({
        UserPoolId: this.userPoolId,
        Username: username
      });

      const response = await this.cognitoClient.send(command);
      const groups = response.Groups || [];
      
      return groups.map(group => group.GroupName || '').filter(name => name.length > 0);
    } catch (error) {
      console.error('Error fetching user groups from Cognito:', error);
      return [];
    }
  }

  /**
   * 获取用户的完整权限信息
   */
  public async getUserPermissionInfo(username: string, decodedToken?: any): Promise<UserPermissionInfo> {
    try {
      // 优先从token中获取用户组信息
      let groups: string[] = [];
      if (decodedToken) {
        groups = this.getUserGroupsFromToken(decodedToken);
      }

      // 如果token中没有组信息，则从Cognito API获取
      if (groups.length === 0) {
        groups = await this.getUserGroupsFromCognito(username);
      }

      const highestRole = getUserHighestRole(groups);

      return {
        userId: decodedToken?.sub || username,
        username: username,
        email: decodedToken?.email,
        groups: groups,
        highestRole: highestRole,
        isAdmin: hasAdminPermission(groups),
        isSuperAdmin: hasSuperAdminPermission(groups),
        isTeacher: hasTeacherPermission(groups),
        isStudent: hasStudentPermission(groups)
      };
    } catch (error) {
      console.error('Error getting user permission info:', error);
      
      // 返回默认的学生权限作为安全后备
      return {
        userId: username,
        username: username,
        groups: [UserRole.STUDENT],
        highestRole: UserRole.STUDENT,
        isAdmin: false,
        isSuperAdmin: false,
        isTeacher: false,
        isStudent: true
      };
    }
  }

  /**
   * 检查用户是否有特定权限
   */
  public async checkUserPermission(username: string, permission: string, decodedToken?: any): Promise<boolean> {
    try {
      const userInfo = await this.getUserPermissionInfo(username, decodedToken);
      return hasPermission(userInfo.groups, permission);
    } catch (error) {
      console.error('Error checking user permission:', error);
      return false;
    }
  }

  /**
   * 从GraphQL context中获取用户权限信息
   * 这是在GraphQL resolvers中使用的便捷方法
   */
  public async getUserPermissionFromContext(context: any): Promise<UserPermissionInfo> {
    try {
      const username = context.username || context.claims?.username;
      const decodedToken = context.claims;

      if (!username) {
        throw new Error('Username not found in context');
      }

      return await this.getUserPermissionInfo(username, decodedToken);
    } catch (error) {
      console.error('Error getting user permission from context:', error);
      
      // 返回默认的学生权限作为安全后备
      return {
        userId: 'unknown',
        username: 'unknown',
        groups: [UserRole.STUDENT],
        highestRole: UserRole.STUDENT,
        isAdmin: false,
        isSuperAdmin: false,
        isTeacher: false,
        isStudent: true
      };
    }
  }

  /**
   * 权限中间件函数
   * 在GraphQL resolvers中用于权限检查
   */
  public requirePermission(requiredPermission: string) {
    return async (context: any) => {
      const userInfo = await this.getUserPermissionFromContext(context);
      
      if (!hasPermission(userInfo.groups, requiredPermission)) {
        throw new Error(`Access denied. Required permission: ${requiredPermission}`);
      }
      
      return userInfo;
    };
  }

  /**
   * 权限装饰器函数
   * 用于包装需要特定权限的GraphQL resolvers
   */
  public withPermission(requiredPermission: string, resolver: Function) {
    return async (parent: any, args: any, context: any, info: any) => {
      const userInfo = await this.getUserPermissionFromContext(context);
      
      if (!hasPermission(userInfo.groups, requiredPermission)) {
        throw new Error(`Access denied. Required permission: ${requiredPermission}`);
      }
      
      // 将用户权限信息添加到context中，供resolver使用
      context.userPermissions = userInfo;
      
      return resolver(parent, args, context, info);
    };
  }
}

/**
 * 创建权限服务实例的工厂函数
 */
export const createPermissionService = (userPoolId?: string): CognitoPermissionService => {
  const poolId = userPoolId || process.env.USER_POOL_ID;
  if (!poolId) {
    throw new Error('USER_POOL_ID environment variable or userPoolId parameter is required');
  }
  
  return new CognitoPermissionService(poolId);
};
