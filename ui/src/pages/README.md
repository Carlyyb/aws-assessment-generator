# 用户设置页面（UserSettings）

## 功能说明
用户设置页面允许用户修改界面语言和主题等个人偏好设置。

### 最新更新
- 修复了设置提交时的错误处理
- 增强了表单验证
- 优化了类型定义

## 主要功能

### 1. 语言设置
- 支持多语言切换
- 实时预览语言更改
- 完善的错误提示

### 2. 错误处理优化
- 添加了表单提交验证
- 显示详细的错误信息
- 支持网络错误提示

## 使用说明

### 修改界面语言
1. 从下拉菜单选择目标语言
2. 点击"提交"保存更改
3. 成功后会显示确认消息

### 错误情况处理
- 未选择语言：显示必选提示
- 网络错误：显示具体错误信息
- 提交成功：显示成功提示

## 技术实现
- 使用 React 18+ 
- AWS Amplify GraphQL API
- Cloudscape Design Components
- TypeScript 类型安全

## 代码示例
```typescript
// 语言更新逻辑
const handleLanguageSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!uiLang?.value) {
    dispatchAlert({ 
      type: AlertType.ERROR, 
      content: getText('common.settings.language_required') 
    });
    return;
  }

  client.graphql<any>({
    mutation: upsertSettings,
    variables: { 
      input: { 
        uiLang: uiLang.value as Lang
      } 
    },
  })
};
```

## 后续优化计划
1. 添加语言切换的过渡动画
2. 增加更多个性化设置选项
3. 优化错误提示的用户体验
