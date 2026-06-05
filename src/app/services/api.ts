import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors: unknown;
  timestamp: string;
}

export interface AuthUserDto {
  userId: number;
  email: string;
  fullName: string;
  phoneNumber: string;
  gender: string;
  countryCode: string;
  countryName: string;
  profilePictureUrl: string | null;
  roles: string[];
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUserDto;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  familyName: string;
  gender: number;
  dateOfBirth: string;
  nationalIdNumber?: string;
  countryCode: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RevokeTokenRequest {
  refreshToken: string;
}

export interface VerifyEmailRequest {
  userId: string;
  token: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface AuthMeDto {
  userId: string;
  email: string;
  name: string;
  claims: { type: string; value: string }[];
}

export interface StationDto {
  id: number;
  arabicName: string;
  englishName: string;
  slug: string;
  city: string;
}

export interface StationGroupDto {
  governorate: string;
  stations: StationDto[];
}

export interface CountryDto {
  countryCode: string;
  countryName: string;
  nationalityName: string;
  phoneCode: string;
  allowsTrainBooking: boolean;
}

export interface TripClassDto {
  coachClassId: number;
  className: string;
  remainingSeats: number;
  price: number;
}

export interface RouteStopDto {
  stationName: string;
  arrivalTime: string | null;
  departureTime: string | null;
  stopSequence: number;
}

export interface TripSearchItemDto {
  tripOccurrenceId: number;
  tripId: number;
  agencyName: string;
  boardingTime: string;
  dropoffTime: string;
  departureTime: string;
  arrivalTime: string;
  totalDurationMinutes: number;
  originStationId: number;
  originStationName: string;
  originGovernorate: string;
  destinationStationId: number;
  destinationStationName: string;
  destinationGovernorate: string;
  startingPrice: number;
  routeStops?: RouteStopDto[];
  availableClasses: TripClassDto[];
}

export interface IndirectLegDto extends TripSearchItemDto {}

export interface IndirectTripItemDto {
  totalDurationMinutes: number;
  layoverDurationMinutes: number;
  totalStartingPrice: number;
  legs: IndirectLegDto[];
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface SeatDto {
  seatNumber: string;
  status: 'Available' | 'Pending' | 'Booked' | string;
  bookingId?: number | null;
  holdExpiresAt?: string | null;
}

export interface OccurrenceClassDto {
  coachClassId: number;
  className: string;
  remainingSeats: number;
  totalSeats?: number;
  layoutType?: string | null;
  deckCount?: number;
  seatMapJson?: string | null;
  availableCount?: number;
  pendingCount?: number;
  bookedCount?: number;
  seats: SeatDto[];
}

export interface SeatMapDto {
  occurrenceId: number;
  generatedAtUtc?: string;
  classes: OccurrenceClassDto[];
}

export interface AddToCartPassengerDto {
  seatNumber?: string;
  passengerName?: string;
  idType?: 'NationalId' | 'Passport' | 'DrivingLicense' | 'StudentId' | 'Other';
  idNumber?: string;
}

export interface AddToCartRequest {
  tripOccurrenceId: number;
  coachClassId: number;
  originStationId: number;
  destinationStationId: number;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  passengers: AddToCartPassengerDto[];
}

export interface CartPassengerDto {
  passengerId?: number;
  name: string;
  idNumber: string;
  seatNumber: string;
}

export interface CartItemDto {
  bookingId: number;
  totalPrice: number;
  seatsBooked: number;
  holdExpiresAt: string;
  agencyName: string;
  className: string;
  origin: string;
  destination: string;
  boardingTime: string;
  dropoffTime: string;
  passengers: CartPassengerDto[];
}

export interface ActiveCartDto {
  items: CartItemDto[];
  grandTotal: number;
}

export interface TicketDto {
  bookingId: number;
  userId?: number;
  ownerId?: number;
  status: string;
  paymentStatus: string;
  totalPrice: number;
  seatsBooked: number;
  bookingDate: string;
  isMarketplacePurchase?: boolean;
  isOfferedForResale?: boolean;
  activeListingId?: number | null;
  marketplaceListingId?: number | null;
  listingId?: number | null;
  refundStatus?: 'Requested' | 'Accepted' | 'Approved' | 'Rejected' | string | null;
  agencyName: string;
  agencyNameAr?: string | null;
  className: string;
  classNameAr?: string | null;
  originGov?: string;
  originGovernorateAr?: string | null;
  originStation: string;
  originStationNameAr?: string | null;
  destinationGov?: string;
  destinationGovernorateAr?: string | null;
  destinationStation: string;
  destinationStationNameAr?: string | null;
  boardingTime: string;
  dropoffTime: string;
  passengers: CartPassengerDto[];
}

export interface UserProfileDto {
  userId: number;
  firstName: string;
  familyName: string | null;
  lastName: string;
  email: string;
  phoneNumber: string;
  gender: string;
  profilePictureUrl: string | null;
  countryCode: string;
  countryName: string;
  totalTripsCount: number;
  loyaltyPointsBalance: number;
  expiringPointsAmount: number;
  nextExpiryDate: string | null;
  activeChallenges: UserChallengeDto[];
  walletBalance: number;
  idType?: number | 'NationalId' | 'Passport' | string | null;
  idNumber?: string | null;
  hasSetIdentityDetails?: boolean;
  preferredLanguage?: string;
  // Kept optional for backward compatibility with older DTOs.
  totalDistanceTraveled?: number;
}

export interface UserChallengeDto {
  challengeId: number;
  title: string;
  description: string;
  type: number | string;
  frequency: number | string;
  currentProgress: number;
  goalValue: number;
  rewardPoints: number;
  isCompleted?: boolean;
}

export interface UpdateProfileRequest {
  firstName: string;
  familyName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  profilePictureUrl?: string | null;
  idType?: number | string;
  idNumber?: string;
}

export interface SearchTripsParams {
  travelDate: string;
  fromGovernorate: string;
  fromStationId?: number;
  toGovernorate: string;
  toStationId?: number;
  passengers: number;
  transport?: number;
  sortBy?: number;
  maxPrice?: number;
  preferredAgencies?: string[];
  pageNumber?: number;
  pageSize?: number;
}

export interface IndirectSearchParams extends SearchTripsParams {}

export interface WalletDepositRequest {
  amount: number;
  mockCardNumber: string;
  expiryDate: string;
  cvv: string;
}

export interface CheckoutRequest {
  paymentMethod: 'Wallet' | 'Points';
  pointsToRedeem?: number;
}

export interface WalletHistoryItemDto {
  id: number;
  amount: number;
  type: string;
  description: string;
  bookingId: number | null;
  createdAt: string;
}

export interface MarketplaceListRequest {
  bookingId: number;
  askingPrice: number;
}

export interface PointTransactionDto {
  transactionId: number;
  amount: number;
  description: string;
  source: string;
  status: string;
  createdAt: string;
}

export interface CreateSupportTicketRequest {
  title: string;
  description: string;
  issueCategory: number;
}

export interface SupportTicketDto {
  ticketId: number;
  title: string;
  description: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface MarketplaceTripDetailsDto {
  origin: string;
  destination: string;
  originGov?: string;
  destinationGov?: string;
  time: string;
  class: string;
  agencyName?: string;
}

export interface MarketplaceListingDto {
  listingId: number;
  sellerId?: number;
  ownerId?: number;
  originalPrice: number;
  askingPrice: number;
  sellerName: string;
  agencyName?: string;
  agency?: string;
  seatsCount: number;
  seatsBooked?: number;
  transportType?: string;
  tripDetails: MarketplaceTripDetailsDto;
}

export interface MarketplaceActiveListingsDto {
  items: MarketplaceListingDto[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface PopularRouteDto {
  originGov: string;
  destinationGov: string;
}

export interface LoyaltyHistoryItemDto {
  transactionId: number;
  amount: number;
  description: string;
  source: string;
  status: string;
  createdAt: string;
}

export interface LoyaltyHistoryPagedDto {
  items: LoyaltyHistoryItemDto[];
  totalCount: number;
  pageSize: number;
  totalPages: number;
  currentPage: number;
}

export interface LoyaltyChallengesPagedDto {
  items: UserChallengeDto[];
  totalCount: number;
  pageSize: number;
  totalPages: number;
  currentPage: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  // Use the shared production/development backend base URL.
  private readonly baseUrl = 'https://rehlabussines2-001-site1.anytempurl.com/api';
  private readonly publicBaseUrl = 'https://rehlabussines2-001-site1.anytempurl.com';

  constructor(private readonly http: HttpClient) {}

  getStations(): Observable<StationGroupDto[]> {
    return this.http
      .get<ApiResponse<StationGroupDto[]>>(`${this.baseUrl}/Stations`)
      .pipe(map((response) => this.unwrap(response)));
  }

  getCountries(): Observable<CountryDto[]> {
    return this.http
      .get<ApiResponse<CountryDto[]>>(`${this.baseUrl}/Countries`)
      .pipe(map((response) => this.unwrap(response)));
  }

  register(payload: RegisterRequest): Observable<AuthTokensDto> {
    return this.http
      .post<ApiResponse<AuthTokensDto>>(`${this.baseUrl}/Auth/register`, payload)
      .pipe(map((response) => this.unwrap(response)));
  }

  login(payload: LoginRequest): Observable<AuthTokensDto> {
    return this.http
      .post<ApiResponse<AuthTokensDto>>(`${this.baseUrl}/Auth/login`, payload)
      .pipe(map((response) => this.unwrap(response)));
  }

  refreshToken(payload: RefreshTokenRequest): Observable<AuthTokensDto> {
    return this.http
      .post<ApiResponse<AuthTokensDto>>(`${this.baseUrl}/Auth/refresh`, payload)
      .pipe(map((response) => this.unwrap(response)));
  }

  revokeToken(payload: RevokeTokenRequest): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/Auth/revoke`, payload)
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  revokeAllTokens(): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/Auth/revoke-all`, null, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  getAuthMe(): Observable<AuthMeDto> {
    return this.http
      .get<ApiResponse<AuthMeDto>>(`${this.baseUrl}/Auth/me`, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  sendVerificationEmail(payload: { email: string }): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/Auth/send-verification-email`, payload)
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  verifyEmail(payload: VerifyEmailRequest): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/Auth/verify-email`, payload)
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/Auth/forgot-password`, payload)
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  resetPassword(payload: ResetPasswordRequest): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/Auth/reset-password`, payload)
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  changePassword(payload: ChangePasswordRequest): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/Auth/change-password`, payload, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  searchTrips(params: SearchTripsParams): Observable<PagedResult<TripSearchItemDto>> {
    let httpParams = new HttpParams()
      .set('travelDate', params.travelDate)
      .set('fromGovernorate', params.fromGovernorate)
      .set('toGovernorate', params.toGovernorate)
      .set('passengers', String(params.passengers))
      .set('pageNumber', String(params.pageNumber ?? 1))
      .set('pageSize', String(params.pageSize ?? 10));

    if (typeof params.fromStationId === 'number') {
      httpParams = httpParams.set('fromStationId', String(params.fromStationId));
    }

    if (typeof params.toStationId === 'number') {
      httpParams = httpParams.set('toStationId', String(params.toStationId));
    }

    if (typeof params.transport === 'number') {
      httpParams = httpParams.set('transport', String(params.transport));
    }

    if (typeof params.sortBy === 'number') {
      httpParams = httpParams.set('sortBy', String(params.sortBy));
    }

    if (typeof params.maxPrice === 'number') {
      httpParams = httpParams.set('maxPrice', String(params.maxPrice));
    }

    if (params.preferredAgencies && params.preferredAgencies.length) {
      params.preferredAgencies.forEach((agency) => {
        httpParams = httpParams.append('preferredAgencies', agency);
      });
    }

    return this.http
      .get<ApiResponse<PagedResult<TripSearchItemDto>>>(`${this.baseUrl}/trips/search`, {
        params: httpParams,
      })
      .pipe(
        map((response) => this.unwrap(response)),
        // Keep compatibility with older deployments that still expose the alias endpoint.
        catchError((error: { status?: number }) => {
          if (error?.status !== 404) {
            return throwError(() => error);
          }

          return this.http
            .get<ApiResponse<PagedResult<TripSearchItemDto>>>(`${this.baseUrl}/Search`, {
              params: httpParams,
            })
            .pipe(map((response) => this.unwrap(response)));
        }),
      );
  }

  searchIndirectTrips(params: IndirectSearchParams): Observable<PagedResult<IndirectTripItemDto>> {
    let httpParams = new HttpParams()
      .set('travelDate', params.travelDate)
      .set('fromGovernorate', params.fromGovernorate)
      .set('toGovernorate', params.toGovernorate)
      .set('passengers', String(params.passengers))
      .set('pageNumber', String(params.pageNumber ?? 1))
      .set('pageSize', String(params.pageSize ?? 10));

    if (typeof params.fromStationId === 'number') {
      httpParams = httpParams.set('fromStationId', String(params.fromStationId));
    }

    if (typeof params.toStationId === 'number') {
      httpParams = httpParams.set('toStationId', String(params.toStationId));
    }

    if (typeof params.transport === 'number') {
      httpParams = httpParams.set('transport', String(params.transport));
    }

    if (typeof params.sortBy === 'number') {
      httpParams = httpParams.set('sortBy', String(params.sortBy));
    }

    if (typeof params.maxPrice === 'number') {
      httpParams = httpParams.set('maxPrice', String(params.maxPrice));
    }

    if (params.preferredAgencies && params.preferredAgencies.length) {
      params.preferredAgencies.forEach((agency) => {
        httpParams = httpParams.append('preferredAgencies', agency);
      });
    }

    return this.http
      .get<ApiResponse<PagedResult<IndirectTripItemDto>>>(`${this.baseUrl}/trips/search/indirect`, {
        params: httpParams,
      })
      .pipe(
        map((response) => this.unwrap(response)),
        catchError((error: { status?: number }) => {
          if (error?.status !== 404) {
            return throwError(() => error);
          }

          return this.http
            .get<ApiResponse<PagedResult<IndirectTripItemDto>>>(`${this.baseUrl}/Search/indirect`, {
              params: httpParams,
            })
            .pipe(map((response) => this.unwrap(response)));
        }),
      );
  }

  getSeatMap(occurrenceId: number): Observable<SeatMapDto> {
    return this.http
      .get<ApiResponse<SeatMapDto>>(`${this.baseUrl}/occurrences/${occurrenceId}/seats`)
      .pipe(map((response) => this.unwrap(response)));
  }

  addToCart(payload: AddToCartRequest): Observable<ActiveCartDto> {
    return this.http
      .post<ApiResponse<ActiveCartDto>>(`${this.baseUrl}/Bookings/cart`, payload, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  getActiveCart(): Observable<ActiveCartDto | null> {
    return this.http
      .get<ApiResponse<ActiveCartDto | null>>(`${this.baseUrl}/Bookings/cart`, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  checkoutWallet(): Observable<string> {
    return this.http
      .post<ApiResponse<string>>(
        `${this.baseUrl}/Bookings/checkout`,
        { paymentMethod: 'Wallet' },
        { headers: this.authHeaders() },
      )
      .pipe(map((response) => this.unwrap(response)));
  }

  checkoutPoints(pointsToRedeem: number): Observable<string> {
    return this.http
      .post<ApiResponse<string>>(
        `${this.baseUrl}/Bookings/checkout`,
        {
          paymentMethod: 'Points',
          pointsToRedeem,
        },
        { headers: this.authHeaders() },
      )
      .pipe(map((response) => this.unwrap(response)));
  }

  getMyTickets(): Observable<TicketDto[]> {
    return this.http
      .get<ApiResponse<TicketDto[]>>(`${this.baseUrl}/Bookings/my-tickets`, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  cancelCartHold(bookingId: number): Observable<void> {
    return this.http
      .delete<ApiResponse<null>>(`${this.baseUrl}/Bookings/bookings/${bookingId}`, {
        headers: this.authHeaders(),
      })
      .pipe(
        map((response) => {
          this.unwrap(response);
        }),
      );
  }

  getMyProfile(): Observable<UserProfileDto> {
    return this.http
      .get<ApiResponse<UserProfileDto>>(`${this.baseUrl}/Users/me`, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  updateMyProfile(payload: UpdateProfileRequest): Observable<void> {
    return this.http
      .put<ApiResponse<null>>(`${this.baseUrl}/Users/me`, payload, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  uploadProfilePicture(file: File): Observable<string | null> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<{ profilePictureUrl: string }>>(`${this.baseUrl}/Users/me/profile-picture`, formData, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => this.resolveProfilePictureUrl(this.unwrap(response).profilePictureUrl ?? null)));
  }

  resolveProfilePictureUrl(path: string | null | undefined): string | null {
    if (!path) {
      return null;
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${this.publicBaseUrl}/${path.replace(/^\/+/, '')}`;
  }

  depositToWallet(payload: WalletDepositRequest): Observable<string> {
    return this.http
      .post<ApiResponse<string>>(`${this.baseUrl}/Wallet/deposit`, payload, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  getWalletHistory(): Observable<WalletHistoryItemDto[]> {
    return this.http
      .get<ApiResponse<WalletHistoryItemDto[]>>(`${this.baseUrl}/Wallet/history`, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  listTicketOnMarketplace(payload: MarketplaceListRequest): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/Marketplace/list`, payload, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  updateTicketStatus(payload: MarketplaceListRequest): Observable<void> {
    return this.listTicketOnMarketplace(payload);
  }

  transferOwnership(listingId: number): Observable<void> {
    return this.buyMarketplaceTicket(listingId);
  }

  buyMarketplaceTicket(listingId: number, passengers?: { passengerName: string; idType?: string; idNumber?: string }[]): Observable<void> {
    const body = passengers ? { passengers } : null;
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/Marketplace/buy/${listingId}`, body, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  cancelMarketplaceListing(listingId: number): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/Marketplace/cancel/${listingId}`, null, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  getPassengerQrPayload(bookingId: number, passengerId: number): Observable<string> {
    return this.http
      .get<ApiResponse<string>>(`${this.baseUrl}/Bookings/${bookingId}/passengers/${passengerId}/qr-payload`, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  requestRefund(bookingId: number): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.baseUrl}/Bookings/${bookingId}/refund-request`, {}, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => {
        this.unwrap(response);
      }));
  }

  getMarketplaceListings(params?: {
    pageNumber?: number;
    pageSize?: number;
    originStationId?: number;
    destinationStationId?: number;
    originGovernorate?: string;
    destinationGovernorate?: string;
    travelDate?: string;
  }): Observable<MarketplaceActiveListingsDto> {
    let httpParams = new HttpParams();

    if (params) {
      if (typeof params.pageNumber === 'number') {
        httpParams = httpParams.set('pageNumber', String(params.pageNumber));
      }

      if (typeof params.pageSize === 'number') {
        httpParams = httpParams.set('pageSize', String(params.pageSize));
      }

      if (typeof params.originStationId === 'number') {
        httpParams = httpParams.set('originStationId', String(params.originStationId));
      }

      if (typeof params.destinationStationId === 'number') {
        httpParams = httpParams.set('destinationStationId', String(params.destinationStationId));
      }

      if (params.originGovernorate) {
        httpParams = httpParams.set('originGovernorate', params.originGovernorate);
      }

      if (params.destinationGovernorate) {
        httpParams = httpParams.set('destinationGovernorate', params.destinationGovernorate);
      }

      if (params.travelDate) {
        httpParams = httpParams.set('travelDate', params.travelDate);
      }
    }

    return this.http
      .get<ApiResponse<MarketplaceActiveListingsDto>>(`${this.baseUrl}/Marketplace/active`, {
        params: httpParams,
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  getPopularRoutes(): Observable<PopularRouteDto[]> {
    return this.http
      .get<ApiResponse<PopularRouteDto[]>>(`${this.baseUrl}/trips/popular-routes`)
      .pipe(map((response) => this.unwrap(response)));
  }

  getLoyaltyHistory(params?: { pageNumber?: number; pageSize?: number }): Observable<LoyaltyHistoryPagedDto> {
    let httpParams = new HttpParams();
    if (params) {
      if (typeof params.pageNumber === 'number') {
        httpParams = httpParams.set('pageNumber', String(params.pageNumber));
      }
      if (typeof params.pageSize === 'number') {
        httpParams = httpParams.set('pageSize', String(params.pageSize));
      }
    }

    return this.http
      .get<ApiResponse<LoyaltyHistoryPagedDto>>(`${this.baseUrl}/Loyalty/history`, {
        headers: this.authHeaders(),
        params: httpParams,
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  getLoyaltyChallenges(params?: {
    isCompleted?: boolean;
    pageNumber?: number;
    pageSize?: number;
  }): Observable<LoyaltyChallengesPagedDto> {
    let httpParams = new HttpParams();

    if (params) {
      if (typeof params.isCompleted === 'boolean') {
        httpParams = httpParams.set('isCompleted', String(params.isCompleted));
      }
      if (typeof params.pageNumber === 'number') {
        httpParams = httpParams.set('pageNumber', String(params.pageNumber));
      }
      if (typeof params.pageSize === 'number') {
        httpParams = httpParams.set('pageSize', String(params.pageSize));
      }
    }

    return this.http
      .get<ApiResponse<LoyaltyChallengesPagedDto>>(`${this.baseUrl}/Loyalty/challenges`, {
        headers: this.authHeaders(),
        params: httpParams,
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  createSupportTicket(payload: CreateSupportTicketRequest): Observable<SupportTicketDto> {
    return this.http
      .post<ApiResponse<SupportTicketDto>>(`${this.baseUrl}/Support/tickets`, payload, {
        headers: this.authHeaders(),
      })
      .pipe(map((response) => this.unwrap(response)));
  }

  private unwrap<T>(response: ApiResponse<T>): T {
    if (response.success) {
      return response.data;
    }

    const message = Array.isArray(response.errors)
      ? response.errors.join(', ')
      : response.message || 'Request failed';

    throw new Error(message);
  }

  private authHeaders(): HttpHeaders {
    const token = this.getAccessToken();

    if (!token) {
      return new HttpHeaders();
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return localStorage.getItem('accessToken');
  }
}

