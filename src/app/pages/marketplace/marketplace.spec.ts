import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { MarketplaceComponent } from './marketplace';
import { AppStateService } from '../../services/state';

describe('Marketplace', () => {
  let component: MarketplaceComponent;
  let fixture: ComponentFixture<MarketplaceComponent>;

  const stateStub = {
    userProfile: {
      userId: 1,
      firstName: 'Test',
      familyName: 'User',
      lastName: '',
    },
    loadProfile: () => Promise.resolve(),
    loadMarketplace: () => Promise.resolve(),
    marketplace: [],
    prepareMarketplacePurchase: () => undefined,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarketplaceComponent, RouterTestingModule],
      providers: [{ provide: AppStateService, useValue: stateStub }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MarketplaceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
