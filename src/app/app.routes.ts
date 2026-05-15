import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'welcome' },
  { path: 'welcome', loadComponent: () => import('./pages/welcome/welcome').then(m => m.WelcomeComponent) },
  { path: 'signup', loadComponent: () => import('./pages/signup/signup').then(m => m.SignupComponent) },
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.LoginComponent) },
  { path: 'auth/forgot-password', loadComponent: () => import('./pages/auth/forgot-password/forgot-password').then(m => m.ForgotPasswordComponent) },
  { path: 'home', loadComponent: () => import('./pages/home/home').then(m => m.HomeComponent) },
  { path: 'about', loadComponent: () => import('./pages/about/about').then(m => m.AboutComponent) },
  { path: 'booking', loadComponent: () => import('./pages/booking/booking').then(m => m.BookingComponent) },
  { path: 'trips', loadComponent: () => import('./pages/trips/trips').then(m => m.TripsComponent) },
  { path: 'my-bookings', loadComponent: () => import('./pages/my-bookings/my-bookings').then(m => m.MyBookingsComponent) },
  { path: 'payment', loadComponent: () => import('./pages/payment/payment').then(m => m.PaymentComponent) },
  { path: 'my-tickets', loadComponent: () => import('./pages/my-tickets/my-tickets').then(m => m.MyTicketsComponent) },
  { path: 'profile', loadComponent: () => import('./pages/profile/profile').then(m => m.ProfileComponent) },
  { path: 'edit-profile', loadComponent: () => import('./pages/edit-profile/edit-profile').then(m => m.EditProfileComponent) },
  { path: 'marketplace', loadComponent: () => import('./pages/marketplace/marketplace').then(m => m.MarketplaceComponent) },
  { path: 'marketplace-confirm', loadComponent: () => import('./pages/marketplace-confirm/marketplace-confirm').then(m => m.MarketplaceConfirmComponent) },
  { path: 'resell', loadComponent: () => import('./pages/resell/resell').then(m => m.ResellComponent) },
  { path: 'auth/reset-password', loadComponent: () => import('./pages/auth/reset-password/reset-password').then(m => m.ResetPasswordComponent) },
  { path: 'auth/verify-email', loadComponent: () => import('./pages/auth/verify-email/verify-email').then(m => m.VerifyEmailComponent) },
  { path: 'challenges', loadComponent: () => import('./pages/challenges-dashboard/challenges-dashboard').then(m => m.ChallengesDashboardComponent) },
];
