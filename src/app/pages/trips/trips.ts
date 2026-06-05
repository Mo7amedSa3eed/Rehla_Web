import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppStateService } from '../../services/state';
import { UiTrip } from '../../services/state';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trips.html',
  styleUrls: ['./trips.scss']
})
export class TripsComponent {
  isSubmitting = false;
  showFilters = false;

  // Filter state
  filterSortBy: 'departure' | 'price' | 'duration' = 'departure';
  filterTransport: 'all' | 'bus' | 'train' = 'all';
  filterMaxPrice: number = 5000;
  maxPriceLimit: number = 5000;
  filterDepartureFrom: string = '';
  filterDepartureTo: string = '';
  filterArrivalFrom: string = '';
  filterArrivalTo: string = '';

  // Internal cached results after applying filters
  private _appliedFilters = false;
  private _filteredCache: UiTrip[] = [];

  constructor(public state: AppStateService, private router: Router) { }

  get filteredResults(): UiTrip[] {
    if (!this._appliedFilters) {
      return this.state.searchResults;
    }
    return this._filteredCache;
  }

  applyFilters(): void {
    let results = [...this.state.searchResults];

    // Filter by transport type
    if (this.filterTransport !== 'all') {
      results = results.filter(trip => {
        const agencyLower = (trip.agencyName || '').toLowerCase();
        const transportLower = (trip.transport || '').toLowerCase();
        if (this.filterTransport === 'bus') {
          return agencyLower.includes('bus') || transportLower.includes('bus') ||
            (!agencyLower.includes('train') && !transportLower.includes('train'));
        }
        if (this.filterTransport === 'train') {
          return agencyLower.includes('train') || transportLower.includes('train');
        }
        return true;
      });
    }

    // Filter by max price
    if (this.filterMaxPrice < this.maxPriceLimit) {
      results = results.filter(trip => trip.price <= this.filterMaxPrice);
    }

    // Filter by departure time
    if (this.filterDepartureFrom) {
      results = results.filter(trip => {
        const tripTime = this.extractTimeString(trip.departureTime);
        return tripTime >= this.filterDepartureFrom;
      });
    }
    if (this.filterDepartureTo) {
      results = results.filter(trip => {
        const tripTime = this.extractTimeString(trip.departureTime);
        return tripTime <= this.filterDepartureTo;
      });
    }

    // Filter by arrival time
    if (this.filterArrivalFrom) {
      results = results.filter(trip => {
        const tripTime = this.extractTimeString(trip.arrivalTime);
        return tripTime >= this.filterArrivalFrom;
      });
    }
    if (this.filterArrivalTo) {
      results = results.filter(trip => {
        const tripTime = this.extractTimeString(trip.arrivalTime);
        return tripTime <= this.filterArrivalTo;
      });
    }

    // Sort
    if (this.filterSortBy === 'price') {
      results.sort((a, b) => a.price - b.price);
    } else if (this.filterSortBy === 'duration') {
      results.sort((a, b) => this.parseDuration(a.duration) - this.parseDuration(b.duration));
    } else {
      // departure time
      results.sort((a, b) =>
        this.extractTimeString(a.departureTime).localeCompare(this.extractTimeString(b.departureTime))
      );
    }

    this._filteredCache = results;
    this._appliedFilters = true;
    this.showFilters = false;
  }

  resetFilters(): void {
    this.filterSortBy = 'departure';
    this.filterTransport = 'all';
    this.filterMaxPrice = this.maxPriceLimit;
    this.filterDepartureFrom = '';
    this.filterDepartureTo = '';
    this.filterArrivalFrom = '';
    this.filterArrivalTo = '';
    this._appliedFilters = false;
    this._filteredCache = [];
  }

  async selectTrip(trip: any): Promise<void> {
    this.state.selectedTicket = trip;
    // If the last search was for bus trips, show seat selection first
    if (this.state.lastSearchTransport === 1) {
      await this.router.navigate(['/seat-selection']);
      return;
    }

    await this.router.navigate(['/passenger-details']);
  }

  /** Convert display time like "02:30 PM" to "14:30" for comparison */
  private extractTimeString(displayTime: string): string {
    if (!displayTime) return '00:00';

    // Try parsing "HH:MM AM/PM" format
    const match = displayTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const period = match[3].toUpperCase();

      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;

      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    // Already in 24h format
    const match24 = displayTime.match(/(\d{1,2}):(\d{2})/);
    if (match24) {
      return `${match24[1].padStart(2, '0')}:${match24[2]}`;
    }

    return '00:00';
  }

  /** Parse duration string like "2h 30m" to minutes */
  private parseDuration(duration: string): number {
    if (!duration) return 0;
    let total = 0;
    const hourMatch = duration.match(/(\d+)\s*h/i);
    const minMatch = duration.match(/(\d+)\s*m/i);
    if (hourMatch) total += parseInt(hourMatch[1], 10) * 60;
    if (minMatch) total += parseInt(minMatch[1], 10);
    return total;
  }
}
