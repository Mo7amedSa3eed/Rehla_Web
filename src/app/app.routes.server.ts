import { RenderMode, ServerRoute } from '@angular/ssr';

const protectedRoutes = [
  'home',
  'about',
  'booking',
  'trips',
  'passenger-details',
  'cart',
  'payment',
  'my-tickets',
  'profile',
  'edit-profile',
  'marketplace-confirm',
  'resell',
  'seat-selection',
  'leg-review',
  'challenges',
  'report-issue',
];

export const serverRoutes: ServerRoute[] = [
  ...protectedRoutes.map<ServerRoute>((path) => ({
    path,
    renderMode: RenderMode.Client,
  })),
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];
