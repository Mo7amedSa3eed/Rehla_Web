import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { PointsService, OnboardingChallenge, MonthlyChallenge } from './points.service';

@Component({
  selector: 'app-challenges-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './challenges-dashboard.html',
  styleUrls: ['./challenges-dashboard.scss']
})
export class ChallengesDashboardComponent implements OnInit {
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
