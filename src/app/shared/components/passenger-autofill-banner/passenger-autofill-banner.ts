import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-passenger-autofill-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './passenger-autofill-banner.html',
  styleUrls: ['./passenger-autofill-banner.scss']
})
export class PassengerAutofillBannerComponent {
  @Input() isAutofilled: boolean = false;
  @Input() errorMessage: string = '';
  @Output() triggerAutofill = new EventEmitter<void>();

  onAutofillClick() {
    this.triggerAutofill.emit();
  }
}
