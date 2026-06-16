import {
  HttpClient,
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, catchError, finalize, map, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthSessionService } from './auth-session.service';
import { ApiResponse, AuthTokensDto } from './api';

const API_BASE_URL = 'https://rehlabussines2-001-site1.anytempurl.com/api';
const AUTH_RETRY_CONTEXT = new HttpContextToken<boolean>(() => false);

let refreshInFlight$: Observable<AuthTokensDto> | null = null;

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(AuthSessionService);
  const http = inject(HttpClient);

  return next(req).pipe(
    catchError((error: unknown) => {
      const carriedAuth = req.headers.has('Authorization');
      const shouldHandleUnauthorized =
        isProtectedApiRequest(req.url) && (carriedAuth || session.hasAnyToken());

      if (shouldHandleUnauthorized && error instanceof HttpErrorResponse && error.status === 401) {
        if (req.context.get(AUTH_RETRY_CONTEXT)) {
          session.logoutDueToUnauthorized();
          return throwError(() => error);
        }

        const refreshToken = session.getRefreshToken();
        if (!refreshToken) {
          session.logoutDueToUnauthorized();
          return throwError(() => error);
        }

        return refreshTokens(http, session, refreshToken).pipe(
          switchMap((tokens) => next(withFreshAccessToken(req, tokens.accessToken))),
          catchError((refreshError: unknown) => {
            session.logoutDueToUnauthorized();
            return throwError(() => refreshError);
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};

function refreshTokens(
  http: HttpClient,
  session: AuthSessionService,
  refreshToken: string,
): Observable<AuthTokensDto> {
  if (!refreshInFlight$) {
    refreshInFlight$ = http
      .post<ApiResponse<AuthTokensDto>>(`${API_BASE_URL}/Auth/refresh`, { refreshToken })
      .pipe(
        map((response) => {
          if (!response.success || !response.data) {
            throw new Error(response.message || 'Token refresh failed');
          }

          session.setTokens(response.data.accessToken, response.data.refreshToken);
          return response.data;
        }),
        finalize(() => {
          refreshInFlight$ = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
  }

  return refreshInFlight$;
}

function withFreshAccessToken(req: HttpRequest<unknown>, accessToken: string): HttpRequest<unknown> {
  return req.clone({
    context: req.context.set(AUTH_RETRY_CONTEXT, true),
    headers: req.headers.set('Authorization', `Bearer ${accessToken}`),
  });
}

function isProtectedApiRequest(url: string): boolean {
  const normalized = url.toLowerCase();
  if (!normalized.includes('/api/')) return false;

  return ![
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-email',
    '/api/auth/send-verification-email',
    '/api/countries',
    '/api/stations',
    '/api/trips/search',
    '/api/search',
  ].some((publicPath) => normalized.includes(publicPath));
}
