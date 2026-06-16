import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/state';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api';
import { firstValueFrom } from 'rxjs';
import {
  buildE164Number,
  DEFAULT_PHONE_CODE,
  FALLBACK_PHONE_CODES,
  getLocalNumberConstraints,
  getLocalNumberPattern,
  isLocalNumberValid,
  mapCountriesToPhoneCodes,
  PhoneCodeOption,
  splitPhoneNumber,
} from '../../shared/phone-codes';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

const nameRegex = /^[a-zA-Z\s\-']+$/;
const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const nationalIdRegex = /^[23]\d{13}$/;
const passportRegex = /^[a-zA-Z0-9\- ]{1,50}$/;

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './edit-profile.html',
  styleUrls: ['./edit-profile.scss']
})
export class EditProfileComponent implements OnInit {
  user: {
    firstName: string;
    familyName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
    photo?: string | null;
  };

  // Identity fields
  selectedIdType: 'none' | 'national' | 'passport' = 'none';
  idNumber = '';

  phoneCodes: PhoneCodeOption[] = FALLBACK_PHONE_CODES;
  selectedPhoneCode = DEFAULT_PHONE_CODE;
  phoneLocalNumber = '';
  selectedPhoto: File | null = null;

  isSaving = false;
  saveError = '';
  saveSuccess = false;

  constructor(
    public state: AppStateService,
    private router: Router,
    private api: ApiService,
  ) {
    const p = this.state.userProfile;
    this.user = {
      firstName: p.firstName,
      familyName: p.familyName,
      lastName: p.lastName,
      email: p.email,
      phoneNumber: p.phone,
      photo: p.photo,
    };
    this.applyPhoneSplit(this.user.phoneNumber ?? '');
    this.initIdentity();
  }

  async ngOnInit(): Promise<void> {
    await this.state.loadProfile().catch(() => undefined);
    const p = this.state.userProfile;
    this.user = {
      firstName: p.firstName,
      familyName: p.familyName,
      lastName: p.lastName,
      email: p.email,
      phoneNumber: p.phone,
      photo: p.photo,
    };
    await this.loadPhoneCodes();
    this.applyPhoneSplit(this.user.phoneNumber ?? '');
    this.initIdentity();
  }

  private initIdentity(): void {
    const p = this.state.userProfile;
    if (p.hasSetIdentityDetails && p.idType) {
      const t = p.idType;
      this.selectedIdType = (t === 1 || t === 'NationalId') ? 'national' : 'passport';
      this.idNumber = p.idNumber ?? '';
    } else {
      this.selectedIdType = 'none';
      this.idNumber = '';
    }
  }

  get hasSetIdentity(): boolean {
    return this.state.userProfile.hasSetIdentityDetails === true;
  }

  get idTypeLabel(): string {
    if (!this.hasSetIdentity) return '';
    const t = this.state.userProfile.idType;
    if (t === 1 || t === 'NationalId') return 'National ID';
    if (t === 2 || t === 'Passport') return 'Passport';
    return String(t ?? '');
  }

  get idNumberDisplay(): string {
    return this.state.userProfile.idNumber ?? '';
  }

  get idNumberPlaceholder(): string {
    return this.selectedIdType === 'passport' ? 'e.g. A12345678' : '14-digit national ID';
  }

  get idNumberLabel(): string {
    return this.selectedIdType === 'passport' ? 'Passport Number' : 'National ID Number';
  }

  private async loadPhoneCodes(): Promise<void> {
    try {
      const countries = await firstValueFrom(this.api.getCountries());
      this.phoneCodes = mapCountriesToPhoneCodes(countries ?? []);
    } catch {
      this.phoneCodes = FALLBACK_PHONE_CODES;
    }
  }

  private applyPhoneSplit(phoneNumber: string): void {
    if (!phoneNumber) {
      this.selectedPhoneCode = DEFAULT_PHONE_CODE;
      this.phoneLocalNumber = '';
      return;
    }
    const parts = splitPhoneNumber(phoneNumber, this.phoneCodes);
    this.selectedPhoneCode = parts.dialCode;
    this.phoneLocalNumber = parts.localNumber;
  }

  get phoneLocalMinLength(): number {
    return getLocalNumberConstraints(this.selectedPhoneCode).min;
  }

  get phoneLocalMaxLength(): number {
    return getLocalNumberConstraints(this.selectedPhoneCode).max;
  }

