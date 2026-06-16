import { HttpInterceptorFn } from '@angular/common/http';

export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  const savedLanguage = typeof localStorage === 'undefined' ? null : localStorage.getItem('locale');
  const language = savedLanguage === 'ar' ? 'ar' : 'en';
  return next(req.clone({ setHeaders: { 'Accept-Language': language } }));
};
