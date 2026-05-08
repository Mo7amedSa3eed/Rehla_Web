import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppStateService } from '../../services/state';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trips.html',
  styleUrls: ['./trips.scss']
})
export class TripsComponent {
  isSubmitting = false;

  constructor(public state: AppStateService, private router: Router) {}

  async bookTrip(trip: any): Promise<void> {
    this.isSubmitting = true;

    try {
      await this.state.addTripToCart(trip);
      await this.router.navigate(['/my-bookings']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add trip to cart';
      alert(message);
    } finally {
      this.isSubmitting = false;
    }
  }
}
