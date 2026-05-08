import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-auth-info',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './auth-info.html',
  styleUrls: ['./auth-info.scss']
})
export class AuthInfoComponent {}
