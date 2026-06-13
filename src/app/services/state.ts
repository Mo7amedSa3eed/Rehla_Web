import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  ActiveCartDto,
  ApiService,
  CartItemDto,
  AuthUserDto,
  MarketplaceActiveListingsDto,
  MarketplaceListingDto,
  RouteStopDto,
  TicketDto,
  TripClassDto,
  TripSearchItemDto,
  UserProfileDto,
} from './api';
import { buildE164Number } from '../shared/phone-codes';

export interface UserProfile {
  userId: number;
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
  loyaltyPointsBalance: number;
  expiringPointsAmount: number;
  nextExpiryDate: string | null;
  hasSetIdentityDetails: boolean;
  idType?: number | string | null;
  idNumber?: string | null;
  activeChallenges: { challengeId: number; title: string; currentProgress: number; goalValue: number; rewardPoints: number; isCompleted?: boolean }[];
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
  showStops?: boolean;
}

export interface UiBooking {
  id: number;
  ticketId: number;
  ownerId?: number;
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
  canResell?: boolean;
  className?: string;
  agencyName?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  // Spec fields
  boardingTimeRaw?: string;
  dropoffTimeRaw?: string;
  refundStatus?: 'Requested' | 'Accepted' | 'Approved' | 'Rejected' | string | null;
  isMarketplacePurchase?: boolean;
  isOfferedForResale?: boolean;
  activeListingId?: number | null;
  paymentStatus?: string;
  bookingDate?: string;
  originGov?: string;
  originStation?: string;
  destinationGov?: string;
  destinationStation?: string;
  agencyNameAr?: string | null;
  classNameAr?: string | null;
  originGovernorateAr?: string | null;
  destinationGovernorateAr?: string | null;
  passengerList?: { passengerId?: number; name: string; idNumber: string; seatNumber: string }[];
}

export interface PassengerDraft {
  fullName: string;
  nationalId: string;
  idType: 'NationalId' | 'Passport';
  phoneCode: string;
  phoneLocalNumber: string;
  email: string;
}

export interface MarketplaceListing {
  listingId: number;
  ticketId: number;
  ownerId?: number;
  sellerId?: number;
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
  sellerName?: string;
  className?: string;
  agencyName?: string;
  transportType?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AppStateService {
  constructor(
    private readonly api: ApiService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) { }

  userProfile: UserProfile = {
    userId: 0,
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
    walletBalance: 0,
    loyaltyPointsBalance: 0,
    expiringPointsAmount: 0,
    nextExpiryDate: null,
    hasSetIdentityDetails: false,
    idType: null,
    idNumber: null,
    activeChallenges: [],
  };

  // Transport of the last search (1=bus,2=train)
  lastSearchTransport: number | null = null;

  // Seats selected by the user during seat selection
  selectedSeats: string[] = [];

  updateUserProfile(updated: UserProfile) {
    this.userProfile = { ...updated };
  }

  applyAuthUserProfile(user: AuthUserDto): void {
    this.userProfile = {
      ...this.userProfile,
      userId: user.userId,
      email: user.email,
      countryCode: user.countryCode,
      country: user.countryName,
      photo: this.api.resolveProfilePictureUrl(user.profilePictureUrl),
    };
  }

  bookings: UiBooking[] = [];
  searchResults: UiTrip[] = [];
  myTickets: UiBooking[] = [];
  marketplace: MarketplaceListing[] = [];
  localPendingBookings: UiBooking[] = [];
  localConfirmedBookings: UiBooking[] = [];
  walletHistory: any[] = [];
  activeCart: ActiveCartDto | null = null;

  currentPaymentBooking: UiBooking | null = null;
  buyingMarketplaceTicketId: number | null = null;
  selectedTicket: any = null;
  searchPassengers: number = 1;
  pendingPassengers: PassengerDraft[] = [];

  isMarketplaceLoaded = false;

  searchType: 'oneway' | 'indirect' | 'round' | 'multi-destination' = 'oneway';
  searchQueries: any[] = [];
  currentLegIndex: number = 0;
  selectedLegs: any[] = [];
  indirectSearchResults: any[] = [];

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

    this.lastSearchTransport = typeof criteria.transport === 'number' ? criteria.transport : null;

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

  async searchIndirectTrips(criteria: any): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    this.lastSearchTransport = typeof criteria.transport === 'number' ? criteria.transport : null;

    const result = await firstValueFrom(
      this.api.searchIndirectTrips({
        travelDate: criteria.travelDate,
        fromGovernorate: criteria.fromGovernorate,
        fromStationId: criteria.fromStationId,
        toGovernorate: criteria.toGovernorate,
        toStationId: criteria.toStationId,
        passengers: criteria.passengers,
        transport: criteria.transport,
        preferredAgencies: criteria.preferredAgencies,
      })
    );

    this.searchPassengers = criteria.passengers;
    this.indirectSearchResults = result.items;
  }

