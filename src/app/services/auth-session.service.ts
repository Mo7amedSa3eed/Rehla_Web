import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { AppStateService } from './state';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private isLoggingOut = false;

  constructor(
    private readonly router: Router,
    private readonly state: AppStateService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  hasAnyToken(): boolean {
    return !!this.getAccessToken() || !!this.getRefreshToken();
  }

  getAccessToken(): string | null {
    if (!this.isBrowser()) return null;
    return localStorage.getItem('accessToken');
  }

  getRefreshToken(): string | null {
    if (!this.isBrowser()) return null;
    return localStorage.getItem('refreshToken');
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (!this.isBrowser()) return;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    this.isLoggingOut = false;
  }

  clearLocalSession(): void {
    if (this.isBrowser()) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
    this.state.resetSessionState();
  }

  logoutManually(): void {
    this.finishLogout();
  }

  logoutDueToUnauthorized(): void {
    if (this.isLoggingOut) return;
    this.isLoggingOut = true;
    this.finishLogout();
  }

  private finishLogout(): void {
    this.clearLocalSession();
    if (this.isBrowser()) {
      window.history.replaceState({}, '', '/login');
    }
    void this.router.navigate(['/login'], { replaceUrl: true });
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
