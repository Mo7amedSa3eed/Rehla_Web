import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, ForgotPasswordRequest } from '../../../services/api';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss'],
})
export class ForgotPasswordComponent {
  email = '';

  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  constructor(private readonly api: ApiService) {}

  async submit(form: NgForm): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    if (form.invalid) {
      this.errorMessage = 'Please enter the email address for your account.';
      return;
    }

    this.isSubmitting = true;

    const payload: ForgotPasswordRequest = {
      email: this.email.trim(),
    };

    try {
      await firstValueFrom(this.api.forgotPassword(payload));
      this.successMessage = 'If an account exists for this email, a reset link has been sent.';
      form.resetForm({ email: '' });
      this.email = '';
    } catch (error: unknown) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to request password reset.';
    } finally {
      this.isSubmitting = false;
    }
  }
}
