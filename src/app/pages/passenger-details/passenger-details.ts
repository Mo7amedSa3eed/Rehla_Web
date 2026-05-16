import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppStateService } from '../../services/state';

@Component({
  selector: 'app-passenger-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './passenger-details.html',
  styleUrls: ['./passenger-details.scss']
})
export class PassengerDetailsComponent implements OnInit {
  isProcessing = false;
  selectedTrip: any = null;

  fullName: string = '';
  nationalId: string = '';
  phoneNumber: string = '';
  email: string = '';

  constructor(public state: AppStateService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    this.selectedTrip = this.state.selectedTicket;
    if (!this.selectedTrip) {
      await this.router.navigate(['/trips']);
    }
  }

  isFormValid(): boolean {
    return (
      this.fullName.trim().length > 0 &&
      this.isNationalIdValid() &&
      this.isPhoneNumberValid()
    );
  }

  isNationalIdValid(): boolean {
    const nationalIdRegex = /^\d{14}$/;
    return nationalIdRegex.test(this.nationalId.trim());
  }

  isPhoneNumberValid(): boolean {
    const phoneRegex = /^\d{11}$/;
    return phoneRegex.test(this.phoneNumber.trim());
  }

  isNationalIdInvalid(): boolean {
    return this.nationalId.trim().length > 0 && !this.isNationalIdValid();
  }

  isPhoneNumberInvalid(): boolean {
    return this.phoneNumber.trim().length > 0 && !this.isPhoneNumberValid();
  }

  async addToCart(): Promise<void> {
    if (!this.isFormValid() || !this.selectedTrip) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.state.addTripToCart(this.selectedTrip);
      await this.router.navigate(['/my-bookings']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add trip to cart';
      alert(message);
    } finally {
      this.isProcessing = false;
    }
  }

  async bookNow(): Promise<void> {
    if (!this.isFormValid() || !this.selectedTrip) {
      return;
    }

    this.isProcessing = true;

    try {
      await this.state.addTripToCart(this.selectedTrip);
      await this.state.loadBookings();
      
      const booking = this.state.bookings.find(b => b.status === 'pending');
      if (booking) {
        this.state.currentPaymentBooking = booking;
        await this.router.navigate(['/payment']);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to proceed with booking';
      alert(message);
    } finally {
      this.isProcessing = false;
    }
  }

  async goBack(): Promise<void> {
    this.state.selectedTicket = null;
    await this.router.navigate(['/trips']);
  }

  get passengerCount(): number {
    return this.state.searchPassengers || 1;
  }

  get totalPrice(): number {
    return (this.selectedTrip?.price || 0) * this.passengerCount;
  }
}
