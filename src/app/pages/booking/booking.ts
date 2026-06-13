import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, StationDto, StationGroupDto } from '../../services/api';
import { AppStateService } from '../../services/state';

export interface MultiDestinationLeg {
  fromGovernorate: string;
  fromStationId: number | null;
  toGovernorate: string;
  toStationId: number | null;
  travelDate: string;
  fromStations: StationDto[];
  toStations: StationDto[];
  fromLocked?: boolean;
  toLocked?: boolean;
}

@Component({
  standalone: true,
  selector: 'app-booking',
  imports: [CommonModule, FormsModule],
  templateUrl: './booking.html',
  styleUrls: ['./booking.scss']
})
export class BookingComponent implements OnInit {

  tripType: 'oneway' | 'round' | 'multi-destination' = 'oneway';

  fromGovernorate = '';
  toGovernorate = '';
  fromStationId: number | null = null;
  toStationId: number | null = null;
  stationGroups: StationGroupDto[] = [];
  fromStations: StationDto[] = [];
  toStations: StationDto[] = [];
  isLoadingStations = false;
  date = '';
  returnDate = '';
  passengers: number = 1;

  multiLegs: MultiDestinationLeg[] = [];

  transportMode = '';
  isSearching = false;

  showAgencyOptions = false;
  selectedAgency: 'Blue Bus' | 'GoBus' | 'Horus' | 'All companies' = 'All companies';

  constructor(
    public state: AppStateService,
    private api: ApiService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadStations();
    this.initMultiLegs();
  }

  async loadStations(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.isLoadingStations = true;
    try {
      this.stationGroups = await firstValueFrom(this.api.getStations());
    } catch {
      this.stationGroups = [];
      alert('Failed to load stations. Please ensure backend API is running.');
    } finally {
      this.isLoadingStations = false;
    }
  }

  onFromGovernorateChange(): void {
    const selected = this.stationGroups.find((group) => group.governorate === this.fromGovernorate);
    this.fromStations = selected?.stations ?? [];
    this.fromStationId = null;
  }

  onToGovernorateChange(): void {
    const selected = this.stationGroups.find((group) => group.governorate === this.toGovernorate);
    this.toStations = selected?.stations ?? [];
    this.toStationId = null;
  }

  selectTransport(mode: string) {
    this.transportMode = mode;

    if (mode !== 'bus') {
      this.showAgencyOptions = false;
      this.selectedAgency = 'All companies';
    }
  }

  onBusCardClick(): void {
    if (this.transportMode !== 'bus') {
      this.transportMode = 'bus';
      this.showAgencyOptions = true;
      return;
    }
    this.showAgencyOptions = !this.showAgencyOptions;
  }

  selectAgency(value: 'Blue Bus' | 'GoBus' | 'Horus' | 'All companies'): void {
    this.selectedAgency = value;
  }

  initMultiLegs() {
    this.multiLegs = [{
      fromGovernorate: '',
      fromStationId: null,
      toGovernorate: '',
      toStationId: null,
      travelDate: '',
      fromStations: [],
      toStations: []
    }];
  }

  addLeg() {
    const lastLeg = this.multiLegs[this.multiLegs.length - 1];
    if (!lastLeg.fromGovernorate || !lastLeg.toGovernorate || !lastLeg.travelDate) {
      alert('Please complete the current leg before adding another.');
      return;
    }

    this.multiLegs.push({
      fromGovernorate: lastLeg.toGovernorate,
      fromStationId: lastLeg.toStationId,
      toGovernorate: '',
      toStationId: null,
      travelDate: '',
      fromStations: lastLeg.toStations,
      toStations: [],
      fromLocked: true
    });
  }

  removeLeg(index: number) {
    this.multiLegs.splice(index, 1);
  }

  onMultiFromGovChange(leg: MultiDestinationLeg) {
    const selected = this.stationGroups.find((group) => group.governorate === leg.fromGovernorate);
    leg.fromStations = selected?.stations ?? [];
    leg.fromStationId = null;
  }

  onMultiToGovChange(leg: MultiDestinationLeg) {
    const selected = this.stationGroups.find((group) => group.governorate === leg.toGovernorate);
    leg.toStations = selected?.stations ?? [];
    leg.toStationId = null;
  }

