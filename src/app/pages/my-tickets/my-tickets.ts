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

constructor(public state: AppStateService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.state.loadTickets().catch(() => undefined);
    await this.state.loadMarketplace().catch(() => undefined);
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
    const askingPrice = Number(ticket.price) * 0.9;

    if (!confirm('Are you sure you want to list this ticket for sale?')) {
      return;
    }

    try {
      await this.state.listTicketForResale(ticket, askingPrice);
      this.view = 'marketplace';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list ticket for resale';
      alert(message);
    }
  }

 buyTicket(ticket: any){
  if (!confirm('Review the ticket details before continuing to payment. Proceed?')) {
    return;
  }

  const fallbackId = ticket.ticketId ?? ticket.id ?? Date.now();

  const booking: UiBooking = {
    id: fallbackId,
    ticketId: fallbackId,
    from: ticket.from,
    to: ticket.to,
    date: ticket.date,
    time: ticket.time,
    duration: ticket.duration || '',
    passengers: ticket.passengers || 1,
    seat: ticket.seat,
    originalPrice: ticket.originalPrice,
    price: ticket.resellPrice || ticket.price,
    status: 'pending'
  };

  // store ticket that user wants to buy
  this.state.currentPaymentBooking = booking;

  // store marketplace ticket id to remove later
  this.state.buyingMarketplaceTicketId = ticket.listingId ?? ticket.id;

  // go to payment page
  this.router.navigate(['/payment']);
}

}