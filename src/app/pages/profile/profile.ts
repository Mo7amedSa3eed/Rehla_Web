import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/state';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

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

  constructor(public state: AppStateService, private readonly router: Router) {}

  logout(): void {
    this.showLogoutConfirmModal = true;
  }

  confirmLogout(): void {
    this.showLogoutConfirmModal = false;

    if (typeof window !== 'undefined') {
      // Clear auth tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      
      // Clear browser history to prevent going back
      window.history.replaceState({}, '', '/login');
    }

    // Reset the user profile state
    this.state.userProfile = {
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

  get fullName() {
    return [this.user.firstName, this.user.lastName, this.user.familyName]
      .filter((value) => value && value.trim().length > 0)
      .join(' ')
      .trim();
  }

  openWalletTopup(): void {
    this.showWalletTopupModal = true;
  }

  closeWalletTopup(): void {
    if (this.isChargingWallet) {
      return;
    }

    this.showWalletTopupModal = false;
  }

  onWalletOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeWalletTopup();
    }
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
    if (!Number.isFinite(amount) || amount <= 0) {
      this.walletError = 'Please enter a valid amount greater than 0.';
      return;
    }

    if (!this.cardNumber.trim() || !this.expiryDate.trim() || !this.cvv.trim()) {
      this.walletError = 'Please complete all Visa card fields.';
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
        mockCardNumber: this.cardNumber.trim(),
        expiryDate: this.expiryDate.trim(),
        cvv: this.cvv.trim(),
      });
      this.walletMessage = message || 'Wallet charged successfully.';
      this.depositAmount = null;
      this.cardNumber = '';
      this.expiryDate = '';
      this.cvv = '';
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
