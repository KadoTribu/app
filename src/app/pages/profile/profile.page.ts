import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonList, IonItem, IonLabel, IonInput, IonAvatar, IonToggle, IonButton, IonIcon, IonSelect, IonSelectOption, AlertController, IonListHeader, IonItemSliding, IonItemOptions, IonItemOption } from '@ionic/angular/standalone';
import { AuthService, UserProfile } from '../../services/auth.service';
import { EventsService, Gift } from '../../services/events.service';
import { addIcons } from 'ionicons';
import { moon, sunny, save, add, trash, gift } from 'ionicons/icons';
import { Observable, switchMap, of } from 'rxjs';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonList, IonItem, IonLabel, IonInput, IonAvatar, IonToggle, IonButton, IonIcon, IonSelect, IonSelectOption, IonListHeader, IonItemSliding, IonItemOptions, IonItemOption, CommonModule, FormsModule]

})
export class ProfilePage implements OnInit {
  private authService = inject(AuthService);
  private eventsService = inject(EventsService);
  private alertCtrl = inject(AlertController);

  user: UserProfile | null = null;
  wishlist$: Observable<Gift[]> = of([]);
  displayName = '';
  avatarSeed = '';
  isDarkMode = false;

  // DiceBear Options
  hairStyle = 'shortFlat';
  accessories = 'none';
  eyeStyle = 'default';
  skinColor = 'f8fdc9';
  hairColor = '2c1b18';
  clothesColor = '262e33';

  // Valid values from DiceBear 9.x Avataaars Schema
  hairOptions = [
    'bigHair', 'bob', 'bun', 'curly', 'curvy', 'dreads', 'frida', 'fro', 'froBand',
    'longButNotTooLong', 'miaWallace', 'shavedSides', 'straight01', 'straight02', 'straightAndStrand',
    'dreads01', 'dreads02', 'frizzle', 'shaggy', 'shaggyMullet', 'shortCurly', 'shortFlat',
    'shortRound', 'shortWaved', 'sides', 'theCaesar', 'theCaesarAndSidePart',
    'hat', 'hijab', 'turban', 'winterHat1', 'winterHat02', 'winterHat03', 'winterHat04'
  ];

  accessoryOptions = [
    'none', 'kurt', 'prescription01', 'prescription02', 'round', 'sunglasses', 'wayfarers', 'eyepatch'
  ];

  eyeOptions = [
    'closed', 'cry', 'default', 'eyeRoll', 'happy', 'hearts', 'side', 'squint', 'surprised', 'wink', 'winkWacky', 'xDizzy'
  ];

  // Simplified palettes
  skinColorOptions = [
    { name: 'Clara', value: 'f8fdc9' },
    { name: 'Media', value: 'd08b5b' },
    { name: 'Oscura', value: '614335' },
    { name: 'Pálida', value: 'ffdbb4' },
    { name: 'Bronceada', value: 'edb98a' }
  ];

  hairColorOptions = [
    { name: 'Negro', value: '2c1b18' },
    { name: 'Castaño Oscuro', value: '4a312c' },
    { name: 'Castaño Claro', value: '724133' },
    { name: 'Rubio', value: 'e8e191' },
    { name: 'Rojo', value: 'b55239' },
    { name: 'Gris', value: 'e8e8e8' },
    { name: 'Platino', value: 'ecdcbf' }
  ];

  clothesColorOptions = [
    { name: 'Negro', value: '262e33' },
    { name: 'Azul', value: '65c9ff' },
    { name: 'Azul Oscuro', value: '5199e4' },
    { name: 'Gris', value: 'e6e6e6' },
    { name: 'Rojo', value: 'ff5c5c' },
    { name: 'Rosa', value: 'ff488e' },
    { name: 'Naranja', value: 'ffdeb5' },
    { name: 'Verde', value: 'a7ffc4' },
    { name: 'Blanco', value: 'ffffff' }
  ];

  constructor() {
    addIcons({ moon, sunny, save, add, trash, gift });
  }

