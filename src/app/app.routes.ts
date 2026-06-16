import { Routes } from '@angular/router';
import { authGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'welcome' },
  { path: 'welcome', loadComponent: () => import('./pages/welcome/welcome').then(m => m.WelcomeComponent) },
  { path: 'signup', loadComponent: () => import('./pages/signup/signup').then(m => m.SignupComponent) },
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent) },
  { path: 'auth/forgot-password', loadComponent: () => import('./pages/auth/forgot-password/forgot-password').then(m => m.ForgotPasswordComponent) },
  { path: 'home', canActivate: [authGuard], loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent) },
  { path: 'about', canActivate: [authGuard], loadComponent: () => import('./pages/about/about').then(m => m.AboutComponent) },
  { path: 'booking', canActivate: [authGuard], loadComponent: () => import('./pages/booking/booking').then(m => m.BookingComponent) },
  { path: 'trips', canActivate: [authGuard], loadComponent: () => import('./pages/trips/trips').then(m => m.TripsComponent) },
  { path: 'passenger-details', canActivate: [authGuard], loadComponent: () => import('./pages/passenger-details/passenger-details').then(m => m.PassengerDetailsComponent) },
  { path: 'cart', canActivate: [authGuard], loadComponent: () => import('./pages/cart/cart').then(m => m.CartComponent) },
  { path: 'payment', canActivate: [authGuard], loadComponent: () => import('./pages/payment/payment').then(m => m.PaymentComponent) },
  { path: 'my-tickets', canActivate: [authGuard], loadComponent: () => import('./pages/my-tickets/my-tickets').then(m => m.MyTicketsComponent) },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./pages/profile/profile').then(m => m.ProfileComponent) },
  { path: 'edit-profile', canActivate: [authGuard], loadComponent: () => import('./pages/edit-profile/edit-profile').then(m => m.EditProfileComponent) },
  { path: 'marketplace-confirm', canActivate: [authGuard], loadComponent: () => import('./pages/marketplace-confirm/marketplace-confirm').then(m => m.MarketplaceConfirmComponent) },
  { path: 'resell', canActivate: [authGuard], loadComponent: () => import('./pages/resell/resell').then(m => m.ResellComponent) },
  { path: 'seat-selection', canActivate: [authGuard], loadComponent: () => import('./pages/seat-selection/seat-selection').then(m => m.SeatSelectionComponent) },
  { path: 'leg-review', canActivate: [authGuard], loadComponent: () => import('./pages/leg-review/leg-review').then(m => m.LegReviewComponent) },
  { path: 'auth/reset-password', loadComponent: () => import('./pages/auth/reset-password/reset-password').then(m => m.ResetPasswordComponent) },
  { path: 'auth/verify-email', loadComponent: () => import('./pages/auth/verify-email/verify-email').then(m => m.VerifyEmailComponent) },
  { path: 'challenges', canActivate: [authGuard], loadComponent: () => import('./pages/challenges-dashboard/challenges-dashboard').then(m => m.ChallengesDashboardComponent) },
  { path: 'report-issue', canActivate: [authGuard], loadComponent: () => import('./pages/report-issue/report-issue').then(m => m.ReportIssueComponent) },
];
