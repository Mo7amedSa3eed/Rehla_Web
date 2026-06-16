import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { AuthSessionService } from './auth-session.service';
import { AppStateService } from './state';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  const session = inject(AuthSessionService);
  const appState = inject(AppStateService);

  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  if (!session.hasAnyToken()) {
    session.clearLocalSession();
    return router.createUrlTree(['/login']);
  }

  void appState.ensureProfileLoaded().catch(() => undefined);
  void appState.ensureActiveCartLoaded().catch(() => undefined);

  return true;
};
