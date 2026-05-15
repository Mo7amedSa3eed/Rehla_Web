import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ApiService, UserChallengeDto, UserProfileDto } from '../../services/api';

export interface OnboardingChallenge {
  id: string;
  title: string;
  description: string;
  rewardPoints: number;
  completed: boolean;
  rewardClaimed: boolean;
  completedAt?: string | null;
}

export interface MonthlyChallenge {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardPoints: number;
  rewardClaimed: boolean;
}

export interface PointsState {
  balance: number;
  expiringPointsAmount: number;
  nextExpiryDate: string | null;
  lastMonthlyResetKey: string;
}

export interface RedemptionPreview {
  discountEgp: number;
  finalTotal: number;
  pointsAfter: number;
  pointsApplied: number;
}

@Injectable({
  providedIn: 'root'
})
export class PointsService {
  readonly pointValueEgp = 0.05;
  readonly maxDiscountPct = 0.5;
  readonly minFinalPriceEgp = 10;
  readonly sliderStep = 20;

  private onboardingSubject = new BehaviorSubject<OnboardingChallenge[]>(this.defaultOnboarding());
  onboarding$ = this.onboardingSubject.asObservable();

  private monthlySubject = new BehaviorSubject<MonthlyChallenge[]>(this.defaultMonthly());
  monthly$ = this.monthlySubject.asObservable();

  private pointsStateSubject = new BehaviorSubject<PointsState>(this.defaultPointsState());
  pointsState$ = this.pointsStateSubject.asObservable();

