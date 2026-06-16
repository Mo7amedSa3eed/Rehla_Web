import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subscription } from 'rxjs';
import { LanguageService } from './language.service';

@Pipe({
  name: 't',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private readonly sub: Subscription;

  constructor(
    private readonly language: LanguageService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.sub = this.language.language$.subscribe(() => this.cdr.markForCheck());
  }

  transform(key: string, params?: Record<string, string | number>): string {
    return this.language.instant(key, params);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}
