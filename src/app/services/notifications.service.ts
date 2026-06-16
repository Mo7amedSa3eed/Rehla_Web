import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, Injector, NgZone, PLATFORM_ID } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { ApiService, NotificationDto } from './api';
import { AuthSessionService } from './auth-session.service';
import { LanguageService } from '../core/i18n/language.service';
import { localizedValue } from '../core/i18n/localized-field.util';

export type NotificationCategory =
  | 'marketplace'
  | 'gamification'
  | 'boarding'
  | 'refund'
  | 'general';

export type NotificationFilter =
  | 'all'
  | 'marketplace'
  | 'boarding'
  | 'gamification'
  | 'refund'
  | 'general'
  | 'unread';

export interface AppNotification {
  id: string;
  type: NotificationCategory;
  title: string;
  titleAr?: string | null;
  body: string;
  messageAr?: string | null;
  receivedAt: Date;
  isRead: boolean;
  payload: { type: string };
}

export interface NotificationGroup {
  label: string;
  items: AppNotification[];
}

export interface NotificationFilterOption {
  value: NotificationFilter;
  label: string;
}

export const notificationFilters: NotificationFilterOption[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'boarding', label: 'Boarding' },
  { value: 'gamification', label: 'Rewards' },
  { value: 'refund', label: 'Refund' },
  { value: 'all', label: 'All' },
];

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  notifications: AppNotification[] = [];
  activeFilter: NotificationFilter = 'unread';
  isLoading = false;
  error = '';

  private connection: signalR.HubConnection | null = null;
  private startPromise: Promise<void> | null = null;
  private hasLoaded = false;

  constructor(
    private readonly api: ApiService,
    private readonly injector: Injector,
    private readonly language: LanguageService,
    private readonly zone: NgZone,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  private get session(): AuthSessionService {
    return this.injector.get(AuthSessionService);
  }

  get filters(): NotificationFilterOption[] {
    return notificationFilters;
  }

  get unreadCount(): number {
    return unreadCount(this.notifications);
  }

  get filteredNotifications(): AppNotification[] {
    return filterNotifications(this.notifications, this.activeFilter);
  }

  get groupedNotifications(): NotificationGroup[] {
    return groupNotifications(this.filteredNotifications, this.language.currentLanguage);
  }

  titleOf(notification: AppNotification): string {
    return localizedValue(this.language.currentLanguage, notification.title, notification.titleAr);
  }

  bodyOf(notification: AppNotification): string {
    return localizedValue(this.language.currentLanguage, notification.body, notification.messageAr);
  }

  typeLabel(notification: AppNotification): string {
    return this.language.exact(notification.type);
  }

  async ensureStarted(): Promise<void> {
    if (!this.isBrowser() || !this.session.getAccessToken()) {
      return;
    }

    if (!this.hasLoaded) {
      await this.loadNotifications();
    }

    await this.connectRealtime();
  }

  async loadNotifications(limit = 50): Promise<void> {
    if (!this.isBrowser() || !this.session.getAccessToken()) {
      return;
    }

    this.isLoading = true;
    this.error = '';
    try {
      const items = await firstValueFrom(this.api.getNotifications(limit));
      this.notifications = items.map(mapNotification);
      this.hasLoaded = true;
    } catch (error) {
      this.error = this.api.formatError(error, 'Failed to load notifications.');
    } finally {
      this.isLoading = false;
    }
  }

  setFilter(filter: NotificationFilter): void {
    this.activeFilter = filter;
  }

  async markRead(notification: AppNotification): Promise<void> {
    if (notification.isRead || notification.id.startsWith('live-')) {
      return;
    }

    this.notifications = this.notifications.map((item) =>
      item.id === notification.id ? { ...item, isRead: true } : item,
    );

    try {
      await firstValueFrom(this.api.markNotificationRead(notification.id));
    } catch (error) {
      this.error = this.api.formatError(error, 'Failed to mark notification as read.');
    }
  }

  async markAllRead(): Promise<void> {
    if (!this.notifications.some((item) => !item.isRead)) {
      return;
    }

    this.notifications = this.notifications.map((item) => ({ ...item, isRead: true }));

    try {
      await firstValueFrom(this.api.markAllNotificationsRead());
    } catch (error) {
      this.error = this.api.formatError(error, 'Failed to mark notifications as read.');
    }
  }

  async deleteNotification(notification: AppNotification, event?: Event): Promise<void> {
    event?.stopPropagation();
    const previous = this.notifications;
    this.notifications = this.notifications.filter((item) => item.id !== notification.id);

    if (notification.id.startsWith('live-')) {
      return;
    }

    try {
      await firstValueFrom(this.api.deleteNotification(notification.id));
    } catch (error) {
      this.notifications = previous;
      this.error = this.api.formatError(error, 'Failed to delete notification.');
    }
  }

  async stop(): Promise<void> {
    this.notifications = [];
    this.error = '';
    this.isLoading = false;
    this.hasLoaded = false;
    this.startPromise = null;

    if (!this.connection) {
      return;
    }

    const connection = this.connection;
    this.connection = null;
    await connection.stop().catch(() => undefined);
  }

  private async connectRealtime(): Promise<void> {
    if (this.connection?.state === signalR.HubConnectionState.Connected || this.startPromise) {
      return this.startPromise ?? Promise.resolve();
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(this.api.getNotificationsHubUrl(), {
        accessTokenFactory: () => this.session.getAccessToken() ?? '',
      })
      .withAutomaticReconnect()
      .build();

    this.connection.on('ReceiveNotification', (title: string, message: string, type: string) => {
      this.zone.run(() => {
        this.receiveLiveNotification(title, message, type);
      });
    });

    this.startPromise = this.connection
      .start()
      .catch((error: unknown) => {
        this.error = error instanceof Error ? error.message : 'Failed to connect notifications.';
      })
      .finally(() => {
        this.startPromise = null;
      });

    return this.startPromise as Promise<void>;
  }

  private receiveLiveNotification(title: string, message: string, type: string): void {
    const liveNotification: AppNotification = {
      id: `live-${Date.now()}`,
      type: mapNotificationType(type),
      title: title ?? '',
      body: message ?? '',
      receivedAt: new Date(),
      isRead: false,
      payload: { type },
    };

    this.notifications = [liveNotification, ...this.notifications];
    void this.loadNotifications();
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}

export function mapNotification(dto: NotificationDto): AppNotification {
  return {
    id: String(dto.id),
    type: mapNotificationType(dto.type),
    title: dto.title ?? '',
    titleAr: dto.titleAr,
    body: dto.message ?? '',
    messageAr: dto.messageAr,
    receivedAt: new Date(dto.createdAt),
    isRead: dto.isRead ?? false,
    payload: { type: dto.type },
  };
}

export function mapNotificationType(type: string): NotificationCategory {
  switch ((type || '').trim().toUpperCase()) {
    case 'MARKETPLACE':
    case 'TICKET_SOLD':
      return 'marketplace';

    case 'GAMIFICATION':
    case 'POINTS_EARNED':
    case 'CHALLENGE_COMPLETED':
      return 'gamification';

    case 'BOARDING':
    case 'BOARDING_SOON':
      return 'boarding';

    case 'REFUND_APPROVED':
    case 'REFUND_REJECTED':
      return 'refund';

    default:
      return 'general';
  }
}

export function filterNotifications(
  notifications: AppNotification[],
  activeFilter: NotificationFilter,
): AppNotification[] {
  switch (activeFilter) {
    case 'all':
      return notifications;
    case 'marketplace':
    case 'boarding':
    case 'gamification':
    case 'refund':
    case 'general':
      return notifications.filter((notification) => notification.type === activeFilter);
    case 'unread':
      return notifications.filter((notification) => !notification.isRead);
  }
}

export function unreadCount(notifications: AppNotification[]): number {
  return notifications.filter((notification) => !notification.isRead).length;
}

export function groupNotifications(
  notifications: AppNotification[],
  language: 'en' | 'ar' = 'en',
): NotificationGroup[] {
  const today = startOfLocalDay(new Date());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const groups = new Map<string, AppNotification[]>();

  for (const item of notifications) {
    const day = startOfLocalDay(item.receivedAt);
    const label =
      day.getTime() === today.getTime()
        ? (language === 'ar' ? 'اليوم' : 'Today')
        : day.getTime() === yesterday.getTime()
          ? (language === 'ar' ? 'أمس' : 'Yesterday')
          : item.receivedAt.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });

    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
