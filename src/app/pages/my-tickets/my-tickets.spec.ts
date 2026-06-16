import { MyTicketsComponent } from './my-tickets';
import { UiBooking } from '../../services/state';

describe('MyTickets', () => {
  let component: MyTicketsComponent;

  const now = new Date('2026-06-14T12:00:00');

  beforeEach(() => {
    const state = {
      myTickets: [],
      marketplace: [],
      userProfile: {},
      isBrowser: () => false,
      loadProfile: () => Promise.resolve(),
      loadTickets: () => Promise.resolve(),
      loadMarketplace: () => Promise.resolve(),
      getPassengerQrPayload: () => Promise.resolve('qr'),
      cancelListing: () => Promise.resolve(),
      requestRefund: () => Promise.resolve(),
      prepareMarketplacePurchase: () => undefined,
    };
    const router = { navigate: () => Promise.resolve(true) };
    const language = { instant: (key: string) => key };

    component = new MyTicketsComponent(state as any, router as any, language as any);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('classifies confirmed tickets more than 5 hours before boarding as upcoming only', () => {
    const ticket = ticketFor({ boardingTimeRaw: '2026-06-14T18:00:00' });

    expect(isUpcoming(ticket, now)).toBeTrue();
    expect(isActive(ticket, now)).toBeFalse();
    expect(isPast(ticket, now)).toBeFalse();
  });

  it('classifies confirmed tickets exactly 5 hours before boarding as active only', () => {
    const ticket = ticketFor({ boardingTimeRaw: '2026-06-14T17:00:00' });

    expect(isUpcoming(ticket, now)).toBeFalse();
    expect(isActive(ticket, now)).toBeTrue();
    expect(isPast(ticket, now)).toBeFalse();
  });

  it('classifies confirmed tickets inside 5 hours and after boarding as active only', () => {
    const insideFiveHours = ticketFor({ id: 2, boardingTimeRaw: '2026-06-14T12:30:00' });
    const afterBoarding = ticketFor({ id: 3, boardingTimeRaw: '2026-06-14T10:00:00' });

    expect(isActive(insideFiveHours, now)).toBeTrue();
    expect(isUpcoming(insideFiveHours, now)).toBeFalse();
    expect(isPast(insideFiveHours, now)).toBeFalse();

    expect(isActive(afterBoarding, now)).toBeTrue();
    expect(isUpcoming(afterBoarding, now)).toBeFalse();
    expect(isPast(afterBoarding, now)).toBeFalse();
  });

  it('hides completed tickets until one hour after boarding', () => {
    const ticket = ticketFor({
      rawStatus: 'Completed',
      status: 'completed',
      boardingTimeRaw: '2026-06-14T11:30:00',
      dropoffTimeRaw: '2026-06-14T12:30:00',
    });

    expect(isUpcoming(ticket, now)).toBeFalse();
    expect(isActive(ticket, now)).toBeFalse();
    expect(isPast(ticket, now)).toBeFalse();
  });

  it('classifies completed tickets as past after one hour from boarding', () => {
    const ticket = ticketFor({
      rawStatus: 'Completed',
      status: 'completed',
      boardingTimeRaw: '2026-06-14T10:00:00',
      dropoffTimeRaw: '2026-06-14T14:00:00',
    });

    expect(isUpcoming(ticket, now)).toBeFalse();
    expect(isActive(ticket, now)).toBeFalse();
    expect(isPast(ticket, now)).toBeTrue();
  });

  it('classifies accepted and approved refunds as past only', () => {
    const accepted = ticketFor({ refundStatus: 'Accepted' });
    const approved = ticketFor({ id: 2, refundStatus: 'Approved' });

    for (const ticket of [accepted, approved]) {
      expect(isUpcoming(ticket, now)).toBeFalse();
      expect(isActive(ticket, now)).toBeFalse();
      expect(isPast(ticket, now)).toBeTrue();
    }
  });

  it('hides cancelled tickets without accepted or approved refund', () => {
    const ticket = ticketFor({
      rawStatus: 'Cancelled',
      status: 'cancelled',
      refundStatus: null,
    });

    expect(isUpcoming(ticket, now)).toBeFalse();
    expect(isActive(ticket, now)).toBeFalse();
    expect(isPast(ticket, now)).toBeFalse();
  });

  it('does not classify any ticket as both upcoming and active', () => {
    const tickets = [
      ticketFor({ boardingTimeRaw: '2026-06-14T18:00:00' }),
      ticketFor({ id: 2, boardingTimeRaw: '2026-06-14T17:00:00' }),
      ticketFor({ id: 3, boardingTimeRaw: '2026-06-14T12:30:00' }),
    ];

    for (const ticket of tickets) {
      expect(isUpcoming(ticket, now) && isActive(ticket, now)).toBeFalse();
    }
  });

  it('keeps old confirmed tickets active until the API marks them completed', () => {
    const ticket = ticketFor({
      boardingTimeRaw: '2026-06-13T10:00:00',
      dropoffTimeRaw: '2026-06-13T12:00:00',
    });

    expect(isUpcoming(ticket, now)).toBeFalse();
    expect(isActive(ticket, now)).toBeTrue();
    expect(isPast(ticket, now)).toBeFalse();
  });

  it('classifies active confirmed tickets without dropoffTime', () => {
    const ticket = ticketFor({
      boardingTimeRaw: '2026-06-14T10:00:00',
      dropoffTimeRaw: undefined,
    });

    expect(isUpcoming(ticket, now)).toBeFalse();
    expect(isActive(ticket, now)).toBeTrue();
    expect(isPast(ticket, now)).toBeFalse();
  });

  function isUpcoming(ticket: UiBooking, date: Date): boolean {
    return (component as any).isUpcoming(ticket, date);
  }

  function isActive(ticket: UiBooking, date: Date): boolean {
    return (component as any).isActiveNow(ticket, date);
  }

  function isPast(ticket: UiBooking, date: Date): boolean {
    return (component as any).isPast(ticket, date);
  }
});

function ticketFor(overrides: Partial<UiBooking> = {}): UiBooking {
  return {
    id: 1,
    ticketId: 1,
    from: 'Cairo',
    to: 'Alexandria',
    date: 'Jun 14, 2026',
    time: '06:00 PM',
    duration: '2h 0m',
    passengers: 1,
    price: 100,
    status: 'confirmed',
    rawStatus: 'Confirmed',
    seat: '1A',
    boardingTimeRaw: '2026-06-14T18:00:00',
    dropoffTimeRaw: '2026-06-14T20:00:00',
    refundStatus: null,
    ...overrides,
  };
}
