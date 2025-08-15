# Assessment Generator 多语言技术文档

## 概述

Assessment Generator 实现了完整的多语言国际化（i18n）系统，支持中文和英文界面切换。本文档详细说明了多语言系统的技术实现、使用方法和最佳实践。

## 系统架构

### 1. 核心组件

```
ui/src/i18n/
├── lang.ts           # 语言管理核心模块
├── en.json          # 英文翻译文件
├── zh.json          # 中文翻译文件
├── keyNotFoundCreator.py  # 缺失翻译键检测工具
└── INTERNATIONALIZATION_GUIDE.md  # 本文档
```

### 2. 技术栈

- **React Context API**: 全局语言状态管理
- **TypeScript**: 类型安全的语言定义
- **JSON**: 翻译文件存储格式
- **AWS Cognito**: 用户语言偏好持久化
- **DynamoDB**: 后端语言设置存储

## 核心实现

### 1. 语言枚举定义

```typescript
// ui/src/i18n/lang.ts
export enum Lang {
  EN = 'en',
  ZH = 'zh',
}

export const DEFAULT_LANG = Lang.EN;
```

### 2. 语言Context系统

```typescript
// 全局语言状态管理
const LanguageContext = React.createContext<{
  currentLang: Lang;
  setCurrentLang: (lang: Lang) => void;
}>({
  currentLang: DEFAULT_LANG,
  setCurrentLang: () => {},
});

// 语言Provider组件
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLang, setCurrentLang] = useState<Lang>(DEFAULT_LANG);
  
  useEffect(() => {
    // 从localStorage恢复语言设置
    const savedLang = localStorage.getItem('ui-language');
    if (savedLang && Object.values(Lang).includes(savedLang as Lang)) {
      setCurrentLang(savedLang as Lang);
    }
  }, []);

  const handleSetCurrentLang = (lang: Lang) => {
    setCurrentLang(lang);
    localStorage.setItem('ui-language', lang);
  };

  return (
    <LanguageContext.Provider value={{ currentLang, setCurrentLang: handleSetCurrentLang }}>
      {children}
    </LanguageContext.Provider>
  );
};
```

### 3. 翻译获取函数

```typescript
// 核心翻译函数
export function getText(key: string): string {
  const context = useContext(LanguageContext);
  const currentLang = context ? context.currentLang : DEFAULT_LANG;
  
  try {
    // 根据当前语言加载对应的翻译文件
    const translations = currentLang === Lang.ZH ? zhTranslations : enTranslations;
    
    // 支持嵌套键访问，如 'common.settings.title'
    const keys = key.split('.');
    let result: any = translations;
    
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key; // 返回键名作为备用
      }
    }
    
    return typeof result === 'string' ? result : key;
  } catch (error) {
    console.error('Translation error:', error);
    return key;
  }
}
```

## 翻译文件结构

### 1. 层次化组织

```json
{
  "common": {
    "actions": {
      "save": "保存",
      "cancel": "取消",
      "submit": "提交"
    },
    "status": {
      "loading": "加载中...",
      "success": "操作成功",
      "error": "操作失败"
    },
    "navigation": {
      "home": "首页",
      "settings": "设置"
    }
  },
  "teachers": {
    "dashboard": {
      "title": "教师仪表板",
      "welcome": "欢迎回来"
    },
    "settings": {
      "knowledge_base": {
        "title": "知识库管理",
        "upload": "上传文档"
      }
    }
  },
  "students": {
    "dashboard": {
      "title": "学生仪表板",
      "assessments": "我的测试"
    }
  }
}
```

### 2. 命名规范

- **模块前缀**: `common`、`teachers`、`students`、`components`
- **功能分组**: 按页面或功能模块分组
- **键名格式**: 使用下划线连接，语义清晰
- **值格式**: 简洁明了，避免HTML标签

## 使用方法

### 1. 基础用法

```tsx
import { getText } from '../i18n/lang';

export const MyComponent: React.FC = () => {
  return (
    <div>
      <h1>{getText('teachers.dashboard.title')}</h1>
      <button>{getText('common.actions.save')}</button>
    </div>
  );
};
```

### 2. 条件翻译

```tsx
export const StatusMessage: React.FC<{ success: boolean }> = ({ success }) => {
  const messageKey = success ? 'common.status.success' : 'common.status.error';
  return <div>{getText(messageKey)}</div>;
};
```

