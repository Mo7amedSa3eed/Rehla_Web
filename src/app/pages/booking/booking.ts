import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, StationDto, StationGroupDto } from '../../services/api';
import { AppStateService } from '../../services/state';

@Component({
  standalone: true,
  selector: 'app-booking',
  imports: [CommonModule, FormsModule],
  templateUrl: './booking.html',
  styleUrls: ['./booking.scss']

})
export class BookingComponent implements OnInit {

  fromGovernorate = '';
  toGovernorate = '';
  fromStationId: number | null = null;
  toStationId: number | null = null;
  stationGroups: StationGroupDto[] = [];
  fromStations: StationDto[] = [];
  toStations: StationDto[] = [];
  isLoadingStations = false;
  date = '';
  time = '';
  passengers:number = 1;

  transportMode = '';
  isSearching = false;
  // tripType = 'oneway';

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

  async searchTrips(): Promise<void> {
    if (
      !this.fromGovernorate ||
      !this.toGovernorate ||
      !this.date ||
      !this.transportMode
    ) {
      alert('Please fill all fields');
      return;
    }

    const normalizedPassengers = Math.max(1, Math.floor(this.passengers || 1));
    this.passengers = normalizedPassengers;

    this.isSearching = true;

    try {
      const preferredAgencies =
        this.transportMode === 'bus' && this.selectedAgency !== 'All companies'
          ? [this.selectedAgency]
          : undefined;

      await this.state.searchTrips({
        travelDate: this.date,
        fromGovernorate: this.fromGovernorate,
        fromStationId: this.fromStationId ?? undefined,
        toGovernorate: this.toGovernorate,
        toStationId: this.toStationId ?? undefined,
        passengers: normalizedPassengers,
        transport: this.transportMode === 'bus' ? 1 : 2,
        preferredAgencies,
      });

      await this.router.navigate(['/trips']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search trips';
      alert(message);
    } finally {
      this.isSearching = false;
    }
  }
}