import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppStateService } from '../../services/state';

@Component({
  selector: 'app-my-bookings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-bookings.html',
  styleUrls: ['./my-bookings.scss']
})
export class MyBookingsComponent implements OnInit {
  isLoading = true;
  loadError = '';

  constructor(public state: AppStateService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.refreshBookings();
  }

  async refreshBookings(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      await Promise.all([
        this.state.loadProfile().catch(() => undefined),
        this.state.loadBookings(),
      ]);
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Failed to load bookings';
    } finally {
      this.isLoading = false;
    }
  }

  async payNow(booking: any): Promise<void> {
    this.state.currentPaymentBooking = booking;
    await this.router.navigate(['/payment']);

  }

  async cancelHold(booking: any): Promise<void> {
    const bookingId = Number(booking?.id);
    if (!Number.isFinite(bookingId)) {
      return;
    }

    try {
      await this.state.cancelCartHold(bookingId);
      await this.refreshBookings();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel hold';
      alert(message);
    }
  }

}