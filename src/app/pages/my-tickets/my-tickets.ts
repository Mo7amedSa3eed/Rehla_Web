import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppStateService, UiBooking } from '../../services/state';

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

    try {
      await this.state.listTicketForResale(ticket, askingPrice);
      this.view = 'marketplace';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list ticket for resale';
      alert(message);
    }
  }

 buyTicket(ticket: any){
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