  async addLegsToCart(): Promise<void> {
    if (!this.isBrowser() || this.selectedLegs.length === 0) {
      return;
    }

    // Clean up any abandoned items in the cart before adding new ones
    try {
      const currentCart = await this.loadCartSafe();
      if (currentCart && currentCart.items && currentCart.items.length > 0) {
        await Promise.all(currentCart.items.map(item =>
          firstValueFrom(this.api.cancelCartHold(item.bookingId)).catch(() => {})
        ));
      }
    } catch (e) {
      console.warn('Failed to clean up old cart items', e);
    }

    const draftPassengers =
      this.pendingPassengers.length === this.searchPassengers
        ? this.pendingPassengers
        : [];

    const primaryPassenger = draftPassengers[0];
    const contactName =
      primaryPassenger?.fullName?.trim() ||
      `${this.userProfile.firstName} ${this.userProfile.lastName}`.trim() ||
      'Rihla Guest';
    const contactPhone = primaryPassenger
      ? buildE164Number(primaryPassenger.phoneCode, primaryPassenger.phoneLocalNumber)
      : this.userProfile.phone || '+201000000000';
    const contactEmail = primaryPassenger?.email?.trim() || this.userProfile.email || 'guest@example.com';

    for (const leg of this.selectedLegs) {
      try {
        const isTrain = this.isTrainTrip(leg.agencyName, leg.transport);

        await firstValueFrom(
          this.api.addToCart({
            tripOccurrenceId: leg.tripOccurrenceId,
            coachClassId: leg.coachClassId,
            originStationId: leg.originStationId,
            destinationStationId: leg.destinationStationId,
            contactName,
            contactPhone,
            contactEmail,
            passengers: draftPassengers.map((passenger, index) => {
              const payload: any = {
                passengerName: passenger?.fullName?.trim() || `Passenger ${index + 1}`,
                seatNumber: isTrain ? `T-${index + 1}` : (leg.selectedSeats?.[index] || ''),
              };
              if (isTrain) {
                payload.idType = passenger?.idType || 'NationalId';
                payload.idNumber = passenger?.nationalId?.trim() || 'N/A';
              }
              return payload;
            }),
          }),
        );
      } catch {
        // Fallback for local bookings handled separately if needed
        console.error('Failed to add leg to cart', leg);
      }
    }

    this.selectedLegs = [];
    this.selectedSeats = [];
    this.pendingPassengers = [];
    this.currentLegIndex = 0;
    this.searchQueries = [];
    this.searchType = 'oneway';

    await this.loadBookings();
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

      // If user selected seats earlier via seat-selection, prefer those
      let seatsToUse: string[] = [];
      if (this.selectedSeats && this.selectedSeats.length >= this.searchPassengers) {
        seatsToUse = this.selectedSeats.slice(0, this.searchPassengers);
      } else {
        const availableSeats = preferredClass.seats
          .filter((seat) => seat.status === 'Available')
          .slice(0, this.searchPassengers)
          .map((seat) => seat.seatNumber);

        if (availableSeats.length < this.searchPassengers) {
          throw new Error('Could not reserve enough seats. Please try another trip.');
        }

        seatsToUse = availableSeats;
      }

      const draftPassengers =
        this.pendingPassengers.length === this.searchPassengers
          ? this.pendingPassengers
          : [];

      const primaryPassenger = draftPassengers[0];
      const contactName =
        primaryPassenger?.fullName?.trim() ||
        `${this.userProfile.firstName} ${this.userProfile.lastName}`.trim() ||
        'Rihla Guest';
      const contactPhone = primaryPassenger
        ? buildE164Number(primaryPassenger.phoneCode, primaryPassenger.phoneLocalNumber)
        : this.userProfile.phone || '+201000000000';
      const contactEmail = primaryPassenger?.email?.trim() || this.userProfile.email || 'guest@example.com';

      const isTrain = this.isTrainTrip(trip.agencyName, trip.transport);

      await firstValueFrom(
        this.api.addToCart({
          tripOccurrenceId: trip.tripOccurrenceId,
          coachClassId: preferredClass.coachClassId,
          originStationId: trip.originStationId,
          destinationStationId: trip.destinationStationId,
          contactName,
          contactPhone,
          contactEmail,
          passengers: draftPassengers.map((passenger, index) => {
            const payload: any = {
              passengerName: passenger?.fullName?.trim() || `Passenger ${index + 1}`,
              seatNumber: isTrain ? `T-${index + 1}` : seatsToUse[index],
            };
            if (isTrain) {
              payload.idType = passenger?.idType || 'NationalId';
              payload.idNumber = passenger?.nationalId?.trim() || 'N/A';
            }
            return payload;
          }),
        }),
      );
    } catch {
      const localBooking = this.mapTripToLocalPendingBooking(trip);
      if (!this.localPendingBookings.some((booking) => booking.id === localBooking.id)) {
        this.localPendingBookings = [localBooking, ...this.localPendingBookings];
      }
    }

