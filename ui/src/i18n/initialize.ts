// 初始化应用的多语言设置
import { Lang } from '../graphql/Lang';
import { setCurrentLang } from './lang';
import { configureAuthI18n } from './auth-translations';

// 从 localStorage 获取保存的语言设置，或根据浏览器语言决定
export function initializeLanguage(): Lang {
  try {
    // 优先使用保存的语言设置
    const savedLang = localStorage.getItem('app-language') as Lang;
    if (savedLang && (savedLang === Lang.zh || savedLang === Lang.en)) {
      setCurrentLang(savedLang);
      configureAuthI18n(savedLang);
      return savedLang;
    }
  } catch (error) {
    console.warn('Failed to load saved language:', error);
  }

  // 根据浏览器语言决定
  const browserLang = navigator.language.startsWith('zh') ? Lang.zh : Lang.en;
  setCurrentLang(browserLang);
  configureAuthI18n(browserLang);
  
  // 保存到 localStorage
  try {
    localStorage.setItem('app-language', browserLang);
  } catch (error) {
    console.warn('Failed to save language to localStorage:', error);
  }
  
  return browserLang;
}

// 切换语言并保存设置
export function switchLanguage(lang: Lang): void {
  setCurrentLang(lang);
  configureAuthI18n(lang);
  
  try {
    localStorage.setItem('app-language', lang);
  } catch (error) {
    console.warn('Failed to save language to localStorage:', error);
  }
}
