import { Component, OnInit, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonAvatar, IonButton, IonIcon, IonRefresher, IonRefresherContent, IonButtons, IonFab, IonFabButton, IonFabList, Platform, AlertController, IonSegment, IonSegmentButton, IonSearchbar, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/angular/standalone';
import { ContactsService, AppContact } from '../../services/contacts.service';
import { AuthService } from '../../services/auth.service';
import { SkeletonLoaderComponent } from '../../components/skeleton-loader/skeleton-loader.component';
import { UserBadgeComponent } from '../../components/user-badge/user-badge.component';
import { addIcons } from 'ionicons';
import { shareSocial, personAdd, add, create, people } from 'ionicons/icons';

@Component({
  selector: 'app-contacts',
  templateUrl: './contacts.page.html',
  styleUrls: ['./contacts.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonItem, IonLabel, IonAvatar, IonButton, IonIcon, IonRefresher, IonRefresherContent, IonButtons, IonFab, IonFabButton, IonFabList, CommonModule, FormsModule, SkeletonLoaderComponent, UserBadgeComponent, IonSegment, IonSegmentButton, IonSearchbar, IonInfiniteScroll, IonInfiniteScrollContent]
})
export class ContactsPage implements OnInit {
  private contactsService = inject(ContactsService);
  private authService = inject(AuthService); // Injected AuthService
  private alertCtrl = inject(AlertController);
  private platform = inject(Platform);
  contacts: AppContact[] = [];
  displayedContacts: AppContact[] = [];
  viewMode: 'registered' | 'invite' = 'registered';
  isLoading = true;

  // Pagination & Search
  @ViewChild(IonInfiniteScroll) infiniteScroll?: IonInfiniteScroll;

  // Pagination & Search
  offset = 0;
  limit = 20;
  currentQuery = '';
  hasMore = true;
  private requestId = 0;

  constructor() {
    addIcons({ shareSocial, personAdd, add, create, people });
  }

  ngOnInit() {
    this.initPage();
  }

  async initPage() {
    this.isLoading = true;
    try {
      await this.contactsService.initContacts();
      await this.loadNextPage(null, true);
    } catch (e: any) {
      console.error(e);
      this.handleError(e);
    } finally {
      this.isLoading = false;
    }
  }

  // Called by Refresher
  async refreshContacts(event: any) {
    this.offset = 0;
    this.hasMore = true;
    this.currentQuery = ''; // Optional: clear search on refresh?
    // Reset infinite scroll state if needed
    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
    }
    await this.initPage();
    event.target.complete();
  }

  async loadNextPage(event?: any, reset: boolean = false) {
    const reqId = ++this.requestId;

    if (reset) {
      this.contacts = [];
      this.offset = 0;
      this.hasMore = true;
      if (this.infiniteScroll) {
        this.infiniteScroll.disabled = false;
      }
    }

    if (!this.hasMore) {
      if (event) event.target.complete();
      return;
    }

    try {
      const newContacts = await this.contactsService.getContactsPage(this.offset, this.limit, this.currentQuery);

      // Check for race condition: if a newer request started, ignore this one
      if (reqId !== this.requestId) {
        if (event) event.target.complete();
        return;
      }

      if (newContacts.length < this.limit) {
        this.hasMore = false;
      }

      this.contacts = [...this.contacts, ...newContacts];
      this.offset += this.limit;

      this.filterContacts();

    } catch (e: any) {
      console.error(e);
      this.handleError(e);
    } finally {
      if (event) event.target.complete();
    }
  }

  onSearchChange(event: any) {
    this.currentQuery = event.target.value;
    this.loadNextPage(null, true);
  }

  filterContacts() {
    if (this.viewMode === 'registered') {
      this.displayedContacts = this.contacts.filter(c => c.isRegistered);
    } else {
      // In invite mode, we show contacts that are NOT registered
      this.displayedContacts = this.contacts.filter(c => !c.isRegistered);
    }
  }

  async handleError(e: any) {
    if (e.code === 'API_NOT_ENABLED') {
      const alert = await this.alertCtrl.create({
        header: 'Configuración Requerida',
        message: 'La Google People API no está habilitada en tu proyecto. Es necesario habilitarla para importar contactos.',
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Habilitar API',
            handler: () => {
              window.open('https://console.developers.google.com/apis/api/people.googleapis.com/overview?project=511372424896', '_blank');
            }
          }
        ]
      });
      await alert.present();
    }
  }


  invite(contact: AppContact) {
    this.contactsService.inviteContact(contact);
  }

  async addManualContact() {
    const alert = await this.alertCtrl.create({
      header: 'Nuevo Contacto',
      inputs: [
        {
          name: 'name',
          type: 'text',
          placeholder: 'Nombre'
        },
        {
          name: 'phone',
          type: 'tel',
          placeholder: 'Teléfono (ej: +34...)'
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Guardar',
          handler: (data) => {
            if (data.name && data.phone) {
              this.contactsService.addManualContact({
                name: data.name,
                phone: data.phone
              });
              this.refreshContacts({ target: { complete: () => { } } }); // Mock event
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async importContacts() {
    const isCapacitor = this.platform.is('capacitor');
    const hasWebAPI = 'contacts' in navigator && 'ContactsManager' in window;
    const hasGoogleToken = !!localStorage.getItem('google_access_token');

    if (isCapacitor || hasWebAPI) {
      // Native or Web API supported, just reload (service handles it)
      this.initPage();
      return;
    }

    // If we are here, we are likely on Web/Desktop without Contact Picker API
    if (hasGoogleToken) {
      // We have a token, just reload (service will fetch from Google)
      this.initPage();
      return;
    }

    // No token, prompt user to connect Google
    const alert = await this.alertCtrl.create({
      header: 'Importar Contactos',
      message: 'Para importar tus contactos en este dispositivo, puedes conectar tu cuenta de Google.',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Conectar Google',
          handler: () => {
            this.connectGoogle();
          }
        }
      ]
    });
    await alert.present();
  }

  async connectGoogle() {
    try {
      await this.authService.loginWithGoogle();
      // After payload, reload contacts
      this.initPage();
    } catch (error: any) {
      console.error('Google Connect Error', error);
      const alert = await this.alertCtrl.create({
        header: 'Error',
        message: 'No se pudo conectar con Google.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }
}

