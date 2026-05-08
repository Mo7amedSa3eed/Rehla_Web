import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  ActiveCartDto,
  ApiService,
  CartItemDto,
  MarketplaceActiveListingsDto,
  MarketplaceListingDto,
  RouteStopDto,
  TicketDto,
  TripClassDto,
  TripSearchItemDto,
  UserProfileDto,
} from './api';

export interface UserProfile {
  firstName: string;
  familyName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  address: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  photo: string | null;
  memberSince: string;
  totalTrips: number;
  totalDistanceTraveled: number;
  walletBalance: number;
}

export interface UiTrip {
  id: number;
  tripOccurrenceId: number;
  tripId: number;
  coachClassId: number;
  className: string;
  originStationId: number;
  originStationName: string;
  destinationStationId: number;
  destinationStationName: string;
  from: string;
  to: string;
  date: string;
  time: string;
  dropoffTime: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  transport: string;
  agencyName: string;
  price: number;
  seats: number;
  availableClasses: TripClassDto[];
  routeStops: RouteStopDto[];
}

export interface UiBooking {
  id: number;
  ticketId: number;
  from: string;
  to: string;
  date: string;
  time: string;
  duration: string;
  passengers: number;
  price: number;
  originalPrice?: number;
  status: 'pending' | 'confirmed' | 'pending-sale' | 'sold' | 'cancelled';
  seat: string;
}

