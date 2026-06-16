import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthSessionService } from '../../services/auth-session.service';
import { LanguageSwitchComponent } from '../../shared/components/language-switch/language-switch';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterModule, LanguageSwitchComponent, TranslatePipe],
  templateUrl: './welcome.html',
  styleUrls: ['./welcome.scss']
})
export class WelcomeComponent implements OnInit {
  constructor(private session: AuthSessionService, private router: Router) {}

  ngOnInit() {
    if (this.session.hasAnyToken()) {
      this.router.navigate(['/home']);
    }
  }
}
