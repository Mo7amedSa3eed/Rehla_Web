import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/state';
import { RouterModule, Router } from '@angular/router';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './profile.html',
  styleUrls: ['./profile.scss']
})
export class ProfileComponent implements OnInit {

  constructor(public state: AppStateService, private readonly router: Router) {}

  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }

    void this.router.navigate(['/login']);
  }

  async ngOnInit(): Promise<void> {
    await this.state.loadProfile().catch(() => undefined);
  }

  get user() {
    return this.state.userProfile;
  }

  get fullName() {
    return [this.user.firstName, this.user.lastName, this.user.familyName]
      .filter((value) => value && value.trim().length > 0)
      .join(' ')
      .trim();
  }
}
