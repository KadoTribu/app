import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonLabel, IonInput, IonButton, IonNote } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.page.html',
  styleUrls: ['./onboarding.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonItem, IonLabel, IonInput, IonButton, IonNote, CommonModule, FormsModule]
})
export class OnboardingPage {
  private authService = inject(AuthService);
  private router = inject(Router);

  phoneNumber = '';
  isLoading = false;

  constructor() { }

  async savePhone() {
    if (!this.phoneNumber || this.phoneNumber.length < 9) return;
    this.isLoading = true;
    try {
      const user = this.authService.currentUser;
      if (user) {
        await this.authService.updateUserPhone(user.uid, this.phoneNumber);
        this.router.navigate(['/tabs/home']);
      }
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoading = false;
    }
  }
}

