import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AppStateService, PassengerDraft } from '../../services/state';
import { ApiService } from '../../services/api';
import { firstValueFrom } from 'rxjs';
import {
  DEFAULT_PHONE_CODE,
  FALLBACK_PHONE_CODES,
  mapCountriesToPhoneCodes,
  PhoneCodeOption,
} from '../../shared/phone-codes';
import { PassengerCardComponent } from '../../shared/components/passenger-card/passenger-card';
import { PassengerAutofillBannerComponent } from '../../shared/components/passenger-autofill-banner/passenger-autofill-banner';

@Component({
  selector: 'app-passenger-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PassengerCardComponent, PassengerAutofillBannerComponent],
  templateUrl: './passenger-details.html',
  styleUrls: ['./passenger-details.scss']
})
export class PassengerDetailsComponent implements OnInit {
  isProcessing = false;
  selectedTrip: any = null;
  isTrain = false;

  form!: FormGroup;
  phoneCodes: PhoneCodeOption[] = FALLBACK_PHONE_CODES;

  pointsToRedeem = 0;
  readonly pointsPerEgp = 20;

  isAutofilled = false;
  autofillError = '';

  constructor(
    public state: AppStateService,
    private router: Router,
    private api: ApiService,
    private fb: FormBuilder
  ) {}

  async ngOnInit(): Promise<void> {
    this.selectedTrip = this.state.selectedTicket;
    if (!this.selectedTrip) {
      await this.router.navigate(['/trips']);
      return;
    }

    this.isTrain = this.state.isTrainTrip(this.selectedTrip.agencyName, this.selectedTrip.transportType);
    
    this.form = this.fb.group({
      passengers: this.fb.array([])
    });

    await this.loadPhoneCodes();
    this.initializePassengers();
  }

  get passengersArray(): FormArray {
    return this.form.get('passengers') as FormArray;
  }

  private initializePassengers(): void {
    const count = this.passengerCount;

    // Load from existing pending passengers if matching count
    if (this.state.pendingPassengers.length === count) {
      this.state.pendingPassengers.forEach((p) => {
        this.passengersArray.push(this.createPassengerGroup(p));
      });
      return;
    }

    // Otherwise create fresh passenger inputs
    for (let i = 0; i < count; i++) {
      const pGroup = this.createPassengerGroup();
      
      // Profile prefill for the FIRST passenger
      if (i === 0 && this.state.userProfile) {
        pGroup.patchValue({
          passengerName: `${this.state.userProfile.firstName || ''} ${this.state.userProfile.lastName || ''}`.trim(),
          email: this.state.userProfile.email || '',
        });

        // If user profile has phone, basic prefill
        if (this.state.userProfile.phone) {
          // For a real app, you'd parse the dial code out of the full E164 string
          pGroup.patchValue({ phoneLocalNumber: this.state.userProfile.phone.replace('+', '') });
        }
      }

      this.passengersArray.push(pGroup);
    }
  }

  private createPassengerGroup(draft?: PassengerDraft): FormGroup {
    return this.fb.group({
      passengerName: [draft?.fullName || '', Validators.required],
      phoneCode: [draft?.phoneCode || DEFAULT_PHONE_CODE],
      phoneLocalNumber: [draft?.phoneLocalNumber || '', Validators.required],
      email: [draft?.email || '', Validators.email],
      idType: [this.isTrain ? (draft?.idType || 'NationalId') : 'NationalId', this.isTrain ? Validators.required : []],
      idNumber: [this.isTrain ? (draft?.nationalId || '') : '', this.isTrain ? Validators.required : []]
    });
  }

  private async loadPhoneCodes(): Promise<void> {
    try {
      const countries = await firstValueFrom(this.api.getCountries());
      this.phoneCodes = mapCountriesToPhoneCodes(countries ?? []);
    } catch {
      this.phoneCodes = FALLBACK_PHONE_CODES;
    }
  }

  // Auto-fill logic for Bus
  get showAutofillBanner(): boolean {
    return !this.isTrain && this.passengerCount > 1;
  }

  handleAutofill(): void {
    this.autofillError = '';
    const firstPax = this.passengersArray.at(0).value;

    if (!firstPax.passengerName?.trim() || !firstPax.phoneLocalNumber?.trim()) {
      this.autofillError = 'Please fill out the Name and Phone of Passenger 1 first.';
      this.isAutofilled = false;
      return;
    }

    for (let i = 1; i < this.passengersArray.length; i++) {
      this.passengersArray.at(i).patchValue({
        phoneCode: firstPax.phoneCode,
        phoneLocalNumber: firstPax.phoneLocalNumber
      });
    }

    this.isAutofilled = true;
  }

  private syncPassengerDrafts(): void {
    this.state.pendingPassengers = this.passengersArray.controls.map((control) => {
      const val = control.value;
      return {
        fullName: val.passengerName,
        phoneCode: val.phoneCode,
        phoneLocalNumber: val.phoneLocalNumber,
        email: val.email,
        nationalId: val.idNumber,
        idType: val.idType
      };
    });
  }

  async addToCart(): Promise<void> {
    if (this.form.invalid || !this.selectedTrip) {
      this.form.markAllAsTouched();
      return;
    }

    this.isProcessing = true;

    try {
      this.syncPassengerDrafts();
      await this.state.addTripToCart(this.selectedTrip);
      await this.router.navigate(['/my-tickets']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add trip to cart';
      alert(message);
    } finally {
      this.isProcessing = false;
    }
  }

  async bookNow(): Promise<void> {
    if (this.form.invalid || !this.selectedTrip) {
      this.form.markAllAsTouched();
      return;
    }

    this.isProcessing = true;

    try {
      this.syncPassengerDrafts();
      await this.state.addTripToCart(this.selectedTrip);
      await this.state.loadBookings();
      
      const booking = this.state.bookings.find(b => b.status === 'pending');
      if (booking) {
        this.state.currentPaymentBooking = booking;
        // Optionally pass pointsToRedeem to payment page via state if needed
        await this.router.navigate(['/payment']);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to proceed with booking';
      alert(message);
    } finally {
      this.isProcessing = false;
    }
  }

  async goBack(): Promise<void> {
    this.state.selectedTicket = null;
    await this.router.navigate(['/trips']);
  }

  get passengerCount(): number {
    return this.state.searchPassengers || 1;
  }

  get totalPrice(): number {
    return (this.selectedTrip?.price || 0) * this.passengerCount;
  }

  get pointsBalance(): number {
    return this.state.userProfile.loyaltyPointsBalance ?? 0;
  }

  get maxRedeemablePoints(): number {
    const maxByPrice = Math.floor(this.totalPrice * this.pointsPerEgp);
    return Math.max(0, Math.min(this.pointsBalance, maxByPrice));
  }

  get discountValue(): number {
    return this.pointsToRedeem / this.pointsPerEgp;
  }

  get finalTotal(): number {
    return Math.max(0, this.totalPrice - this.discountValue);
  }

  onPointsChange(event: Event): void {
    const raw = parseInt((event.target as HTMLInputElement).value, 10) || 0;
    const step = this.pointsPerEgp;
    const clamped = Math.min(Math.max(raw, 0), this.maxRedeemablePoints);
    this.pointsToRedeem = Math.floor(clamped / step) * step;
  }
}