  autoReturnStepByStep() {
    if (this.multiLegs.length < 1) return;
    const lastLeg = this.multiLegs[this.multiLegs.length - 1];
    
    // Reverse logic: append C->B, B->A
    const reversedLegs = [];
    for (let i = this.multiLegs.length - 1; i >= 0; i--) {
      const origLeg = this.multiLegs[i];
      reversedLegs.push({
        fromGovernorate: origLeg.toGovernorate,
        fromStationId: origLeg.toStationId,
        toGovernorate: origLeg.fromGovernorate,
        toStationId: origLeg.fromStationId,
        travelDate: '',
        fromStations: origLeg.toStations,
        toStations: origLeg.fromStations,
        fromLocked: true,
        toLocked: true
      });
    }
    this.multiLegs.push(...reversedLegs);
  }

  autoReturnDirect() {
    if (this.multiLegs.length < 1) return;
    const firstLeg = this.multiLegs[0];
    const lastLeg = this.multiLegs[this.multiLegs.length - 1];
    
    this.multiLegs.push({
      fromGovernorate: lastLeg.toGovernorate,
      fromStationId: lastLeg.toStationId,
      toGovernorate: firstLeg.fromGovernorate,
      toStationId: firstLeg.fromStationId,
      travelDate: '',
      fromStations: lastLeg.toStations,
      toStations: firstLeg.fromStations,
      fromLocked: true,
      toLocked: true
    });
  }

  async searchTrips(): Promise<void> {
    if (!this.transportMode) {
      alert('Please choose a transportation mode');
      return;
    }

    const normalizedPassengers = Math.max(1, Math.floor(this.passengers || 1));
    this.passengers = normalizedPassengers;

    const preferredAgencies =
      this.transportMode === 'bus' && this.selectedAgency !== 'All companies'
        ? [this.selectedAgency]
        : undefined;

    const transportType = this.transportMode === 'bus' ? 1 : (this.transportMode === 'train' ? 2 : 0);

    this.state.searchType = this.tripType;
    this.state.searchQueries = [];
    this.state.currentLegIndex = 0;
    this.state.selectedLegs = [];

    if (this.tripType === 'multi-destination') {
      for (const leg of this.multiLegs) {
        if (!leg.fromGovernorate || !leg.toGovernorate || !leg.travelDate) {
          alert('Please fill all fields for all legs.');
          return;
        }
        if (leg.fromGovernorate === leg.toGovernorate && leg.fromStationId === leg.toStationId) {
          alert('Origin and destination cannot be identical.');
          return;
        }
        this.state.searchQueries.push({
          travelDate: leg.travelDate,
          fromGovernorate: leg.fromGovernorate,
          fromStationId: leg.fromStationId ?? undefined,
          toGovernorate: leg.toGovernorate,
          toStationId: leg.toStationId ?? undefined,
          passengers: normalizedPassengers,
          transport: transportType,
          preferredAgencies,
        });
      }
    } else {
      if (!this.fromGovernorate || !this.toGovernorate || !this.date) {
        alert('Please fill all required fields');
        return;
      }
      if (this.fromGovernorate === this.toGovernorate && this.fromStationId === this.toStationId) {
        alert('Origin and destination cannot be identical.');
        return;
      }
      
      this.state.searchQueries.push({
        travelDate: this.date,
        fromGovernorate: this.fromGovernorate,
        fromStationId: this.fromStationId ?? undefined,
        toGovernorate: this.toGovernorate,
        toStationId: this.toStationId ?? undefined,
        passengers: normalizedPassengers,
        transport: transportType,
        preferredAgencies,
      });

      if (this.tripType === 'round') {
        if (!this.returnDate) {
          alert('Please specify a return date');
          return;
        }
        if (this.returnDate < this.date) {
          alert('Return date must be after departure date');
          return;
        }
        this.state.searchQueries.push({
          travelDate: this.returnDate,
          fromGovernorate: this.toGovernorate,
          fromStationId: this.toStationId ?? undefined,
          toGovernorate: this.fromGovernorate,
          toStationId: this.fromStationId ?? undefined,
          passengers: normalizedPassengers,
          transport: transportType,
          preferredAgencies,
        });
      }
    }

    this.isSearching = true;

    try {
      const firstQuery = this.state.searchQueries[0];
      await this.state.searchTrips(firstQuery);
      await this.router.navigate(['/trips']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search trips';
      alert(message);
    } finally {
      this.isSearching = false;
    }
  }
}