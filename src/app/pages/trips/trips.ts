import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppStateService } from '../../services/state';
import { UiTrip } from '../../services/state';
import { ApiService, TripClassDto, TripSearchItemDto } from '../../services/api';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './trips.html',
  styleUrls: ['./trips.scss']
})
export class TripsComponent implements OnInit {
  isSubmitting = false;
  actionError = '';
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

  constructor(public state: AppStateService, private router: Router, private api: ApiService, public language: LanguageService) { }

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
    this.actionError = '';
    if (this.showIndirect && this.state.indirectSearchResults.length === 0) {
      const q = this.state.searchQueries[this.state.currentLegIndex] || {};
      this.isSearchingIndirect = true;
      try {
        await this.state.searchIndirectTrips(q);
      } catch (error) {
        this.actionError = this.api.formatError(error, 'Failed to load indirect trips.');
      } finally {
        this.isSearchingIndirect = false;
      }
    }
  }

  async applyFilters(): Promise<void> {
    this.actionError = '';
    const q = this.state.searchQueries[this.state.currentLegIndex];
    if (q) {
      q.pageNumber = 1;
      q.pageSize = 10;
      q.maxPrice = this.filterMaxPrice < this.maxPriceLimit ? this.filterMaxPrice : undefined;
      q.transport = this.filterTransport === 'bus' ? 1 : (this.filterTransport === 'train' ? 2 : 0);
      q.sortBy = this.filterSortBy === 'price' ? 1 : (this.filterSortBy === 'duration' ? 2 : 0);

      this.isSubmitting = true;
      try {
        await this.state.searchTrips(q);
      } catch (error) {
        this.actionError = this.api.formatError(error, 'Failed to apply filters.');
      } finally {
        this.isSubmitting = false;
      }
    }

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
    this.showFilters = false;
  }

  async nextPage(): Promise<void> {
    this.actionError = '';
    if (this.state.searchTripsCurrentPage < this.state.searchTripsTotalPages) {
      const q = this.state.searchQueries[this.state.currentLegIndex];
      q.pageNumber = this.state.searchTripsCurrentPage + 1;
      q.pageSize = 10;
      this.isSubmitting = true;
      try {
        await this.state.searchTrips(q);
        this.applyLocalFiltersOnly();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        this.actionError = this.api.formatError(error, 'Failed to load next page.');
      } finally {
        this.isSubmitting = false;
      }
    }
  }

  async prevPage(): Promise<void> {
    this.actionError = '';
    if (this.state.searchTripsCurrentPage > 1) {
      const q = this.state.searchQueries[this.state.currentLegIndex];
      q.pageNumber = this.state.searchTripsCurrentPage - 1;
      q.pageSize = 10;
      this.isSubmitting = true;
      try {
        await this.state.searchTrips(q);
        this.applyLocalFiltersOnly();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        this.actionError = this.api.formatError(error, 'Failed to load previous page.');
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
    const firstClass = this.firstAvailableClass(dto.availableClasses);
    const transportType = this.extractTransportType(dto);
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
      transport: transportType ?? dto.agencyName,
      agencyName: dto.agencyName,
      rawAgencyName: dto.agencyName,
      price: firstClass?.price ?? dto.startingPrice,
      seats: firstClass?.remainingSeats ?? 0,
      availableClasses: dto.availableClasses ?? [],
      selectedFloorNumber: this.extractFloorNumber(firstClass?.className ?? ''),
      selectedSeatType: this.extractSeatType(firstClass?.className ?? ''),
      routeStops: dto.routeStops ?? [],
    };
  }

  private extractTransportType(dto: TripSearchItemDto): string | number | null {
    const rawDto = dto as TripSearchItemDto & {
      transport?: string | number | null;
      transportType?: string | number | null;
    };

    return rawDto.transportType ?? rawDto.transport ?? null;
  }

  selectClassForTrip(trip: UiTrip, cls: TripClassDto): void {
    trip.coachClassId = cls.coachClassId;
    trip.className = cls.className;
    trip.price = cls.price;
    trip.seats = cls.remainingSeats;
    trip.selectedFloorNumber = this.extractFloorNumber(cls.className);
    trip.selectedSeatType = this.extractSeatType(cls.className);
    trip.selectedSeats = [];
  }

  selectClassIdForTrip(trip: UiTrip, coachClassId: number): void {
    const selectedClass = trip.availableClasses.find((item) => item.coachClassId === Number(coachClassId));
    if (!selectedClass) {
      return;
    }

    this.selectClassForTrip(trip, selectedClass);
  }

  classOptionLabel(trip: UiTrip, cls: TripClassDto, classIndex: number): string {
    const floorNumber = this.extractFloorNumber(cls.className);
    const floorLabel =
      floorNumber !== null
        ? `Floor ${floorNumber}`
        : trip.availableClasses.length > 1
          ? `Floor ${classIndex + 1}`
          : 'Standard';

    return `${floorLabel} - ${cls.className} - ${cls.remainingSeats} seats - ${cls.price} EGP`;
  }

  async goBackOneLeg(): Promise<void> {
    if (this.state.currentLegIndex > 0) {
      this.state.currentLegIndex--;
      this.state.selectedLegs.pop(); // Remove the previously selected leg

      this.isSubmitting = true;
      this.actionError = '';
      try {
        const prevQuery = this.state.searchQueries[this.state.currentLegIndex];
        await this.state.searchTrips(prevQuery);
        this.applyLocalFiltersOnly();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (error) {
        this.actionError = this.api.formatError(error, 'Failed to load previous leg trips.');
      } finally {
        this.isSubmitting = false;
        this.showIndirect = false;
      }
    }
  }

  async selectIndirectTrip(indirectDto: any): Promise<void> {
    const leg1 = this.mapDtoToUiTrip(indirectDto.legs[0]);
    const leg2 = this.mapDtoToUiTrip(indirectDto.legs[1]);
    await this.selectTrip(leg1, leg2);
  }

  async selectTrip(trip: any, secondIndirectLeg?: any): Promise<void> {
    // Safety guard: if we're selecting the first leg (currentLegIndex === 0)
    // and stale legs exist from a previous attempt, clear them first
    if (this.state.currentLegIndex === 0 && this.state.selectedLegs.length > 0) {
      this.state.selectedLegs = [];
    }

    if (this.state.currentLegIndex === 0) {
      this.state.pendingPassengers = [];
    }

    this.state.selectedLegs.push(trip);
    if (secondIndirectLeg) {
      this.state.selectedLegs.push(secondIndirectLeg);
    }

    this.state.currentLegIndex++;

    if (this.state.currentLegIndex < this.state.searchQueries.length) {
      // More legs to select — reload results for next leg
      this.isSubmitting = true;
      try {
        const nextQuery = this.state.searchQueries[this.state.currentLegIndex];
        await this.state.searchTrips(nextQuery);
      } catch (error) {
        this.actionError = this.api.formatError(error, 'Failed to search next leg.');
      } finally {
        this.isSubmitting = false;
        this.showIndirect = false; // reset for next leg
      }
      return;
    }

    // All legs selected — go to the combined leg-review screen
    // (handles seat selection for bus and passenger count for train in one scrollable page)
    this.state.currentLegIndex = 0;
    await this.router.navigate(['/leg-review']);
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

  private firstAvailableClass(classes: TripClassDto[] | null | undefined): TripClassDto | undefined {
    return (classes ?? []).find((item) => item.remainingSeats > 0) ?? classes?.[0];
  }

  private extractFloorNumber(className: string): number | null {
    return extractFloorNumber(className);
  }

  private extractSeatType(className: string): string {
    return extractSeatType(className);
  }
}

function extractFloorNumber(className: string): number | null {
  const match = /(?:floor|deck|level)\s*(\d+)/i.exec(className ?? '');
  return match ? Number(match[1]) : null;
}

function extractSeatType(className: string): string {
  const floorMatch = /floor\s*\d+\s+(\w+)/i.exec(className ?? '');
  if (floorMatch) return floorMatch[1];

  const parts = (className ?? '').trim().split(/[\s-]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : className;
}
