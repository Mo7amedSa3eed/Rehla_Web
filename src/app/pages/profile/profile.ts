import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/state';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class ProfileComponent implements OnInit {

  constructor(public state: AppStateService) {}

  async ngOnInit(): Promise<void> {
    await this.state.loadProfile().catch(() => undefined);
  }

  get user() {
    return this.state.userProfile;
  }

  get fullName() {
    return [this.user.firstName, this.user.familyName, this.user.lastName]
      .filter((value) => value && value.trim().length > 0)
      .join(' ')
      .trim();
  }
}
