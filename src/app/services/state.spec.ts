import { TestBed } from '@angular/core/testing';

import { AppStateService, UiBooking } from './state';
import { ApiService } from './api';
import { of } from 'rxjs';

class MockApiService {
  static tickets: any[] = [];

  checkout() { return of('ok'); }
  getMarketplaceListings() { return of({ items: [] }); }
  listTicketOnMarketplace(payload: { bookingId: number }) {
    MockApiService.tickets = MockApiService.tickets.map((ticket) =>
      ticket.bookingId === payload.bookingId
        ? { ...ticket, status: 'pending-sale', isMarketplacePurchase: false }
        : ticket,
    );
    return of(null);
  }
  updateTicketStatus(payload: { bookingId: number }) {
    return this.listTicketOnMarketplace(payload);
  }
  buyMarketplaceTicket() { return of(null); }
  transferOwnership() { return of(null); }
  getMyTickets() { return of(MockApiService.tickets); }
  getActiveCart() { return of(null); }
}

describe('State', () => {
  let service: AppStateService;

  beforeEach(() => {
    MockApiService.tickets = [];
    TestBed.configureTestingModule({
      providers: [
        AppStateService,
        { provide: ApiService, useClass: MockApiService }
      ]
    });
    service = TestBed.inject(AppStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should clear payment state after wallet checkout', async () => {
    const localBooking: UiBooking = {
      id: 9999,
      ticketId: 9999,
      from: 'A', to: 'B', date: '2026-05-15', time: '10:00', duration: '', passengers: 1,
      price: 100, originalPrice: 100, status: 'pending', seat: '1A',
    } as UiBooking;

    (service as any).localPendingBookings = [localBooking];
    service.currentPaymentBooking = localBooking;

    await service.checkoutWallet();

    expect(service.currentPaymentBooking).toBeNull();
  });

  it('should mark ticket pending-sale after listing to marketplace', async () => {
    const ticket: UiBooking = {
      id: 1001,
      ticketId: 1001,
      from: 'A', to: 'B', date: '2026-05-15', time: '10:00', duration: '', passengers: 1,
      price: 200, originalPrice: 200, status: 'confirmed', seat: '4B', canResell: true,
    } as UiBooking;

    MockApiService.tickets = [{
      bookingId: ticket.id,
      status: 'confirmed',
      paymentStatus: 'Paid',
      totalPrice: 200,
      seatsBooked: 1,
      bookingDate: '2026-05-15T00:00:00Z',
      agencyName: 'Train',
      className: 'Standard',
      originStation: 'A',
      destinationStation: 'B',
      boardingTime: '2026-05-15T10:00:00',
      dropoffTime: '2026-05-15T11:00:00',
      passengers: [{ name: 'P1', idNumber: '1', seatNumber: '4B' }],
    }];

    await service.listTicketForResale(ticket, 180);

    const updated = service.myTickets.find(t => t.id === 1001);
    expect(updated?.status).toBe('pending-sale');
    expect(updated?.canResell).toBe(false);
  });

  it('should finalize marketplace purchase and clear selection', async () => {
    service.prepareMarketplacePurchase({
      listingId: 777,
      ticketId: 888,
      from: 'A',
      to: 'B',
      date: '2026-05-15',
      time: '10:00',
      duration: '',
      passengers: 1,
      seat: '1A',
      originalPrice: 200,
      price: 180,
      status: 'available',
      sellerName: 'Seller',
    } as any);

    await service.completeMarketplacePurchase();

    expect(service.currentPaymentBooking).toBeNull();
    expect(service.buyingMarketplaceTicketId).toBeNull();
  });

  describe('isTrainTrip', () => {
    it('should return true for train agencies and type strings', () => {
      expect(service.isTrainTrip('EGYPTIAN NATIONAL RAILWAYS', '')).toBe(true);
      expect(service.isTrainTrip('Go Train', '')).toBe(true);
      expect(service.isTrainTrip('TALGO train', '')).toBe(true);
      expect(service.isTrainTrip('', 'TRAIN')).toBe(true);
      expect(service.isTrainTrip('ENR', '')).toBe(true);
      expect(service.isTrainTrip('National Rail', '')).toBe(true);
      expect(service.isTrainTrip('السكة الحديد', '')).toBe(true);
    });

    it('should return true for train numeric transport types', () => {
      expect(service.isTrainTrip('', 2)).toBe(true);
      expect(service.isTrainTrip('', '2')).toBe(true);
    });

    it('should return false for bus agencies and type strings', () => {
      expect(service.isTrainTrip('Go Bus', '')).toBe(false);
      expect(service.isTrainTrip('Super Jet', '')).toBe(false);
      expect(service.isTrainTrip('', 'BUS')).toBe(false);
    });

    it('should return false for bus numeric transport types', () => {
      expect(service.isTrainTrip('', 1)).toBe(false);
      expect(service.isTrainTrip('', '1')).toBe(false);
    });

    it('should prefer recognizable agency names over stale numeric search filters', () => {
      expect(service.isTrainTrip('Egyptian National Railways', 1)).toBe(true);
      expect(service.isTrainTrip('Go Bus', 2)).toBe(false);
    });
  });

});
