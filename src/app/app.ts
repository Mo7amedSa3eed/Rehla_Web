import { Component, NgModule, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AppStateService } from './services/state';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {

  view: '/booking' | '/trips' | '/my-bookings'| '/my-tickets' = '/booking';
  isSignupPage = false;

  constructor(
    public state: AppStateService,
    private readonly router: Router,
  ) {
    this.updateRouteState(this.router.url);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.updateRouteState(event.urlAfterRedirects));
  }

  private updateRouteState(url: string): void {
    this.isSignupPage =
      url === '/signup' ||
      url.startsWith('/signup?') ||
      url === '/login' ||
      url.startsWith('/login?') ||
        url === '/welcome' ||
        url.startsWith('/welcome?');
  }

}