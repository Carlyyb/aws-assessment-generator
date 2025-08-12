import React from 'react';
import { Lang } from '../graphql/Lang';
import { getLangResource } from '../i18n/lang';

interface Props {
  lang: Lang;
  onChange: (lang: Lang) => void;
}

const LangSwitcher: React.FC<Props> = ({ lang, onChange }) => {
  const handleLangSwitch = (lang: Lang) => {
    onChange(lang);
  };

  return (
    <select value={lang} onChange={(e) => handleLangSwitch(e.target.value as Lang)}>
      <option value={Lang.zh}>中文</option>
      <option value={Lang.en}>英文</option>
    </select>
  );
};

export default LangSwitcher;