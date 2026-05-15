import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppStateService, UiBooking } from '../../services/state';

@Component({
  selector: 'app-resell',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resell.html',
  styleUrls: ['./resell.scss']
})
export class ResellComponent implements OnInit {

  ticket: UiBooking | null = null;
  askingPrice = 0;
  isLoading = true;
  loadError = '';
  isSaving = false;

  constructor(
    public state: AppStateService,
    private router: Router,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  async ngOnInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      this.isLoading = false;
      return;
    }

    const selectedTicket = typeof history !== 'undefined' ? history.state?.ticket : null;
    this.ticket = selectedTicket ?? this.state.selectedTicket;

    if (!this.ticket) {
      this.loadError = 'No ticket was selected for resale.';
      this.isLoading = false;
      return;
    }

    this.askingPrice = Number((this.ticket.price * 0.9).toFixed(2));
    this.isLoading = false;
  }

  async sellTicket(): Promise<void> {
    if (!this.ticket || this.isSaving) {
      return;
    }

    const askingPrice = Number(this.askingPrice);

    if (!Number.isFinite(askingPrice) || askingPrice <= 0) {
      this.loadError = 'Enter a valid resale price.';
      return;
    }

    this.isSaving = true;
    this.loadError = '';

    try {
      if (!confirm('Are you sure you want to list this ticket for sale at ' + askingPrice + '?')) {
        this.isSaving = false;
        return;
      }

      await this.state.listTicketForResale(this.ticket, askingPrice);
      await Promise.all([
        this.state.loadTickets().catch(() => undefined),
        this.state.loadMarketplace().catch(() => undefined),
        this.state.loadBookings().catch(() => undefined),
      ]);
      await this.router.navigate(['/marketplace']);
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Failed to list ticket for resale';
    } finally {
      this.isSaving = false;
    }
  }

  async cancel(): Promise<void> {
    await this.router.navigate(['/my-tickets']);
  }

}