import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { ActiveCartDto, ApiService, CartItemDto, CartPassengerDto } from '../../services/api';
import { AppStateService } from '../../services/state';
import { LanguageService } from '../../core/i18n/language.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';


interface CartPassenger {
  name: string;
  idNumber: string;
  seatNumber: string;
}

interface CartItem {
  bookingId: number;
  totalPrice: number;
  seatsBooked: number;
  holdExpiresAt: Date | null;
  agencyName: string;
  className: string;
  origin: string;
  originGov: string;
  destination: string;
  destinationGov: string;
  boardingTime: string;
  dropoffTime: string;
  passengers: CartPassenger[];
}

interface CartView {
  items: CartItem[];
  grandTotal: number;
}

type CartViewState =
  | { kind: 'initial' }
  | { kind: 'loading' }
  | { kind: 'loaded'; cart: CartView }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'checkoutLoading'; cart: CartView }
  | { kind: 'itemCancelling'; cart: CartView; bookingId: number };

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './cart.html',
  styleUrls: ['./cart.scss'],
})
export class CartComponent implements OnInit, OnDestroy {
  state: CartViewState = { kind: 'initial' };
  latestCart: CartView | null = null;
  pointsToRedeem = 0;
  message = '';
  messageKind: 'info' | 'error' = 'info';

  readonly pointValueEgp = 0.05;
  readonly sliderStep = 20;
  readonly minFinalPriceEgp = 10;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private languageSub?: Subscription;
  private lastCartDto: ActiveCartDto | null = null;

  constructor(
    public appState: AppStateService,
    private readonly api: ApiService,
    private readonly router: Router,
    private readonly language: LanguageService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser()) {
      this.state = { kind: 'empty' };
      return;
    }

    const navigationError = this.readNavigationCartError();
    if (navigationError) {
      this.setErrorMessage(navigationError);
    }

