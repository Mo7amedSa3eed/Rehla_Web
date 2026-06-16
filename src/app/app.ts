import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AppStateService } from './services/state';
import { filter } from 'rxjs/operators';
import { Bell, CheckCheck, LucideAngularModule, RefreshCw, ShoppingCart, Trash2, X } from 'lucide-angular';
import { NotificationsService } from './services/notifications.service';
import { LanguageService } from './core/i18n/language.service';
import { LanguageDomLocalizerService } from './core/i18n/language-dom-localizer.service';
import { TranslatePipe } from './core/i18n/translate.pipe';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    LucideAngularModule,
    TranslatePipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly ShoppingCartIcon = ShoppingCart;
  readonly BellIcon = Bell;
  readonly RefreshIcon = RefreshCw;
  readonly CheckAllIcon = CheckCheck;
  readonly TrashIcon = Trash2;
  readonly CloseIcon = X;

  view: '/booking' | '/trips' | '/my-bookings'| '/my-tickets' = '/booking';
  showShellChrome = true;
  isNotificationsOpen = false;

  constructor(
    public state: AppStateService,
    public notifications: NotificationsService,
    public language: LanguageService,
    domLocalizer: LanguageDomLocalizerService,
    private readonly router: Router,
  ) {
    domLocalizer.start();
    this.updateRouteState(this.router.url);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.updateRouteState(event.urlAfterRedirects));
  }

  private updateRouteState(url: string): void {
    const normalizedUrl = url.split('?')[0];

    this.showShellChrome = ![
      '/signup',
      '/login',
      '/welcome',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/verify-email',
    ].includes(normalizedUrl);

    if (this.showShellChrome) {
      void this.notifications.ensureStarted();
    } else {
      this.isNotificationsOpen = false;
      void this.notifications.stop();
    }
  }

  toggleNotifications(): void {
    this.isNotificationsOpen = !this.isNotificationsOpen;
    if (this.isNotificationsOpen) {
      void this.notifications.ensureStarted();
    }
  }

  closeNotifications(): void {
    this.isNotificationsOpen = false;
  }
}
