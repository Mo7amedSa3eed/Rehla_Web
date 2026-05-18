import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiService, LoginRequest } from '../../services/api';
import { AppStateService } from '../../services/state';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {
  credentials: LoginRequest = {
    email: '',
    password: '',
    deviceInfo: 'Web'
  };

  isSubmitting = false;
  errorMessage = '';

  constructor(
    private readonly api: ApiService,
    private readonly state: AppStateService,
    private readonly router: Router,
  ) {}

  async submit(form: NgForm): Promise<void> {
    this.errorMessage = '';

    if (form.invalid) {
      this.errorMessage = 'Please enter your email and password.';
      return;
    }

    this.isSubmitting = true;

    try {
      const payload = {
        ...this.credentials,
        email: this.credentials.email.trim(),
        password: this.credentials.password.trim(),
      };

      const tokens = await firstValueFrom(this.api.login(payload));
      this.storeTokens(tokens.accessToken, tokens.refreshToken);
      this.state.applyAuthUserProfile(tokens.user);
      await this.router.navigate(['/home']);
    } catch (error) {
      this.errorMessage = this.getErrorMessage(error);
    } finally {
      this.isSubmitting = false;
    }
  }

  private storeTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
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

    return 'Login failed.';
  }
}
