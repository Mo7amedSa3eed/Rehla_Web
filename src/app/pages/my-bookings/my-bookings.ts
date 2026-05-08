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

  constructor(public state: AppStateService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.state.loadBookings().catch(() => undefined);
  }

  payNow(booking:any){

    this.state.currentPaymentBooking = booking;

    this.router.navigate(['/payment']);

  }

  async cancelHold(booking: any): Promise<void> {
    const bookingId = Number(booking?.id);
    if (!Number.isFinite(bookingId)) {
      return;
    }

    try {
      await this.state.cancelCartHold(bookingId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel hold';
      alert(message);
    }
  }

}