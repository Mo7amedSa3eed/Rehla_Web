import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppStateService } from '../../services/state';

@Component({
  selector: 'app-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment.html',
  styleUrls: ['./payment.scss']
})
export class PaymentComponent {

  paymentMethod: string = 'card';
  isSubmitting = false;

  constructor(public state: AppStateService, private router: Router) {}

async confirmPayment(): Promise<void> {

  const booking = this.state.currentPaymentBooking;

  if (!booking) return;

  this.isSubmitting = true;

  try {
    await this.state.checkoutWallet();
    await this.router.navigate(['/my-bookings']);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment failed';
    alert(message);
  } finally {
    this.isSubmitting = false;
  }
}
}
