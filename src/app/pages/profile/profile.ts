import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/state';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService, WalletHistoryItemDto } from '../../services/api';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class ProfileComponent implements OnInit {
  depositAmount: number | null = null;
  cardNumber = '';
  expiryDate = '';
  cvv = '';
  showWalletTopupModal = false;
  isChargingWallet = false;
  walletMessage = '';
  walletError = '';
  showLogoutConfirmModal = false;

  // Wallet History
  showWalletHistoryModal = false;
  walletHistory: WalletHistoryItemDto[] = [];
  isLoadingWalletHistory = false;
  walletHistoryError = '';

  constructor(
    public state: AppStateService,
    private readonly router: Router,
    private readonly api: ApiService,
  ) {}

  logout(): void {
    this.showLogoutConfirmModal = true;
  }

  async confirmLogout(): Promise<void> {
    this.showLogoutConfirmModal = false;

    // Call revoke token per spec - treat 400/401 as non-blocking
    try {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
      if (refreshToken) {
        await firstValueFrom(this.api.revokeToken({ refreshToken })).catch(() => undefined);
      }
    } catch { /* non-blocking */ }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.history.replaceState({}, '', '/login');
    }

    this.state.userProfile = {
      userId: 0, firstName: '', familyName: '', lastName: '', email: '',
      phone: '', dob: '', gender: '', address: '', city: '', state: '',
      country: '', countryCode: '', memberSince: '', photo: null,
      totalTrips: 0, totalDistanceTraveled: 0, walletBalance: 0,
      loyaltyPointsBalance: 0, expiringPointsAmount: 0, nextExpiryDate: null,
      hasSetIdentityDetails: false, idType: null, idNumber: null, activeChallenges: [],
    };

    void this.router.navigate(['/login']);
  }

  cancelLogout(): void {
    this.showLogoutConfirmModal = false;
  }

  async ngOnInit(): Promise<void> {
    await this.state.loadProfile().catch(() => undefined);
  }

  get user() {
    return this.state.userProfile;
  }

  get fullName(): string {
    return `${this.user.firstName} ${this.user.lastName} ${this.user.familyName}`
      .replace(/\s+/g, ' ').trim();
  }

  get initials(): string {
    const first = this.user.firstName?.[0]?.toUpperCase() || '';
    const last = this.user.lastName?.[0]?.toUpperCase() || '';
    return (first + last) || first || '?';
  }

  get idTypeLabel(): string {
    const t = this.user.idType;
    if (t === 1 || t === 'NationalId') return 'National ID';
    if (t === 2 || t === 'Passport') return 'Passport';
    return String(t ?? '');
  }

  openWalletTopup(): void {
    this.showWalletTopupModal = true;
    this.walletMessage = '';
    this.walletError = '';
  }

  closeWalletTopup(): void {
    if (this.isChargingWallet) return;
    this.showWalletTopupModal = false;
  }

  onWalletOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeWalletTopup();
  }

  async openWalletHistory(): Promise<void> {
    this.showWalletHistoryModal = true;
    this.walletHistoryError = '';
    this.isLoadingWalletHistory = true;
    try {
      this.walletHistory = await firstValueFrom(this.api.getWalletHistory());
    } catch (e) {
      this.walletHistoryError = e instanceof Error ? e.message : 'Failed to load wallet history.';
    } finally {
      this.isLoadingWalletHistory = false;
    }
  }

  closeWalletHistory(): void {
    this.showWalletHistoryModal = false;
  }

  onWalletHistoryOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closeWalletHistory();
  }

  onCvvChange(value: string): void {
    this.cvv = (value ?? '').replace(/\D/g, '').slice(0, 3);
  }

  onExpiryDateChange(value: string): void {
    const digitsOnly = (value ?? '').replace(/\D/g, '').slice(0, 4);
    if (digitsOnly.length <= 2) {
      this.expiryDate = digitsOnly;
      return;
    }
    this.expiryDate = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
  }

  async chargeWallet(): Promise<void> {
    this.walletMessage = '';
    this.walletError = '';

    const amount = Number(this.depositAmount ?? 0);
    if (!Number.isFinite(amount) || amount < 10) {
      this.walletError = 'Minimum deposit amount is 10 EGP.';
      return;
    }
    if (amount > 10000) {
      this.walletError = 'Maximum deposit amount is 10,000 EGP.';
      return;
    }
    if (!this.cardNumber.trim() || !this.expiryDate.trim() || !this.cvv.trim()) {
      this.walletError = 'Please complete all Visa card fields.';
      return;
    }
    if (!/^\d{16}$/.test(this.cardNumber.replace(/\s/g, ''))) {
      this.walletError = 'Card number must be exactly 16 digits.';
      return;
    }
    if (!/^\d{3}$/.test(this.cvv)) {
      this.walletError = 'CVV must be exactly 3 digits.';
      return;
    }
    const expiryValidation = this.validateExpiryDate(this.expiryDate);
    if (!expiryValidation.valid) {
      this.walletError = expiryValidation.message;
      return;
    }

    this.isChargingWallet = true;
    try {
      const message = await this.state.depositToWallet({
        amount,
        mockCardNumber: this.cardNumber.replace(/\s/g, '').trim(),
        expiryDate: this.expiryDate.trim(),
        cvv: this.cvv.trim(),
      });
      this.walletMessage = message || 'Wallet charged successfully.';
      this.depositAmount = null;
      this.cardNumber = '';
      this.expiryDate = '';
      this.cvv = '';
      await this.state.loadProfile().catch(() => undefined);
    } catch (error) {
      this.walletError = error instanceof Error ? error.message : 'Failed to charge wallet.';
    } finally {
      this.isChargingWallet = false;
    }
  }

  private validateExpiryDate(value: string): { valid: boolean; message: string } {
    const trimmed = value.trim();
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(trimmed)) {
      return { valid: false, message: 'Expiry date must be in MM/YY format.' };
    }
    const [monthText, yearText] = trimmed.split('/');
    const month = Number(monthText);
    const year = 2000 + Number(yearText);
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return { valid: false, message: 'Expiry date cannot be in the past.' };
    }
    if (year > currentYear + 15) {
      return { valid: false, message: 'Expiry date year looks invalid.' };
    }
    return { valid: true, message: '' };
  }
}
