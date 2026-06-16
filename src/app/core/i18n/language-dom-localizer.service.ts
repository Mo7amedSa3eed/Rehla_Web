import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { LanguageService } from './language.service';

@Injectable({ providedIn: 'root' })
export class LanguageDomLocalizerService {
  private readonly originalText = new WeakMap<Text, string>();
  private readonly originalAttrs = new WeakMap<Element, Record<string, string>>();
  private observer?: MutationObserver;

  constructor(
    private readonly language: LanguageService,
    private readonly zone: NgZone,
    @Inject(DOCUMENT) private readonly document: Document,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  start(): void {
    if (!isPlatformBrowser(this.platformId) || this.observer) return;

    this.zone.runOutsideAngular(() => {
      this.localizeTree(this.document.body);
      this.observer = new MutationObserver(() => this.localizeTree(this.document.body));
      this.observer.observe(this.document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['placeholder', 'title', 'aria-label'],
      });
    });

    this.language.language$.subscribe(() => {
      this.zone.runOutsideAngular(() => this.localizeTree(this.document.body));
    });
  }

  private localizeTree(root: ParentNode): void {
    const walker = this.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let current = walker.nextNode();

    while (current) {
      this.localizeTextNode(current as Text);
      current = walker.nextNode();
    }

    root.querySelectorAll?.('[placeholder], [title], [aria-label]').forEach((element) => {
      this.localizeAttributes(element);
    });
  }

  private localizeTextNode(node: Text): void {
    const parent = node.parentElement;
    if (!parent || ['SCRIPT', 'STYLE', 'CODE', 'PRE'].includes(parent.tagName)) return;

    if (!this.originalText.has(node)) {
      this.originalText.set(node, node.data);
    }

    let original = this.originalText.get(node) ?? node.data;
    const translatedOriginal = this.translatePreservingWhitespace(original);
    if (node.data !== original && node.data !== translatedOriginal) {
      original = node.data;
      this.originalText.set(node, original);
    }

    const translated = this.translatePreservingWhitespace(original);
    if (node.data !== translated) {
      node.data = translated;
    }
  }

  private localizeAttributes(element: Element): void {
    const attrs = ['placeholder', 'title', 'aria-label'];
    let originals = this.originalAttrs.get(element);
    if (!originals) {
      originals = {};
      this.originalAttrs.set(element, originals);
    }

    attrs.forEach((attr) => {
      const value = element.getAttribute(attr);
      if (!value) return;
      originals![attr] ??= value;
      const translatedOriginal = this.translatePreservingWhitespace(originals![attr]);
      if (value !== originals![attr] && value !== translatedOriginal) {
        originals![attr] = value;
      }
      const translated = this.translatePreservingWhitespace(originals![attr]);
      if (value !== translated) {
        element.setAttribute(attr, translated);
      }
    });
  }

  private translatePreservingWhitespace(value: string): string {
    const match = value.match(/^(\s*)(.*?)(\s*)$/s);
    if (!match) return value;
    const [, before, body, after] = match;
    if (!body.trim()) return value;
    return `${before}${this.language.exact(body)}${after}`;
  }
}