### 3. 动态内容

```tsx
export const UserGreeting: React.FC<{ userName: string }> = ({ userName }) => {
  const template = getText('common.greeting.welcome');
  return <div>{template.replace('{name}', userName)}</div>;
};
```

### 4. 表单组件集成

```tsx
import { FormField } from '@cloudscape-design/components';

export const LanguageSettings: React.FC = () => {
  return (
    <FormField
      label={getText('common.settings.language')}
      description={getText('common.settings.language_description')}
    >
      <Select
        placeholder={getText('common.actions.select')}
        options={[
          { label: getText('common.languages.english'), value: 'en' },
          { label: getText('common.languages.chinese'), value: 'zh' }
        ]}
      />
    </FormField>
  );
};
```

## 语言切换实现

### 1. 语言选择器组件

```tsx
export const LanguageSelector: React.FC = () => {
  const { currentLang, setCurrentLang } = useContext(LanguageContext);
  
  const languages = [
    { label: 'English', value: Lang.EN },
    { label: '中文', value: Lang.ZH }
  ];

  return (
    <Select
      selectedOption={languages.find(lang => lang.value === currentLang)}
      onChange={({ detail }) => {
        if (detail.selectedOption) {
          setCurrentLang(detail.selectedOption.value as Lang);
        }
      }}
      options={languages}
    />
  );
};
```

### 2. 持久化存储

```typescript
// 用户设置页面
export const UserSettings: React.FC = () => {
  const handleLanguageSubmit = async (language: Lang) => {
    try {
      // 保存到后端
      await client.graphql({
        query: upsertSettings,
        variables: { 
          input: { uiLang: language } 
        },
      });
      
      // 更新本地状态
      setCurrentLang(language);
      
      // 本地存储备份
      localStorage.setItem('ui-language', language);
      
    } catch (error) {
      console.error('Language update failed:', error);
    }
  };
};
```

## 最佳实践

### 1. 键名设计原则

```typescript
// ✅ 好的键名设计
'teachers.settings.knowledge_base.upload_success'
'common.validation.email_invalid'
'students.dashboard.assessment_count'

// ❌ 避免的键名设计
'msg1'  // 语义不明
'teacherSettingsKnowledgeBaseUploadSuccess'  // 过长
'upload success'  // 包含空格
```

### 2. 翻译文本指南

```json
{
  // ✅ 简洁明了
  "submit": "提交",
  "cancel": "取消",
  
  // ✅ 保持一致性
  "create_course": "创建课程",
  "create_template": "创建模板",
  
  // ❌ 避免过长
  "very_long_description_text": "这是一个非常长的描述文本...",
  
  // ❌ 避免HTML
  "formatted_text": "<strong>重要</strong>提示"
}
```

### 3. 性能优化

```typescript
// 懒加载翻译文件
const loadTranslations = async (lang: Lang) => {
  const translations = await import(`./translations/${lang}.json`);
  return translations.default;
};

// 缓存翻译结果
const translationCache = new Map<string, string>();

export function getText(key: string): string {
  const cacheKey = `${currentLang}:${key}`;
  
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }
  
  const translation = getTranslationFromFile(key);
  translationCache.set(cacheKey, translation);
  
  return translation;
}
```

## 开发工具

### 1. 缺失翻译检测

```python
# keyNotFoundCreator.py
import json
import os
import re

def find_missing_translations():
    """扫描代码中的getText调用，检查缺失的翻译键"""
    
    # 扫描所有TypeScript文件
    for root, dirs, files in os.walk('./src'):
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                check_file_translations(os.path.join(root, file))

def check_file_translations(file_path):
    """检查单个文件中的翻译键"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # 查找所有getText调用
    pattern = r"getText\(['\"]([^'\"]+)['\"]\)"
    matches = re.findall(pattern, content)
    
    for key in matches:
        if not translation_exists(key):
            print(f"Missing translation: {key} in {file_path}")

if __name__ == "__main__":
    find_missing_translations()
```

### 2. 翻译文件验证

