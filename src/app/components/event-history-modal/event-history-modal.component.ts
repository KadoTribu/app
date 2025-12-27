import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonLabel, IonIcon, ModalController } from '@ionic/angular/standalone';
import { TribuEvent } from '../../services/events.service';
import { addIcons } from 'ionicons';
import { calendar, time } from 'ionicons/icons';
import { Router } from '@angular/router';

@Component({
    selector: 'app-event-history-modal',
    template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Historial de Eventos</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()">Cerrar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-list>
        <ion-item *ngFor="let event of historyEvents" button (click)="openEvent(event)">
          <ion-icon name="time" slot="start" size="large" color="medium"></ion-icon>
          <ion-label>
            <h2>{{ event.title }}</h2>
            <p>{{ event.date?.toDate() | date:'fullDate' }}</p>
            <p *ngIf="event.description" class="ion-text-wrap">{{ event.description }}</p>
          </ion-label>
        </ion-item>
        <ion-item *ngIf="historyEvents.length === 0">
           <ion-label class="ion-text-center">No hay eventos pasados.</ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
    standalone: true,
    imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonLabel, IonIcon]
})
export class EventHistoryModalComponent {
    @Input() historyEvents: TribuEvent[] = [];
    private modalCtrl = inject(ModalController);
    private router = inject(Router);

    constructor() {
        addIcons({ calendar, time });
    }

    close() {
        this.modalCtrl.dismiss();
    }

    openEvent(event: TribuEvent) {
        this.close();
        this.router.navigate(['/event', event.id]);
    }
}
