import { Component, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AppStateService } from '../../services/state';
import { ApiService, SeatDto } from '../../services/api';

@Component({
  selector: 'app-seat-selection',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './seat-selection.html',
  styleUrls: ['./seat-selection.scss']
})
export class SeatSelectionComponent implements OnInit {
  seatMap: any = null;
  selectedSeatsLocal: string[] = [];
  loading = false;
  errorMessage = '';
  selectedClass: any = null;
  currentLegIndex = 0;

  constructor(public state: AppStateService, private api: ApiService, public router: Router, private location: Location) {}

  async ngOnInit(): Promise<void> {
    if (!this.state.selectedLegs || this.state.selectedLegs.length === 0) {
      await this.router.navigate(['/trips']);
      return;
    }

    // Find first leg that requires seat selection (bus)
    this.currentLegIndex = this.state.selectedLegs.findIndex(leg => !this.isTrainLeg(leg));

    if (this.currentLegIndex === -1) {
      this.router.navigate(['/passenger-details']);
      return;
    }

    await this.loadSeats();
  }

  async loadSeats() {
    const trip = this.tripInfo;
    this.selectedSeatsLocal = trip.selectedSeats || [];
    this.errorMessage = '';
    try {
      this.loading = true;
      const map = await this.api.getSeatMap(trip.tripOccurrenceId).toPromise();
      this.seatMap = map;
      if (map && map.classes && map.classes.length > 0) {
        this.selectedClass = map.classes.find((c: any) => c.coachClassId === trip.coachClassId);
        if (!this.selectedClass) {
          this.errorMessage = 'The selected class is no longer available. Please choose another class.';
        }
      }
    } catch (error) {
      this.seatMap = null;
      this.errorMessage = this.api.formatError(error, 'Could not load seat map for this trip.');
    } finally {
      this.loading = false;
    }
  }

  toggleSeat(seatNumber: string, status: string): void {
    if (status !== 'Available') {
      return;
    }

    const idx = this.selectedSeatsLocal.indexOf(seatNumber);
    if (idx === -1) {
      this.selectedSeatsLocal.push(seatNumber);
    } else {
      this.selectedSeatsLocal.splice(idx, 1);
    }
  }

  isSeatSelected(seatNumber: string): boolean {
    return this.selectedSeatsLocal.includes(seatNumber);
  }

  get seatRows(): { left: SeatDto[]; right: SeatDto[] }[] {
    const seats = this.selectedClass?.seats ?? [];
    const rows: { left: SeatDto[]; right: SeatDto[] }[] = [];
    const columns = this.columnsForClass(this.selectedClass?.className, this.selectedClass?.layoutType);
    const rowSize = columns.left + columns.right;

    for (let index = 0; index < seats.length; index += rowSize) {
      rows.push({
        left: seats.slice(index, index + columns.left),
        right: seats.slice(index + columns.left, index + rowSize)
      });
    }

    return rows;
  }

  private columnsForClass(className?: string, layoutType?: string | null): { left: number; right: number } {
    const layoutColumns = this.columnsFromLayoutType(layoutType);
    if (layoutColumns) {
      return layoutColumns;
    }

    return this.extractFloorNumber(className ?? '') === 2
      ? { left: 1, right: 2 }
      : { left: 2, right: 2 };
  }

  private columnsFromLayoutType(layoutType?: string | null): { left: number; right: number } | null {
    const parts = (layoutType ?? '').split('x');
    if (parts.length !== 2) {
      return null;
    }

    return {
      left: Number(parts[0]) || 2,
      right: Number(parts[1]) || 2,
    };
  }

  private extractFloorNumber(className: string): number | null {
    const match = /(?:floor|deck|level)\s*(\d+)/i.exec(className);
    return match ? Number(match[1]) : null;
  }

  goBack(): void {
    if (this.currentLegIndex > 0) {
      // Find previous leg that required seat selection
      let prevIndex = -1;
      for (let i = this.currentLegIndex - 1; i >= 0; i--) {
        const leg = this.state.selectedLegs[i];
        if (!this.isTrainLeg(leg)) {
          prevIndex = i;
          break;
        }
      }
      if (prevIndex !== -1) {
        this.currentLegIndex = prevIndex;
        this.loadSeats();
        return;
      }
    }
    this.location.back();
  }

  continue(): void {
    this.errorMessage = '';
    if (this.selectedSeatsLocal.length === 0) {
      this.errorMessage = 'Please select at least one seat.';
      return;
    }

    this.tripInfo.selectedSeats = [...this.selectedSeatsLocal];

    // Find next leg that requires seat selection
    let nextIndex = this.state.selectedLegs.findIndex((leg, idx) => idx > this.currentLegIndex && !this.isTrainLeg(leg));

    if (nextIndex !== -1) {
      this.currentLegIndex = nextIndex;
      this.loadSeats();
    } else {
      this.state.searchPassengers = Math.max(
        1,
        ...this.state.selectedLegs.map((leg) => leg.selectedSeats?.length ?? 0),
      );
      this.router.navigate(['/passenger-details']);
    }
  }

  get tripInfo() {
    return this.state.selectedLegs[this.currentLegIndex];
  }

  get isLastSeatSelection() {
    return this.state.selectedLegs.findIndex((leg, idx) => idx > this.currentLegIndex && !this.isTrainLeg(leg)) === -1;
  }

  get totalPrice(): number {
    if (!this.tripInfo) return 0;
    return this.tripInfo.price * this.selectedSeatsLocal.length;
  }

  private isTrainLeg(leg: any): boolean {
    return this.state.isTrainTrip(leg?.rawAgencyName ?? leg?.agencyName ?? '', leg?.transport ?? '');
  }
}
