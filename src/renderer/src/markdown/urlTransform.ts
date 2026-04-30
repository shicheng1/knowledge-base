import { defaultUrlTransform } from 'react-markdown';

export function markdownUrlTransform(url: string): string {
  const s = String(url || '');
  if (/^local-image:/i.test(s)) return s;
  return defaultUrlTransform(s);
}