  ngOnInit() {
    this.authService.userProfile$.subscribe(profile => {
      this.user = profile;
      if (profile) {
        this.displayName = profile.displayName || '';
        if (profile.photoURL && profile.photoURL.includes('dicebear')) {
          try {
            const url = new URL(profile.photoURL);
            this.avatarSeed = url.searchParams.get('seed') || this.displayName;

            const loadedTop = url.searchParams.get('top');
            this.hairStyle = this.hairOptions.includes(loadedTop as string) ? loadedTop as string : 'shortFlat';

            const loadedAccessories = url.searchParams.get('accessories');
            this.accessories = this.accessoryOptions.includes(loadedAccessories as string) ? loadedAccessories as string : 'none';

            const loadedEyes = url.searchParams.get('eyes');
            this.eyeStyle = this.eyeOptions.includes(loadedEyes as string) ? loadedEyes as string : 'default';

            this.skinColor = url.searchParams.get('skinColor') || 'f8fdc9';
            this.hairColor = url.searchParams.get('hairColor') || '2c1b18';
            this.clothesColor = url.searchParams.get('clothesColor') || '262e33';
          } catch (e) {
            console.error('Error parsing avatar URL', e);
            this.avatarSeed = this.displayName;
          }
        } else {
          this.avatarSeed = this.displayName || 'seed';
        }
      }
    });

    this.wishlist$ = this.authService.user$.pipe(
      switchMap(user => user ? this.eventsService.getWishlist(user.uid) : of([]))
    );

    // Check stored preference or system preference
    const storedTheme = localStorage.getItem('theme_preference');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

    if (storedTheme) {
      this.isDarkMode = storedTheme === 'dark';
    } else {
      this.isDarkMode = prefersDark.matches;
    }

    // Apply class based on final decision
    document.body.classList.toggle('dark', this.isDarkMode);
  }

  get avatarUrl() {
    const seed = this.avatarSeed || 'default';
    const params = new URLSearchParams({
      seed: seed,
      top: this.hairStyle,
      accessories: this.accessories === 'none' ? '' : this.accessories,
      accessoriesProbability: '100',
      accessoriesColor: '262e33',
      eyes: this.eyeStyle,
      skinColor: this.skinColor,
      hairColor: this.hairColor,
      backgroundColor: 'ffffff',
      clothing: 'shirtCrewNeck',
      clothesColor: this.clothesColor
    });

    // Force no graphic for plain t-shirt
    params.set('clothingGraphic', '');

    if (this.accessories === 'none') {
      params.delete('accessories');
      params.delete('accessoriesProbability');
    }

    return `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`;
  }

  toggleTheme(event: any) {
    this.isDarkMode = event.detail.checked;
    document.body.classList.toggle('dark', this.isDarkMode);
    localStorage.setItem('theme_preference', this.isDarkMode ? 'dark' : 'light');
  }

  async saveProfile() {
    if (!this.user) return;

    try {
      await this.authService.updateProfile(this.user.uid, {
        displayName: this.displayName,
        photoURL: this.avatarUrl
      });
      // Show toast or feedback
    } catch (error) {
      console.error('Error saving profile', error);
    }
  }

  async addWishlistItem() {
    if (!this.user) return;
    const alert = await this.alertCtrl.create({
      header: 'Añadir Deseo',
      inputs: [
        {
          name: 'title',
          type: 'text',
          placeholder: 'Título (ej: Zapatillas)'
        },
        {
          name: 'url',
          type: 'url',
          placeholder: 'Enlace (opcional)'
        },
        {
          name: 'price',
          type: 'number',
          placeholder: 'Precio estimado (€)'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Añadir',
          handler: (data) => {
            if (data.title && this.user) {
              this.eventsService.addToWishlist(this.user.uid, {
                title: data.title,
                url: data.url,
                price: data.price ? parseFloat(data.price) : undefined
              });
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteWishlistItem(gift: Gift) {
    if (!this.user || !gift.id) return;
    await this.eventsService.deleteFromWishlist(this.user.uid, gift.id);
  }

  logout() {
    this.authService.logout();
  }
}
