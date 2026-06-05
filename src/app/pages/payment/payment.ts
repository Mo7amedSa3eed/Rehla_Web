import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppStateService } from '../../services/state';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment.html',
  styleUrls: ['./payment.scss']
})
export class PaymentComponent implements OnInit {

  paymentMethod: 'wallet' | 'points' = 'wallet';
  isSubmitting = false;
  readonly pointsPerEgp = 10;

  constructor(public state: AppStateService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.state.loadProfile().catch(() => undefined);
  }

  get totalPrice(): number {
    return this.state.currentPaymentBooking?.price ?? 0;
  }

  get pointsNeeded(): number {
    return Math.ceil(this.totalPrice * this.pointsPerEgp);
  }

  get canPayWithPoints(): boolean {
    return this.state.userProfile.loyaltyPointsBalance >= this.pointsNeeded;
  }

  async confirmPayment(): Promise<void> {
    const booking = this.state.currentPaymentBooking;

    if (!booking) {
      return;
    }

    this.isSubmitting = true;

    try {
      if (this.paymentMethod === 'points') {
        await this.state.checkoutPoints(this.pointsNeeded);
      } else {
        await this.state.checkoutWallet();
      }
      await this.router.navigate(['/my-tickets']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment failed';
      alert(message);
    } finally {
      this.isSubmitting = false;
    }
  }

  async cancel(): Promise<void> {
    this.state.currentPaymentBooking = null;
    this.state.buyingMarketplaceTicketId = null;
    await this.router.navigate(['/my-tickets']);
  }
}