    // Clear selected seats after attempting to add to cart
    this.selectedSeats = [];
    this.pendingPassengers = [];

    await this.loadBookings();
  }

  async loadBookings(): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const [cart, tickets] = await Promise.all([this.loadCartSafe(), this.loadTicketsSafe()]);
    this.activeCart = cart;
    const pending = (cart?.items ?? []).map((item) => this.mapCartItemToUiBooking(item));
    const offlinePending = this.localPendingBookings.filter(b => b.id < 0);
    this.localPendingBookings = [...pending, ...offlinePending];

    const confirmed = tickets.map((ticket) => this.mapTicketToUiBooking(ticket));
    this.bookings = this.mergeBookings([
      ...this.localPendingBookings,
      ...confirmed,
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
      if (typeof targetBookingId === 'number') {
        this.markBookingConfirmed(targetBookingId);
      } else {
        this.confirmCartItems();
      }
      await this.loadBookings();
      await this.loadTickets();
      if (typeof this.buyingMarketplaceTicketId === 'number') {
        await firstValueFrom(this.api.buyMarketplaceTicket(this.buyingMarketplaceTicketId));
        await this.loadMarketplace().catch(() => undefined);
      }
    } catch {
      if (typeof targetBookingId === 'number') {
        this.confirmLocalBooking(targetBookingId);
      } else {
        this.confirmCartItems();
      }
      await this.loadBookings();
      await this.loadTickets();
    }

    this.currentPaymentBooking = null;
    this.buyingMarketplaceTicketId = null;
  }

  async checkoutPoints(pointsToRedeem: number): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const targetBookingId = this.currentPaymentBooking?.id;

    try {
      await firstValueFrom(this.api.checkoutPoints(pointsToRedeem));
      if (typeof targetBookingId === 'number') {
        this.markBookingConfirmed(targetBookingId);
      } else {
        this.confirmCartItems();
      }
      await this.loadBookings();
      await this.loadTickets();
      await this.loadProfile().catch(() => undefined);
    } catch {
      if (typeof targetBookingId === 'number') {
        this.confirmLocalBooking(targetBookingId);
      } else {
        this.confirmCartItems();
      }
      await this.loadBookings();
      await this.loadTickets();
    }

    this.currentPaymentBooking = null;
    this.buyingMarketplaceTicketId = null;
  }

  async depositToWallet(payload: {
    amount: number;
    mockCardNumber: string;
    expiryDate: string;
    cvv: string;
  }): Promise<string> {
    if (!this.isBrowser()) {
      return 'Wallet charging is available in browser mode only.';
    }

    const message = await firstValueFrom(this.api.depositToWallet(payload));
    await this.loadProfile().catch(() => undefined);
    return message;
  }

  async listTicketForResale(ticket: UiBooking, askingPrice: number): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    await firstValueFrom(
      this.api.updateTicketStatus({
        bookingId: ticket.id,
        askingPrice,
      }),
    );

    this.markTicketPendingSale(ticket.id);
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

    const result = await firstValueFrom(this.api.getMarketplaceListings(params));
    this.marketplace = this.mapMarketplaceToUi(result);
    this.isMarketplaceLoaded = true;
  }

  async buyMarketplaceListing(listingId: number): Promise<void> {
    await this.completeMarketplacePurchase(listingId);
  }

  prepareMarketplacePurchase(listing: MarketplaceListing): void {
    const bookingId = listing.listingId ?? listing.ticketId;

    this.currentPaymentBooking = {
      id: bookingId,
      ticketId: listing.ticketId,
      ownerId: listing.ownerId,
      from: listing.from,
      to: listing.to,
      date: listing.date,
      time: listing.time,
      duration: listing.duration,
      passengers: listing.passengers,
      price: listing.price,
      originalPrice: listing.originalPrice,
      status: 'pending',
      seat: listing.seat,
    };

    this.buyingMarketplaceTicketId = listing.listingId;
  }

  async completeMarketplacePurchase(listingId?: number, passengers?: { passengerName: string; idType?: string; idNumber?: string }[]): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const targetListingId = listingId ?? this.buyingMarketplaceTicketId;
    if (typeof targetListingId !== 'number') {
      throw new Error('No marketplace ticket selected for purchase.');
    }

    await firstValueFrom(this.api.buyMarketplaceTicket(targetListingId, passengers));
    await this.loadMarketplace().catch(() => undefined);
    await this.loadTickets().catch(() => undefined);
    await this.loadBookings().catch(() => undefined);

    this.currentPaymentBooking = null;
    this.buyingMarketplaceTicketId = null;
  }

  async requestRefund(bookingId: number): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    await firstValueFrom(this.api.requestRefund(bookingId));

    // Optimistically update refund status
    this.myTickets = this.myTickets.map((ticket) =>
      ticket.id === bookingId
        ? { ...ticket, refundStatus: 'Requested' as const }
        : ticket,
    );

    await this.loadTickets().catch(() => undefined);
  }

  async cancelListing(listingId: number): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    await firstValueFrom(this.api.cancelMarketplaceListing(listingId));
    await this.loadTickets().catch(() => undefined);
    await this.loadMarketplace().catch(() => undefined);
    await this.loadBookings().catch(() => undefined);
  }

  async getPassengerQrPayload(bookingId: number, passengerId: number): Promise<string> {
    if (!this.isBrowser()) {
      return '';
    }

    return firstValueFrom(this.api.getPassengerQrPayload(bookingId, passengerId));
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
    profilePictureUrl?: string | null;
    idType?: number | string;
    idNumber?: string;
  }): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    const payload: any = {
      firstName: profile.firstName,
      familyName: profile.familyName,
      lastName: profile.lastName,
      email: profile.email,
      phoneNumber: profile.phoneNumber,
      profilePictureUrl: profile.profilePictureUrl ?? undefined,
    };

    // Only send identity fields if not already locked
    if (!this.userProfile.hasSetIdentityDetails && profile.idType !== undefined) {
      payload.idType = profile.idType;
      payload.idNumber = profile.idNumber;
    }

    await firstValueFrom(this.api.updateMyProfile(payload));

    this.userProfile = {
      ...this.userProfile,
      firstName: profile.firstName,
      familyName: profile.familyName,
      lastName: profile.lastName,
      email: profile.email ?? this.userProfile.email,
      phone: profile.phoneNumber ?? this.userProfile.phone,
      photo: profile.profilePictureUrl !== undefined ? profile.profilePictureUrl : this.userProfile.photo,
    };

    // Reload profile to get updated hasSetIdentityDetails from server
    await this.loadProfile().catch(() => undefined);
  }

  async uploadProfilePicture(file: File): Promise<string | null> {
    if (!this.isBrowser()) {
      return null;
    }

    const pictureUrl = await firstValueFrom(this.api.uploadProfilePicture(file));
    this.userProfile = {
      ...this.userProfile,
      photo: pictureUrl,
    };

    return pictureUrl;
  }

  private async loadCartSafe(): Promise<ActiveCartDto | null> {
    return firstValueFrom(this.api.getActiveCart()).catch(() => null);
  }

  private async loadTicketsSafe(): Promise<TicketDto[]> {
    return firstValueFrom(this.api.getMyTickets()).catch(() => []);
  }

  private extractLocation(obj1: any, obj2: any, prefix: 'origin' | 'destination'): string {
    const keys = [
      `${prefix}GovEn`, `${prefix}GovernorateEn`, `${prefix}Gov`, `${prefix}Governorate`,
      `${prefix}StationNameEn`, `${prefix}StationEn`, `${prefix}StationName`, `${prefix}Station`,
      `${prefix}Name`, `${prefix}`
    ];
    for (const obj of [obj1, obj2]) {
      if (!obj) continue;
      for (const k of keys) {
        if (obj[k] && typeof obj[k] === 'string' && obj[k].trim() !== '') {
          return obj[k].trim();
        }
      }
    }
    return 'Unknown';
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
      from: this.extractLocation(trip, null, 'origin'),
      to: this.extractLocation(trip, null, 'destination'),
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
    const dropoffDate = new Date(item.dropoffTime);

    return {
      id: item.bookingId,
      ticketId: item.bookingId,
      from: this.extractLocation(item, null, 'origin'),
      to: this.extractLocation(item, null, 'destination'),
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
      className: item.className,
      agencyName: item.agencyName,
      arrivalDate: dropoffDate.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
      arrivalTime: dropoffDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }

  private mapTicketToUiBooking(ticket: TicketDto): UiBooking {
    const boardingDate = new Date(ticket.boardingTime);
    const dropoffDate = new Date(ticket.dropoffTime);
    const normalizedStatus = ticket.status?.toLowerCase();

    const isRefundAccepted = ticket.refundStatus === 'Accepted' || ticket.refundStatus === 'Approved';

    const status: UiBooking['status'] = isRefundAccepted
      ? 'cancelled'
      : normalizedStatus === 'confirmed'
        ? (ticket.isOfferedForResale ? 'pending-sale' : 'confirmed')
        : normalizedStatus === 'pending-sale'
          ? 'pending-sale'
          : normalizedStatus === 'sold'
            ? 'sold'
            : normalizedStatus === 'cancelled'
              ? 'cancelled'
              : 'pending';

    const listingId = ticket.activeListingId ?? ticket.marketplaceListingId ?? ticket.listingId ?? null;

    const canResell =
      status === 'confirmed' &&
      !ticket.isMarketplacePurchase &&
      !ticket.isOfferedForResale &&
      listingId == null &&
      (ticket.refundStatus == null || ticket.refundStatus === 'Rejected');

    return {
      id: ticket.bookingId,
      ticketId: ticket.bookingId,
      ownerId: ticket.ownerId,
      from: this.extractLocation(ticket, null, 'origin'),
      to: this.extractLocation(ticket, null, 'destination'),
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
      status,
      seat: ticket.passengers.map((passenger) => passenger.seatNumber).join(', '),
      canResell,
      className: ticket.className,
      agencyName: ticket.agencyName,
      arrivalDate: dropoffDate.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
      arrivalTime: dropoffDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
      // Spec fields
      boardingTimeRaw: ticket.boardingTime,
      dropoffTimeRaw: ticket.dropoffTime,
      refundStatus: ticket.refundStatus,
      isMarketplacePurchase: ticket.isMarketplacePurchase ?? false,
      isOfferedForResale: ticket.isOfferedForResale ?? false,
      activeListingId: listingId,
      paymentStatus: ticket.paymentStatus,
      bookingDate: ticket.bookingDate,
      originGov: ticket.originGov,
      originStation: ticket.originStation,
      destinationGov: ticket.destinationGov,
      destinationStation: ticket.destinationStation,
      agencyNameAr: ticket.agencyNameAr,
      classNameAr: ticket.classNameAr,
      originGovernorateAr: ticket.originGovernorateAr,
      destinationGovernorateAr: ticket.destinationGovernorateAr,
      passengerList: ticket.passengers.map((p) => ({
        passengerId: p.passengerId,
        name: p.name,
        idNumber: p.idNumber,
        seatNumber: p.seatNumber,
      })),
    };
  }

  private markTicketPendingSale(bookingId: number): void {
    this.myTickets = this.myTickets.map((ticket) =>
      ticket.id === bookingId
        ? { ...ticket, status: 'pending-sale', canResell: false }
        : ticket,
    );

    this.bookings = this.bookings.map((booking) =>
      booking.id === bookingId
        ? { ...booking, status: 'pending-sale', canResell: false }
        : booking,
    );
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
      className: trip.className,
      agencyName: trip.agencyName,
      arrivalTime: trip.dropoffTime,
      arrivalDate: trip.date,
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

  private markBookingConfirmed(bookingId: number): void {
    this.localPendingBookings = this.localPendingBookings.filter((booking) => booking.id !== bookingId);

    const baseBooking =
      this.bookings.find((booking) => booking.id === bookingId) ||
      (this.currentPaymentBooking?.id === bookingId ? this.currentPaymentBooking : null);

    if (baseBooking) {
      const confirmedBooking: UiBooking = { ...baseBooking, status: 'confirmed' };
      this.localConfirmedBookings = this.mergeBookings([confirmedBooking, ...this.localConfirmedBookings]);
    }

    this.bookings = this.bookings.map((booking) =>
      booking.id === bookingId ? { ...booking, status: 'confirmed' } : booking,
    );
  }

  private confirmCartItems(): void {
    const confirmedCartBookings = this.localPendingBookings.map(b => ({ ...b, status: 'confirmed' as const }));
    this.localConfirmedBookings = this.mergeBookings([...confirmedCartBookings, ...this.localConfirmedBookings]);
    this.localPendingBookings = [];
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
      userId: profile.userId,
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
      photo: this.api.resolveProfilePictureUrl(profile.profilePictureUrl),
      memberSince: '',
      totalTrips: profile.totalTripsCount,
      totalDistanceTraveled: profile.totalDistanceTraveled ?? 0,
      walletBalance: profile.walletBalance,
      loyaltyPointsBalance: profile.loyaltyPointsBalance,
      expiringPointsAmount: profile.expiringPointsAmount ?? 0,
      nextExpiryDate: profile.nextExpiryDate ?? null,
      hasSetIdentityDetails: profile.hasSetIdentityDetails ?? false,
      idType: profile.idType ?? null,
      idNumber: profile.idNumber ?? null,
      activeChallenges: (profile.activeChallenges ?? []).map(c => ({
        challengeId: c.challengeId,
        title: c.title,
        currentProgress: c.currentProgress,
        goalValue: c.goalValue,
        rewardPoints: c.rewardPoints,
        isCompleted: c.isCompleted,
      })),
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
        ownerId: listing.ownerId,
        sellerId: listing.sellerId ?? listing.ownerId,
        from: this.extractLocation(listing.tripDetails, listing, 'origin'),
        to: this.extractLocation(listing.tripDetails, listing, 'destination'),
        date: dateLabel,
        time: timeLabel,
        duration: '',
        passengers: listing.seatsCount ?? listing.seatsBooked ?? 0,
        seat: '',
        originalPrice: listing.originalPrice,
        price: listing.askingPrice,
        status: 'available',
        sellerName: listing.sellerName,
        className: listing.tripDetails.class,
        agencyName: listing.agencyName ?? listing.agency ?? listing.tripDetails.agencyName,
        transportType: listing.transportType,
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

  public isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  public isTrainTrip(agencyName: any = '', transportType: any = ''): boolean {
    if (transportType === 2 || String(transportType) === '2') {
      return true;
    }
    if (transportType === 1 || String(transportType) === '1') {
      return false;
    }
    const agency = String(agencyName || '').toUpperCase();
    const type = String(transportType || '').toUpperCase();
    return type === 'TRAIN'
      || agency === 'EGYPTIAN NATIONAL RAILWAYS'
      || agency.includes('NATIONAL RAIL')
      || agency.includes('RAILWAY')
      || agency.includes('TRAIN')
      || agency.includes('ENR')
      || agency.includes('TALGO');
  }
}
