import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AppStateService, DirectBookingError, PassengerDraft } from '../../services/state';
import { ApiService } from '../../services/api';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  DEFAULT_PHONE_CODE,
  FALLBACK_PHONE_CODES,
  mapCountriesToPhoneCodes,
  PhoneCodeOption,
  splitPhoneNumber,
} from '../../shared/phone-codes';
import { PassengerCardComponent } from '../../shared/components/passenger-card/passenger-card';
import { PassengerAutofillBannerComponent } from '../../shared/components/passenger-autofill-banner/passenger-autofill-banner';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-passenger-details',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PassengerCardComponent, PassengerAutofillBannerComponent, TranslatePipe],
  templateUrl: './passenger-details.html',
  styleUrls: ['./passenger-details.scss']
})
export class PassengerDetailsComponent implements OnInit, OnDestroy {
  isProcessing = false;
  actionError = '';
  selectedLegs: any[] = [];

  form!: FormGroup;
  phoneCodes: PhoneCodeOption[] = FALLBACK_PHONE_CODES;

  pointsToRedeem = 0;
  readonly pointsPerEgp = 20;

  // Per-leg autofill state
  autofillStates: { isAutofilled: boolean; autofillError: string }[] = [];
  private autofillSubs: Subscription[] = [];

  constructor(
    public state: AppStateService,
    private router: Router,
    private api: ApiService,
    private fb: FormBuilder,
    public language: LanguageService
  ) {}

  async ngOnInit(): Promise<void> {
    this.selectedLegs = this.state.selectedLegs || [];
    if (!this.selectedLegs || this.selectedLegs.length === 0) {
      await this.router.navigate(['/trips']);
      return;
    }

    this.form = this.fb.group({ legs: this.fb.array([]) });

    await Promise.all([
      this.loadPhoneCodes(),
      this.state.loadProfile().catch(() => undefined),
    ]);

    this.initializeLegs();
  }

  ngOnDestroy(): void {
    this.autofillSubs.forEach(s => s.unsubscribe());
  }

  // ── Form structure ────────────────────────────────────────

  get legsArray(): FormArray {
    return this.form.get('legs') as FormArray;
  }

  getPassengersArray(legIdx: number): FormArray {
    return (this.legsArray.at(legIdx) as FormGroup).get('passengers') as FormArray;
  }

  private initializeLegs(): void {
    this.autofillSubs.forEach(s => s.unsubscribe());
    this.autofillSubs = [];
    this.autofillStates = [];
    (this.legsArray as FormArray).clear();

    const profileDraft = this.profilePassengerDraft();

    this.selectedLegs.forEach((leg, legIdx) => {
      const isTrain = this.isLegTrain(legIdx);
      const count = this.passengerCountForLeg(legIdx);
      const passengersArray = this.fb.array([] as FormGroup[]);

      for (let i = 0; i < count; i++) {
        // Profile prefill for passenger 0 of EVERY leg (spec §7)
        // Other passengers get blank forms
        const draft = i === 0 ? profileDraft : undefined;
        passengersArray.push(this.createPassengerGroup(draft, isTrain));
      }

      this.legsArray.push(this.fb.group({ passengers: passengersArray }));
      this.autofillStates.push({ isAutofilled: false, autofillError: '' });
      this.watchFirstPassengerForAutofillReset(legIdx);
    });
  }

  private createPassengerGroup(draft?: PassengerDraft, isTrain = false): FormGroup {
    return this.fb.group({
      passengerName: [draft?.fullName || '', Validators.required],
      phoneCode: [draft?.phoneCode || DEFAULT_PHONE_CODE],
      phoneLocalNumber: [draft?.phoneLocalNumber || '', Validators.required],
      email: [draft?.email || '', Validators.email],
      idType: [isTrain ? (draft?.idType || 'NationalId') : 'NationalId', isTrain ? Validators.required : []],
      idNumber: [isTrain ? (draft?.nationalId || '') : '', isTrain ? Validators.required : []]
    });
  }