    await Promise.all([
      this.loadCart({ preserveMessage: !!navigationError }),
      this.appState.loadProfile().catch(() => undefined),
    ]);
    this.languageSub = this.language.language$.subscribe(() => this.refreshLocalizedCart());
    this.timerId = setInterval(() => {
      if (this.latestCart && this.hasExpiredHold) {
        this.loadCart();
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
    this.languageSub?.unsubscribe();
  }

  get isBusy(): boolean {
    return this.state.kind === 'checkoutLoading' || this.state.kind === 'itemCancelling';
  }

  get cart(): CartView | null {
    return 'cart' in this.state ? this.state.cart : this.latestCart;
  }

  get maxRedeemablePoints(): number {
    const total = this.latestCart?.grandTotal ?? 0;
    const balance = this.appState.userProfile.loyaltyPointsBalance ?? 0;
    if (total <= this.minFinalPriceEgp || balance <= 0) return 0;

    const walletLimit = balance;
    const halfCapLimit = Math.floor((total * 0.5) / this.pointValueEgp);
    const floorLimit = Math.floor((total - this.minFinalPriceEgp) / this.pointValueEgp);
    const raw = Math.min(walletLimit, halfCapLimit, floorLimit);
    return Math.floor(Math.max(raw, 0) / this.sliderStep) * this.sliderStep;
  }

  get discountValue(): number {
    return this.pointsToRedeem * this.pointValueEgp;
  }

  get finalTotal(): number {
    const total = this.latestCart?.grandTotal ?? 0;
    return total > 0 ? Math.max(total - this.discountValue, this.minFinalPriceEgp) : 0;
  }

  get hasExpiredHold(): boolean {
    return (this.latestCart?.items ?? []).some((item) => this.isExpired(item));
  }

  async loadCart(options: { preserveMessage?: boolean } = {}): Promise<void> {
    if (!this.isBrowser()) {
      this.state = { kind: 'empty' };
      return;
    }

    if (!options.preserveMessage) {
      this.clearMessage();
    }
    if (!this.latestCart) {
      this.state = { kind: 'loading' };
    }

    try {
      const cartDto = await this.appState.loadActiveCart();
      this.lastCartDto = cartDto;
      const cart = cartDto ? this.normalizeCart(cartDto) : null;

      if (!cart || cart.items.length === 0) {
        this.latestCart = null;
        this.lastCartDto = null;
        this.pointsToRedeem = 0;
        this.state = { kind: 'empty' };
        return;
      }

      this.latestCart = cart;
      this.pointsToRedeem = Math.min(this.pointsToRedeem, this.maxRedeemablePoints);
      this.state = { kind: 'loaded', cart };
    } catch (error) {
      this.state = { kind: 'error', message: this.api.cartUserMessage(error) };
    }
  }

  async cancelItem(bookingId: number): Promise<void> {
    if (!this.latestCart) return;

    this.clearMessage();
    this.state = { kind: 'itemCancelling', cart: this.latestCart, bookingId };

    try {
      await firstValueFrom(this.api.cancelCartHold(bookingId));
      this.setInfoMessage('Cart hold cancelled.');
    } catch (error) {
      this.setErrorMessage(this.api.cartUserMessage(error));
    } finally {
      await this.loadCart({ preserveMessage: true });
    }
  }

  async checkout(): Promise<void> {
    if (!this.latestCart || this.hasExpiredHold) return;

    this.clearMessage();
    this.state = { kind: 'checkoutLoading', cart: this.latestCart };

    try {
      const responseMessage = await firstValueFrom(this.api.checkout({
        paymentMethod: 'Wallet',
        pointsToRedeem: this.pointsToRedeem,
      }));
      this.setInfoMessage(responseMessage || 'Checkout successful.');
      this.latestCart = null;
      this.appState.activeCart = null;
      await Promise.all([
        this.appState.loadBookings().catch(() => undefined),
        this.appState.loadTickets().catch(() => undefined),
        this.appState.loadProfile().catch(() => undefined),
      ]);
      await this.router.navigate(['/my-tickets']);
    } catch (error) {
      const checkoutMessage = this.api.cartUserMessage(error);
      await this.loadCart({ preserveMessage: true });
      this.setErrorMessage(checkoutMessage);
    }
  }

  private clearMessage(): void {
    this.message = '';
    this.messageKind = 'info';
  }

  private setInfoMessage(message: string): void {
    this.message = message;
    this.messageKind = 'info';
  }

  private setErrorMessage(message: string): void {
    this.message = message;
    this.messageKind = 'error';
  }

  private readNavigationCartError(): string {
    const navigation = this.router.getCurrentNavigation();
    const fromNavigation = navigation?.extras.state?.['cartError'];
    if (typeof fromNavigation === 'string' && fromNavigation.trim()) {
      return fromNavigation.trim();
    }

    if (typeof window === 'undefined') {
      return '';
    }

    const fromHistory = window.history.state?.cartError;
    return typeof fromHistory === 'string' ? fromHistory.trim() : '';
  }

  onPointsChange(event: Event): void {
    const raw = parseInt((event.target as HTMLInputElement).value, 10) || 0;
    const clamped = Math.min(Math.max(raw, 0), this.maxRedeemablePoints);
    this.pointsToRedeem = Math.floor(clamped / this.sliderStep) * this.sliderStep;
  }

  isCancelling(bookingId: number): boolean {
    return this.state.kind === 'itemCancelling' && this.state.bookingId === bookingId;
  }

  isExpired(item: CartItem): boolean {
    return !!item.holdExpiresAt && item.holdExpiresAt.getTime() <= Date.now();
  }

  holdLabel(item: CartItem): string {
    if (!item.holdExpiresAt) return 'No expiry time';

    const remainingMs = item.holdExpiresAt.getTime() - Date.now();
    if (remainingMs <= 0) return 'Expired';

    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  private normalizeCart(dto: ActiveCartDto): CartView {
    return {
      items: (dto.items ?? []).map((item) => this.normalizeCartItem(item)),
      grandTotal: Number(dto.grandTotal ?? 0),
    };
  }

  private normalizeCartItem(dto: CartItemDto): CartItem {
    const isArabic = this.language.currentLanguage === 'ar';
    return {
      bookingId: Number(dto.bookingId ?? 0),
      totalPrice: Number(dto.totalPrice ?? 0),
      seatsBooked: Number(dto.seatsBooked ?? 0),
      holdExpiresAt: dto.holdExpiresAt ? new Date(dto.holdExpiresAt) : null,
      agencyName: this.localizedText(isArabic, [dto.agencyName], [dto.agencyNameAr], 'Transport'),
      className: this.localizedText(isArabic, [dto.className], [dto.classNameAr], 'Standard'),
      origin: this.localizedText(isArabic, [dto.originStationNameEn, dto.origin], [dto.originAr], 'Origin'),
      originGov: this.localizedText(isArabic, [dto.originGovEn, dto.originGov], [dto.originGovAr]),
      destination: this.localizedText(isArabic, [dto.destinationStationNameEn, dto.destination], [dto.destinationAr], 'Destination'),
      destinationGov: this.localizedText(isArabic, [dto.destinationGovEn, dto.destinationGov], [dto.destinationGovAr]),
      boardingTime: this.formatSchedule(dto.boardingTime),
      dropoffTime: this.formatSchedule(dto.dropoffTime),
      passengers: (dto.passengers ?? []).map((passenger) => this.normalizePassenger(passenger)),
    };
  }

  private normalizePassenger(passenger: CartPassengerDto): CartPassenger {
    return {
      name: this.firstText(passenger.name, passenger.passengerName, 'Passenger'),
      idNumber: this.firstText(passenger.idNumber, 'N/A'),
      seatNumber: this.firstText(passenger.seatNumber, 'Auto'),
    };
  }

  private formatSchedule(value?: string | null): string {
    if (!value) return 'N/A';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString(this.language.currentLocale, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private firstText(...values: Array<string | null | undefined>): string {
    const value = values.find((item) => typeof item === 'string' && item.trim().length > 0);
    return value?.trim() ?? '';
  }

  private localizedText(
    isArabic: boolean,
    englishValues: Array<string | null | undefined>,
    arabicValues: Array<string | null | undefined>,
    fallback = '',
  ): string {
    return isArabic
      ? this.firstText(...arabicValues, ...englishValues, fallback)
      : this.firstText(...englishValues, fallback);
  }

  private refreshLocalizedCart(): void {
    if (!this.lastCartDto || !this.latestCart) return;

    const cart = this.normalizeCart(this.lastCartDto);
    this.latestCart = cart;
    if (this.state.kind === 'loaded') {
      this.state = { kind: 'loaded', cart };
    } else if (this.state.kind === 'checkoutLoading') {
      this.state = { kind: 'checkoutLoading', cart };
    } else if (this.state.kind === 'itemCancelling') {
      this.state = { kind: 'itemCancelling', cart, bookingId: this.state.bookingId };
    }
  }

  private isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }
}
