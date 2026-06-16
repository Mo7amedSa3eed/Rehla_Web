import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-language-switch',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './language-switch.html',
  styleUrls: ['./language-switch.scss'],
})
export class LanguageSwitchComponent {
  constructor(public readonly language: LanguageService) {}

  setLanguage(lang: 'en' | 'ar'): void {
    void this.language.setLanguage(lang, true, true);
  }
}
