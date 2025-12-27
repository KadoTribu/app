import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonLabel, IonIcon, ModalController } from '@ionic/angular/standalone';
import { TribuEvent, EventsService } from '../../services/events.service';
import { addIcons } from 'ionicons';
import { checkmarkCircle, closeCircle, calendar } from 'ionicons/icons';

@Component({
    selector: 'app-pending-invitations-modal',
    template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Invitaciones Pendientes</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()">Cerrar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item *ngFor="let event of pendingEvents">
          <ion-icon name="calendar" slot="start" size="large"></ion-icon>
          <ion-label>
            <h2>{{ event.title }}</h2>
            <p>{{ event.date?.toDate() | date:'fullDate' }}</p>
            <p>{{ event.description }}</p>
          </ion-label>
          <ion-buttons slot="end">
            <ion-button color="danger" (click)="reject(event)">
              <ion-icon name="close-circle" slot="icon-only"></ion-icon>
            </ion-button>
            <ion-button color="success" (click)="accept(event)">
              <ion-icon name="checkmark-circle" slot="icon-only"></ion-icon>
            </ion-button>
          </ion-buttons>
        </ion-item>
        <ion-item *ngIf="pendingEvents.length === 0">
           <ion-label class="ion-text-center">No tienes invitaciones pendientes</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
    standalone: true,
    imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonLabel, IonIcon]
})
export class PendingInvitationsModalComponent {
    @Input() pendingEvents: TribuEvent[] = [];
    private modalCtrl = inject(ModalController);
    private eventsService = inject(EventsService);

    constructor() {
        addIcons({ checkmarkCircle, closeCircle, calendar });
    }

    close() {
        this.modalCtrl.dismiss();
    }

    async accept(event: TribuEvent) {
        if (event.id) {
            await this.eventsService.acceptInvitation(event.id, event.organizerId, event.honoreeIds || []);
            // Remove from local list to update UI immediately
            this.pendingEvents = this.pendingEvents.filter(e => e.id !== event.id);
            if (this.pendingEvents.length === 0) this.close();
        }
    }

    async reject(event: TribuEvent) {
        if (event.id) {
            await this.eventsService.rejectInvitation(event.id);
            this.pendingEvents = this.pendingEvents.filter(e => e.id !== event.id);
            if (this.pendingEvents.length === 0) this.close();
        }
    }
}
