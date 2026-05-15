import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AppStateService } from '../../services/state';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './marketplace.html',
  styleUrls: ['./marketplace.scss']
})
export class MarketplaceComponent {

  isLoading = true;
  loadError = '';

  constructor(public state: AppStateService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    await this.refreshMarketplace();
  }

  async refreshMarketplace(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      await Promise.all([
        this.state.loadProfile().catch(() => undefined),
        this.state.loadMarketplace(),
      ]);
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Failed to load marketplace listings';
    } finally {
      this.isLoading = false;
    }
  }

  get marketplaceTickets() {
    return this.state.marketplace.filter((ticket) => !this.isOwnListing(ticket));
  }

  private isOwnListing(ticket: { ownerId?: number; sellerName?: string }): boolean {
    if (typeof ticket.ownerId === 'number' && ticket.ownerId === this.state.userProfile.userId) {
      return true;
    }

    if (!ticket.sellerName) {
      return false;
    }

    const currentName = [this.state.userProfile.firstName, this.state.userProfile.familyName, this.state.userProfile.lastName]
      .filter((value) => value && value.trim().length > 0)
      .join(' ')
      .trim();

    return currentName.length > 0 && ticket.sellerName.trim().toLowerCase() === currentName.toLowerCase();
  }

  async buyTicket(ticket: any): Promise<void> {
    this.state.prepareMarketplacePurchase(ticket);
    await this.router.navigate(['/marketplace-confirm']);
  }

}