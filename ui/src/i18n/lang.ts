import { Lang } from '../graphql/Lang';
import { configureAuthI18n } from './auth-translations';

/**
 * 国际化（i18n）命名规则：
 * 
 * 1. 键名结构：
 *    - common.*: 通用文本，如按钮、标签等
 *      例如: common.submit, common.cancel, common.error
 * 
 *    - pages.$pageName.*: 特定页面的文本
 *      例如: pages.settings.title, pages.settings.ui_language
 * 
 *    - components.$componentName.*: 组件特定文本
 *      例如: components.dashboard.title
 * 
 * 2. 命名约定：
 *    - 使用小写字母
 *    - 使用下划线分隔单词
 *    - 避免使用特殊字符
 *    - 具有描述性，见名知意
 * 
 * 3. 参数化文本：
 *    使用 {paramName} 格式的占位符
 *    例如: "Hello {username}, you have {count} messages"
 * 
 * 4. 分类约定：
 *    - title: 标题文本
 *    - label: 表单标签
 *    - message: 提示消息
 *    - error: 错误消息
 *    - button: 按钮文本
 *    - placeholder: 输入框占位符
 *    
 * 5. 示例：
 *    common.submit: "提交"
 *    pages.settings.title: "设置"
 *    pages.settings.update_success: "设置更新成功"
 */

let currentLang: Lang = Lang.zh; // 默认中文

export function setCurrentLang(lang: Lang) {
  currentLang = lang;
  // 同时更新认证组件的语言
  try {
    configureAuthI18n(lang === Lang.zh ? 'zh' : 'en');
  } catch (error) {
    console.warn('Failed to configure auth i18n:', error);
  }
}

// 获取当前语言
export function getCurrentLang(): Lang {
  return currentLang;
}

import zhJson from './zh.json';
import enJson from './en.json';

const langResources = {
  [Lang.zh]: zhJson,
  [Lang.en]: enJson,
};

export function getLangResource(lang: Lang){
  return langResources[lang];
}

export function getText(key: string): string {
  const resource = langResources[currentLang];
  if (!resource) {
    console.warn(`Language resource not found for: ${currentLang}`);
    return key; // 返回key作为fallback
  }
  
  // 支持嵌套key，如 'user.profile.name'
  const keys = key.split('.');
  let value: any = resource;
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      console.warn(`Translation key not found: ${key} in language: ${currentLang}`);
      return key; // 返回key作为fallback
    }
  }
  
  return value;
}

// 可选：带参数的文本获取函数
export function getTextWithParams(key: string, params: Record<string, string | number>): string {
  let text = getText(key);
  
  // 简单的参数替换，支持 {paramName} 格式
  Object.entries(params).forEach(([paramKey, paramValue]) => {
    text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
  });
  
  return text;
}


/**
 * ----------使用示例------------
 * // 设置语言
setCurrentLang(Lang.zh);

// 直接获取文本
const title = getText('common.title');
const userName = getText('user.profile.name');

// 带参数的文本
const welcome = getTextWithParams('welcome.message', { 
  name: 'John', 
  count: 5 
});
// 如果 welcome.message = "欢迎 {name}，您有 {count} 条消息"
// 结果: "欢迎 John，您有 5 条消息"

 * 
 */