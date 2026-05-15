import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AppStateService } from '../../services/state';

@Component({
  selector: 'app-marketplace-confirm',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './marketplace-confirm.html',
  styleUrls: ['./marketplace-confirm.scss']
})
export class MarketplaceConfirmComponent implements OnInit {
  isSubmitting = false;
  errorMessage = '';

  constructor(public state: AppStateService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    if (!this.state.currentPaymentBooking || !this.state.buyingMarketplaceTicketId) {
      await this.router.navigate(['/marketplace']);
    }
  }

  get booking() {
    return this.state.currentPaymentBooking;
  }

  async confirmPurchase(): Promise<void> {
    if (!this.state.buyingMarketplaceTicketId) {
      await this.router.navigate(['/marketplace']);
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      await this.state.completeMarketplacePurchase();
      await this.router.navigate(['/my-bookings']);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to complete purchase';
    } finally {
      this.isSubmitting = false;
    }
  }

  async cancel(): Promise<void> {
    this.state.currentPaymentBooking = null;
    this.state.buyingMarketplaceTicketId = null;
    await this.router.navigate(['/marketplace']);
  }
}
