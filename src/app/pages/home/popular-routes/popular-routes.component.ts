import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PopularRoute, PopularRoutesService } from '../../../services/popular-routes';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-popular-routes',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './popular-routes.html',
  styleUrls: ['./popular-routes.scss']
})
export class PopularRoutesComponent implements OnInit {
  routes: PopularRoute[] = [];
  isLoading = true;

  constructor(
    private popularRoutesService: PopularRoutesService,
    private router: Router,
    public language: LanguageService
  ) {}

  ngOnInit(): void {
    this.popularRoutesService.getPopularRoutes().subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.routes = response.data;
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  onRouteClick(route: PopularRoute): void {
    // Navigate to booking page and pass the origin/destination via router state
    // We use the English names as they match the governorate values in the dropdowns
    this.router.navigate(['/booking'], {
      state: {
        defaultFrom: route.originGovEn,
        defaultTo: route.destinationGovEn
      }
    });
  }
}
