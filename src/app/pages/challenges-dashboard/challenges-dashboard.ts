import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ApiService, LoyaltyChallengesPagedDto, LoyaltyHistoryPagedDto, UserChallengeDto } from '../../services/api';
import { AppStateService } from '../../services/state';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-challenges-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './challenges-dashboard.html',
  styleUrls: ['./challenges-dashboard.scss']
})
export class ChallengesDashboardComponent implements OnInit {
  isLoading = true;
  loadError = '';

  // Tab
  activeTab: 'challenges' | 'history' = 'challenges';

  // Challenges
  challengeFilter: 'active' | 'completed' = 'active';
  challenges: UserChallengeDto[] = [];
  challengesTotalPages = 1;
  challengesCurrentPage = 1;
  isLoadingMoreChallenges = false;

  // Points history — uses existing LoyaltyHistoryPagedDto shape
  pointHistory: any[] = [];
  pointHistoryTotalPages = 1;
  pointHistoryCurrentPage = 1;
  isLoadingMoreHistory = false;
  historyError = '';

  constructor(
    public state: AppStateService,
    private api: ApiService
  ) { }

  async ngOnInit(): Promise<void> {
    await this.state.loadProfile().catch(() => undefined);
    await this.loadChallenges(true);
    this.isLoading = false;
  }

  get userProfile() {
    return this.state.userProfile;
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  async selectTab(tab: 'challenges' | 'history'): Promise<void> {
    this.activeTab = tab;
    if (tab === 'history' && this.pointHistory.length === 0) {
      await this.loadPointHistory(true);
    }
  }

  // ── Challenges ────────────────────────────────────────────────────────────
  async selectFilter(filter: 'active' | 'completed'): Promise<void> {
    if (this.challengeFilter === filter) return;
    this.challengeFilter = filter;
    this.challenges = [];
    this.challengesCurrentPage = 1;
    await this.loadChallenges(true);
  }

  async loadChallenges(reset = false): Promise<void> {
    if (reset) { this.challenges = []; this.challengesCurrentPage = 1; }
    try {
      const isCompleted = this.challengeFilter === 'completed';
      const result: LoyaltyChallengesPagedDto = await firstValueFrom(
        this.api.getLoyaltyChallenges({ isCompleted, pageNumber: this.challengesCurrentPage, pageSize: 10 })
      );
      const items = result?.items ?? [];
      this.challenges = reset ? items : [...this.challenges, ...items];
      this.challengesTotalPages = result?.totalPages ?? 1;
    } catch (err) {
      if (reset) this.loadError = err instanceof Error ? err.message : 'Failed to load challenges.';
    }
  }

  async loadMoreChallenges(): Promise<void> {
    if (this.challengesCurrentPage >= this.challengesTotalPages || this.isLoadingMoreChallenges) return;
    this.isLoadingMoreChallenges = true;
    this.challengesCurrentPage++;
    await this.loadChallenges(false);
    this.isLoadingMoreChallenges = false;
  }

  get hasMoreChallenges(): boolean {
    return this.challengesCurrentPage < this.challengesTotalPages;
  }

  challengeProgress(c: UserChallengeDto): number {
    if ((c.goalValue ?? 0) <= 0) return c.isCompleted ? 100 : 0;
    return Math.min(100, Math.round((c.currentProgress / c.goalValue) * 100));
  }

  get oneTimeChallenges(): UserChallengeDto[] {
    return this.challenges.filter(c => {
      const f = String(c.frequency).toLowerCase();
      return f === 'onetime' || f === 'one-time' || f === '1' || f === '0';
    });
  }

  get monthlyChallenges(): UserChallengeDto[] {
    return this.challenges.filter(c => {
      const f = String(c.frequency).toLowerCase();
      return f === 'monthly' || f === '2';
    });
  }

  get otherChallenges(): UserChallengeDto[] {
    return this.challenges.filter(c => {
      const f = String(c.frequency).toLowerCase();
      const isOneTime = f === 'onetime' || f === 'one-time' || f === '1' || f === '0';
      const isMonthly = f === 'monthly' || f === '2';
      return !isOneTime && !isMonthly;
    });
  }

  // ── Points History ────────────────────────────────────────────────────────
  async loadPointHistory(reset = false): Promise<void> {
    if (reset) { this.pointHistory = []; this.pointHistoryCurrentPage = 1; }
    this.historyError = '';
    try {
      const result: LoyaltyHistoryPagedDto = await firstValueFrom(
        this.api.getLoyaltyHistory({ pageNumber: this.pointHistoryCurrentPage, pageSize: 10 })
      );
      const items = result?.items ?? [];
      this.pointHistory = reset ? items : [...this.pointHistory, ...items];
      this.pointHistoryTotalPages = result?.totalPages ?? 1;
    } catch (err) {
      this.historyError = err instanceof Error ? err.message : 'Failed to load point history.';
    }
  }

  async loadMoreHistory(): Promise<void> {
    if (this.pointHistoryCurrentPage >= this.pointHistoryTotalPages || this.isLoadingMoreHistory) return;
    this.isLoadingMoreHistory = true;
    this.pointHistoryCurrentPage++;
    await this.loadPointHistory(false);
    this.isLoadingMoreHistory = false;
  }

  get hasMoreHistory(): boolean {
    return this.pointHistoryCurrentPage < this.pointHistoryTotalPages;
  }
}
