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
  selectedClass: any = null;
  currentLegIndex = 0;

  constructor(public state: AppStateService, private api: ApiService, public router: Router, private location: Location) {}

  async ngOnInit(): Promise<void> {
    if (!this.state.selectedLegs || this.state.selectedLegs.length === 0) {
      await this.router.navigate(['/trips']);
      return;
    }

    // Find first leg that requires seat selection (bus)
    this.currentLegIndex = this.state.selectedLegs.findIndex(leg => !this.state.isTrainTrip(leg.agencyName || '', leg.transport || ''));

    if (this.currentLegIndex === -1) {
      this.router.navigate(['/passenger-details']);
      return;
    }

    await this.loadSeats();
  }

  async loadSeats() {
    const trip = this.tripInfo;
    this.selectedSeatsLocal = trip.selectedSeats || [];
    try {
      this.loading = true;
      const map = await this.api.getSeatMap(trip.tripOccurrenceId).toPromise();
      this.seatMap = map;
      if (map && map.classes && map.classes.length > 0) {
        this.selectedClass = map.classes.find((c: any) => c.coachClassId === trip.coachClassId) || map.classes[0];
      }
    } catch {
      this.seatMap = null;
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
      if (this.selectedSeatsLocal.length >= this.state.searchPassengers) {
        alert(`You can only select ${this.state.searchPassengers} seat(s).`);
        return;
      }
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

    for (let index = 0; index < seats.length; index += 4) {
      rows.push({
        left: seats.slice(index, index + 2),
        right: seats.slice(index + 2, index + 4)
      });
    }

    return rows;
  }

  goBack(): void {
    if (this.currentLegIndex > 0) {
      // Find previous leg that required seat selection
      let prevIndex = -1;
      for (let i = this.currentLegIndex - 1; i >= 0; i--) {
        const leg = this.state.selectedLegs[i];
        if (!this.state.isTrainTrip(leg.agencyName || '', leg.transport || '')) {
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
    if (this.selectedSeatsLocal.length !== this.state.searchPassengers) {
      alert(`Please select exactly ${this.state.searchPassengers} seat(s).`);
      return;
    }

    this.tripInfo.selectedSeats = [...this.selectedSeatsLocal];

    // Find next leg that requires seat selection
    let nextIndex = this.state.selectedLegs.findIndex((leg, idx) => idx > this.currentLegIndex && !this.state.isTrainTrip(leg.agencyName || '', leg.transport || ''));

    if (nextIndex !== -1) {
      this.currentLegIndex = nextIndex;
      this.loadSeats();
    } else {
      this.router.navigate(['/passenger-details']);
    }
  }

  get tripInfo() {
    return this.state.selectedLegs[this.currentLegIndex];
  }

  get isLastSeatSelection() {
    return this.state.selectedLegs.findIndex((leg, idx) => idx > this.currentLegIndex && !this.state.isTrainTrip(leg.agencyName || '', leg.transport || '')) === -1;
  }

  get totalPrice(): number {
    if (!this.tripInfo) return 0;
    return this.tripInfo.price * this.selectedSeatsLocal.length;
  }
}
