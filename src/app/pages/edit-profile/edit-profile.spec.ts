import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { EditProfileComponent } from './edit-profile';
import { AppStateService } from '../../services/state';

describe('EditProfileComponent', () => {
  let component: EditProfileComponent;
  let fixture: ComponentFixture<EditProfileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [EditProfileComponent],
      imports: [FormsModule],
      providers: [AppStateService]
    }).compileComponents();

    fixture = TestBed.createComponent(EditProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load user profile from AppStateService', () => {
    expect(component.user).toBeDefined();
    expect(component.user.firstName).toBeTruthy();
  });

  it('should update user first name', () => {
    component.user.firstName = 'Test';
    expect(component.user.firstName).toBe('Test');
  });
});
