import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { ResellComponent } from './resell';
import { AppStateService } from '../../services/state';

describe('Resell', () => {
  let component: ResellComponent;
  let fixture: ComponentFixture<ResellComponent>;

  const stateStub = {
    selectedTicket: null,
    listTicketForResale: () => Promise.resolve(),
    loadTickets: () => Promise.resolve(),
    loadMarketplace: () => Promise.resolve(),
    loadBookings: () => Promise.resolve(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResellComponent, RouterTestingModule],
      providers: [{ provide: AppStateService, useValue: stateStub }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
