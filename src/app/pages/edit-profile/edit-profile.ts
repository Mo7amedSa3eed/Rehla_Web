import { Component, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AppStateService } from '../../services/state';
import { Router } from '@angular/router';

@Component({
  selector: 'app-edit-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-profile.html',
  styleUrls: ['./edit-profile.scss']
})
export class EditProfileComponent implements OnInit {
  user: {
    firstName: string;
    familyName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
    photo?: string | null;
  };
  selectedPhoto: File | null = null;

  constructor(
    public state: AppStateService,
    private router: Router
  ) {
    this.user = {
      firstName: this.state.userProfile.firstName,
      familyName: this.state.userProfile.familyName,
      lastName: this.state.userProfile.lastName,
      email: this.state.userProfile.email,
      phoneNumber: this.state.userProfile.phone,
      photo: this.state.userProfile.photo,
    };
  }

  async ngOnInit(): Promise<void> {
    await this.state.loadProfile().catch(() => undefined);
    this.user = {
      firstName: this.state.userProfile.firstName,
      familyName: this.state.userProfile.familyName,
      lastName: this.state.userProfile.lastName,
      email: this.state.userProfile.email,
      phoneNumber: this.state.userProfile.phone,
      photo: this.state.userProfile.photo,
    };
  }

  onPhotoSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.selectedPhoto = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.user.photo = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  async saveChanges(form: NgForm): Promise<void> {
    if (form.invalid) {
      return;
    }

    try {
      let uploadedPhotoUrl = this.user.photo ?? null;

      if (this.selectedPhoto) {
        uploadedPhotoUrl = await this.state.uploadProfilePicture(this.selectedPhoto);
        this.user.photo = uploadedPhotoUrl;
      }

      await this.state.saveProfile({
        ...this.user,
        profilePictureUrl: uploadedPhotoUrl,
      });

      await this.router.navigate(['/profile']);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      alert(message);
    }
  }

  async cancel(): Promise<void> {
    await this.router.navigate(['/profile']);
  }
}