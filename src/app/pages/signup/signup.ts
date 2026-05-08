import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService, CountryDto, RegisterRequest } from '../../services/api';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './signup.html',
  styleUrls: ['./signup.scss']
})
export class SignupComponent implements OnInit {
  countries: CountryDto[] = [];
  isSubmitting = false;
  errorMessage = '';

  register: RegisterRequest = {
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    firstName: '',
    lastName: '',
    familyName: '',
    gender: 1,
    dateOfBirth: '',
    nationalIdNumber: '',
    countryCode: 'EG'
  };

  constructor(
    private readonly api: ApiService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.countries = await firstValueFrom(this.api.getCountries());
      if (this.countries.length && !this.register.countryCode) {
        this.register.countryCode = this.countries[0].countryCode;
      }
    } catch {
      this.countries = [];
    }
  }

  get passwordMismatch(): boolean {
    return (
      this.register.password.length > 0 &&
      this.register.confirmPassword.length > 0 &&
      this.register.password !== this.register.confirmPassword
    );
  }

  async submit(form: NgForm): Promise<void> {
    this.errorMessage = '';

    if (form.invalid || this.passwordMismatch) {
      this.errorMessage = 'Please fix the validation errors before submitting.';
      return;
    }

    this.isSubmitting = true;

    try {
      const trimmed = {
        ...this.register,
        email: this.register.email.trim(),
        phoneNumber: this.register.phoneNumber.trim(),
        firstName: this.register.firstName.trim(),
        familyName: this.register.familyName.trim(),
        lastName: this.register.lastName.trim(),
        nationalIdNumber: this.register.nationalIdNumber?.trim() || undefined,
        countryCode: this.register.countryCode || 'EG',
        dateOfBirth: this.register.dateOfBirth?.trim(),
      };

      const tokens = await firstValueFrom(this.api.register(trimmed));
      this.storeTokens(tokens.accessToken, tokens.refreshToken);
      await this.router.navigate(['/home']);
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (error instanceof HttpErrorResponse) {
      const apiError = error.error as { message?: string; errors?: string[] } | null;
      if (apiError?.errors?.length) {
        return apiError.errors.join(', ');
      }
      if (apiError?.message) {
        return apiError.message;
      }
    }

    return 'Registration failed.';
  }

  private storeTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
}