  constructor(
    private readonly api: ApiService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  async loadDashboard(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const profile = await firstValueFrom(this.api.getMyProfile());
    let merged: UserChallengeDto[] = profile.activeChallenges ?? [];

    try {
      const [activeChallenges, completedChallenges] = await Promise.all([
        firstValueFrom(this.api.getLoyaltyChallenges({ isCompleted: false, pageNumber: 1, pageSize: 50 })),
        firstValueFrom(this.api.getLoyaltyChallenges({ isCompleted: true, pageNumber: 1, pageSize: 50 })),
      ]);
      merged = this.mergeChallenges(activeChallenges.items, completedChallenges.items);
    } catch {
      // Fallback to profile.activeChallenges when history endpoints are unavailable.
    }

    this.syncFromApi(profile, merged);
  }

  calculatePointsEarned(ticketPriceEgp: number): number {
    if (ticketPriceEgp <= 0) {
      return 0;
    }

    return Math.floor(ticketPriceEgp / this.pointValueEgp);
  }

  calculateMaxRedeemablePoints(cartTotal: number, walletPoints: number): number {
    if (cartTotal <= this.minFinalPriceEgp || walletPoints <= 0) {
      return 0;
    }

    const walletLimit = walletPoints;
    const halfCapLimit = Math.floor((cartTotal * this.maxDiscountPct) / this.pointValueEgp);
    const floorLimit = Math.floor((cartTotal - this.minFinalPriceEgp) / this.pointValueEgp);
    const raw = Math.min(walletLimit, halfCapLimit, floorLimit);

    return this.snapDownToStep(Math.max(raw, 0));
  }

  calculateRedemptionPreview(cartTotal: number, walletPoints: number, pointsToRedeem: number): RedemptionPreview {
    const maxRedeemable = this.calculateMaxRedeemablePoints(cartTotal, walletPoints);
    const pointsApplied = Math.min(this.snapToStep(pointsToRedeem), maxRedeemable);
    const discountEgp = pointsApplied * this.pointValueEgp;
    const finalTotal = Math.max(cartTotal - discountEgp, this.minFinalPriceEgp);

    return {
      discountEgp,
      finalTotal,
      pointsAfter: Math.max(walletPoints - pointsApplied, 0),
      pointsApplied,
    };
  }

  private snapDownToStep(points: number): number {
    return Math.floor(points / this.sliderStep) * this.sliderStep;
  }

  private snapToStep(points: number): number {
    return Math.round(points / this.sliderStep) * this.sliderStep;
  }

  private getMonthKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${month}`;
  }

  private syncFromApi(profile: UserProfileDto, challenges: UserChallengeDto[]): void {
    const normalized = challenges.map((challenge) => this.normalizeChallenge(challenge));
    const onboarding = normalized.filter((challenge) => challenge.frequency === 'one-time');
    const monthly = normalized.filter((challenge) => challenge.frequency === 'monthly');

    this.onboardingSubject.next(onboarding.map((challenge) => this.mapToOnboarding(challenge)));
    this.monthlySubject.next(monthly.map((challenge) => this.mapToMonthly(challenge)));

    this.pointsStateSubject.next({
      balance: profile.loyaltyPointsBalance ?? 0,
      expiringPointsAmount: profile.expiringPointsAmount ?? 0,
      nextExpiryDate: profile.nextExpiryDate ?? null,
      lastMonthlyResetKey: this.getMonthKey(new Date()),
    });
  }

  private normalizeChallenge(challenge: UserChallengeDto): {
    id: string;
    title: string;
    description: string;
    rewardPoints: number;
    currentProgress: number;
    goalValue: number;
    isCompleted: boolean;
    frequency: 'monthly' | 'one-time';
  } {
    const frequencyValue = String(challenge.frequency ?? '').toLowerCase();
    const isMonthly =
      frequencyValue.includes('month') ||
      frequencyValue === '2' ||
      (typeof challenge.frequency === 'number' && challenge.frequency === 2);

    const goalValue = challenge.goalValue ?? 0;
    const currentProgress = challenge.currentProgress ?? 0;

    return {
      id: String(challenge.challengeId ?? challenge.title),
      title: challenge.title,
      description: challenge.description,
      rewardPoints: challenge.rewardPoints ?? 0,
      currentProgress,
      goalValue,
      isCompleted: Boolean(challenge.isCompleted) || (goalValue > 0 && currentProgress >= goalValue),
      frequency: isMonthly ? 'monthly' : 'one-time',
    };
  }

  private mapToOnboarding(challenge: {
    id: string;
    title: string;
    description: string;
    rewardPoints: number;
    isCompleted: boolean;
  }): OnboardingChallenge {
    return {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      rewardPoints: challenge.rewardPoints,
      completed: challenge.isCompleted,
      rewardClaimed: challenge.isCompleted,
      completedAt: challenge.isCompleted ? new Date().toISOString() : null,
    };
  }

  private mapToMonthly(challenge: {
    id: string;
    title: string;
    description: string;
    rewardPoints: number;
    currentProgress: number;
    goalValue: number;
    isCompleted: boolean;
  }): MonthlyChallenge {
    return {
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      target: challenge.goalValue,
      progress: challenge.currentProgress,
      rewardPoints: challenge.rewardPoints,
      rewardClaimed: challenge.isCompleted,
    };
  }

  private mergeChallenges(
    active: UserChallengeDto[] = [],
    completed: UserChallengeDto[] = [],
  ): UserChallengeDto[] {
    const merged = new Map<number, UserChallengeDto>();

    active.forEach((challenge) => {
      if (typeof challenge.challengeId === 'number') {
        merged.set(challenge.challengeId, challenge);
      }
    });

    completed.forEach((challenge) => {
      if (typeof challenge.challengeId !== 'number') {
        return;
      }

      const existing = merged.get(challenge.challengeId);
      merged.set(challenge.challengeId, { ...existing, ...challenge, isCompleted: true });
    });

    return Array.from(merged.values());
  }

  private defaultPointsState(): PointsState {
    return {
      balance: 0,
      expiringPointsAmount: 0,
      nextExpiryDate: null,
      lastMonthlyResetKey: this.getMonthKey(new Date()),
    };
  }

  private defaultOnboarding(): OnboardingChallenge[] {
    return [
      {
        id: 'loading',
        title: 'Loading challenges',
        description: 'Syncing your onboarding progress from the server.',
        rewardPoints: 0,
        completed: false,
        rewardClaimed: false,
      },
    ];
  }

  private defaultMonthly(): MonthlyChallenge[] {
    return [
      {
        id: 'loading',
        title: 'Loading monthly challenges',
        description: 'Fetching your current monthly goals.',
        target: 1,
        progress: 0,
        rewardPoints: 0,
        rewardClaimed: false,
      },
    ];
  }
}
