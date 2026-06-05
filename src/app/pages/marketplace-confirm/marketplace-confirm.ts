import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AppStateService, MarketplaceListing } from '../../services/state';

@Component({
  selector: 'app-marketplace-confirm',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './marketplace-confirm.html',
  styleUrls: ['./marketplace-confirm.scss']
})
export class MarketplaceConfirmComponent implements OnInit {
  isSubmitting = false;
  errorMessage = '';

  isTrain = false;
  passengers: { passengerName: string; idType: string; idNumber: string }[] = [];

  constructor(public state: AppStateService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    if (!this.state.currentPaymentBooking || !this.state.buyingMarketplaceTicketId) {
      await this.router.navigate(['/my-tickets']);
      return;
    }

    this.detectTransportType();
    this.initializePassengers();
  }

  get booking() {
    return this.state.currentPaymentBooking;
  }

  private detectTransportType() {
    const listingId = this.state.buyingMarketplaceTicketId;
    const mpListing = this.state.marketplace.find(l => l.listingId === listingId);

    if (mpListing) {
      const agency = (
        mpListing.agencyName ??
        mpListing.className ??
        ''
      ).toUpperCase();

      const transportType = (mpListing.transportType ?? '').toUpperCase();

      this.isTrain = transportType === 'TRAIN' ||
        agency === 'EGYPTIAN NATIONAL RAILWAYS' ||
        agency.includes('NATIONAL RAIL') ||
        agency.includes('RAILWAY') ||
        agency.includes('TRAIN') ||
        agency.includes('ENR');
    }
  }

  private initializePassengers() {
    const count = this.booking?.passengers || 1;
    this.passengers = Array.from({ length: count }).map(() => ({
      passengerName: '',
      idType: 'NationalId',
      idNumber: ''
    }));
  }

  get isFormValid(): boolean {
    for (const pax of this.passengers) {
      if (!pax.passengerName.trim()) return false;
      if (this.isTrain && !pax.idNumber.trim()) return false;
    }
    return true;
  }

  async confirmPurchase(): Promise<void> {
    if (!this.state.buyingMarketplaceTicketId || !this.isFormValid) {
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const payload = this.passengers.map(p => ({
        passengerName: p.passengerName,
        ...(this.isTrain ? { idType: p.idType, idNumber: p.idNumber } : {})
      }));

      await this.state.completeMarketplacePurchase(undefined, payload);
      await this.router.navigate(['/my-tickets']);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to complete purchase';
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
