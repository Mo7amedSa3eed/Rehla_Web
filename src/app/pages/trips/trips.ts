import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppStateService } from '../../services/state';
import { UiTrip } from '../../services/state';
import { TripSearchItemDto } from '../../services/api';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trips.html',
  styleUrls: ['./trips.scss']
})
export class TripsComponent implements OnInit {
  isSubmitting = false;
  showFilters = false;

  showIndirect = false;
  isSearchingIndirect = false;

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

  ngOnInit() {
    // Auto load indirect if direct is empty and we are a simple one-way search
    if (this.state.searchQueries.length <= 1 && this.state.searchResults.length === 0) {
      this.toggleIndirect();
    }
  }

  get filteredResults(): UiTrip[] {
    if (!this._appliedFilters) {
      return this.state.searchResults;
    }
    return this._filteredCache;
  }

  async toggleIndirect() {
    this.showIndirect = !this.showIndirect;
    if (this.showIndirect && this.state.indirectSearchResults.length === 0) {
      const q = this.state.searchQueries[this.state.currentLegIndex] || {};
      this.isSearchingIndirect = true;
      try {
        await this.state.searchIndirectTrips(q);
      } catch (e) {
        alert('Failed to load indirect trips');
      } finally {
        this.isSearchingIndirect = false;
      }
    }
  }

  async applyFilters(): Promise<void> {
    const q = this.state.searchQueries[this.state.currentLegIndex];
    if (q) {
      q.pageNumber = 1;
      q.pageSize = 10;
      q.maxPrice = this.filterMaxPrice < this.maxPriceLimit ? this.filterMaxPrice : undefined;
      q.transport = this.filterTransport === 'bus' ? 1 : (this.filterTransport === 'train' ? 2 : 0);
      q.sortBy = this.filterSortBy === 'price' ? 1 : (this.filterSortBy === 'duration' ? 2 : 3);
      
      this.isSubmitting = true;
      try {
        await this.state.searchTrips(q);
      } catch (e) {
        console.error('Failed to apply filters', e);
      } finally {
        this.isSubmitting = false;
      }
    }

    let results = [...this.state.searchResults];

    // Filter by departure time (Client-side only)
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

    // Filter by arrival time (Client-side only)
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

    this._filteredCache = results;
    this._appliedFilters = true;
    this.showFilters = false;
  }

  async nextPage(): Promise<void> {
    if (this.state.searchTripsCurrentPage < this.state.searchTripsTotalPages) {
      const q = this.state.searchQueries[this.state.currentLegIndex];
      q.pageNumber = this.state.searchTripsCurrentPage + 1;
      q.pageSize = 10;
      this.isSubmitting = true;
      try {
        await this.state.searchTrips(q);
        this.applyLocalFiltersOnly();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        console.error('Failed to load next page', e);
      } finally {
        this.isSubmitting = false;
      }
    }
  }

  async prevPage(): Promise<void> {
    if (this.state.searchTripsCurrentPage > 1) {
      const q = this.state.searchQueries[this.state.currentLegIndex];
      q.pageNumber = this.state.searchTripsCurrentPage - 1;
      q.pageSize = 10;
      this.isSubmitting = true;
      try {
        await this.state.searchTrips(q);
        this.applyLocalFiltersOnly();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (e) {
        console.error('Failed to load previous page', e);
      } finally {
        this.isSubmitting = false;
      }
    }
  }

  private applyLocalFiltersOnly(): void {
    let results = [...this.state.searchResults];

    if (this.filterDepartureFrom) {
      results = results.filter(trip => this.extractTimeString(trip.departureTime) >= this.filterDepartureFrom);
    }
    if (this.filterDepartureTo) {
      results = results.filter(trip => this.extractTimeString(trip.departureTime) <= this.filterDepartureTo);
    }
    if (this.filterArrivalFrom) {
      results = results.filter(trip => this.extractTimeString(trip.arrivalTime) >= this.filterArrivalFrom);
    }
    if (this.filterArrivalTo) {
      results = results.filter(trip => this.extractTimeString(trip.arrivalTime) <= this.filterArrivalTo);
    }

    this._filteredCache = results;
    this._appliedFilters = true;
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

  mapDtoToUiTrip(dto: TripSearchItemDto): UiTrip {
    // Helper to reuse mapping logic for indirect legs
    const firstClass = dto.availableClasses[0];
    return {
      id: dto.tripOccurrenceId,
      tripOccurrenceId: dto.tripOccurrenceId,
      tripId: dto.tripId,
      coachClassId: firstClass?.coachClassId ?? 0,
      className: firstClass?.className ?? 'N/A',
      originStationId: dto.originStationId,
      originStationName: dto.originStationName,
      destinationStationId: dto.destinationStationId,
      destinationStationName: dto.destinationStationName,
      from: dto.originGovernorate,
      to: dto.destinationGovernorate,
      date: new Date(dto.boardingTime).toLocaleDateString(),
      time: new Date(dto.boardingTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dropoffTime: new Date(dto.dropoffTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      departureTime: new Date(dto.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      arrivalTime: new Date(dto.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: `${Math.floor(dto.totalDurationMinutes / 60)}h ${dto.totalDurationMinutes % 60}m`,
      transport: dto.agencyName,
      agencyName: dto.agencyName,
      price: dto.startingPrice,
      seats: firstClass?.remainingSeats ?? 0,
      availableClasses: dto.availableClasses ?? [],
      routeStops: dto.routeStops ?? [],
    };
  }

  async selectIndirectTrip(indirectDto: any): Promise<void> {
    const leg1 = this.mapDtoToUiTrip(indirectDto.legs[0]);
    const leg2 = this.mapDtoToUiTrip(indirectDto.legs[1]);
    await this.selectTrip(leg1, leg2);
  }

  async selectTrip(trip: any, secondIndirectLeg?: any): Promise<void> {
    this.state.selectedLegs.push(trip);
    if (secondIndirectLeg) {
      this.state.selectedLegs.push(secondIndirectLeg);
    }

    this.state.currentLegIndex++;

    if (this.state.currentLegIndex < this.state.searchQueries.length) {
      // Fetch next leg
      this.isSubmitting = true;
      try {
        const nextQuery = this.state.searchQueries[this.state.currentLegIndex];
        await this.state.searchTrips(nextQuery);
      } catch (e) {
        alert('Failed to search next leg');
      } finally {
        this.isSubmitting = false;
        this.showIndirect = false; // reset for next leg
      }
      return;
    }

    // All legs selected
    const needsSeatSelection = this.state.selectedLegs.some(
      leg => !this.state.isTrainTrip(leg.agencyName || '', leg.transport || '')
    );

    if (needsSeatSelection) {
      this.state.currentLegIndex = 0;
      await this.router.navigate(['/seat-selection']);
    } else {
      await this.router.navigate(['/passenger-details']);
    }
  }

  /** Convert display time like "02:30 PM" to "14:30" for comparison */
  private extractTimeString(displayTime: string): string {
    if (!displayTime) return '00:00';
    const match = displayTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2];
      const period = match[3].toUpperCase();
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
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
