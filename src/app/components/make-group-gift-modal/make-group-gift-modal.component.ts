import { Component, inject, OnInit, Input } from '@angular/core';
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
    @Input() activeParticipantsUids: string[] = []; // UIDs of people in the event
    @Input() honoreeIds: string[] = [];
    @Input() currentUserId: string = '';

    participants: AppContact[] = [];
    selectedUids: string[] = [];
    payerId: string = '';

    constructor() { }

    async ngOnInit() {
        // Load contacts to get names for the UIDs
        const all = await this.contactsService.getAllContacts();

        // 1. Filter candidates: Must be active participants AND NOT honorees
        const candidates = this.activeParticipantsUids.filter(uid => !this.honoreeIds.includes(uid));

        // 2. Build participants list from contacts
        this.participants = all.filter(c => c.uid && candidates.includes(c.uid));

        // 3. Add "Me" (Current User) if appropriate
        // If I am in the candidate list but not found in contacts (because I don't have myself as a contact), add manually.
        // Also ensuring I'm not an honoree.
        if (this.currentUserId && !this.honoreeIds.includes(this.currentUserId)) {
            const amIAlreadyListed = this.participants.some(p => p.uid === this.currentUserId);
            if (!amIAlreadyListed) {
                // Check if I was supposed to be a candidate (i.e., I am in activeParticipantsUids)
                // Usually the organizer is in activeParticipantsUids.
                if (this.activeParticipantsUids.includes(this.currentUserId)) {
                    this.participants.unshift({
                        name: 'Yo',
                        phone: '',
                        uid: this.currentUserId
                    } as AppContact);
                }
            } else {
                // If I am listed (maybe I added myself to contacts?), rename to "Yo" for clarity? Optional.
                // let's leave it as is or move to top.
                const myIndex = this.participants.findIndex(p => p.uid === this.currentUserId);
                if (myIndex > -1) {
                    const myContact = this.participants.splice(myIndex, 1)[0];
                    myContact.name = `${myContact.name} (Yo)`;
                    this.participants.unshift(myContact);
                }
            }
        }

        // Auto-select all by default
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
