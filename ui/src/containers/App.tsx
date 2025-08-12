import React from 'react';
import { Lang } from '../graphql/Lang';
import { getLangResource } from '../i18n/lang';
import LangSwitcher from '../components/LangSwitcher';

interface Props {
  lang: Lang;
}

const App: React.FC<Props> = ({ lang }) => {
  const langResource = getLangResource(lang);

  return (
    <div>
      <h1>{langResource.hello}</h1>
      <LangSwitcher lang={lang} onChange={(lang) => console.log(lang)} />
    </div>
  );
};

export default App;