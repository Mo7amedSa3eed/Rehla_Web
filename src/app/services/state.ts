import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import {
  ActiveCartDto,
  AddToCartRequest,
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
import { AppLanguage, LanguageService } from '../core/i18n/language.service';

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

export function createEmptyUserProfile(): UserProfile {
  return {
    userId: 0,
    firstName: '',
    familyName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    gender: '',
    address: '',
    city: '',
    state: '',
    country: '',
    countryCode: '',
    memberSince: '',
    photo: null,
    totalTrips: 0,
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
  transport: string | number;
  agencyName: string;
  rawAgencyName?: string;
  price: number;
  seats: number;
  availableClasses: TripClassDto[];
  selectedFloorNumber?: number | null;
  selectedSeatType?: string;
  selectedSeats?: string[];
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
  status: 'pending' | 'confirmed' | 'completed' | 'pending-sale' | 'sold' | 'cancelled';
  rawStatus?: string;
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

export class DirectBookingError extends Error {
  constructor(message: string, public readonly cartAdded: boolean) {
    super(message);
    this.name = 'DirectBookingError';
  }
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
  private profileLoadPromise: Promise<void> | null = null;
  private activeCartLoadPromise: Promise<ActiveCartDto | null> | null = null;
  private lastSearchResultItems: TripSearchItemDto[] = [];
  private lastBookingsCart: ActiveCartDto | null = null;
  private lastBookingTickets: TicketDto[] = [];
  private lastMyTicketDtos: TicketDto[] = [];
  private lastMarketplaceResult: MarketplaceActiveListingsDto | null = null;
  private lastUserProfileDto: UserProfileDto | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly language: LanguageService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.language.language$.subscribe(() => this.refreshLocalizedState());
  }

  userProfile: UserProfile = createEmptyUserProfile();
  isProfileLoaded = false;
  isProfileLoading = false;
  profileLoadError = '';
  hasLoadedActiveCart = false;

  // Transport of the last search (1=bus,2=train)
  lastSearchTransport: number | null = null;

  // Seats selected by the user during seat selection
  selectedSeats: string[] = [];

  updateUserProfile(updated: UserProfile) {
    this.userProfile = { ...updated };
    this.isProfileLoaded = true;
    this.profileLoadError = '';
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

  resetProfile(): void {
    this.userProfile = createEmptyUserProfile();
    this.isProfileLoaded = false;
    this.isProfileLoading = false;
    this.profileLoadError = '';
  }

  resetSessionState(): void {
    this.resetProfile();
    this.bookings = [];
    this.myTickets = [];
    this.marketplace = [];
    this.localPendingBookings = [];
    this.localConfirmedBookings = [];
    this.walletHistory = [];
    this.activeCart = null;
    this.hasLoadedActiveCart = false;
    this.activeCartLoadPromise = null;
    this.lastSearchResultItems = [];
    this.lastBookingsCart = null;
    this.lastBookingTickets = [];
    this.lastMyTicketDtos = [];
    this.lastMarketplaceResult = null;
    this.lastUserProfileDto = null;
    this.currentPaymentBooking = null;
    this.buyingMarketplaceTicketId = null;
    this.selectedTicket = null;
    this.selectedSeats = [];
    this.selectedLegs = [];
    this.pendingPassengers = [];
    this.currentLegIndex = 0;
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

  searchTripsCurrentPage: number = 1;
  searchTripsTotalPages: number = 1;

  async searchTrips(criteria: {
    travelDate: string;
    fromGovernorate: string;
    fromStationId?: number;
    toGovernorate: string;
    toStationId?: number;
    passengers: number;
    transport?: number;
    preferredAgencies?: string[];
    pageNumber?: number;
    pageSize?: number;
    sortBy?: number;
    maxPrice?: number;
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
        pageNumber: criteria.pageNumber ?? 1,
        pageSize: criteria.pageSize ?? 10,
        sortBy: criteria.sortBy,
        maxPrice: criteria.maxPrice
      }),
    );

    this.lastSearchResultItems = primaryResult.items ?? [];
    this.searchResults = this.lastSearchResultItems.map((trip) => this.mapTripToUi(trip));
    this.searchTripsCurrentPage = primaryResult.currentPage || 1;
    this.searchTripsTotalPages = primaryResult.totalPages || 1;

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
    this.lastSearchResultItems = result.items ?? [];
    this.searchResults = this.lastSearchResultItems.map((trip) => this.mapTripToUi(trip));
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

    await this.cleanupActiveCartHolds();

    const failures: string[] = [];

    for (const payload of this.buildSelectedLegCartPayloads()) {
      try {
        await firstValueFrom(this.api.addToCart(payload));
      } catch (error) {
        failures.push(this.api.formatError(error, 'Failed to add leg to cart'));
      }
    }

    if (failures.length) {
      throw new Error([...new Set(failures)].join(', '));
    }

    this.clearSelectedBookingState();

    await this.loadBookings();
  }

  async bookSelectedLegsNow(pointsToRedeem = 0): Promise<void> {
    if (!this.isBrowser() || this.selectedLegs.length === 0) {
      return;
    }

    await this.cleanupActiveCartHolds();
    const payloads = this.buildSelectedLegCartPayloads();
    let cartAdded = false;

    try {
      for (const payload of payloads) {
        await firstValueFrom(this.api.addToCart(payload));
      }
      cartAdded = true;

      await firstValueFrom(this.api.checkout({
        paymentMethod: 'Wallet',
        pointsToRedeem: Math.max(0, Math.floor(pointsToRedeem || 0)),
      }));

      this.clearSelectedBookingState();
      await Promise.all([
        this.loadBookings(),
        this.loadTickets(),
        this.loadProfile().catch(() => undefined),
      ]);
      this.currentPaymentBooking = null;
      this.buyingMarketplaceTicketId = null;
    } catch (error) {
      await this.loadBookings().catch(() => undefined);

      if (cartAdded) {
        const message = this.api.formatError(error, 'Checkout failed');
        throw new DirectBookingError(`Trips were added to cart, but checkout failed. ${message}`, true);
      }

      throw new DirectBookingError(this.api.formatError(error, 'Failed to add trips to cart'), false);
    }
  }

  private async cleanupActiveCartHolds(): Promise<void> {
    try {
      const currentCart = await this.loadCartSafe();
      if (currentCart?.items?.length) {
        await Promise.all(currentCart.items.map((item) =>
          firstValueFrom(this.api.cancelCartHold(item.bookingId)).catch(() => undefined),
        ));
      }
    } catch (error) {
      console.warn('Failed to clean up old cart items', error);
    }
  }

  private buildSelectedLegCartPayloads(): AddToCartRequest[] {
    const draftPassengers =
      this.pendingPassengers.length >= this.searchPassengers
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

    return this.selectedLegs.map((leg) => {
      const isTrain = this.isTrainTrip(leg.rawAgencyName ?? leg.agencyName, leg.transport);
      const legPassengerCount = isTrain
        ? Math.max(1, this.searchPassengers)
        : Math.max(1, leg.selectedSeats?.length ?? 0);

      return {
        tripOccurrenceId: leg.tripOccurrenceId,
        coachClassId: leg.coachClassId,
        originStationId: leg.originStationId,
        destinationStationId: leg.destinationStationId,
        contactName,
        contactPhone,
        contactEmail,
        passengers: draftPassengers.slice(0, legPassengerCount).map((passenger, index) => {
          const payload: AddToCartRequest['passengers'][number] = {
            passengerName: passenger?.fullName?.trim() || `Passenger ${index + 1}`,
            seatNumber: isTrain ? `T-${index + 1}` : (leg.selectedSeats?.[index] || ''),
          };
          if (isTrain) {
            payload.idType = passenger?.idType || 'NationalId';
            payload.idNumber = passenger?.nationalId?.trim() || 'N/A';
          }
          return payload;
        }),
      };
    });
  }

  private clearSelectedBookingState(): void {
    this.selectedLegs = [];
    this.selectedSeats = [];
    this.pendingPassengers = [];
    this.currentLegIndex = 0;
    this.searchQueries = [];
    this.searchType = 'oneway';
  }

  async addTripToCart(trip: UiTrip): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    try {
      const seatMap = await firstValueFrom(this.api.getSeatMap(trip.tripOccurrenceId));
      const preferredClass = seatMap.classes.find((item) =>
        item.coachClassId === trip.coachClassId && item.remainingSeats >= this.searchPassengers
      );

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

      const isTrain = this.isTrainTrip(trip.rawAgencyName ?? trip.agencyName, trip.transport);

      await firstValueFrom(
        this.api.addToCart({
          tripOccurrenceId: trip.tripOccurrenceId,
          coachClassId: trip.coachClassId,
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
    this.lastBookingsCart = cart;
    this.lastBookingTickets = tickets;
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

    await firstValueFrom(this.api.checkout({ paymentMethod: 'Wallet', pointsToRedeem: 0 }));
    await this.loadBookings();
    await this.loadTickets();
    if (typeof this.buyingMarketplaceTicketId === 'number') {
      await firstValueFrom(this.api.buyMarketplaceTicket(this.buyingMarketplaceTicketId));
      await this.loadMarketplace().catch(() => undefined);
    }

    this.currentPaymentBooking = null;
    this.buyingMarketplaceTicketId = null;
  }

  async checkoutPoints(pointsToRedeem: number): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    await firstValueFrom(this.api.checkout({
      paymentMethod: 'Wallet',
      pointsToRedeem: Math.max(0, Math.floor(pointsToRedeem || 0)),
    }));
    await this.loadBookings();
    await this.loadTickets();
    await this.loadProfile().catch(() => undefined);

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
    this.lastMarketplaceResult = result;
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

    const tickets = await firstValueFrom(this.api.getMyTickets());
    this.lastMyTicketDtos = tickets;
    this.myTickets = this.mergeBookings([
      ...tickets.map((ticket) => this.mapTicketToUiBooking(ticket)),
      ...this.localConfirmedBookings,
    ]);
  }

  async loadProfile(): Promise<void> {
    if (!this.isBrowser()) {
      return;
    }

    if (this.profileLoadPromise) {
      return this.profileLoadPromise;
    }

    this.profileLoadPromise = this.fetchProfile();
    try {
      await this.profileLoadPromise;
    } finally {
      this.profileLoadPromise = null;
    }
  }

  async ensureProfileLoaded(): Promise<void> {
    if (this.isProfileLoaded) {
      return;
    }

    await this.loadProfile();
  }

  private async fetchProfile(): Promise<void> {
    this.isProfileLoading = true;
    this.profileLoadError = '';

    try {
      const profile = await firstValueFrom(this.api.getMyProfile());
      this.lastUserProfileDto = profile;
      this.userProfile = this.mapProfileToUi(profile);
      this.isProfileLoaded = true;
      this.profileLoadError = '';
    } catch (error) {
      this.profileLoadError = this.api.formatError(error, 'Could not load your profile. Please try again.');
      throw error;
    } finally {
      this.isProfileLoading = false;
    }
  }

  async loadActiveCart(): Promise<ActiveCartDto | null> {
    if (!this.isBrowser()) {
      return null;
    }

    if (this.activeCartLoadPromise) {
      return this.activeCartLoadPromise;
    }

    this.activeCartLoadPromise = firstValueFrom(this.api.getActiveCart());
    try {
      this.activeCart = await this.activeCartLoadPromise;
      this.hasLoadedActiveCart = true;
      return this.activeCart;
    } finally {
      this.activeCartLoadPromise = null;
    }
  }

  async ensureActiveCartLoaded(): Promise<void> {
    if (this.hasLoadedActiveCart) {
      return;
    }

    await this.loadActiveCart();
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
    return this.loadActiveCart().catch(() => null);
  }

  private async loadTicketsSafe(): Promise<TicketDto[]> {
    return firstValueFrom(this.api.getMyTickets()).catch(() => []);
  }

  private extractLocation(obj1: any, obj2: any, prefix: 'origin' | 'destination'): string {
    const englishKeys = [
      `${prefix}GovEn`, `${prefix}GovernorateEn`, `${prefix}Gov`, `${prefix}Governorate`,
      `${prefix}StationNameEn`, `${prefix}StationEn`, `${prefix}StationName`, `${prefix}Station`,
      `${prefix}Name`, `${prefix}`
    ];
    const arabicKeys = [
      `${prefix}GovAr`, `${prefix}GovernorateAr`, `${prefix}StationNameAr`, `${prefix}StationAr`,
      `${prefix}NameAr`, `${prefix}Ar`
    ];
    const keys = this.language.currentLanguage === 'ar'
      ? [...arabicKeys, ...englishKeys]
      : englishKeys;

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
    const firstClass = this.firstAvailableClass(trip.availableClasses);
    const transportType = this.extractTransportType(trip);
    const boardingDate = new Date(trip.boardingTime);
    const dropoffDate = new Date(trip.dropoffTime);
    const departureDate = new Date(trip.departureTime);
    const arrivalDate = new Date(trip.arrivalTime);
    const locale = this.language.currentLocale;
    const isArabic = this.language.currentLanguage === 'ar';
    const className = this.localizedField(firstClass, isArabic, {
      keys: ['className', 'name'],
      arabicKeys: ['classNameAr', 'nameAr'],
      fallback: 'N/A',
    });
    const agencyName = this.localizedField(trip, isArabic, {
      keys: ['agencyName'],
      arabicKeys: ['agencyNameAr', 'agencyAr'],
      fallback: trip.agencyName,
    });

    return {
      id: trip.tripOccurrenceId,
      tripOccurrenceId: trip.tripOccurrenceId,
      tripId: trip.tripId,
      coachClassId: firstClass?.coachClassId ?? 0,
      className,
      originStationId: trip.originStationId,
      originStationName: trip.originStationName,
      destinationStationId: trip.destinationStationId,
      destinationStationName: trip.destinationStationName,
      from: this.extractLocation(trip, null, 'origin'),
      to: this.extractLocation(trip, null, 'destination'),
      date: boardingDate.toLocaleDateString(locale, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
      time: boardingDate.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }),
      dropoffTime: dropoffDate.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }),
      departureTime: departureDate.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }),
      arrivalTime: arrivalDate.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }),
      duration: this.formatDuration(trip.totalDurationMinutes),
      transport: transportType ?? agencyName,
      agencyName,
      rawAgencyName: trip.agencyName,
      price: firstClass?.price ?? trip.startingPrice,
      seats: firstClass?.remainingSeats ?? 0,
      availableClasses: trip.availableClasses ?? [],
      selectedFloorNumber: this.extractFloorNumber(firstClass?.className ?? className),
      selectedSeatType: this.extractSeatType(firstClass?.className ?? className),
      routeStops: trip.routeStops ?? [],
    };
  }

  private extractTransportType(trip: TripSearchItemDto): string | number | null {
    const rawTrip = trip as TripSearchItemDto & {
      transport?: string | number | null;
      transportType?: string | number | null;
    };

    return rawTrip.transportType ?? rawTrip.transport ?? null;
  }

  private firstAvailableClass(classes: TripClassDto[] | null | undefined): TripClassDto | undefined {
    return (classes ?? []).find((item) => item.remainingSeats > 0) ?? classes?.[0];
  }

  private extractFloorNumber(className: string): number | null {
    const match = /(?:floor|deck|level)\s*(\d+)/i.exec(className);
    return match ? Number(match[1]) : null;
  }

  private extractSeatType(className: string): string {
    const floorMatch = /floor\s*\d+\s+(\w+)/i.exec(className);
    if (floorMatch) return floorMatch[1];

    const parts = className.trim().split(/[\s-]+/).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : className;
  }

  private mapCartItemToUiBooking(item: CartItemDto): UiBooking {
    const boardingDate = item.boardingTime ? new Date(item.boardingTime) : null;
    const dropoffDate = item.dropoffTime ? new Date(item.dropoffTime) : null;
    const locale = this.language.currentLocale;
    const isArabic = this.language.currentLanguage === 'ar';

    return {
      id: item.bookingId,
      ticketId: item.bookingId,
      from: this.extractLocation(item, null, 'origin'),
      to: this.extractLocation(item, null, 'destination'),
      date: boardingDate ? boardingDate.toLocaleDateString(locale, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }) : '',
      time: boardingDate ? boardingDate.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }) : '',
      duration: item.boardingTime && item.dropoffTime ? this.durationFromTimes(item.boardingTime, item.dropoffTime) : '',
      passengers: item.seatsBooked,
      price: item.totalPrice,
      originalPrice: item.totalPrice,
      status: 'pending',
      seat: (item.passengers ?? []).map((passenger) => passenger.seatNumber || '').filter(Boolean).join(', '),
      className: this.localizedField(item, isArabic, {
        keys: ['className'],
        arabicKeys: ['classNameAr'],
        fallback: item.className || '',
      }),
      agencyName: this.localizedField(item, isArabic, {
        keys: ['agencyName'],
        arabicKeys: ['agencyNameAr'],
        fallback: item.agencyName || '',
      }),
      arrivalDate: dropoffDate ? dropoffDate.toLocaleDateString(locale, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }) : '',
      arrivalTime: dropoffDate ? dropoffDate.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }) : '',
    };
  }

  private mapTicketToUiBooking(ticket: TicketDto): UiBooking {
    const boardingDate = new Date(ticket.boardingTime);
    const dropoffDate = new Date(ticket.dropoffTime);
    const normalizedStatus = ticket.status?.toLowerCase();
    const locale = this.language.currentLocale;
    const isArabic = this.language.currentLanguage === 'ar';

    const isRefundAccepted = ticket.refundStatus === 'Accepted' || ticket.refundStatus === 'Approved';

    const status: UiBooking['status'] = isRefundAccepted
      ? 'cancelled'
      : normalizedStatus === 'confirmed'
        ? (ticket.isOfferedForResale ? 'pending-sale' : 'confirmed')
        : normalizedStatus === 'completed'
          ? 'completed'
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
      date: boardingDate.toLocaleDateString(locale, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
      time: boardingDate.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }),
      duration: this.durationFromTimes(ticket.boardingTime, ticket.dropoffTime),
      passengers: ticket.seatsBooked,
      price: ticket.totalPrice,
      originalPrice: ticket.totalPrice,
      status,
      rawStatus: ticket.status,
      seat: ticket.passengers.map((passenger) => passenger.seatNumber).join(', '),
      canResell,
      className: this.localizedField(ticket, isArabic, {
        keys: ['className'],
        arabicKeys: ['classNameAr'],
        fallback: ticket.className,
      }),
      agencyName: this.localizedField(ticket, isArabic, {
        keys: ['agencyName'],
        arabicKeys: ['agencyNameAr'],
        fallback: ticket.agencyName,
      }),
      arrivalDate: dropoffDate.toLocaleDateString(locale, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
      arrivalTime: dropoffDate.toLocaleTimeString(locale, {
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
        name: p.name || p.passengerName || '',
        idNumber: p.idNumber || '',
        seatNumber: p.seatNumber || '',
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
    const isArabic = this.language.currentLanguage === 'ar';

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
      country: this.localizedField(profile, isArabic, {
        keys: ['countryName'],
        arabicKeys: ['countryNameAr'],
        fallback: profile.countryName,
      }),
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
        title: this.localizedField(c, isArabic, {
          keys: ['title'],
          arabicKeys: ['titleAr'],
          fallback: c.title,
        }),
        currentProgress: c.currentProgress,
        goalValue: c.goalValue,
        rewardPoints: c.rewardPoints,
        isCompleted: c.isCompleted,
      })),
    };
  }

  private localizedField(
    source: any,
    isArabic: boolean,
    options: { keys: string[]; arabicKeys: string[]; fallback?: string | null }
  ): string {
    if (!source) return options.fallback || '';
    if (isArabic) {
      for (const key of options.arabicKeys) {
        const value = String(source[key] ?? '').trim();
        if (value) return value;
      }
    }
    for (const key of options.keys) {
      const value = String(source[key] ?? '').trim();
      if (value) return value;
    }
    return (options.fallback ?? '').trim();
  }

  private cleanClassName(raw: string): string {
    const seen = new Set<string>();
    return raw
      .split(' - ')
      .filter(part => {
        const trimmed = part.trim();
        if (seen.has(trimmed)) return false;
        seen.add(trimmed);
        return true;
      })
      .join(' - ');
  }

  private mapMarketplaceToUi(result: MarketplaceActiveListingsDto): MarketplaceListing[] {
    const activeLanguage = this.getActiveLanguage();
    const isArabic = activeLanguage === 'ar';
    const activeLocale = isArabic ? 'ar-EG' : 'en-US';

    return (result.items ?? []).map((listing) => {
      const trip = listing.tripDetails ?? {};
      const time = trip.time ? new Date(trip.time) : new Date();

      const dateLabel = time.toLocaleDateString(activeLocale, {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      });

      const timeLabel = time.toLocaleTimeString(activeLocale, {
        hour: '2-digit',
        minute: '2-digit',
      });

      const originGov = this.localizedField(trip, isArabic, {
        keys: ['originGovEn', 'originGovernorate', 'originGov'],
        arabicKeys: ['originGovAr', 'originGovernorateAr'],
      });
      const destinationGov = this.localizedField(trip, isArabic, {
        keys: ['destinationGovEn', 'destinationGovernorate', 'destinationGov'],
        arabicKeys: ['destinationGovAr', 'destinationGovernorateAr'],
      });
      const originCity = this.localizedField(trip, isArabic, {
        keys: ['originStationNameEn', 'origin', 'originStation', 'originName'],
        arabicKeys: ['originAr', 'originStationNameAr', 'originNameAr'],
      });
      const destinationCity = this.localizedField(trip, isArabic, {
        keys: ['destinationStationNameEn', 'destination', 'destinationStation', 'destinationName'],
        arabicKeys: ['destinationAr', 'destinationStationNameAr', 'destinationNameAr'],
      });
      const agencyName = this.localizedField(trip, isArabic, {
        keys: ['agencyName'],
        arabicKeys: ['agencyNameAr', 'agencyAr'],
        fallback: (listing as any).agency ?? '',
      });
      const className = this.cleanClassName(
        this.localizedField(trip, isArabic, {
          keys: ['class'],
          arabicKeys: ['classNameAr', 'classAr'],
          fallback: 'Standard',
        })
      );

      const fromLabel = originGov || originCity || 'Unknown';
      const toLabel = destinationGov || destinationCity || 'Unknown';

      // Reformat seller name from "First Family Last" to "First Last Family"
      let formattedSellerName = listing.sellerName || 'Seller';
      const nameParts = formattedSellerName.split(' ').filter(p => p.trim().length > 0);
      if (nameParts.length >= 3 && formattedSellerName !== 'Seller') {
        const first = nameParts[0];
        const last = nameParts[nameParts.length - 1];
        const family = nameParts.slice(1, nameParts.length - 1).join(' ');
        formattedSellerName = `${first} ${last} ${family}`;
      }

      return {
        listingId: listing.listingId,
        ticketId: listing.listingId,
        ownerId: listing.ownerId,
        sellerId: listing.sellerId ?? listing.ownerId,
        from: fromLabel,
        to: toLabel,
        originCity: originCity || null,
        destinationCity: destinationCity || null,
        originGov: originGov || null,
        destinationGov: destinationGov || null,
        date: dateLabel,
        time: timeLabel,
        duration: '',
        passengers: listing.seatsCount ?? listing.seatsBooked ?? 0,
        seat: '',
        originalPrice: Number(listing.originalPrice ?? 0),
        price: Number(listing.askingPrice ?? 0),
        status: 'available',
        sellerName: formattedSellerName,
        className: className,
        agencyName: agencyName,
        transportType: listing.transportType,
      };
    });
  }

  private getActiveLanguage(): AppLanguage {
    return this.language.currentLanguage;
  }

  private refreshLocalizedState(): void {
    if (this.lastUserProfileDto) {
      this.userProfile = this.mapProfileToUi(this.lastUserProfileDto);
    }

    if (this.lastSearchResultItems.length) {
      this.searchResults = this.lastSearchResultItems.map((trip) => this.mapTripToUi(trip));
    }

    if (this.lastBookingsCart || this.lastBookingTickets.length || this.localConfirmedBookings.length) {
      const pending = (this.lastBookingsCart?.items ?? []).map((item) => this.mapCartItemToUiBooking(item));
      const offlinePending = this.localPendingBookings.filter(b => b.id < 0);
      this.localPendingBookings = [...pending, ...offlinePending];
      const confirmed = this.lastBookingTickets.map((ticket) => this.mapTicketToUiBooking(ticket));
      this.bookings = this.mergeBookings([
        ...this.localPendingBookings,
        ...confirmed,
        ...this.localConfirmedBookings,
      ]);
    }

    if (this.lastMyTicketDtos.length) {
      this.myTickets = this.mergeBookings([
        ...this.lastMyTicketDtos.map((ticket) => this.mapTicketToUiBooking(ticket)),
        ...this.localConfirmedBookings,
      ]);
    }

    if (this.lastMarketplaceResult) {
      this.marketplace = this.mapMarketplaceToUi(this.lastMarketplaceResult);
    }
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
    const agency = String(agencyName || '').toUpperCase();
    const type = String(transportType || '').toUpperCase();
    const isKnownTrainAgency = agency === 'EGYPTIAN NATIONAL RAILWAYS'
      || agency.includes('NATIONAL RAIL')
      || agency.includes('RAILWAY')
      || agency.includes('TRAIN')
      || agency.includes('ENR')
      || agency.includes('TALGO')
      || agency.includes('السكة')
      || agency.includes('الحديد')
      || agency.includes('قطار');
    if (isKnownTrainAgency) {
      return true;
    }

    const isKnownBusAgency = agency.includes('BUS')
      || agency.includes('BLUEBUS')
      || agency.includes('GO BUS')
      || agency.includes('GOBUS')
      || agency.includes('SUPER JET')
      || agency.includes('سوبر جيت')
      || agency.includes('اتوبيس')
      || agency.includes('باص');
    if (isKnownBusAgency) {
      return false;
    }

    if (transportType === 2 || String(transportType) === '2') {
      return true;
    }
    if (transportType === 1 || String(transportType) === '1') {
      return false;
    }

    return type === 'TRAIN'
      || type === 'ENR';
  }
}
