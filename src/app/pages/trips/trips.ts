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

  async selectTrip(trip: any): Promise<void> {
    this.state.selectedTicket = trip;
    await this.router.navigate(['/passenger-details']);
  }
}
