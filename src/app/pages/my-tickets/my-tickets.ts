import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AppStateService, MarketplaceListing, UiBooking } from '../../services/state';
import { QRCodeComponent } from 'angularx-qrcode';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageService } from '../../core/i18n/language.service';

@Component({
  selector: 'app-my-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, QRCodeComponent, TranslatePipe],
  templateUrl: './my-tickets.html',
  styleUrls: ['./my-tickets.scss']
})
export class MyTicketsComponent implements OnInit, OnDestroy {
  private readonly activeBeforeBoardingMs = 5 * 60 * 60 * 1000;
  private readonly boardingNowMs = 60 * 60 * 1000;

  view: 'tickets' | 'marketplace' = 'tickets';
  ticketTab: 'upcoming' | 'active' | 'past' = 'upcoming';
  visibleTickets: UiBooking[] = [];
  isLoading = true;
  hasLoadedTickets = false;
  loadError = '';
  actionError = '';

  // Marketplace filter state
  isMarketplaceFilterOpen = false;
  mpFilterOrigin = '';
  mpFilterDestination = '';
  mpFilterDate = '';

  // Expanded ticket detail
  expandedTicketId: number | null = null;

  // Boarding pass state
  showBoardingPass = false;
  boardingPassTicket: UiBooking | null = null;
  boardingPassPassenger: { passengerId?: number; name: string; idNumber: string; seatNumber: string } | null = null;
  qrPayload = '';
  qrLoading = false;
  qrError = '';

  // Refund state
  isRequestingRefund = false;
  showRefundDialog = false;
  refundTargetTicket: UiBooking | null = null;

  // Cancel listing state
  isCancellingListing = false;

  // Countdown timer
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  countdownMap: Map<number, string> = new Map();

  // Print ref
  @ViewChild('boardingPassEl') boardingPassEl!: ElementRef;