export interface MarketplaceListing {
  listingId: number;
  ticketId: number;
  from: string;
  to: string;
  date: string;
  time: string;
  duration: string;
  passengers: number;
  seat: string;
  originalPrice: number;
  price: number;
  status: 'available' | 'sold';
}

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  constructor(
    private readonly api: ApiService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  userProfile: UserProfile = {
    firstName: 'Mohamed',
    familyName: '',
    lastName: 'Saeed',
    email: 'mo7amedsa3eed@gmail.com',
    phone: '',
    dob: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    country: '',
    countryCode: '',
    memberSince: '2025-12-24',
    photo: null as string | null,
    totalTrips: 12,
    totalDistanceTraveled: 0,
    walletBalance: 0
  };

  updateUserProfile(updated: UserProfile) {
    this.userProfile = { ...updated };
  }

  bookings: UiBooking[] = [];
  searchResults: UiTrip[] = [];
  myTickets: UiBooking[] = [];
  marketplace: MarketplaceListing[] = [];
  localPendingBookings: UiBooking[] = [];
  localConfirmedBookings: UiBooking[] = [];

  currentPaymentBooking: UiBooking | null = null;
  buyingMarketplaceTicketId: number | null = null;
  selectedTicket: any = null;
  searchPassengers: number = 1;

  isMarketplaceLoaded = false;

  async searchTrips(criteria: {
    travelDate: string;
    fromGovernorate: string;
    fromStationId?: number;
    toGovernorate: string;
    toStationId?: number;
    passengers: number;
    transport?: number;
    preferredAgencies?: string[];
  }): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const primaryResult = await firstValueFrom(
      this.api.searchTrips({
        travelDate: criteria.travelDate,
        fromGovernorate: criteria.fromGovernorate,
        fromStationId: criteria.fromStationId,
        toGovernorate: criteria.toGovernorate,
        toStationId: criteria.toStationId,
        passengers: criteria.passengers,
        transport: criteria.transport,
        preferredAgencies: criteria.preferredAgencies,
      }),
    );

    const result =
      primaryResult.items.length === 0 && typeof criteria.transport === 'number' && criteria.transport !== 0
        ? await firstValueFrom(
            this.api.searchTrips({
              travelDate: criteria.travelDate,
              fromGovernorate: criteria.fromGovernorate,
              fromStationId: criteria.fromStationId,
              toGovernorate: criteria.toGovernorate,
              toStationId: criteria.toStationId,
              passengers: criteria.passengers,
              transport: 0,
              preferredAgencies: criteria.preferredAgencies,
            }),
          )
        : primaryResult;

    this.searchPassengers = criteria.passengers;
    this.searchResults = result.items.map((trip) => this.mapTripToUi(trip));
  }

  async addTripToCart(trip: UiTrip): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    try {
      const seatMap = await firstValueFrom(this.api.getSeatMap(trip.tripOccurrenceId));
      const preferredClass = seatMap.classes.find((item) => item.remainingSeats >= this.searchPassengers);

      if (!preferredClass) {
        throw new Error('Not enough available seats for selected trip.');
      }

      const availableSeats = preferredClass.seats
        .filter((seat) => seat.status === 'Available')
        .slice(0, this.searchPassengers)
        .map((seat) => seat.seatNumber);

      if (availableSeats.length < this.searchPassengers) {
        throw new Error('Could not reserve enough seats. Please try another trip.');
      }

      await firstValueFrom(
        this.api.addToCart({
          tripOccurrenceId: trip.tripOccurrenceId,
          coachClassId: preferredClass.coachClassId,
          originStationId: trip.originStationId,
          destinationStationId: trip.destinationStationId,
          contactName: `${this.userProfile.firstName} ${this.userProfile.lastName}`.trim() || 'Rihla Guest',
          contactPhone: this.userProfile.phone || '+201000000000',
          contactEmail: this.userProfile.email || 'guest@example.com',
          passengers: availableSeats.map((seat, index) => ({
            passengerName: `Passenger ${index + 1}`,
            idType: 'NationalId',
            idNumber: `TEMP-${Date.now()}-${index}`,
            seatNumber: seat,
          })),
        }),
      );
    } catch {
      const localBooking = this.mapTripToLocalPendingBooking(trip);
      if (!this.localPendingBookings.some((booking) => booking.id === localBooking.id)) {
        this.localPendingBookings = [localBooking, ...this.localPendingBookings];
      }
    }

    await this.loadBookings();
  }

  async loadBookings(): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const [cart, tickets] = await Promise.all([this.loadCartSafe(), this.loadTicketsSafe()]);
    const pending = (cart?.items ?? []).map((item) => this.mapCartItemToUiBooking(item));
    const confirmed = tickets.map((ticket) => this.mapTicketToUiBooking(ticket));
    this.bookings = this.mergeBookings([
      ...pending,
      ...confirmed,
      ...this.localPendingBookings,
      ...this.localConfirmedBookings,
    ]);
  }

  async checkoutWallet(): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const targetBookingId = this.currentPaymentBooking?.id;

    try {
      await firstValueFrom(this.api.checkoutWallet());
      await this.loadBookings();
      await this.loadTickets();
      if (typeof this.buyingMarketplaceTicketId === 'number') {
        await firstValueFrom(this.api.buyMarketplaceTicket(this.buyingMarketplaceTicketId));
        await this.loadMarketplace().catch(() => undefined);
      }
    } catch {
      if (typeof targetBookingId === 'number') {
        this.confirmLocalBooking(targetBookingId);
      }
      await this.loadBookings();
      await this.loadTickets();
    }

    this.currentPaymentBooking = null;
    this.buyingMarketplaceTicketId = null;
  }

  async listTicketForResale(ticket: UiBooking, askingPrice: number): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    await firstValueFrom(
      this.api.listTicketOnMarketplace({
        bookingId: ticket.id,
        askingPrice,
      }),
    );

    await this.loadMarketplace().catch(() => undefined);
    await this.loadTickets().catch(() => undefined);
    await this.loadBookings().catch(() => undefined);
  }

  async loadMarketplace(params?: {
    pageNumber?: number;
    pageSize?: number;
    originStationId?: number;
    destinationStationId?: number;
    originGovernorate?: string;
    destinationGovernorate?: string;
    travelDate?: string;
  }): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const listings = await firstValueFrom(this.api.getMarketplaceListings(params));
    this.marketplace = this.mapMarketplaceToUi(listings);
    this.isMarketplaceLoaded = true;
  }

  async buyMarketplaceListing(listingId: number): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    await firstValueFrom(this.api.buyMarketplaceTicket(listingId));
    await this.loadMarketplace().catch(() => undefined);
    await this.loadTickets().catch(() => undefined);
    await this.loadBookings().catch(() => undefined);
  }

  async cancelCartHold(bookingId: number): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    await firstValueFrom(this.api.cancelCartHold(bookingId));
    await this.loadBookings().catch(() => undefined);
  }

  async loadTickets(): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const tickets = await this.loadTicketsSafe();
    this.myTickets = this.mergeBookings([
      ...tickets.map((ticket) => this.mapTicketToUiBooking(ticket)),
      ...this.localConfirmedBookings,
    ]);
  }

  async loadProfile(): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const profile = await firstValueFrom(this.api.getMyProfile());
    this.userProfile = this.mapProfileToUi(profile);
  }

  async saveProfile(profile: {
    firstName: string;
    familyName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
  }): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    await firstValueFrom(
      this.api.updateMyProfile({
        firstName: profile.firstName,
        familyName: profile.familyName,
        lastName: profile.lastName,
        email: profile.email,
        phoneNumber: profile.phoneNumber,
      }),
    );

    this.userProfile = {
      ...this.userProfile,
      firstName: profile.firstName,
      familyName: profile.familyName,
      lastName: profile.lastName,
      email: profile.email ?? this.userProfile.email,
      phone: profile.phoneNumber ?? this.userProfile.phone,
    };
  }

  async uploadProfilePicture(file: File): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const pictureUrl = await firstValueFrom(this.api.uploadProfilePicture(file));
    this.userProfile = {
      ...this.userProfile,
      photo: pictureUrl,
    };
  }

  private async loadCartSafe(): Promise<ActiveCartDto | null> {
    return firstValueFrom(this.api.getActiveCart()).catch(() => null);
  }

  private async loadTicketsSafe(): Promise<TicketDto[]> {
    return firstValueFrom(this.api.getMyTickets()).catch(() => []);
  }

  private mapTripToUi(trip: TripSearchItemDto): UiTrip {
    const firstClass = trip.availableClasses[0];
    const boardingDate = new Date(trip.boardingTime);
    const dropoffDate = new Date(trip.dropoffTime);
    const departureDate = new Date(trip.departureTime);
    const arrivalDate = new Date(trip.arrivalTime);

    return {
      id: trip.tripOccurrenceId,
      tripOccurrenceId: trip.tripOccurrenceId,
      tripId: trip.tripId,
      coachClassId: firstClass?.coachClassId ?? 0,
      className: firstClass?.className ?? 'N/A',
      originStationId: trip.originStationId,
      originStationName: trip.originStationName,
      destinationStationId: trip.destinationStationId,
      destinationStationName: trip.destinationStationName,
      from: trip.originGovernorate,
      to: trip.destinationGovernorate,
      date: boardingDate.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
      time: boardingDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      dropoffTime: dropoffDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      departureTime: departureDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      arrivalTime: arrivalDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      duration: this.formatDuration(trip.totalDurationMinutes),
      transport: trip.agencyName,
      agencyName: trip.agencyName,
      price: trip.startingPrice,
      seats: firstClass?.remainingSeats ?? 0,
      availableClasses: trip.availableClasses ?? [],
      routeStops: trip.routeStops ?? [],
    };
  }

  private mapCartItemToUiBooking(item: CartItemDto): UiBooking {
    const boardingDate = new Date(item.boardingTime);

    return {
      id: item.bookingId,
      ticketId: item.bookingId,
      from: item.origin,
      to: item.destination,
      date: boardingDate.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
      time: boardingDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      duration: this.durationFromTimes(item.boardingTime, item.dropoffTime),
      passengers: item.seatsBooked,
      price: item.totalPrice,
      originalPrice: item.totalPrice,
      status: 'pending',
      seat: item.passengers.map((passenger) => passenger.seatNumber).join(', '),
    };
  }

  private mapTicketToUiBooking(ticket: TicketDto): UiBooking {
    const boardingDate = new Date(ticket.boardingTime);

    return {
      id: ticket.bookingId,
      ticketId: ticket.bookingId,
      from: ticket.originStation,
      to: ticket.destinationStation,
      date: boardingDate.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
      time: boardingDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      duration: this.durationFromTimes(ticket.boardingTime, ticket.dropoffTime),
      passengers: ticket.seatsBooked,
      price: ticket.totalPrice,
      originalPrice: ticket.totalPrice,
      status: 'confirmed',
      seat: ticket.passengers.map((passenger) => passenger.seatNumber).join(', '),
    };
  }

  private mapTripToLocalPendingBooking(trip: UiTrip): UiBooking {
    const bookingId = Date.now();

    return {
      id: bookingId,
      ticketId: bookingId,
      from: trip.originStationName || trip.from,
      to: trip.destinationStationName || trip.to,
      date: trip.date,
      time: trip.time,
      duration: trip.duration,
      passengers: this.searchPassengers,
      price: trip.price * this.searchPassengers,
      originalPrice: trip.price * this.searchPassengers,
      status: 'pending',
      seat: 'Auto-assign at checkout',
    };
  }

  private confirmLocalBooking(bookingId: number): void {
    const pendingBooking = this.localPendingBookings.find((booking) => booking.id === bookingId);
    if (!pendingBooking) {
      return;
    }

    this.localPendingBookings = this.localPendingBookings.filter((booking) => booking.id !== bookingId);
    const confirmedBooking: UiBooking = {
      ...pendingBooking,
      status: 'confirmed',
    };

    this.localConfirmedBookings = this.mergeBookings([confirmedBooking, ...this.localConfirmedBookings]);
  }

  private mergeBookings(bookings: UiBooking[]): UiBooking[] {
    const unique = new Map<number, UiBooking>();
    for (const booking of bookings) {
      unique.set(booking.id, booking);
    }

    return Array.from(unique.values()).sort((a, b) => b.id - a.id);
  }

  private mapProfileToUi(profile: UserProfileDto): UserProfile {
    return {
      firstName: profile.firstName,
      familyName: profile.familyName ?? '',
      lastName: profile.lastName,
      email: profile.email,
      phone: profile.phoneNumber,
      dob: '',
      gender: profile.gender,
      address: '',
      city: '',
      state: '',
      country: profile.countryName,
      countryCode: profile.countryCode,
      photo: profile.profilePictureUrl,
      memberSince: '',
      totalTrips: profile.totalTripsCount,
      totalDistanceTraveled: profile.totalDistanceTraveled ?? 0,
      walletBalance: profile.walletBalance,
    };
  }

  private mapMarketplaceToUi(result: MarketplaceActiveListingsDto): MarketplaceListing[] {
    return (result.items ?? []).map((listing) => {
      const time = new Date(listing.tripDetails.time);
      const dateLabel = time.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });

      const timeLabel = time.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return {
        listingId: listing.listingId,
        ticketId: listing.listingId,
        from: listing.tripDetails.origin,
        to: listing.tripDetails.destination,
        date: dateLabel,
        time: timeLabel,
        duration: '',
        passengers: listing.seatsCount ?? 0,
        seat: '',
        originalPrice: listing.originalPrice,
        price: listing.askingPrice,
        status: 'available',
      };
    });
  }

  private formatDuration(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes}m`;
    }

    if (minutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${minutes}m`;
  }

  private durationFromTimes(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMinutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));

    return this.formatDuration(diffMinutes);
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
