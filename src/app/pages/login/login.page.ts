import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonIcon, IonText, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { logoGoogle } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonContent, IonButton, IonIcon, IonSpinner, CommonModule, FormsModule]
})
export class LoginPage {
  private authService = inject(AuthService);
  private router = inject(Router);
  isLoading = false;

  constructor() {
    addIcons({ logoGoogle });
  }

  async loginGoogle() {
    this.isLoading = true;
    try {
      await this.authService.loginWithGoogle();
      // Navigation is handled by auth state or subsequent logic, but let's try direct nav too
      this.router.navigate(['/tabs/home']);
    } catch (error) {
      console.error(error);
      // Handle error (show toast)
    } finally {
      this.isLoading = false;
    }
  }
}

