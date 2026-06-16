import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LanguageService } from '../../../core/i18n/language.service';
import {
  FALLBACK_PHONE_CODES,
  getLocalNumberConstraints,
  getLocalNumberPattern,
  PhoneCodeOption
} from '../../phone-codes';

@Component({
  selector: 'app-passenger-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './passenger-card.html',
  styleUrls: ['./passenger-card.scss']
})
export class PassengerCardComponent implements OnInit {
  @Input() group!: FormGroup;
  @Input() index: number = 0;
  @Input() isTrain: boolean = false;
  @Input() showEmail: boolean = true;
  @Input() requirePhone: boolean = true;
  @Input() showHeaderIcon: boolean = false;
  @Input() seatLabel: string = '';
  @Input() phoneCodes: PhoneCodeOption[] = FALLBACK_PHONE_CODES;

  constructor(public language: LanguageService) {}

  ngOnInit() {
    if (!this.group) {
      throw new Error('PassengerCardComponent requires a FormGroup');
    }
  }

  get idType() {
    return this.group.get('idType')?.value || 'NationalId';
  }

  get phoneCode() {
    return this.group.get('phoneCode')?.value || '+20';
  }

  getIdNumberLabel(): string {
    return this.idType === 'Passport' 
      ? this.language.instant('Passport Number') 
      : this.language.instant('National ID Number');
  }

  getIdNumberPlaceholder(): string {
    return this.idType === 'Passport' 
      ? 'A1234567' 
      : this.language.instant('National ID Number');
  }

  getIdNumberInputMode(): string {
    return this.idType === 'Passport' ? 'text' : 'numeric';
  }

  getIdNumberMaxLength(): number {
    return this.idType === 'Passport' ? 20 : 14;
  }

  phoneLocalMinLength(): number {
    return getLocalNumberConstraints(this.phoneCode).min;
  }

  phoneLocalMaxLength(): number {
    return getLocalNumberConstraints(this.phoneCode).max;
  }

  phoneLocalPattern(): string {
    return getLocalNumberPattern(this.phoneCode);
  }

  hasError(controlName: string, errorName: string): boolean {
    const control = this.group.get(controlName);
    return !!(control && control.errors?.[errorName] && (control.dirty || control.touched));
  }
}
