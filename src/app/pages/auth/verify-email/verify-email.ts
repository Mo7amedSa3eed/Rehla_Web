import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService, VerifyEmailRequest } from '../../../services/api';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './verify-email.html',
  styleUrls: ['./verify-email.scss']
})
export class VerifyEmailComponent implements OnInit {
  isLoading = true;
  success = false;
  message = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: ApiService,
    private readonly router: Router,
  ) {}

  async ngOnInit(): Promise<void> {
    const qp = this.route.snapshot.queryParamMap;
    const userId = qp.get('userId') ?? qp.get('user') ?? '';
    const token = qp.get('token') ?? '';

    if (!userId || !token) {
      this.success = false;
      this.message = 'Invalid verification link.';
      this.isLoading = false;
      return;
    }

    try {
      const payload: VerifyEmailRequest = { userId, token };
      await firstValueFrom(this.api.verifyEmail(payload));
      this.success = true;
      this.message = 'Your email has been verified. You can now log in.';
    } catch (err: unknown) {
      this.success = false;
      if (err instanceof Error) {
        this.message = err.message;
      } else {
        this.message = 'Failed to verify email.';
      }
    } finally {
      this.isLoading = false;
    }
  }

  goLogin(): void {
    void this.router.navigate(['/login']);
  }
}
