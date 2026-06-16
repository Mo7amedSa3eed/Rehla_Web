import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authErrorInterceptor } from './auth-error.interceptor';
import { AuthSessionService } from './auth-session.service';

class MockAuthSessionService {
  accessToken = 'old-access-token';
  refreshToken = 'old-refresh-token';
  logoutCalls = 0;

  hasAnyToken(): boolean {
    return !!this.accessToken || !!this.refreshToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  logoutDueToUnauthorized(): void {
    this.logoutCalls += 1;
  }
}

describe('authErrorInterceptor', () => {
  const apiBaseUrl = 'https://rehlabussines2-001-site1.anytempurl.com/api';
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let session: MockAuthSessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthSessionService, useClass: MockAuthSessionService },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSessionService) as unknown as MockAuthSessionService;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('refreshes tokens and retries the failed authenticated request after a 401', () => {
    let response: unknown;

    http
      .get(`${apiBaseUrl}/Users/me`, {
        headers: new HttpHeaders({ Authorization: 'Bearer old-access-token' }),
      })
      .subscribe((value) => {
        response = value;
      });

    httpMock.expectOne(`${apiBaseUrl}/Users/me`).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });

    const refreshRequest = httpMock.expectOne(`${apiBaseUrl}/Auth/refresh`);
    expect(refreshRequest.request.method).toBe('POST');
    expect(refreshRequest.request.body).toEqual({ refreshToken: 'old-refresh-token' });
    refreshRequest.flush({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: '2026-03-06T13:00:00Z',
        user: {} as unknown,
      },
      errors: null,
      timestamp: '2026-03-06T12:00:00Z',
    });

    const retryRequest = httpMock.expectOne(`${apiBaseUrl}/Users/me`);
    expect(retryRequest.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    retryRequest.flush({ ok: true });

    expect(response).toEqual({ ok: true });
    expect(session.accessToken).toBe('new-access-token');
    expect(session.refreshToken).toBe('new-refresh-token');
    expect(session.logoutCalls).toBe(0);
  });

  it('shares one refresh request across simultaneous 401 responses', () => {
    const responses: unknown[] = [];

    http
      .get(`${apiBaseUrl}/Users/me`, {
        headers: new HttpHeaders({ Authorization: 'Bearer old-access-token' }),
      })
      .subscribe((value) => responses.push(value));
    http
      .get(`${apiBaseUrl}/Bookings/cart`, {
        headers: new HttpHeaders({ Authorization: 'Bearer old-access-token' }),
      })
      .subscribe((value) => responses.push(value));

    const originalRequests = httpMock.match((request) =>
      [`${apiBaseUrl}/Users/me`, `${apiBaseUrl}/Bookings/cart`].includes(request.url),
    );
    expect(originalRequests.length).toBe(2);
    originalRequests.forEach((request) => {
      request.flush(null, { status: 401, statusText: 'Unauthorized' });
    });

    const refreshRequests = httpMock.match(`${apiBaseUrl}/Auth/refresh`);
    expect(refreshRequests.length).toBe(1);
    refreshRequests[0].flush({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: '2026-03-06T13:00:00Z',
        user: {} as unknown,
      },
      errors: null,
      timestamp: '2026-03-06T12:00:00Z',
    });

    const retryRequests = httpMock.match((request) =>
      [`${apiBaseUrl}/Users/me`, `${apiBaseUrl}/Bookings/cart`].includes(request.url),
    );
    expect(retryRequests.length).toBe(2);
    retryRequests.forEach((request, index) => {
      expect(request.request.headers.get('Authorization')).toBe('Bearer new-access-token');
      request.flush({ index });
    });

    expect(responses).toEqual([{ index: 0 }, { index: 1 }]);
    expect(session.logoutCalls).toBe(0);
  });

  it('logs out and does not retry when refresh fails', () => {
    let error: HttpErrorResponse | undefined;

    http
      .get(`${apiBaseUrl}/Users/me`, {
        headers: new HttpHeaders({ Authorization: 'Bearer old-access-token' }),
      })
      .subscribe({ error: (value: HttpErrorResponse) => (error = value) });

    httpMock.expectOne(`${apiBaseUrl}/Users/me`).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    httpMock.expectOne(`${apiBaseUrl}/Auth/refresh`).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(error?.status).toBe(401);
    expect(session.logoutCalls).toBe(1);
    httpMock.expectNone(`${apiBaseUrl}/Users/me`);
  });

  it('does not refresh public auth endpoints', () => {
    let error: HttpErrorResponse | undefined;

    http
      .post(`${apiBaseUrl}/Auth/login`, {}, {
        headers: new HttpHeaders({ Authorization: 'Bearer old-access-token' }),
      })
      .subscribe({ error: (value: HttpErrorResponse) => (error = value) });

    httpMock.expectOne(`${apiBaseUrl}/Auth/login`).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });

    expect(error?.status).toBe(401);
    expect(session.logoutCalls).toBe(0);
    httpMock.expectNone(`${apiBaseUrl}/Auth/refresh`);
  });
});
