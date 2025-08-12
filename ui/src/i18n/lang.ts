import { Lang } from '../graphql/Lang';

let currentLang: Lang = Lang.zh; // 默认中文

export function setCurrentLang(lang: Lang) {
  currentLang = lang;
}

// 获取当前语言
export function getCurrentLang(): Lang {
  return currentLang;
}


const langResources = {
  [Lang.zh]: require('./zh.json'),
  [Lang.en]: require('./en.json'),
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