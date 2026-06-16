import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, StationDto, StationGroupDto } from '../../services/api';
import { AppStateService } from '../../services/state';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageService } from '../../core/i18n/language.service';

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
  returnGenerated?: boolean;
}

type ReturnAutomationMode = 'direct' | 'step-by-step';

@Component({
  standalone: true,
  selector: 'app-booking',
  imports: [CommonModule, FormsModule, TranslatePipe],
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
  returnAutomationMode: ReturnAutomationMode | null = null;
  private returnAutomationStartIndex: number | null = null;

  transportMode: 'all' | 'bus' | 'train' = 'all';
  isSearching = false;
  actionError = '';

  showAgencyOptions = false;
  selectedAgency: 'Blue Bus' | 'GoBus' | 'Horus' | 'All companies' = 'All companies';

  todayStr: string = '';
  maxDateStr: string = '';

  constructor(
    public state: AppStateService,
    private api: ApiService,
    private router: Router,
    public language: LanguageService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  async ngOnInit(): Promise<void> {
    const today = new Date();
    this.todayStr = today.toISOString().split('T')[0];
    const maxDate = new Date();
    maxDate.setDate(today.getDate() + 60);
    this.maxDateStr = maxDate.toISOString().split('T')[0];

    await this.loadStations();
    this.initMultiLegs();

    // Handle pre-filled routes from the Popular Routes component
    const state = history.state as { defaultFrom?: string; defaultTo?: string };
    if (state?.defaultFrom && state?.defaultTo) {
      this.fromGovernorate = state.defaultFrom;
      this.toGovernorate = state.defaultTo;
      this.onFromGovernorateChange();
      this.onToGovernorateChange();
    }
  }

  async loadStations(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.isLoadingStations = true;
    this.actionError = '';
    try {
      this.stationGroups = await firstValueFrom(this.api.getStations());
    } catch (error) {
      this.stationGroups = [];
      this.actionError = this.api.formatError(error, this.language.instant('Failed to load stations'));
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

  governorateLabel(group: StationGroupDto): string {
    if (this.language.currentLanguage === 'ar' && group.governorateAr?.trim()) {
      return group.governorateAr.trim();
    }
    return group.governorate;
  }

  stationLabel(station: StationDto): string {
    const stationName = this.language.currentLanguage === 'ar' && station.arabicName?.trim()
      ? station.arabicName.trim()
      : station.englishName;
    const cityName = this.language.currentLanguage === 'ar'
      ? (station.governorateAr?.trim() || this.language.instant(station.city))
      : station.city;

    return cityName ? `${stationName} (${cityName})` : stationName;
  }

  selectTransport(mode: 'all' | 'bus' | 'train') {
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

  decrementPassengers(): void {
    this.passengers = Math.max(1, Math.floor(this.passengers || 1) - 1);
  }

  incrementPassengers(): void {
    this.passengers = Math.min(10, Math.floor(this.passengers || 1) + 1);
  }

  initMultiLegs() {
    this.returnAutomationMode = null;
    this.returnAutomationStartIndex = null;
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
    if (this.returnAutomationMode) {
      return;
    }

    const lastLeg = this.multiLegs[this.multiLegs.length - 1];
    if (!this.isLegRouteComplete(lastLeg)) {
      this.actionError = this.language.instant('Please complete the current leg before adding another');
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
    if (this.returnAutomationMode) {
      if (this.returnAutomationStartIndex !== null && index < this.returnAutomationStartIndex) {
        this.discardReturnAutomation();
        this.multiLegs.splice(index, 1);
      } else {
        this.undoReturnAutomation();
      }
      return;
    }

    this.multiLegs.splice(index, 1);
  }

  onMultiFromGovChange(leg: MultiDestinationLeg) {
    if (leg.fromLocked) {
      return;
    }
    this.discardReturnAutomation();
    const selected = this.stationGroups.find((group) => group.governorate === leg.fromGovernorate);
    leg.fromStations = selected?.stations ?? [];
    leg.fromStationId = null;
  }

  onMultiToGovChange(leg: MultiDestinationLeg) {
    if (leg.toLocked) {
      return;
    }
    this.discardReturnAutomation();
    const selected = this.stationGroups.find((group) => group.governorate === leg.toGovernorate);
    leg.toStations = selected?.stations ?? [];
    leg.toStationId = null;
  }

  onMultiStationChange(): void {
    this.discardReturnAutomation();
  }

  onMultiDateChange(index: number): void {
    for (let i = index + 1; i < this.multiLegs.length; i++) {
      const previousDate = this.multiLegs[i - 1].travelDate;
      if (previousDate && this.multiLegs[i].travelDate && this.multiLegs[i].travelDate < previousDate) {
        this.multiLegs[i].travelDate = '';
      }
    }
  }

  autoReturnStepByStep() {
    this.actionError = '';
    if (this.returnAutomationMode || this.multiLegs.length < 2) return;
    if (!this.validateReturnAutomationLegs()) {
      return;
    }

    const reversedLegs: MultiDestinationLeg[] = [];
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
        toLocked: true,
        returnGenerated: true,
      });
    }
    this.returnAutomationStartIndex = this.multiLegs.length;
    this.returnAutomationMode = 'step-by-step';
    this.multiLegs.push(...reversedLegs);
  }

  autoReturnDirect() {
    this.actionError = '';
    if (this.returnAutomationMode || this.multiLegs.length < 1) return;
    if (!this.validateReturnAutomationLegs()) {
      return;
    }

    const firstLeg = this.multiLegs[0];
    const lastLeg = this.multiLegs[this.multiLegs.length - 1];

    this.returnAutomationStartIndex = this.multiLegs.length;
    this.returnAutomationMode = 'direct';
    this.multiLegs.push({
      fromGovernorate: lastLeg.toGovernorate,
      fromStationId: lastLeg.toStationId,
      toGovernorate: firstLeg.fromGovernorate,
      toStationId: firstLeg.fromStationId,
      travelDate: '',
      fromStations: lastLeg.toStations,
      toStations: firstLeg.fromStations,
      fromLocked: true,
      toLocked: true,
      returnGenerated: true,
    });
  }

  undoReturnAutomation(): void {
    if (this.returnAutomationStartIndex === null) {
      this.clearReturnAutomationState();
      return;
    }

    this.multiLegs = this.multiLegs.slice(0, this.returnAutomationStartIndex);
    this.clearReturnAutomationState();
  }

  get canAddMultiLeg(): boolean {
    const lastLeg = this.multiLegs[this.multiLegs.length - 1];
    return !this.returnAutomationMode && this.isLegRouteComplete(lastLeg);
  }

  get canShowReturnAutomation(): boolean {
    return !this.returnAutomationMode && this.multiLegs.some((leg) => this.isLegComplete(leg));
  }

  private clearReturnAutomationState(): void {
    this.returnAutomationMode = null;
    this.returnAutomationStartIndex = null;
  }

  private discardReturnAutomation(): void {
    if (this.returnAutomationStartIndex !== null) {
      this.multiLegs = this.multiLegs.slice(0, this.returnAutomationStartIndex);
    }
    this.clearReturnAutomationState();
  }

  private isLegRouteComplete(leg?: MultiDestinationLeg): boolean {
    return !!leg?.fromGovernorate && !!leg?.toGovernorate;
  }

  private isLegComplete(leg?: MultiDestinationLeg): boolean {
    return this.isLegRouteComplete(leg) && !!leg?.travelDate;
  }

  private validateReturnAutomationLegs(): boolean {
    const missingRouteIndex = this.multiLegs.findIndex((leg) => !this.isLegRouteComplete(leg));
    if (missingRouteIndex !== -1) {
      this.actionError = this.language.instant('Please choose From and To for Leg {{leg}} before adding a return', {
        leg: missingRouteIndex + 1,
      });
      return false;
    }

    const missingDateIndex = this.multiLegs.findIndex((leg) => !leg.travelDate);
    if (missingDateIndex !== -1) {
      this.actionError = this.language.instant('Please choose a date for Leg {{leg}} before adding a return', {
        leg: missingDateIndex + 1,
      });
      return false;
    }

    return true;
  }

  private isSameLocationInvalid(fromGovernorate: string, fromStationId: number | null, toGovernorate: string, toStationId: number | null): boolean {
    if (fromStationId !== null && toStationId !== null) {
      return fromStationId === toStationId;
    }

    return fromGovernorate === toGovernorate;
  }

  async searchTrips(): Promise<void> {
    this.actionError = '';

    const normalizedPassengers = this.transportMode === 'train'
      ? Math.min(10, Math.max(1, Math.floor(this.passengers || 1)))
      : 1;
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
      let prevDate = '';
      for (let i = 0; i < this.multiLegs.length; i++) {
        const leg = this.multiLegs[i];
        if (!leg.fromGovernorate || !leg.toGovernorate || !leg.travelDate) {
          this.actionError = this.language.instant('Please fill all fields for all legs');
          return;
        }
        if (this.isSameLocationInvalid(leg.fromGovernorate, leg.fromStationId, leg.toGovernorate, leg.toStationId)) {
          this.actionError = this.language.instant('Origin and destination cannot be identical');
          return;
        }
        if (leg.travelDate < this.todayStr) {
          this.actionError = this.language.instant('Date for Leg {{leg}} cannot be in the past', { leg: i + 1 });
          return;
        }
        if (leg.travelDate > this.maxDateStr) {
          this.actionError = this.language.instant('Date for Leg {{leg}} cannot be more than 60 days in the future', { leg: i + 1 });
          return;
        }
        if (prevDate && leg.travelDate < prevDate) {
          this.actionError = this.language.instant('Date for Leg {{leg}} must be on or after Leg {{previousLeg}}', {
            leg: i + 1,
            previousLeg: i,
          });
          return;
        }
        prevDate = leg.travelDate;

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
        this.actionError = this.language.instant('Please fill all required fields');
        return;
      }
      if (this.isSameLocationInvalid(this.fromGovernorate, this.fromStationId, this.toGovernorate, this.toStationId)) {
        this.actionError = this.language.instant('Origin and destination cannot be identical');
        return;
      }
      if (this.date < this.todayStr) {
        this.actionError = this.language.instant('Departure date cannot be in the past');
        return;
      }
      if (this.date > this.maxDateStr) {
        this.actionError = this.language.instant('Departure date cannot be more than 60 days in the future');
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
          this.actionError = this.language.instant('Please specify a return date');
          return;
        }
        if (this.returnDate < this.date) {
          this.actionError = this.language.instant('Return date must be on or after the departure date');
          return;
        }
        if (this.returnDate > this.maxDateStr) {
          this.actionError = this.language.instant('Return date cannot be more than 60 days in the future');
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
      this.actionError = this.api.formatError(error, this.language.instant('Failed to search trips'));
    } finally {
      this.isSearching = false;
    }
  }
}