  constructor(
    public state: AppStateService,
    private router: Router,
    private language: LanguageService,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.refreshTickets();
    this.startCountdown();
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  async refreshTickets(): Promise<void> {
    this.actionError = '';
    if (!this.state.isBrowser()) {
      return;
    }

    this.isLoading = true;
    this.loadError = '';

    try {
      await Promise.all([
        this.state.loadProfile().catch(() => undefined),
        this.state.loadTickets(),
        this.state.loadMarketplace(),
      ]);
    } catch (error) {
      this.loadError = error instanceof Error ? error.message : 'Failed to load tickets';
    } finally {
      this.updateVisibleTickets();
      this.hasLoadedTickets = true;
      this.isLoading = false;
      this.updateCountdowns();
    }
  }

  setTicketTab(tab: 'upcoming' | 'active' | 'past'): void {
    this.ticketTab = tab;
    this.updateVisibleTickets();
  }

  // ─── Ticket Classification (Spec rules) ───

  private parseScheduleLocal(value: string): Date {
    return new Date(value);
  }

  private normalize(value?: string | null): string {
    return (value ?? '').trim().toLowerCase();
  }

  private ticketStatus(ticket: UiBooking): string {
    return this.normalize(ticket.rawStatus ?? ticket.status);
  }

  private isConfirmed(ticket: UiBooking): boolean {
    return this.ticketStatus(ticket) === 'confirmed';
  }

  private isCompleted(ticket: UiBooking): boolean {
    return this.ticketStatus(ticket) === 'completed';
  }

  private isCancelled(ticket: UiBooking): boolean {
    return this.ticketStatus(ticket) === 'cancelled';
  }

  private isRefundAccepted(ticket: UiBooking): boolean {
    const refund = this.normalize(ticket.refundStatus);
    return refund === 'accepted' || refund === 'approved';
  }

  private isHiddenFromTicketTabs(ticket: UiBooking): boolean {
    return this.isCancelled(ticket) && !this.isRefundAccepted(ticket);
  }

  private isUpcoming(ticket: UiBooking, now = new Date()): boolean {
    if (
      !ticket.boardingTimeRaw ||
      this.isHiddenFromTicketTabs(ticket) ||
      this.isRefundAccepted(ticket) ||
      !this.isConfirmed(ticket)
    ) {
      return false;
    }

    const activeStartsAt = new Date(
      this.parseScheduleLocal(ticket.boardingTimeRaw).getTime() - this.activeBeforeBoardingMs,
    );
    return now < activeStartsAt;
  }

  private isActiveNow(ticket: UiBooking, now = new Date()): boolean {
    if (
      !ticket.boardingTimeRaw ||
      this.isHiddenFromTicketTabs(ticket) ||
      this.isRefundAccepted(ticket) ||
      !this.isConfirmed(ticket)
    ) {
      return false;
    }

    const activeStartsAt = new Date(
      this.parseScheduleLocal(ticket.boardingTimeRaw).getTime() - this.activeBeforeBoardingMs,
    );
    return now >= activeStartsAt;
  }

  private isPast(ticket: UiBooking, now = new Date()): boolean {
    if (this.isHiddenFromTicketTabs(ticket)) return false;
    if (this.isRefundAccepted(ticket)) return true;
    if (!ticket.boardingTimeRaw || !this.isCompleted(ticket)) return false;

    const pastStartsAt = new Date(
      this.parseScheduleLocal(ticket.boardingTimeRaw).getTime() + this.boardingNowMs,
    );
    return now > pastStartsAt;
  }

  get myTicketsList(): UiBooking[] {
    return this.visibleTickets;
  }

  private updateVisibleTickets(): void {
    const all = this.state.myTickets;
    const now = new Date();

    if (this.ticketTab === 'active') {
      this.visibleTickets = all
        .filter(t => this.isActiveNow(t, now))
        .sort((a, b) => this.sortByBoardingAsc(a, b));
    } else if (this.ticketTab === 'upcoming') {
      this.visibleTickets = all
        .filter(t => this.isUpcoming(t, now))
        .sort((a, b) => this.sortByBoardingAsc(a, b));
    } else {
      this.visibleTickets = all
        .filter(t => this.isPast(t, now))
        .sort((a, b) => this.sortByDropoffDesc(a, b));
    }
  }

  private sortByBoardingAsc(a: UiBooking, b: UiBooking): number {
    return this.scheduleTime(a.boardingTimeRaw) - this.scheduleTime(b.boardingTimeRaw) || a.id - b.id;
  }

  private sortByDropoffDesc(a: UiBooking, b: UiBooking): number {
    return this.scheduleTime(b.dropoffTimeRaw) - this.scheduleTime(a.dropoffTimeRaw) || b.id - a.id;
  }

  private scheduleTime(value?: string): number {
    return value ? this.parseScheduleLocal(value).getTime() : 0;
  }

  // ─── Countdown ───

  private startCountdown(): void {
    if (!this.state.isBrowser()) return;

    this.countdownInterval = setInterval(() => {
      this.updateCountdowns();
    }, 30000); // Every 30 seconds
  }

  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private updateCountdowns(): void {
    const now = new Date();
    this.countdownMap = new Map();

    for (const ticket of this.state.myTickets) {
      if (this.isActiveNow(ticket, now) && ticket.boardingTimeRaw) {
        this.countdownMap.set(ticket.id, this.timeUntilBoarding(ticket, now));
      }
    }

    this.updateVisibleTickets();
  }

  timeUntilBoarding(ticket: UiBooking, now = new Date()): string {
    if (!ticket.boardingTimeRaw) return '';
    const diffMs = this.parseScheduleLocal(ticket.boardingTimeRaw).getTime() - now.getTime();
    if (diffMs <= 0) return this.language.instant('Boarding now');

    const totalMinutes = Math.floor(diffMs / 1000 / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0) {
      return this.language.instant('{{hours}}h {{minutes}}m left', { hours, minutes });
    }
    return this.language.instant('{{minutes}}m left', { minutes });
  }

  getCountdown(ticketId: number): string {
    return this.countdownMap.get(ticketId) || '';
  }

  // ─── Ticket Details ───

  toggleDetails(ticketId: number): void {
    this.expandedTicketId = this.expandedTicketId === ticketId ? null : ticketId;
  }

  isExpanded(ticketId: number): boolean {
    return this.expandedTicketId === ticketId;
  }

  // ─── Status Helpers ───

  getStatusLabel(ticket: UiBooking): string {
    if (this.isRefundAccepted(ticket)) return 'Cancelled (Refunded)';
    if (ticket.refundStatus === 'Requested') return 'Refund Requested';
    if (ticket.refundStatus === 'Rejected') return 'Refund Rejected';
    if (ticket.isOfferedForResale) return 'Listed on Marketplace';
    if (ticket.status === 'confirmed') return 'Confirmed';
    if (ticket.status === 'completed') return 'Completed';
    if (ticket.status === 'pending-sale') return 'Offered for Sale';
    if (ticket.status === 'sold') return 'Sold';
    if (ticket.status === 'cancelled') return 'Cancelled';
    return 'Pending';
  }

  getStatusClass(ticket: UiBooking): Record<string, boolean> {
    return {
      confirmed: ticket.status === 'confirmed' && !this.isRefundAccepted(ticket) && !ticket.isOfferedForResale,
      pending: ticket.status === 'pending',
      pendingSale: ticket.status === 'pending-sale' || (ticket.isOfferedForResale === true),
      sold: ticket.status === 'sold',
      cancelled: ticket.status === 'cancelled' || this.isRefundAccepted(ticket),
      refundRequested: ticket.refundStatus === 'Requested',
      refundRejected: ticket.refundStatus === 'Rejected',
    };
  }

  getAgencyClass(agencyName: string | undefined): string {
    if (!agencyName) return '';
    const name = agencyName.toLowerCase();
    if (name.includes('gobus') || name.includes('go bus')) return 'agency-orange';
    if (name.includes('bluebus') || name.includes('blue bus')) return 'agency-purple';
    if (name.includes('horus')) return 'agency-green';
    return '';
  }

  // ─── Refund Logic ───

  canShowRefund(ticket: UiBooking): boolean {
    if (!ticket.boardingTimeRaw) return false;
    return this.parseScheduleLocal(ticket.boardingTimeRaw) > new Date() &&
           (ticket.status === 'confirmed' || ticket.refundStatus != null) &&
           !ticket.isMarketplacePurchase;
  }

  isRefundDisabled(ticket: UiBooking): boolean {
    const hasFinalOrPending =
      ticket.refundStatus === 'Requested' ||
      ticket.refundStatus === 'Accepted' ||
      ticket.refundStatus === 'Approved' ||
      ticket.refundStatus === 'Rejected';

    return hasFinalOrPending || this.isRequestingRefund || (ticket.isOfferedForResale === true);
  }

  getRefundButtonLabel(ticket: UiBooking): string {
    if (this.isRequestingRefund && this.refundTargetTicket?.id === ticket.id) {
      return 'Submitting refund request...';
    }
    if (ticket.isOfferedForResale) return 'Listed on Marketplace';
    if (ticket.refundStatus === 'Requested') return 'Refund Requested';
    if (ticket.refundStatus === 'Accepted' || ticket.refundStatus === 'Approved') return 'Refund Accepted';
    if (ticket.refundStatus === 'Rejected') return 'Refund Rejected';
    return 'Request Refund';
  }

  openRefundDialog(ticket: UiBooking): void {
    this.refundTargetTicket = ticket;
    this.showRefundDialog = true;
  }

  closeRefundDialog(): void {
    this.showRefundDialog = false;
    this.refundTargetTicket = null;
  }

  async confirmRefund(): Promise<void> {
    if (!this.refundTargetTicket || this.isRequestingRefund) return;

    this.actionError = '';
    this.isRequestingRefund = true;
    try {
      await this.state.requestRefund(this.refundTargetTicket.id);
      this.closeRefundDialog();
      await this.refreshTickets();
    } catch (error) {
      this.actionError = error instanceof Error ? error.message : 'Failed to request refund';
    } finally {
      this.isRequestingRefund = false;
    }
  }

  // ─── Resell ───

  canResellTicket(ticket: UiBooking): boolean {
    if (!ticket.boardingTimeRaw) return false;
    const isUpcoming = this.parseScheduleLocal(ticket.boardingTimeRaw) > new Date();
    return isUpcoming &&
           ticket.status === 'confirmed' &&
           !ticket.isMarketplacePurchase &&
           !ticket.isOfferedForResale &&
           (ticket.refundStatus == null || ticket.refundStatus === 'Rejected');
  }

  async resellTicket(ticket: UiBooking): Promise<void> {
    this.actionError = '';
    if (!this.canResellTicket(ticket)) {
      this.actionError = 'This ticket cannot be resold.';
      return;
    }

    this.state.selectedTicket = ticket;
    await this.router.navigate(['/resell'], { state: { ticket } });
  }

  // ─── Cancel Listing ───

  canCancelListing(ticket: UiBooking): boolean {
    return (ticket.isOfferedForResale === true) && ticket.activeListingId != null;
  }

  async cancelListing(ticket: UiBooking): Promise<void> {
    if (!ticket.activeListingId || this.isCancellingListing) return;

    if (!confirm(this.language.instant('Are you sure you want to cancel this listing?'))) return;

    this.actionError = '';
    this.isCancellingListing = true;
    try {
      await this.state.cancelListing(ticket.activeListingId);
      await this.refreshTickets();
    } catch (error) {
      this.actionError = error instanceof Error ? error.message : 'Failed to cancel listing';
    } finally {
      this.isCancellingListing = false;
    }
  }

  // ─── Boarding Pass ───

  async openBoardingPass(ticket: UiBooking, passenger: { passengerId?: number; name: string; idNumber: string; seatNumber: string }): Promise<void> {
    this.boardingPassTicket = ticket;
    this.boardingPassPassenger = passenger;
    this.showBoardingPass = true;
    this.qrPayload = '';
    this.qrError = '';
    this.qrLoading = true;

    if (this.ticketTab === 'past') {
      this.qrLoading = false;
      return;
    }

    try {
      const pid = passenger.passengerId ?? 0;
      if (pid > 0) {
        this.qrPayload = await this.state.getPassengerQrPayload(ticket.id, pid);
      } else {
        this.qrPayload = `REF-${ticket.id}-P${pid}`;
      }
    } catch (error) {
      this.qrError = error instanceof Error ? error.message : 'Failed to load QR code';
      // Fallback QR
      this.qrPayload = `REF-${ticket.id}-${passenger.name}`;
    } finally {
      this.qrLoading = false;
    }
  }

  closeBoardingPass(): void {
    this.showBoardingPass = false;
    this.boardingPassTicket = null;
    this.boardingPassPassenger = null;
    this.qrPayload = '';
    this.qrError = '';
  }

  locationCode(value: string): string {
    if (!value) return '???';
    return value.length < 3 ? value.toUpperCase() : value.substring(0, 3).toUpperCase();
  }

  tripDuration(ticket: UiBooking): string {
    if (!ticket.boardingTimeRaw || !ticket.dropoffTimeRaw) return ticket.duration || '--';
    const from = this.parseScheduleLocal(ticket.boardingTimeRaw).getTime();
    const to = this.parseScheduleLocal(ticket.dropoffTimeRaw).getTime();
    const minutes = Math.max(0, Math.floor((to - from) / 1000 / 60));
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }

  async printBoardingPass(): Promise<void> {
    window.print();
  }

  async downloadBoardingPass(): Promise<void> {
    if (!this.boardingPassEl?.nativeElement) return;

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(this.boardingPassEl.nativeElement, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pageWidth - 20;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      const name = this.boardingPassPassenger?.name?.replace(/\s+/g, '_') || 'passenger';
      pdf.save(`boarding-pass-${name}.pdf`);
    } catch (error) {
      this.actionError = 'Failed to download boarding pass. Please use the Print option instead.';
    }
  }

  // ─── Marketplace ───

  get marketplaceTickets(): MarketplaceListing[] {
    const userId = this.state.userProfile?.userId;
    return this.state.marketplace.filter((ticket) => {
      const sellerId = ticket.sellerId ?? null;
      return sellerId == null || sellerId !== userId;
    });
  }

  get averageDiscount(): number {
    const tickets = this.marketplaceTickets;
    if (!tickets || tickets.length === 0) return 0;

    let totalDiscount = 0;
    let validCount = 0;

    for (const item of tickets) {
      const original = Number(item.originalPrice ?? 0);
      const asking = Number(item.price ?? 0);
      if (original > 0 && asking < original) {
        totalDiscount += ((original - asking) / original) * 100;
        validCount++;
      }
    }

    return validCount > 0 ? totalDiscount / validCount : 0;
  }

  private isOwnListing(ticket: { sellerId?: number; ownerId?: number; sellerName?: string }): boolean {
    // Prefer sellerId for matching (spec recommendation)
    if (typeof ticket.sellerId === 'number' && ticket.sellerId === this.state.userProfile.userId) {
      return true;
    }
    if (typeof ticket.ownerId === 'number' && ticket.ownerId === this.state.userProfile.userId) {
      return true;
    }

    const currentName = this.getCurrentUserName();
    if (!currentName || !ticket.sellerName) {
      return false;
    }

    return this.normalizeName(ticket.sellerName) === this.normalizeName(currentName);
  }

  private getCurrentUserName(): string {
    const profile = this.state.userProfile;
    return [profile.firstName, profile.familyName, profile.lastName]
      .filter((value) => value && value.trim().length > 0)
      .join(' ')
      .trim();
  }

  private normalizeName(value: string): string {
    return value.trim().toLowerCase();
  }

  buyTicket(ticket: any): void {
    if (!confirm(this.language.instant('Review the ticket details before continuing to payment. Proceed?'))) {
      return;
    }

    this.state.prepareMarketplacePurchase(ticket);
    this.router.navigate(['/marketplace-confirm']);
  }

  openMarketplaceFilter() {
    this.isMarketplaceFilterOpen = true;
  }

  closeMarketplaceFilter() {
    this.isMarketplaceFilterOpen = false;
  }

  async resetMarketplaceFilters() {
    this.mpFilterOrigin = '';
    this.mpFilterDestination = '';
    this.mpFilterDate = '';
    this.isLoading = true;
    try {
      await this.state.loadMarketplace();
    } finally {
      this.isLoading = false;
    }
  }

  async applyMarketplaceFilters() {
    this.closeMarketplaceFilter();
    this.isLoading = true;
    try {
      const params: any = {};
      if (this.mpFilterOrigin) params.originGovernorate = this.mpFilterOrigin;
      if (this.mpFilterDestination) params.destinationGovernorate = this.mpFilterDestination;
      if (this.mpFilterDate) params.travelDate = this.mpFilterDate;
      await this.state.loadMarketplace(params);
    } finally {
      this.isLoading = false;
    }
  }
}
