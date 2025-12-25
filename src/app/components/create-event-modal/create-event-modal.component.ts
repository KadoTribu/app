import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonItem, IonLabel, IonInput, IonTextarea, IonDatetime, IonDatetimeButton, IonModal, IonList, IonListHeader, IonAvatar, IonCheckbox, ModalController, IonIcon, IonNote } from '@ionic/angular/standalone';
import { ContactsService, AppContact } from '../../services/contacts.service';
import { addIcons } from 'ionicons';
import { person, heart } from 'ionicons/icons';

@Component({
  selector: 'app-create-event-modal',
  templateUrl: './create-event-modal.component.html',
  styleUrls: ['./create-event-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonItem, IonLabel, IonInput, IonTextarea, IonDatetime, IonDatetimeButton, IonModal, IonList, IonListHeader, IonAvatar, IonCheckbox, IonIcon, IonNote]
})
export class CreateEventModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private contactsService = inject(ContactsService);

  title = '';
  description = '';
  date = new Date().toISOString();

  registeredContacts: AppContact[] = [];
  guestContacts: AppContact[] = [];

  selectedContactUids: string[] = [];
  selectedGuestPhones: string[] = [];
  selectedHonoreeUids: string[] = [];

  isLoadingContacts = true;

  constructor() {
    addIcons({ person, heart });
  }

  async ngOnInit() {
    this.isLoadingContacts = true;
    try {
      const allContacts = await this.contactsService.getAllContacts();

      this.registeredContacts = allContacts.filter(c => c.isRegistered && c.uid);
      this.guestContacts = allContacts.filter(c => !c.isRegistered || !c.uid);

    } catch (e) {
      console.error('Error loading contacts for event modal', e);
    } finally {
      this.isLoadingContacts = false;
      console.log('Contacts loading finished', { registered: this.registeredContacts.length, guests: this.guestContacts.length });
    }
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    const guests = this.guestContacts.filter(c => this.selectedGuestPhones.includes(c.phone));

    this.modalCtrl.dismiss({
      title: this.title,
      description: this.description,
      date: this.date,
      participantIds: this.selectedContactUids,
      honoreeIds: this.selectedHonoreeUids,
      guests: guests.map(c => ({ name: c.name, phone: c.phone }))
    }, 'confirm');
  }

  toggleContact(uid: string) {
    if (this.selectedContactUids.includes(uid)) {
      this.selectedContactUids = this.selectedContactUids.filter(id => id !== uid);
      // Also remove from honorees if removed from participants?
      // User Logic: Can I be honoree but not participant? Ideally no.
      // But implementation simplicity: I'll leave it or auto-remove.
      // Let's auto-remove for consistency.
      this.selectedHonoreeUids = this.selectedHonoreeUids.filter(id => id !== uid);
    } else {
      this.selectedContactUids.push(uid);
    }
  }

  toggleHonoree(uid: string) {
    if (this.selectedHonoreeUids.includes(uid)) {
      this.selectedHonoreeUids = this.selectedHonoreeUids.filter(id => id !== uid);
    } else {
      this.selectedHonoreeUids.push(uid);
      // Auto-add to participants if selected as honoree?
      if (!this.selectedContactUids.includes(uid)) {
        this.selectedContactUids.push(uid);
      }
    }
  }

  toggleGuest(phone: string) {
    if (this.selectedGuestPhones.includes(phone)) {
      this.selectedGuestPhones = this.selectedGuestPhones.filter(p => p !== phone);
    } else {
      this.selectedGuestPhones.push(phone);
    }
  }
}
