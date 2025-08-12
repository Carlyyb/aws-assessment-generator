import { Lang } from '../graphql/Lang';

const langResources = {
  [Lang.zh]: require('./zh.json'),
  [Lang.en]: require('./en.json'),
};

export function getLangResource(lang: Lang){
  return langResources[lang];
}

