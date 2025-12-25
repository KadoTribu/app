import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonList, IonListHeader, IonItem, IonLabel, IonCheckbox, IonButton, IonIcon, IonProgressBar, IonChip, AlertController, IonFab, IonFabButton, ModalController } from '@ionic/angular/standalone';
import { EventsService, TribuEvent, Gift } from '../../services/events.service';
import { MakeGroupGiftModalComponent } from '../../components/make-group-gift-modal/make-group-gift-modal.component';
import { AuthService } from '../../services/auth.service';
import { ContactsService, AppContact } from '../../services/contacts.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, switchMap, of, tap } from 'rxjs';
import { addIcons } from 'ionicons';
import { wallet, add, people, gift, star, mailOpen, trash } from 'ionicons/icons';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.page.html',
  styleUrls: ['./event-detail.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonList, IonListHeader, IonItem, IonLabel, IonCheckbox, IonButton, IonIcon, IonProgressBar, IonChip, CommonModule, FormsModule, IonFab, IonFabButton]
})
export class EventDetailPage implements OnInit {
  private eventsService = inject(EventsService);
  private authService = inject(AuthService);
  private contactsService = inject(ContactsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private modalCtrl = inject(ModalController);

  event$: Observable<TribuEvent | undefined> = of(undefined);
  gifts$: Observable<Gift[]> = of([]);
  currentUserUid = this.authService.currentUser?.uid;
  contacts: AppContact[] = [];
  isPending = false;

  constructor() {
    addIcons({ wallet, add, people, gift, star, mailOpen, trash });
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.event$ = this.eventsService.getEvent(id).pipe(
        tap(event => {
          if (event && this.currentUserUid) {
            const status = event.participationStatus?.[this.currentUserUid];
            // Only block if explicitly pending. If undefined (old events), allow.
            this.isPending = status === 'pending';
          }
        })
      );
      this.gifts$ = this.eventsService.getEventGifts(id);
      this.contacts = await this.contactsService.getAllContacts();
    }
  }

  getContactName(uid: string): string {
    return this.contacts.find(c => c.uid === uid)?.name || 'Alguien';
  }

  async acceptInvitation(event: TribuEvent) {
    if (!this.currentUserUid || !event.id) return;
    await this.eventsService.acceptInvitation(event.id, event.organizerId, event.honoreeIds || []);
    this.isPending = false;
  }

  async rejectInvitation(event: TribuEvent) {
    if (!event.id) return;
    await this.eventsService.rejectInvitation(event.id);
    this.router.navigate(['/tabs/home']);
  }

  async deleteEventUi(event: TribuEvent) {
    const alert = await this.alertCtrl.create({
      header: '¿Borrar Evento?',
      message: 'Esta acción es irreversible. Se borrarán todos los regalos y deudas asociados.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Borrar',
          role: 'destructive',
          handler: async () => {
            if (event.id) {
              await this.eventsService.deleteEvent(event.id);
              this.router.navigate(['/tabs/home']);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  viewDebts(eventId: string) {
    this.router.navigate(['/debts', eventId]);
  }

  async toggleReservation(gift: Gift) {
    if (gift.purchaseType === 'group') return;

    // Toggle
    if (gift.assignedTo === this.currentUserUid) {
      await this.eventsService.releaseGift(gift.id!);
    } else if (!gift.assignedTo) {
      await this.eventsService.reserveGift(gift.id!);
    }
  }

  async startGroupGift(gift: Gift, event: TribuEvent) {
    const modal = await this.modalCtrl.create({
      component: MakeGroupGiftModalComponent,
      componentProps: {
        activeParticipantsUids: event.participantIds
      }
    });
    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data) {
      await this.eventsService.createGroupGift(
        gift.id!,
        gift.title,
        event.id!,
        data.participantIds,
        data.payerId,
        gift.price || 0
      );
    }
  }

  async addGift() {
    const eventId = this.route.snapshot.paramMap.get('id');
    if (!eventId) return;

    const alert = await this.alertCtrl.create({
      header: 'Añadir Regalo',
      inputs: [
        {
          name: 'title',
          type: 'text',
          placeholder: 'Nombre del regalo (ej: Bicicleta)'
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
            if (data.title) {
              this.eventsService.addGift({
                eventId: eventId,
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
}