  // ── Per-leg helpers ───────────────────────────────────────

  isLegTrain(legIdx: number): boolean {
    const leg = this.selectedLegs[legIdx];
    return this.state.isTrainTrip(leg?.rawAgencyName ?? leg?.agencyName ?? '', leg?.transport ?? '');
  }

  passengerCountForLeg(legIdx: number): number {
    const leg = this.selectedLegs[legIdx];
    if (this.isLegTrain(legIdx)) {
      // Train: use the shared counter the user set on leg-review
      return this.state.searchPassengers || 1;
    }
    // Bus: one form per selected seat, no cross-leg enforcement
    return leg?.selectedSeats?.length ?? 0;
  }

  legLabel(legIdx: number): string {
    if (this.state.searchType === 'multi-destination') {
      return this.language.instant('Leg {{index}}', { index: legIdx + 1 });
    }
    const labels = [
      this.language.instant('Outbound'),
      this.language.instant('Return'),
      this.language.instant('Leg 3'),
      this.language.instant('Leg 4'),
      this.language.instant('Leg 5')
    ];
    return labels[legIdx] ?? this.language.instant('Leg {{index}}', { index: legIdx + 1 });
  }

  get isMultiLeg(): boolean {
    return this.selectedLegs.length > 1;
  }

  // ── Autofill ─────────────────────────────────────────────

  showAutofillBanner(legIdx: number): boolean {
    return !this.isLegTrain(legIdx) && this.getPassengersArray(legIdx).length > 1;
  }

  handleAutofill(legIdx: number): void {
    const state = this.autofillStates[legIdx];
    state.autofillError = '';
    const paxArray = this.getPassengersArray(legIdx);
    const firstPax = paxArray.at(0).value;

    if (!firstPax.passengerName?.trim() || !firstPax.phoneLocalNumber?.trim()) {
      state.autofillError = this.language.instant('Please fill out the Name and Phone of Passenger 1 first');
      state.isAutofilled = false;
      return;
    }

    for (let i = 1; i < paxArray.length; i++) {
      paxArray.at(i).patchValue({
        passengerName: firstPax.passengerName,
        phoneCode: firstPax.phoneCode,
        phoneLocalNumber: firstPax.phoneLocalNumber,
      });
    }

    state.isAutofilled = true;
  }

  private watchFirstPassengerForAutofillReset(legIdx: number): void {
    if (this.isLegTrain(legIdx)) return;
    const paxArray = this.getPassengersArray(legIdx);
    if (paxArray.length === 0) return;

    const firstPax = paxArray.at(0);
    let prev = { ...firstPax.value };

    const sub = firstPax.valueChanges.subscribe((value) => {
      const changed =
        value.passengerName !== prev.passengerName ||
        value.phoneCode !== prev.phoneCode ||
        value.phoneLocalNumber !== prev.phoneLocalNumber;

      if (changed && this.autofillStates[legIdx]?.isAutofilled) {
        this.autofillStates[legIdx].isAutofilled = false;
      }
      prev = { ...value };
    });

    this.autofillSubs.push(sub);
  }

  // ── Profile prefill helpers ───────────────────────────────

  private profilePassengerDraft(): PassengerDraft | undefined {
    if (!this.state.isProfileLoaded) return undefined;

    const profile = this.state.userProfile;
    const fullName = [profile.firstName, profile.lastName, profile.familyName]
      .map((part) => (part || '').trim())
      .filter(Boolean)
      .join(' ');
    const phone = profile.phone
      ? splitPhoneNumber(profile.phone, this.phoneCodes)
      : { dialCode: DEFAULT_PHONE_CODE, localNumber: '' };

    if (!fullName && !phone.localNumber && !profile.email && !profile.idNumber) {
      return undefined;
    }

    return {
      fullName,
      phoneCode: phone.dialCode,
      phoneLocalNumber: phone.localNumber,
      email: profile.email || '',
      idType: this.profileIdType(),
      nationalId: profile.idNumber || '',
    };
  }

