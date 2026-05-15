import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, ResetPasswordRequest } from '../../../services/api';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password.html',
  styleUrls: ['./reset-password.scss']
})
export class ResetPasswordComponent implements OnInit {
  email = '';
  token = '';

  newPassword = '';
  confirmPassword = '';

  isSubmitting = false;
  errorMessage = '';
  successMessage = '';

  private readonly passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: ApiService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    this.email = qp.get('email') ?? '';
    this.token = qp.get('token') ?? '';
  }

  private validate(): string | null {
    if (!this.newPassword || !this.confirmPassword) {
      return 'Please enter and confirm your new password.';
    }

    if (!this.passwordRegex.test(this.newPassword)) {
      return 'Password must be at least 8 characters and include uppercase, lowercase and a number.';
    }

    if (this.newPassword !== this.confirmPassword) {
      return 'Passwords do not match.';
    }

    if (!this.email || !this.token) {
      return 'Missing email or token. Use the link sent to your email.';
    }

    return null;
  }

  async submit(form: NgForm): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    if (form.invalid) {
      this.errorMessage = 'Please fill the form correctly.';
      return;
    }

    const validation = this.validate();
    if (validation) {
      this.errorMessage = validation;
      return;
    }

    this.isSubmitting = true;

    const payload: ResetPasswordRequest = {
      email: this.email,
      token: this.token,
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword,
    };

    try {
      await firstValueFrom(this.api.resetPassword(payload));
      this.successMessage = 'Your password has been reset. Redirecting to login...';
      setTimeout(() => void this.router.navigate(['/login']), 1500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        this.errorMessage = err.message;
      } else {
        this.errorMessage = 'Failed to reset password.';
      }
    } finally {
      this.isSubmitting = false;
    }
  }
}
