import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Inject, Injectable, Injector, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ApiService } from '../../services/api';
import { AuthSessionService } from '../../services/auth-session.service';

export type AppLanguage = 'en' | 'ar';

type TranslationTree = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly storageKey = 'locale';
  private readonly fallbackLang: AppLanguage = 'en';
  private readonly loaded: Partial<Record<AppLanguage, TranslationTree>> = {};
  private readonly translationHttp: HttpClient;

  private readonly languageSubject = new BehaviorSubject<AppLanguage>(this.fallbackLang);
  readonly language$ = this.languageSubject.asObservable();
  readonly isLoading$ = new BehaviorSubject<boolean>(false);

  constructor(
    httpBackend: HttpBackend,
    private readonly injector: Injector,
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.translationHttp = new HttpClient(httpBackend);
    void this.init();
  }

  get currentLanguage(): AppLanguage {
    return this.languageSubject.value;
  }

  get currentLocale(): string {
    return this.currentLanguage === 'ar' ? 'ar-EG' : 'en-US';
  }

  async init(): Promise<void> {
    const lang = this.resolveInitialLanguage();
    await this.load(lang);
    this.applyLanguage(lang);
    void this.applyBackendPreferredLanguage();
  }

  async setLanguage(
    lang: AppLanguage,
    syncBackend = true,
    reloadAfterChange = false,
  ): Promise<void> {
    const previousLanguage = this.currentLanguage;
    this.isLoading$.next(true);
    try {
      await this.load(lang);
      this.saveLanguage(lang);
      this.applyLanguage(lang);

      if (syncBackend) {
        await this.syncBackend(lang);
      }

      if (reloadAfterChange && previousLanguage !== lang) {
        this.reloadPage();
      }
    } finally {
      this.isLoading$.next(false);
    }
  }

  toggleLanguage(): void {
    void this.setLanguage(this.currentLanguage === 'ar' ? 'en' : 'ar');
  }

  instant(key: string, params?: Record<string, string | number>): string {
    const value = this.findValue(this.loaded[this.currentLanguage], key)
      ?? this.findValue(this.loaded[this.currentLanguage], `exact.${key}`)
      ?? this.findValue(this.loaded[this.currentLanguage], `errors.${key}`)
      ?? this.findValue(this.loaded[this.fallbackLang], key)
      ?? this.findValue(this.loaded[this.fallbackLang], `exact.${key}`)
      ?? this.findValue(this.loaded[this.fallbackLang], `errors.${key}`);
    const text = typeof value === 'string' ? value : key;
    return this.interpolate(text, params);
  }

  exact(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return value;

    const translation = this.findValue(this.loaded[this.currentLanguage], `exact.${trimmed}`)
      ?? this.findValue(this.loaded[this.currentLanguage], `errors.${trimmed}`)
      ?? this.findValue(this.loaded[this.fallbackLang], `exact.${trimmed}`);

    if (typeof translation === 'string') return translation;

    if (this.currentLanguage === 'ar') {
      const patterned = trimmed
        .replace(/\bEGP\b/g, 'جنيه')
        .replace(/\bpts\b/g, 'نقطة')
        .replace(/\bunread\b/g, 'غير مقروءة');
      if (patterned !== trimmed) return patterned;
    }

    return trimmed;
  }

  async syncCurrentLanguage(): Promise<void> {
    await this.syncBackend(this.currentLanguage);
  }

  private resolveInitialLanguage(): AppLanguage {
    if (!this.isBrowser()) return this.fallbackLang;

    const saved = localStorage.getItem(this.storageKey);
    if (saved === 'ar' || saved === 'en') return saved;

    const browserLanguage = navigator.language || '';
    return browserLanguage.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }

  private async load(lang: AppLanguage): Promise<void> {
    if (this.loaded[lang]) return;

    try {
      this.loaded[lang] = await firstValueFrom(
        this.translationHttp.get<TranslationTree>(`/assets/i18n/${lang}.json`),
      );
    } catch {
      this.loaded[lang] = {};
    }
  }

  private applyLanguage(lang: AppLanguage): void {
    this.languageSubject.next(lang);
    this.document.documentElement.lang = lang;
    this.document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }

  private saveLanguage(lang: AppLanguage): void {
    if (this.isBrowser()) {
      localStorage.setItem(this.storageKey, lang);
    }
  }

  private async syncBackend(lang: AppLanguage): Promise<void> {
    const session = this.injector.get(AuthSessionService);
    if (!session.hasAnyToken()) return;

    try {
      const api = this.injector.get(ApiService);
      await firstValueFrom(api.updatePreferredLanguage(lang));
    } catch {
      // Keep the local language even when the profile preference cannot be updated.
    }
  }

  private async applyBackendPreferredLanguage(): Promise<void> {
    if (!this.isBrowser()) return;

    const session = this.injector.get(AuthSessionService);
    if (!session.hasAnyToken()) return;

    try {
      const api = this.injector.get(ApiService);
      const profile = await firstValueFrom(api.getMyProfile());
      const preferredLanguage = this.normalizeLanguage(profile.preferredLanguage);
      if (!preferredLanguage || preferredLanguage === this.currentLanguage) return;

      await this.load(preferredLanguage);
      this.saveLanguage(preferredLanguage);
      this.applyLanguage(preferredLanguage);
      this.reloadPage();
    } catch {
      // Local language remains the fallback if the profile cannot be read.
    }
  }

  private normalizeLanguage(value: unknown): AppLanguage | null {
    return value === 'ar' || value === 'en' ? value : null;
  }

  private reloadPage(): void {
    if (!this.isBrowser()) return;
    this.document.defaultView?.location.reload();
  }

  private findValue(tree: TranslationTree | undefined, path: string): unknown {
    if (!tree) return undefined;
    return path.split('.').reduce<unknown>((current, part) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[part];
    }, tree);
  }

  private interpolate(text: string, params?: Record<string, string | number>): string {
    if (!params) return text;
    return Object.entries(params).reduce(
      (result, [key, value]) => result.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value)),
      text,
    );
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
