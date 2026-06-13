import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService, CreateSupportTicketRequest, SupportTicketDto } from '../../services/api';
import { firstValueFrom } from 'rxjs';

const CATEGORIES = [
  { value: 1, label: 'Payment' },
  { value: 2, label: 'Trip Experience' },
  { value: 3, label: 'App Bug' },
  { value: 4, label: 'Account Issue' },
  { value: 5, label: 'Other' },
];

@Component({
  selector: 'app-report-issue',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './report-issue.html',
  styleUrls: ['./report-issue.scss']
})
export class ReportIssueComponent {
  categories = CATEGORIES;

  title = '';
  description = '';
  issueCategory = 1;

  isSubmitting = false;
  submitError = '';
  showSuccessModal = false;
  createdTicket: SupportTicketDto | null = null;

  constructor(private api: ApiService, private router: Router) {}

  get titleInvalid(): boolean {
    return this.title.trim().length > 0 && this.title.trim().length > 200;
  }

  get descriptionInvalid(): boolean {
    const len = this.description.trim().length;
    return len > 0 && (len < 10 || len > 1000);
  }

  get isFormValid(): boolean {
    const titleLen = this.title.trim().length;
    const descLen = this.description.trim().length;
    return titleLen > 0 && titleLen <= 200 && descLen >= 10 && descLen <= 1000;
  }

  get descriptionCharCount(): number {
    return this.description.trim().length;
  }

  async submit(): Promise<void> {
    if (!this.isFormValid) return;

    this.isSubmitting = true;
    this.submitError = '';
    try {
      const payload: CreateSupportTicketRequest = {
        title: this.title.trim(),
        description: this.description.trim(),
        issueCategory: this.issueCategory,
      };
      this.createdTicket = await firstValueFrom(this.api.createSupportTicket(payload));
      this.showSuccessModal = true;
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || (typeof e === 'string' ? e : '');
      if (!msg || msg.toLowerCase().includes('network') || msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('unknown error')) {
        this.submitError = 'No internet connection. Please try again.';
      } else {
        this.submitError = msg || 'Failed to submit issue. Please try again.';
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  closeSuccessModal(): void {
    this.showSuccessModal = false;
    void this.router.navigate(['/profile']);
  }
}
