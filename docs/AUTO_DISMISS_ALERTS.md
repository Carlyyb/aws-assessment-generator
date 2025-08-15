# 自动消失的消息通知系统

## 功能概述

实现了一个统一的、自动消失的消息通知系统，所有通过 `dispatchAlert` 发送的通知将在 30 秒后自动消失。

## 主要特性

1. **自动消失**
   - 所有通知将在 30 秒后自动消失
   - 用户仍可以手动关闭通知

2. **统一管理**
   - 使用 React Context API 统一管理所有通知
   - 所有组件共享相同的通知行为

3. **类型安全**
   - 完整的 TypeScript 类型支持
   - 使用 `FlashbarProps.MessageDefinition` 类型定义

## 实现细节

### 核心代码

```typescript
const dispatchAlert = (newAlert: FlashbarProps.MessageDefinition) => {
  const id = Date.now().toString();
  
  const alert: FlashbarProps.MessageDefinition = {
    content: newAlert.type === AlertType.SUCCESS 
      ? getText('common.status.success') 
      : getText('common.status.failed'),
    ...newAlert,
    id,
    dismissible: true,
    onDismiss: () => setAlerts((alerts: FlashbarProps.MessageDefinition[]) => 
      alerts.filter((currentAlert: FlashbarProps.MessageDefinition) => 
        currentAlert.id !== id
      )
    ),
  };
  
  setAlerts((currentAlerts: FlashbarProps.MessageDefinition[]) => 
    [...currentAlerts, alert]
  );

  // 30 秒后自动移除
  setTimeout(() => {
    setAlerts((currentAlerts: FlashbarProps.MessageDefinition[]) => 
      currentAlerts.filter((currentAlert: FlashbarProps.MessageDefinition) => 
        currentAlert.id !== id
      )
    );
  }, 30000);
};
```

### 使用方式

```typescript
const YourComponent = () => {
  const dispatchAlert = useContext(DispatchAlertContext);

  const handleSuccess = () => {
    dispatchAlert({ 
      type: AlertType.SUCCESS, 
      content: getText('common.status.success') 
    });
  };

  const handleError = () => {
    dispatchAlert({ 
      type: AlertType.ERROR, 
      content: getText('common.status.error') 
    });
  };
};
```

## 影响范围

此功能影响以下组件的通知行为：

1. UserSettings 页面
   - 语言设置成功/失败提示
   - 主题设置更新提示

2. Templates 页面
   - 模板操作提示

3. StudentAssessment 页面
   - 评估相关操作提示

4. ManageKnowledgeBases 页面
   - 知识库操作状态提示

## 测试建议

1. **基本功能测试**
   - 验证通知是否正确显示
   - 确认通知在 30 秒后自动消失
   - 测试手动关闭通知功能

2. **多通知测试**
   - 同时触发多个通知
   - 验证每个通知的独立计时
   - 检查通知队列管理

3. **边缘情况**
   - 在通知消失前切换页面
   - 快速连续触发多个通知
   - 手动关闭即将自动消失的通知

## 注意事项

1. 所有通知默认 30 秒后自动消失
2. 通知仍然可以手动关闭
3. 页面跳转不会影响已显示的通知
4. 通知使用 Context API，确保在 Provider 范围内使用
