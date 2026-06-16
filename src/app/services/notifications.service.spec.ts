import {
  AppNotification,
  filterNotifications,
  groupNotifications,
  mapNotificationType,
  unreadCount,
} from './notifications.service';

describe('notification helpers', () => {
  const baseNotification: AppNotification = {
    id: '1',
    type: 'general',
    title: 'Title',
    body: 'Body',
    receivedAt: new Date(),
    isRead: false,
    payload: { type: 'GENERAL' },
  };

  it('maps refund backend notification types to refund', () => {
    expect(mapNotificationType('REFUND_APPROVED')).toBe('refund');
    expect(mapNotificationType('REFUND_REJECTED')).toBe('refund');
  });

  it('maps supported backend notification types to app categories', () => {
    expect(mapNotificationType('TICKET_SOLD')).toBe('marketplace');
    expect(mapNotificationType('POINTS_EARNED')).toBe('gamification');
    expect(mapNotificationType('CHALLENGE_COMPLETED')).toBe('gamification');
    expect(mapNotificationType('BOARDING_SOON')).toBe('boarding');
    expect(mapNotificationType('unknown')).toBe('general');
  });

  it('filters unread and category notifications client-side', () => {
    const notifications: AppNotification[] = [
      { ...baseNotification, id: '1', type: 'refund', isRead: false },
      { ...baseNotification, id: '2', type: 'marketplace', isRead: true },
      { ...baseNotification, id: '3', type: 'refund', isRead: true },
    ];

    expect(filterNotifications(notifications, 'unread').map((item) => item.id)).toEqual(['1']);
    expect(filterNotifications(notifications, 'refund').map((item) => item.id)).toEqual(['1', '3']);
    expect(filterNotifications(notifications, 'all')).toEqual(notifications);
  });

  it('counts unread notifications', () => {
    expect(unreadCount([
      { ...baseNotification, id: '1', isRead: false },
      { ...baseNotification, id: '2', isRead: true },
    ])).toBe(1);
  });

  it('groups notifications by local day labels', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const groups = groupNotifications([
      { ...baseNotification, id: '1', receivedAt: today },
      { ...baseNotification, id: '2', receivedAt: yesterday },
    ]);

    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday']);
  });
});
