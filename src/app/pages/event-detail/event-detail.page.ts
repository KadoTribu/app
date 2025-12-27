import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonList, IonListHeader, IonItem, IonLabel, IonCheckbox, IonButton, IonIcon, IonProgressBar, IonChip, AlertController, IonFab, IonFabButton, ModalController, IonAvatar } from '@ionic/angular/standalone';
import { EventsService, TribuEvent, Gift, GiftGroup } from '../../services/events.service';
import { CreateEventModalComponent } from '../../components/create-event-modal/create-event-modal.component';
import { AuthService } from '../../services/auth.service';
import { ContactsService, AppContact } from '../../services/contacts.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, switchMap, of, tap } from 'rxjs';
import { addIcons } from 'ionicons';
import { wallet, add, people, gift, star, mailOpen, trash, personAdd, checkmarkCircle, closeCircle, time, create, location, calendarOutline, locationOutline } from 'ionicons/icons';

import { GroupGiftDetailComponent } from '../../components/group-gift-detail/group-gift-detail.component';

@Component({
  selector: 'app-event-detail',
  templateUrl: './event-detail.page.html',
  styleUrls: ['./event-detail.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonList, IonListHeader, IonItem, IonLabel, IonCheckbox, IonButton, IonIcon, IonProgressBar, IonChip, CommonModule, FormsModule, IonFab, IonFabButton, IonAvatar]
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
  giftGroups$: Observable<GiftGroup[]> = of([]);

  currentUserUid = this.authService.currentUser?.uid;
  contacts: AppContact[] = [];
  isPending = false;

  constructor() {
    addIcons({ wallet, add, people, gift, star, mailOpen, trash, personAdd, checkmarkCircle, closeCircle, time, create, location, calendarOutline, locationOutline });
  }

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.event$ = this.eventsService.getEvent(id).pipe(
        tap(event => {
          if (event && this.currentUserUid) {
            const status = event.participationStatus?.[this.currentUserUid];
            this.isPending = status === 'pending';
          }
        })
      );
      this.gifts$ = this.eventsService.getEventGifts(id);
      this.giftGroups$ = this.eventsService.getEventGiftGroups(id);
      this.giftGroups$.subscribe(groups => this.giftGroups = groups);
      this.contacts = await this.contactsService.getAllContacts();

      if (this.event$) {
        this.event$.subscribe(ev => { if (ev) this.loadParticipants(ev); });
      }
    }
  }

  giftGroups: GiftGroup[] = [];

  getGroupName(groupId: string): string {
    const g = this.giftGroups.find(x => x.id === groupId);
    return g ? `Grupo: ${g.name}` : 'Grupo';
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

  async editEvent(event: TribuEvent) {
    const modal = await this.modalCtrl.create({
      component: CreateEventModalComponent,
      componentProps: { event } // Pass event for editing
    });

    await modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm' && data) {
      // Transform guests to match structure if needed, or if service handles it.
      // Service expects Partial<TribuEvent>.
      // Modal returns object with properties.
      const updateData: Partial<TribuEvent> = {
        title: data.title,
        description: data.description,
        // Ensure date is stored as Timestamp if possible, or let service handle it? 
        // Service createEvent assigns new Date(), but updateEvent is just updateDoc.
        // We need to convert ISO string back to Date for Firestore SDK to save as Timestamp automatically?
        // Or just save as Date object.
        date: new Date(data.date),
        locationName: data.locationName,
        googleMapsLink: data.googleMapsLink,
        // Update participants? The modal returns uids.
        // If we update participationIds, we might mess up status.
        // Let's assume for now we only edit metadata (Title, Desc, Date, Location).
        // If organizer wants to add participants, they use the invite button.
        // If they want to remove? The modal allows unchecking.
        // Let's just update the basic fields for now to be safe, or handle participants carefully.
        // User mainly asked for Location and Date.
      };

      await this.eventsService.updateEvent(event.id!, updateData);
    }
  }

  viewDebts(eventId: string) {
    this.router.navigate(['/debts', eventId]);
  }

  async toggleReservation(gift: Gift) {
    if (gift.purchaseType === 'group') return;
    if (gift.assignedTo === this.currentUserUid) {
      await this.eventsService.releaseGift(gift.id!);
    } else if (!gift.assignedTo) {
      await this.eventsService.reserveGift(gift.id!);
    }
  }

  async createGroupUi() {
    const eventId = this.route.snapshot.paramMap.get('id');
    if (!eventId) return;

    const alert = await this.alertCtrl.create({
      header: 'Crear Bote / Grupo de Regalo',
      inputs: [
        { name: 'name', type: 'text', placeholder: 'Nombre del grupo (ej: Regalo clase)' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Siguiente',
          handler: async (data) => {
            if (data.name) {
              this.selectParticipantsForGroup(eventId, data.name);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async selectParticipantsForGroup(eventId: string, groupName: string) {
    // Filter out honorees from potential participants
    let potential = this.displayParticipants;
    // We need to fetch event to know honorees if not readily available in displayParticipants (we have status/uid). 
    // Assuming 'displayParticipants' is populated.
    // But we better use contacts + currentUser.

    const inputs = this.displayParticipants
      .filter(p => p.uid) // Must have UID
      .map(p => ({
        type: 'checkbox' as const,
        label: p.name,
        value: p.uid,
        checked: p.uid === this.currentUserUid // Auto-select self
      }));

    const alert = await this.alertCtrl.create({
      header: 'Participantes del Grupo',
      inputs: inputs,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Crear Grupo',
          handler: async (selectedUids: string[]) => {
            if (selectedUids && selectedUids.length > 0) {
              await this.eventsService.createGiftGroup(eventId, groupName, selectedUids);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async openGroup(group: GiftGroup) {
    const modal = await this.modalCtrl.create({
      component: GroupGiftDetailComponent,
      componentProps: {
        group: group,
        allContacts: this.contacts // Pass contacts context
      }
    });
    await modal.present();
  }

  async addGift() {
    const eventId = this.route.snapshot.paramMap.get('id');
    if (!eventId) return;

    const alert = await this.alertCtrl.create({
      header: 'Añadir Idea de Regalo',
      inputs: [
        { name: 'title', type: 'text', placeholder: 'Nombre del regalo (ej: Bicicleta)' },
        { name: 'url', type: 'url', placeholder: 'Enlace (opcional)' },
        { name: 'price', type: 'number', placeholder: 'Precio estimado (€)' }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
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

  // Participants logic remains...
  displayParticipants: { name: string; photoURL?: string; status: 'pending' | 'accepted' | 'rejected'; isContact: boolean; uid?: string }[] = [];

  async loadParticipants(event: TribuEvent) {
    const participants: any[] = [];
    const honoreeIds = event.honoreeIds || [];

    // 1. Registered Participants
    if (event.participantIds) {
      for (const uid of event.participantIds) {
        // Exclude Honorees from "participants that can be added to groups" usually, but here we just list them.
        // We will filter them out in selectParticipantsForGroup if needed, but wait, usually displayParticipants shows everyone.

        const contact = this.contacts.find(c => c.uid === uid);
        const status = event.participationStatus?.[uid] || 'pending';
        const isHonoree = honoreeIds.includes(uid);

        if (contact) {
          participants.push({
            name: contact.name + (isHonoree ? ' (Homenajeado)' : ''),
            photoURL: contact.photoURL,
            status: status,
            isContact: true,
            uid: uid
          });
        } else {
          const profile = await this.authService.getUserProfile(uid);
          participants.push({
            name: (profile?.displayName || 'Usuario Desconocido') + (isHonoree ? ' (Homenajeado)' : ''),
            photoURL: profile?.photoURL,
            status: status,
            isContact: false,
            uid: uid
          });
        }
      }
    }

    if (event.guests) {
      for (const guest of event.guests) {
        participants.push({
          name: guest.name,
          photoURL: undefined,
          status: 'pending',
          isContact: false,
          uid: undefined
        });
      }
    }

    this.displayParticipants = participants;
  }

  getStatusIcon(status: string) {
    switch (status) {
      case 'accepted': return 'checkmark-circle';
      case 'rejected': return 'close-circle';
      default: return 'time';
    }
  }

  getStatusColor(status: string) {
    switch (status) {
      case 'accepted': return 'success';
      case 'rejected': return 'danger';
      default: return 'medium';
    }
  }

  async inviteGuestsUi(event: TribuEvent) {
    if (!event.id) return;

    const eligibleContacts = this.contacts.filter(c =>
      c.uid && !event.participantIds.includes(c.uid)
    );

    if (eligibleContacts.length === 0) {
      const alert = await this.alertCtrl.create({
        header: 'Invitar Amigos',
        message: 'Todos tus contactos ya están en este evento o no tienes contactos nuevos.',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Invitar Amigos',
      inputs: eligibleContacts.map(contact => ({
        type: 'checkbox',
        label: contact.name,
        value: contact.uid
      })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Invitar',
          handler: async (selectedUids: string[]) => {
            if (selectedUids && selectedUids.length > 0) {
              await this.eventsService.addParticipants(event.id!, selectedUids);
            }
          }
        }
      ]
    });

    await alert.present();
  }
}

