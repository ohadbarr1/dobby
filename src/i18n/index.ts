import { he, TranslationKey } from './he';

const strings = he;

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let text: string = strings[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return text;
}
