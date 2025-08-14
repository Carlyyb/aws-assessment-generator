import React from 'react';
import { switchLanguage } from '../i18n/initialize';
import { Lang } from '../graphql/Lang';

interface LanguageSwitcherProps {
  style?: React.CSSProperties;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ style }) => {
  const handleLanguageChange = (language: 'zh' | 'en') => {
    const langEnum = language === 'zh' ? Lang.zh : Lang.en;
    switchLanguage(langEnum);
    // 强制重新渲染页面以应用新的翻译
    window.location.reload();
  };

  return (
    <div style={{ 
      display: 'flex', 
      gap: '10px', 
      justifyContent: 'center',
      margin: '10px 0',
      ...style 
    }}>
      <button
        onClick={() => handleLanguageChange('zh')}
        style={{
          padding: '8px 16px',
          border: '1px solid #ddd',
          borderRadius: '6px',
          backgroundColor: '#fff',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#fff';
        }}
      >
        中文
      </button>
      <button
        onClick={() => handleLanguageChange('en')}
        style={{
          padding: '8px 16px',
          border: '1px solid #ddd',
          borderRadius: '6px',
          backgroundColor: '#fff',
          cursor: 'pointer',
          fontSize: '14px',
          transition: 'all 0.2s ease',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#f5f5f5';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#fff';
        }}
      >
        English
      </button>
    </div>
  );
};
