import { AppLanguage } from './language.service';

export function localizedValue(
  lang: AppLanguage,
  english?: string | null,
  arabic?: string | null,
): string {
  if (lang === 'ar' && arabic?.trim()) return arabic;
  return english || arabic || '';
}
