import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonItem, IonLabel, IonCheckbox, ModalController, IonList, IonListHeader, IonAvatar, IonRadioGroup, IonRadio } from '@ionic/angular/standalone';
import { ContactsService, AppContact } from '../../services/contacts.service';

@Component({
    selector: 'app-make-group-gift-modal',
    template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="cancel()">Cancelar</ion-button>
        </ion-buttons>
        <ion-title>Regalar en Grupo</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="confirm()" [disabled]="!payerId || selectedUids.length < 2" strong="true">Confirmar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
        <p class="ion-text-center ion-text-muted">
            Selecciona quién participa y quién hace la compra (paga).
        </p>

        <ion-list>
            <ion-list-header>Participantes ({{selectedUids.length}})</ion-list-header>
            <ion-item *ngFor="let contact of participants">
                <ion-checkbox slot="start" [checked]="selectedUids.includes(contact.uid!)" (ionChange)="toggleParticipant(contact.uid!)"></ion-checkbox>
                <ion-label>
                    <h2>{{ contact.name }}</h2>
                    <p>{{ contact.phone }}</p>
                </ion-label>
            </ion-item>
        </ion-list>

        <ion-list *ngIf="selectedUids.length > 0">
            <ion-list-header>¿Quién paga la compra?</ion-list-header>
            <ion-radio-group [(ngModel)]="payerId">
                <ion-item *ngFor="let uid of selectedUids">
                    <ion-label>{{ getContactName(uid) }}</ion-label>
                    <ion-radio slot="end" [value]="uid"></ion-radio>
                </ion-item>
            </ion-radio-group>
        </ion-list>

    </ion-content>
  `,
    standalone: true,
    imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonItem, IonLabel, IonCheckbox, IonList, IonListHeader, IonAvatar, IonRadioGroup, IonRadio]
})
export class MakeGroupGiftModalComponent implements OnInit {
    private modalCtrl = inject(ModalController);
    private contactsService = inject(ContactsService);

    // Input
    activeParticipantsUids: string[] = []; // UIDs of people in the event

    participants: AppContact[] = [];
    selectedUids: string[] = [];
    payerId: string = '';

    constructor() { }

    async ngOnInit() {
        // Load contacts to get names for the UIDs
        const all = await this.contactsService.getAllContacts();
        // Filter to only those in the event
        this.participants = all.filter(c => c.uid && this.activeParticipantsUids.includes(c.uid));

        // Auto-select all by default? Or just user?
        // Let's select all initially for convenience
        this.selectedUids = this.participants.map(p => p.uid!);
    }

    toggleParticipant(uid: string) {
        if (this.selectedUids.includes(uid)) {
            this.selectedUids = this.selectedUids.filter(id => id !== uid);
            if (this.payerId === uid) this.payerId = '';
        } else {
            this.selectedUids.push(uid);
        }
    }

    getContactName(uid: string): string {
        return this.participants.find(p => p.uid === uid)?.name || 'Usuario';
    }

    cancel() {
        this.modalCtrl.dismiss(null, 'cancel');
    }

    confirm() {
        this.modalCtrl.dismiss({
            participantIds: this.selectedUids,
            payerId: this.payerId
        }, 'confirm');
    }
}
