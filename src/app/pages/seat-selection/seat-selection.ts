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

  constructor(public state: AppStateService, private api: ApiService, public router: Router, private location: Location) {}

  async ngOnInit(): Promise<void> {
    const trip = this.state.selectedTicket;
    if (!trip) {
      await this.router.navigate(['/trips']);
      return;
    }

    try {
      this.loading = true;
      const map = await this.api.getSeatMap(trip.tripOccurrenceId).toPromise();
      this.seatMap = map;
      if (map && map.classes && map.classes.length > 0) {
        this.selectedClass = map.classes[0];
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
    this.location.back();
  }

  continue(): void {
    if (this.selectedSeatsLocal.length === 0) return;
    this.state.selectedSeats = [...this.selectedSeatsLocal];
    this.router.navigate(['/passenger-details']);
  }

  get tripInfo() {
    return this.state.selectedTicket;
  }

  get totalPrice(): number {
    if (!this.tripInfo) return 0;
    return this.tripInfo.price * this.selectedSeatsLocal.length;
  }
}
