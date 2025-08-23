# 班级管理功能说明

## 功能概述

本模块实现了一个完整的班级管理系统，允许教师创建和管理班级，以及管理班级中的学生。

## 核心功能

### 1. 班级管理
- 创建新班级
  - 设置班级名称
  - 添加班级描述
- 查看班级列表
- 查看班级详情
  - 基本信息展示
  - 学生列表管理

### 2. 学生管理
- 通过邮箱添加学生
- 查看班级学生列表
- 移除班级学生
- 学生数量统计

## 技术实现

### 前端实现
```typescript
// 班级管理主页面
export default function ClassManagement() {
  // 状态管理
  const [classes, setClasses] = useState<Class[]>([]);
  const [isCreateModalVisible, setCreateModalVisible] = useState(false);

  // 加载班级列表
  const loadClasses = async () => {
    const response = await client.graphql<any>({
      query: listClassesByTeacher
    });
    setClasses(response.data.listClasses.items);
  };

  // 创建新班级
  const handleCreateClass = async () => {
    await client.graphql<any>({
      mutation: createClass,
      variables: {
        input: {
          name: newClassName,
          description: newClassDescription
        }
      }
    });
  };
}
```

### 后端架构
```graphql
type Class @model {
  id: ID!
  name: String!
  description: String
  teacherId: String! @index
  students: [Student] @hasMany
}

type Student @model {
  id: ID!
  name: String!
  email: String! @index
  classes: [Class] @hasMany
}
```

### 权限控制
```typescript
@auth(rules: [
  { allow: groups, groups: ["teachers"], operations: [create, update, delete, read] }
  { allow: groups, groups: ["students"], operations: [read] }
])
```

## 使用指南

### 教师端
1. 创建班级
   - 导航到班级管理页面
   - 点击"创建班级"按钮
   - 填写班级信息并提交

2. 管理学生
   - 在班级列表中找到目标班级
   - 点击"添加学生"添加新学生
   - 在班级详情页面可以查看和管理学生

### API 使用
```typescript
// 创建班级
const createClass = async (name: string, description: string) => {
  await client.graphql({
    mutation: createClassMutation,
    variables: {
      input: { name, description }
    }
  });
};

// 添加学生
const addStudent = async (classId: string, studentEmail: string) => {
  await client.graphql({
    mutation: addStudentToClassMutation,
    variables: {
      input: { classId, studentEmail }
    }
  });
};
```

## 数据结构

### 班级数据
```typescript
interface Class {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  students: Student[];
  createdAt: string;
  updatedAt: string;
}
```

### 学生数据
```typescript
interface Student {
  id: string;
  name: string;
  email: string;
  classes: Class[];
}
```

## 错误处理

系统实现了完整的错误处理机制：
- 表单验证错误
- API 调用错误
- 权限错误
- 网络错误

所有错误都会通过统一的提示系统显示给用户。

## 测试指南

### 基础功能测试
1. 创建班级
   - 测试必填字段验证
   - 测试创建成功/失败提示

2. 学生管理
   - 测试添加学生
   - 测试移除学生
   - 验证学生列表显示

### 边界情况测试
1. 大量数据处理
   - 测试大量学生的显示
   - 测试分页功能

2. 错误处理
   - 测试网络断开情况
   - 测试权限不足场景
   - 测试重复操作

## 注意事项

1. 权限控制
   - 只有教师组可以创建和管理班级
   - 学生只能查看所属班级

2. 性能考虑
   - 班级列表实现了分页
   - 学生列表采用懒加载

3. 数据安全
   - 所有操作都需要认证
   - 敏感数据加密存储

## 未来计划

1. 功能增强
   - 批量导入学生
   - 班级公告功能
   - 学生分组管理

2. 性能优化
   - 缓存优化
   - 批量操作支持

3. 用户体验
   - 拖拽排序
   - 快捷操作
   - 数据导出
