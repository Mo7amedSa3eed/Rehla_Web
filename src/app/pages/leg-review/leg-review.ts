import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppStateService } from '../../services/state';
import { ApiService, SeatDto } from '../../services/api';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageService } from '../../core/i18n/language.service';

interface LegReviewState {
  legIndex: number;
  isTrain: boolean;
  seatMap: any;
  selectedClass: any;
  selectedSeats: string[];
  seatRows: { left: SeatDto[]; right: SeatDto[] }[];
  loading: boolean;
  error: string;
}

@Component({
  selector: 'app-leg-review',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './leg-review.html',
  styleUrls: ['./leg-review.scss'],
})
export class LegReviewComponent implements OnInit {
  legStates: LegReviewState[] = [];
  isNavigating = false;
  actionError = '';

  constructor(
    public state: AppStateService,
    private api: ApiService,
    private router: Router,
    private language: LanguageService,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.state.selectedLegs || this.state.selectedLegs.length === 0) {
      await this.router.navigate(['/trips']);
      return;
    }

    // Build per-leg state
    this.legStates = this.state.selectedLegs.map((leg, i) => ({
      legIndex: i,
      isTrain: this.isTrainLeg(leg),
      seatMap: null,
      selectedClass: null,
      selectedSeats: leg.selectedSeats || [],
      seatRows: [],
      loading: false,
      error: '',
    }));

