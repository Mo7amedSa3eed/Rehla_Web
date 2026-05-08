import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/state';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marketplace.html',
  styleUrls: ['./marketplace.scss']
})
export class MarketplaceComponent {

  constructor(public state: AppStateService) {}

  async ngOnInit(): Promise<void> {
    await this.state.loadMarketplace().catch(() => undefined);
  }

  async buyTicket(ticket: any): Promise<void> {
    const listingId = ticket.listingId ?? ticket.id;

    try {
      await this.state.buyMarketplaceListing(listingId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to buy ticket';
      alert(message);
    }
  }

}