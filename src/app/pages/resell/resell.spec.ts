import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResellComponent } from './resell';

describe('Resell', () => {
  let component: ResellComponent;
  let fixture: ComponentFixture<ResellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResellComponent]
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