```typescript
// validateTranslations.ts
export function validateTranslationFiles() {
  const enKeys = getAllKeys(enTranslations);
  const zhKeys = getAllKeys(zhTranslations);
  
  // 检查缺失的键
  const missingInZh = enKeys.filter(key => !zhKeys.includes(key));
  const missingInEn = zhKeys.filter(key => !enKeys.includes(key));
  
  if (missingInZh.length > 0) {
    console.warn('Missing in zh.json:', missingInZh);
  }
  
  if (missingInEn.length > 0) {
    console.warn('Missing in en.json:', missingInEn);
  }
}

function getAllKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = [];
  
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (typeof obj[key] === 'object') {
      keys.push(...getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  
  return keys;
}
```

## 测试策略

### 1. 单元测试

```typescript
import { getText } from '../i18n/lang';
import { LanguageProvider } from '../i18n/lang';

describe('Internationalization', () => {
  test('should return correct translation for existing key', () => {
    const wrapper = ({ children }) => (
      <LanguageProvider>{children}</LanguageProvider>
    );
    
    const { result } = renderHook(() => getText('common.actions.save'), { wrapper });
    expect(result.current).toBe('Save');
  });
  
  test('should return key for missing translation', () => {
    const { result } = renderHook(() => getText('non.existent.key'));
    expect(result.current).toBe('non.existent.key');
  });
});
```

### 2. 集成测试

```typescript
describe('Language Switching', () => {
  test('should update UI language when changed', async () => {
    render(
      <LanguageProvider>
        <UserSettings />
      </LanguageProvider>
    );
    
    // 切换到中文
    const languageSelect = screen.getByRole('combobox');
    await user.selectOptions(languageSelect, 'zh');
    
    // 验证界面文本已更新
    expect(screen.getByText('设置')).toBeInTheDocument();
  });
});
```

## 部署和维护

### 1. 构建时检查

```json
// package.json
{
  "scripts": {
    "lint:i18n": "node scripts/validateTranslations.js",
    "build": "npm run lint:i18n && tsc && vite build"
  }
}
```

### 2. 持续集成

```yaml
# .github/workflows/i18n-check.yml
name: I18n Check
on: [push, pull_request]

jobs:
  check-translations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Check translation completeness
        run: npm run lint:i18n
```

### 3. 翻译更新流程

1. **开发阶段**: 使用英文键名作为默认值
2. **代码审查**: 检查新增的翻译键
3. **翻译阶段**: 专业翻译人员更新翻译文件
4. **测试验证**: 在各语言环境下测试功能
5. **部署上线**: 确保所有翻译完整

## 常见问题

### 1. 翻译键未找到

**问题**: 控制台出现 "Translation key not found" 警告

**解决方案**:
- 检查翻译文件中是否存在对应键名
- 验证键名拼写是否正确
- 确认文件路径层次结构匹配

### 2. 语言切换不生效

**问题**: 更改语言设置后界面未更新

**解决方案**:
- 检查LanguageProvider是否正确包装应用
- 验证localStorage是否正常工作
- 确认组件使用了正确的getText函数

### 3. 特殊字符显示问题

**问题**: 中文或特殊字符显示为乱码

**解决方案**:
- 确保文件以UTF-8编码保存
- 检查构建工具的字符编码配置
- 验证Web服务器的字符集设置

## 扩展计划

### 1. 新语言支持

```typescript
// 添加新语言支持
export enum Lang {
  EN = 'en',
  ZH = 'zh',
  JA = 'ja',  // 日语
  KO = 'ko',  // 韩语
}
```

### 2. 动态翻译加载

```typescript
// 实现动态翻译文件加载
const loadLanguageAsync = async (lang: Lang) => {
  const module = await import(`./translations/${lang}.json`);
  return module.default;
};
```

### 3. 翻译管理API

```typescript
// 后端翻译管理接口
export interface TranslationAPI {
  getTranslations(lang: Lang): Promise<Record<string, string>>;
  updateTranslation(key: string, value: string, lang: Lang): Promise<void>;
  createTranslationKey(key: string): Promise<void>;
}
```

## 结语

Assessment Generator的多语言系统提供了完整的国际化解决方案，支持灵活的语言切换和可扩展的翻译管理。通过遵循本文档的最佳实践，可以确保系统的多语言功能稳定可靠，为全球用户提供优质的本土化体验。

---

**维护者**: Assessment Generator 开发团队  
**最后更新**: 2025年8月15日  
**版本**: 1.0.0
