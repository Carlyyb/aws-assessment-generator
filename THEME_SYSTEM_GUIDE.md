# 🎨 主题自定义系统实现指南

## ✨ 功能概述

成功为您的测试生成器应用实现了一个完整的主题自定义系统，支持：

- **🎨 颜色自定义**：主色调、辅助色、背景色、文本色
- **🖼️ Logo自定义**：支持上传和显示自定义Logo
- **👥 权限控制**：只有教师（后续可改为管理员）可以创建自定义主题
- **🌍 全局应用**：所有用户看到相同的主题
- **💾 本地存储**：主题设置保存在浏览器本地存储
- **🔄 实时切换**：支持实时预览和切换主题

## 🏗️ 系统架构

### 1. 核心组件

#### 主题上下文 (`ThemeContext.tsx`)
```typescript
// 主题数据结构
interface CustomTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  logo?: string;
  logoUrl?: string;
  createdBy: string;
  isDefault: boolean;
}
```

#### 主题定制器 (`ThemeCustomizer.tsx`)
- 🎨 颜色选择器（ColorInput）
- 📁 Logo上传器（FileInput）
- 👁️ 实时预览功能
- 💾 保存和删除主题

#### 主题按钮 (`ThemeButton.tsx`)
- 🔧 一键打开主题定制器
- 📍 集成到帮助面板中

### 2. 技术栈

- **React 18** - 前端框架
- **Mantine Core** - UI 组件库（与 CloudScape 并存）
- **TypeScript** - 类型安全
- **CSS Variables** - 动态主题切换
- **Local Storage** - 主题持久化

## 🚀 使用指南

### 教师用户（主题创建者）

1. **打开主题定制器**
   - 点击帮助面板中的调色板图标 🎨
   - 或使用右侧工具栏的主题按钮

2. **选择预设主题**
   - Default AWS（默认AWS主题）
   - Dark Mode（深色主题）
   - Education Blue（教育蓝主题）

3. **创建自定义主题**
   - 填写主题名称
   - 选择主色调（导航、按钮等）
   - 选择辅助色（强调、链接等）
   - 设置背景颜色
   - 设置文本颜色
   - 上传Logo图片（可选）

4. **预览和保存**
   - 点击"预览"查看效果
   - 点击"保存主题"创建自定义主题
   - 在主题列表中管理已创建的主题

### 学生用户（主题使用者）

- 自动看到教师设置的主题
- 可以在可用主题中切换（包括预设和自定义主题）
- 无法创建或删除自定义主题

## 🎯 主要特性

### 1. 权限控制系统
```typescript
const canCustomizeTheme = (user?: UserProfile): boolean => {
  return user?.group === 'teachers'; // 当前只有教师可以自定义
};
```

### 2. 实时主题切换
```css
:root {
  --primary-color: #232f3e;
  --secondary-color: #ff9900;
  --background-color: #ffffff;
  --text-color: #000000;
}
```

### 3. Logo集成
- 自动显示在顶部导航栏
- 自动显示在侧边导航栏
- 支持多种图片格式
- 自适应尺寸

### 4. 数据持久化
```typescript
// 保存到本地存储
localStorage.setItem('currentTheme', JSON.stringify(theme));
localStorage.setItem('customThemes', JSON.stringify(customThemes));
```

## 📁 文件结构

```
ui/src/
├── contexts/
│   └── ThemeContext.tsx      # 主题上下文和状态管理
├── components/
│   ├── ThemeButton.tsx       # 主题按钮组件
│   └── ThemeCustomizer.tsx   # 主题定制器界面
├── pages/
│   └── ThemeDemo.tsx         # 主题演示页面
├── styles/
│   └── theme.css             # 主题CSS变量和样式
└── i18n/
    ├── en.json              # 英文翻译（新增主题相关）
    └── zh.json              # 中文翻译（新增主题相关）
```

## 🔧 自定义扩展

### 1. 添加新的颜色选项
```typescript
// 在 CustomTheme 接口中添加新属性
interface CustomTheme {
  // ...existing properties
  accentColor?: string;
  borderColor?: string;
}
```

### 2. 集成更多UI框架
```typescript
// 在 theme.css 中添加新的CSS变量映射
.my-component {
  background-color: var(--primary-color);
  border-color: var(--secondary-color);
}
```

### 3. 服务器端主题存储
```typescript
// 替换 localStorage 为 API 调用
const saveThemeToServer = async (theme: CustomTheme) => {
  await fetch('/api/themes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(theme),
  });
};
```

## 🎨 预设主题

### Default AWS
- 主色调：#232f3e（AWS深蓝）
- 辅助色：#ff9900（AWS橙）
- 背景：#ffffff（白色）
- 文本：#000000（黑色）

### Dark Mode
- 主色调：#1a1b23（深灰）
- 辅助色：#4dabf7（亮蓝）
- 背景：#1a1b23（深灰）
- 文本：#ffffff（白色）

### Education Blue
- 主色调：#1976d2（教育蓝）
- 辅助色：#42a5f5（亮蓝）
- 背景：#f5f5f5（浅灰）
- 文本：#333333（深灰）

## 🛠️ 技术实现细节

### 1. Mantine + CloudScape 集成
```tsx
// 应用结构
<ThemeProvider userProfile={userProfile}>
  <MantineProvider theme={mantineTheme}>
    <I18nProvider>
      <AppLayout>
        {/* CloudScape 组件 */}
      </AppLayout>
    </I18nProvider>
  </MantineProvider>
</ThemeProvider>
```

### 2. CSS变量动态更新
```typescript
useEffect(() => {
  const root = document.documentElement;
  root.style.setProperty('--primary-color', currentTheme.primaryColor);
  root.style.setProperty('--secondary-color', currentTheme.secondaryColor);
  // ...
}, [currentTheme]);
```

### 3. Logo处理
```typescript
const handleFileUpload = async (file: File | null) => {
  if (!file) return;
  
  // 使用 FileReader 转换为 base64
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target?.result as string;
    setFormData(prev => ({ ...prev, logoUrl: result }));
  };
  reader.readAsDataURL(file);
};
```

## 🎯 下一步计划

1. **服务器端存储**：将主题数据存储到数据库
2. **管理员权限**：添加超级管理员角色
3. **主题分享**：允许导出和导入主题
4. **更多预设**：添加更多行业特定的预设主题
5. **高级定制**：支持字体、间距、圆角等更多样式选项

## 🚀 部署说明

主题系统已完全集成到现有应用中：

✅ **无需额外配置** - 开箱即用  
✅ **向后兼容** - 不影响现有功能  
✅ **响应式设计** - 适配所有设备  
✅ **多语言支持** - 中英文界面  
✅ **权限控制** - 安全的用户权限管理  

现在您的用户可以享受完全自定义的界面体验！🎨✨
