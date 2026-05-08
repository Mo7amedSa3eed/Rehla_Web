import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/state';
import { Router } from '@angular/router';

@Component({
  selector: 'app-resell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './resell.html',
  styleUrls: ['./resell.scss']
})
export class ResellComponent {

  ticket: any;
  resellPrice: number = 0;

  constructor(private state: AppStateService, private router: Router) {

    // receive ticket from previous page
    this.ticket = typeof history !== 'undefined' ? history.state.ticket : null;

    if(this.ticket){
      this.resellPrice = this.ticket.price * 0.9;
    }

  }

  async sellTicket(): Promise<void> {
    if (!this.ticket) {
      return;
    }

    try {
      await this.state.listTicketForResale(this.ticket, this.resellPrice);
      await this.router.navigate(['/marketplace']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list ticket for resale';
      alert(message);
    }
  }

}