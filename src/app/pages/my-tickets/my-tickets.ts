import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppStateService, MarketplaceListing, UiBooking } from '../../services/state';

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-tickets.html',
  styleUrls: ['./my-tickets.scss']
})
export class MyTicketsComponent implements OnInit {

  view: 'resell' | 'marketplace' = 'resell';
  isLoading = true;
  loadError = '';

constructor(public state: AppStateService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.refreshTickets();
  }

  async refreshTickets(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      await Promise.all([
        this.state.loadProfile().catch(() => undefined),
        this.state.loadTickets(),
        this.state.loadMarketplace(),
      ]);
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Failed to load tickets';
    } finally {
      this.isLoading = false;
    }
  }

  get resellTickets(): UiBooking[] {
    return this.state.myTickets.filter(
      (ticket) => ticket.status === 'confirmed' && ticket.canResell !== false,
    );
  }

  get marketplaceTickets(): MarketplaceListing[] {
    return this.state.marketplace.filter((ticket) => !this.isOwnListing(ticket));
  }

  private isOwnListing(ticket: { sellerName?: string }): boolean {
    if (typeof (ticket as { ownerId?: number }).ownerId === 'number' && (ticket as { ownerId?: number }).ownerId === this.state.userProfile.userId) {
      return true;
    }

    const currentName = this.getCurrentUserName();
    if (!currentName || !ticket.sellerName) {
      return false;
    }

    return this.normalizeName(ticket.sellerName) === this.normalizeName(currentName);
  }

  private getCurrentUserName(): string {
    const profile = this.state.userProfile;
    return [profile.firstName, profile.familyName, profile.lastName]
      .filter((value) => value && value.trim().length > 0)
      .join(' ')
      .trim();
  }

  private normalizeName(value: string): string {
    return value.trim().toLowerCase();
  }

  getStatusClass(status: string) {
    return {
      confirmed: status === 'confirmed',
      pending: status === 'pending',
      pendingSale: status === 'pending-sale',
      sold: status === 'sold',
      cancelled: status === 'cancelled'
    };
  }

  cancelTicket(ticket: any) {
    ticket.status = 'cancelled';
  }

  async resellTicket(ticket: any): Promise<void> {
    if (!confirm('Are you sure you want to list this ticket for sale?')) {
      return;
    }

    this.state.selectedTicket = ticket;
    await this.router.navigate(['/resell'], { state: { ticket } });
  }

 buyTicket(ticket: any){
  if (!confirm('Review the ticket details before continuing to payment. Proceed?')) {
    return;
  }

  this.state.prepareMarketplacePurchase(ticket);
  this.router.navigate(['/marketplace-confirm']);
}

}