  get phoneLocalPattern(): string {
    return getLocalNumberPattern(this.selectedPhoneCode);
  }

  async onPhotoSelected(event: any): Promise<void> {
    const file = event.target.files[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = () => { this.user.photo = reader.result as string; };
    reader.readAsDataURL(file);

    try {
      this.selectedPhoto = await this.compressImage(file, 800, 800, 0.7);
    } catch (e) {
      console.warn('Image compression failed, using original file', e);
      this.selectedPhoto = file;
    }
  }

  private compressImage(file: File, maxWidth: number, maxHeight: number, quality: number): Promise<File> {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        resolve(file); // fallback for SSR
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file); // fallback
              }
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  validateForm(): string | null {
    if (!this.user.firstName.trim() || !nameRegex.test(this.user.firstName)) {
      return 'First name is required and must contain only letters, spaces, hyphens, or apostrophes';
    }
    if (!this.user.familyName?.trim() || !nameRegex.test(this.user.familyName)) {
      return 'Family name is required and must contain only letters, spaces, hyphens, or apostrophes';
    }
    if (!this.user.lastName.trim() || !nameRegex.test(this.user.lastName)) {
      return 'Last name is required and must contain only letters, spaces, hyphens, or apostrophes';
    }
    if (!this.user.email?.trim() || !emailRegex.test(this.user.email)) {
      return 'Please enter a valid email address';
    }
    if (!this.phoneLocalNumber.trim() || !isLocalNumberValid(this.selectedPhoneCode, this.phoneLocalNumber)) {
      return 'Please enter a valid phone number';
    }
    // Identity validation (only if not yet set)
    if (!this.hasSetIdentity) {
      if (this.selectedIdType === 'national') {
        if (!nationalIdRegex.test(this.idNumber.trim())) {
          return 'National ID must be 14 digits starting with 2 or 3';
        }
      } else if (this.selectedIdType === 'passport') {
        if (!passportRegex.test(this.idNumber.trim())) {
          return 'Passport number can only contain letters, digits, spaces, and hyphens (max 50 chars)';
        }
      }
    }
    return null;
  }

  async saveChanges(form: NgForm): Promise<void> {
    this.saveError = '';
    this.saveSuccess = false;

    if (form.invalid) return;

    const validationError = this.validateForm();
    if (validationError) {
      this.saveError = validationError;
      return;
    }

    this.isSaving = true;
    try {
      // Step 1: Upload photo first if a new one was selected
      let uploadedPhotoUrl = this.user.photo ?? null;
      if (this.selectedPhoto) {
        uploadedPhotoUrl = await this.state.uploadProfilePicture(this.selectedPhoto);
        this.user.photo = uploadedPhotoUrl;
      }

      // Step 2: Build phone number
      const fullPhoneNumber = this.phoneLocalNumber.trim()
        ? buildE164Number(this.selectedPhoneCode, this.phoneLocalNumber)
        : undefined;

      // Step 3: Build identity payload (only if not locked)
      let idType: number | undefined;
      let idNumber: string | undefined;
      if (!this.hasSetIdentity) {
        if (this.selectedIdType === 'national') { idType = 1; idNumber = this.idNumber.trim(); }
        else if (this.selectedIdType === 'passport') { idType = 2; idNumber = this.idNumber.trim(); }
      }

      // Step 4: Send profile update
      await this.state.saveProfile({
        firstName: this.user.firstName.trim(),
        familyName: this.user.familyName.trim(),
        lastName: this.user.lastName.trim(),
        email: this.user.email?.trim(),
        phoneNumber: fullPhoneNumber,
        profilePictureUrl: uploadedPhotoUrl,
        idType,
        idNumber,
      });

      this.saveSuccess = true;
      setTimeout(() => this.router.navigate(['/profile']), 800);
    } catch (error: any) {
      let msg = 'Failed to save profile';
      if (error?.error?.errors && Array.isArray(error.error.errors)) {
        msg = error.error.errors.join(', ');
      } else if (error?.error?.message) {
        msg = error.error.message;
      } else if (error instanceof Error) {
        msg = error.message;
      }
      this.saveError = msg;
    } finally {
      this.isSaving = false;
    }
  }

  async cancel(): Promise<void> {
    await this.router.navigate(['/profile']);
  }
}