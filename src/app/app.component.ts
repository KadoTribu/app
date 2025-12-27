import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonApp, IonRouterOutlet, IonSplitPane, IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonMenuToggle, IonItem, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { RouterLink } from '@angular/router';
import { AuthService } from './services/auth.service';
import { addIcons } from 'ionicons';
import { home, people, logOut, person, card } from 'ionicons/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: true,
  imports: [IonApp, IonRouterOutlet, IonSplitPane, IonMenu, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonMenuToggle, IonItem, IonIcon, IonLabel, CommonModule, RouterLink],
})
export class AppComponent {
  private authService = inject(AuthService);
  user$ = this.authService.user$;


  constructor() {
    addIcons({ home, people, logOut, person, card });
    this.initializeApp();
  }

  initializeApp() {
    const storedTheme = localStorage.getItem('theme_preference');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    let isDark = false;
    if (storedTheme) {
      isDark = storedTheme === 'dark';
    } else {
      isDark = prefersDark.matches;
    }

    document.body.classList.toggle('dark', isDark);
  }

  logout() {
    this.authService.logout();
  }
}