    // Load seat maps for all bus legs in parallel
    const busLegs = this.legStates.filter(ls => !ls.isTrain);
    await Promise.all(busLegs.map(ls => this.loadSeatsForLeg(ls)));
  }

  private isTrainLeg(leg: any): boolean {
    return this.state.isTrainTrip(leg?.rawAgencyName ?? leg?.agencyName ?? '', leg?.transport ?? '');
  }

  private async loadSeatsForLeg(ls: LegReviewState): Promise<void> {
    const leg = this.state.selectedLegs[ls.legIndex];
    ls.loading = true;
    ls.error = '';
    try {
      const map = await this.api.getSeatMap(leg.tripOccurrenceId).toPromise();
      ls.seatMap = map;
      if (map?.classes?.length) {
        ls.selectedClass = map.classes.find((c: any) => c.coachClassId === leg.coachClassId);
        if (!ls.selectedClass) {
          ls.error = this.language.instant('The selected class is no longer available Please choose another class');
          return;
        }
        ls.seatRows = this.calculateSeatRows(ls);
      }
    } catch {
      ls.error = this.language.instant('Could not load seat map for this leg');
    } finally {
      ls.loading = false;
    }
  }

  // ── Seat helpers ──────────────────────────────────────────

  private calculateSeatRows(ls: LegReviewState): { left: SeatDto[]; right: SeatDto[] }[] {
    const seats: SeatDto[] = ls.selectedClass?.seats ?? [];
    const rows: { left: SeatDto[]; right: SeatDto[] }[] = [];
    const columns = this.columnsForClass(ls.selectedClass?.className, ls.selectedClass?.layoutType);
    const rowSize = columns.left + columns.right;

    for (let i = 0; i < seats.length; i += rowSize) {
      rows.push({
        left: seats.slice(i, i + columns.left),
        right: seats.slice(i + columns.left, i + rowSize),
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

  trackByRow(index: number): number {
    return index;
  }

  isSeatSelected(ls: LegReviewState, seatNumber: string): boolean {
    return ls.selectedSeats.includes(seatNumber);
  }

  toggleSeat(ls: LegReviewState, seatNumber: string, status: string): void {
    if (status !== 'Available') return;
    const idx = ls.selectedSeats.indexOf(seatNumber);
    if (idx === -1) {
      ls.selectedSeats.push(seatNumber);
    } else {
      ls.selectedSeats.splice(idx, 1);
    }
  }

  // ── Train passenger count ─────────────────────────────────

  get passengerCount(): number {
    return this.state.searchPassengers || 1;
  }

  decrementPassengers(): void {
    this.state.searchPassengers = Math.max(1, this.passengerCount - 1);
  }

  incrementPassengers(): void {
    this.state.searchPassengers = Math.min(10, this.passengerCount + 1);
  }

  get hasTrainLeg(): boolean {
    return this.legStates.some(ls => ls.isTrain);
  }

  /** Returns true only for the first train leg — this is where the shared counter renders */
  isFirstTrainLeg(legIndex: number): boolean {
    const firstTrainIndex = this.legStates.findIndex(ls => ls.isTrain);
    return firstTrainIndex === legIndex;
  }

  // ── Pricing ───────────────────────────────────────────────

  getLegPrice(ls: LegReviewState): number {
    const leg = this.state.selectedLegs[ls.legIndex];
    const count = ls.isTrain ? this.passengerCount : ls.selectedSeats.length;
    return (leg.price || 0) * Math.max(1, count);
  }

  get totalPrice(): number {
    return this.legStates.reduce((sum, ls) => sum + this.getLegPrice(ls), 0);
  }

  // ── Validation ────────────────────────────────────────────

  get canContinue(): boolean {
    return this.legStates.every(ls => {
      if (ls.isTrain) return true;        // train: no seat selection needed
      return ls.selectedSeats.length > 0; // bus: at least 1 seat
    });
  }

  get validationMessage(): string {
    const busLegs = this.legStates.filter(ls => !ls.isTrain && ls.selectedSeats.length === 0);
    if (busLegs.length === 0) return '';
    if (busLegs.length === 1) {
      const leg = this.state.selectedLegs[busLegs[0].legIndex];
      const legWord = this.language.instant('Leg');
      return this.language.instant('Please select seats for Leg {{index}} ({{from}} → {{to}})', {
        index: busLegs[0].legIndex + 1,
        from: leg.from,
        to: leg.to
      });
    }
    return this.language.instant('Please select seats for all {{count}} bus legs', { count: busLegs.length });
  }

  // ── Navigation ────────────────────────────────────────────

  async goBack(): Promise<void> {
    this.actionError = '';
    // Clear all selected legs so the user starts fresh on the trips page
    this.state.selectedLegs = [];
    this.state.currentLegIndex = 0;

    // Re-fetch leg 0 results so the trips page shows the outbound leg again
    // (when the user selected leg 2, searchResults was overwritten with return results)
    const firstQuery = this.state.searchQueries[0];
    if (firstQuery) {
      try {
        await this.state.searchTrips(firstQuery);
      } catch (error) {
        this.actionError = error instanceof Error ? error.message : this.language.instant('Failed to reload trip results');
        return;
      }
    }

    await this.router.navigate(['/trips']);
  }

  async continueToPassengers(): Promise<void> {
    if (!this.canContinue || this.isNavigating) return;

    // Persist selected seats back to each leg independently
    // Each bus leg keeps its OWN seat count — no cross-leg constraint
    this.legStates.forEach(ls => {
      if (!ls.isTrain) {
        this.state.selectedLegs[ls.legIndex].selectedSeats = [...ls.selectedSeats];
      }
    });
    // Note: searchPassengers is only used for train legs and is already set
    // by the passenger counter on this screen. Bus legs use selectedSeats.length.

    this.isNavigating = true;
    try {
      await this.router.navigate(['/passenger-details']);
    } finally {
      this.isNavigating = false;
    }
  }

  // ── Leg display helpers ───────────────────────────────────

  legLabel(legIndex: number): string {
    if (this.state.selectedLegs.length === 1) return '';
    if (this.state.searchType === 'multi-destination') {
      return `${this.language.instant('Leg')} ${legIndex + 1}`;
    }
    const labels = ['Outbound', 'Return', 'Leg 3', 'Leg 4', 'Leg 5'];
    const label = labels[legIndex] ?? `Leg ${legIndex + 1}`;
    return this.language.instant(label);
  }
}
