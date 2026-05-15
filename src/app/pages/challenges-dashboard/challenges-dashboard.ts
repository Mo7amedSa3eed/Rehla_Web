import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PointsService, OnboardingChallenge, MonthlyChallenge, RedemptionPreview } from './points.service';

@Component({
  selector: 'app-challenges-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './challenges-dashboard.html',
  styleUrls: ['./challenges-dashboard.scss']
})
export class ChallengesDashboardComponent implements OnInit {
  cartTotal = 240;
  selectedPoints = 0;
  isLoading = true;
  loadError = '';

  constructor(public pointsService: PointsService) {}

  async ngOnInit(): Promise<void> {
    try {
      await this.pointsService.loadDashboard();
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Failed to load challenges.';
    } finally {
      this.isLoading = false;
    }
  }

  getMaxRedeemablePoints(walletPoints: number): number {
    return this.pointsService.calculateMaxRedeemablePoints(this.cartTotal, walletPoints);
  }

  getRedemptionPreview(walletPoints: number): RedemptionPreview {
    return this.pointsService.calculateRedemptionPreview(this.cartTotal, walletPoints, this.selectedPoints);
  }

  onCartTotalChange(walletPoints: number): void {
    const maxPoints = this.getMaxRedeemablePoints(walletPoints);
    if (this.selectedPoints > maxPoints) {
      this.selectedPoints = maxPoints;
    }
  }

  onSliderChange(value: string, walletPoints: number): void {
    const numeric = Number(value) || 0;
    const snapped = Math.round(numeric / this.pointsService.sliderStep) * this.pointsService.sliderStep;
    this.selectedPoints = Math.min(snapped, this.getMaxRedeemablePoints(walletPoints));
  }

  onboardingStatus(task: OnboardingChallenge): string {
    if (task.rewardClaimed || task.completed) {
      return 'Claimed';
    }

    return 'In Progress';
  }

  monthlyStatus(task: MonthlyChallenge): string {
    if (task.rewardClaimed) {
      return 'Claimed';
    }

    if (task.progress === 0) {
      return 'Locked';
    }

    return 'In Progress';
  }

  onboardingProgress(task: OnboardingChallenge): number {
    return task.completed ? 100 : 0;
  }

  monthlyProgress(task: MonthlyChallenge): number {
    if (task.target <= 0) {
      return 0;
    }

    return Math.min(100, (task.progress / task.target) * 100);
  }

}