  private profileIdType(): 'NationalId' | 'Passport' {
    const idType = String(this.state.userProfile.idType ?? '').toLowerCase();
    return idType === '2' || idType === 'passport' ? 'Passport' : 'NationalId';
  }

  private mergePassengerDraft(profileDraft?: PassengerDraft, savedDraft?: PassengerDraft): PassengerDraft | undefined {
    if (!profileDraft) return savedDraft;
    if (!savedDraft) return profileDraft;
    return {
      fullName: savedDraft.fullName?.trim() || profileDraft.fullName,
      phoneCode: savedDraft.phoneLocalNumber?.trim() ? savedDraft.phoneCode : profileDraft.phoneCode,
      phoneLocalNumber: savedDraft.phoneLocalNumber?.trim() || profileDraft.phoneLocalNumber,
      email: savedDraft.email?.trim() || profileDraft.email,
      idType: savedDraft.idType || profileDraft.idType,
      nationalId: savedDraft.nationalId?.trim() || profileDraft.nationalId,
    };
  }

  // ── Phone codes ───────────────────────────────────────────

  private async loadPhoneCodes(): Promise<void> {
    try {
      const countries = await firstValueFrom(this.api.getCountries());
      this.phoneCodes = mapCountriesToPhoneCodes(countries ?? []);
    } catch {
      this.phoneCodes = FALLBACK_PHONE_CODES;
    }
  }

  // ── Sync drafts (flatten legs → passengers) ───────────────

  private syncPassengerDrafts(): void {
    // Flatten to first leg's passengers for backward compat with state.pendingPassengers
    const firstLegPax = this.getPassengersArray(0);
    this.state.pendingPassengers = firstLegPax.controls.map((control) => {
      const val = control.value;
      return {
        fullName: val.passengerName,
        phoneCode: val.phoneCode,
        phoneLocalNumber: val.phoneLocalNumber,
        email: val.email,
        nationalId: val.idNumber,
        idType: val.idType,
      };
    });
  }

  // ── Actions ───────────────────────────────────────────────

  async addToCart(): Promise<void> {
    this.actionError = '';
    if (this.form.invalid || this.selectedLegs.length === 0) {
      this.form.markAllAsTouched();
      this.actionError = this.language.instant('Please complete all passenger details before adding to cart');
      return;
    }

    this.isProcessing = true;
    try {
      this.syncPassengerDrafts();
      await this.state.addLegsToCart();
      await this.router.navigate(['/cart']);
    } catch (error) {
      this.actionError = this.api.formatError(error, this.language.instant('Failed to add trips to cart'));
    } finally {
      this.isProcessing = false;
    }
  }

  async bookNow(): Promise<void> {
    this.actionError = '';
    if (this.form.invalid || this.selectedLegs.length === 0) {
      this.form.markAllAsTouched();
      this.actionError = this.language.instant('Please complete all passenger details before booking');
      return;
    }

    this.isProcessing = true;
    try {
      this.syncPassengerDrafts();
      await this.state.bookSelectedLegsNow(this.pointsToRedeem);
      await this.router.navigate(['/my-tickets']);
    } catch (error) {
      this.actionError = this.api.formatError(error, this.language.instant('Failed to proceed with booking'));
      if (error instanceof DirectBookingError && error.cartAdded) {
        await this.router.navigate(['/cart'], {
          state: { cartError: this.actionError },
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  async goBack(): Promise<void> {
    // Return to seat selection (leg-review), not all the way back to trip search.
    // Selected legs and seats are preserved so the user just adjusts seats.
    await this.router.navigate(['/leg-review']);
  }

  // ── Pricing / points ──────────────────────────────────────

  get totalPrice(): number {
    return this.selectedLegs.reduce((sum, leg, legIdx) => {
      const count = this.isLegTrain(legIdx)
        ? (this.state.searchPassengers || 1)
        : Math.max(1, leg.selectedSeats?.length ?? 1);
      return sum + ((leg.price || 0) * count);
    }, 0);
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
