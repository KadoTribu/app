import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonAvatar } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-badge',
  templateUrl: './user-badge.component.html',
  styleUrls: ['./user-badge.component.scss'],
  standalone: true,
  imports: [CommonModule, IonAvatar]
})
export class UserBadgeComponent {
  authService = inject(AuthService);
  private router = inject(Router);

  user$ = this.authService.userProfile$;

  goToProfile() {
    this.router.navigate(['/profile']);
  }
}
