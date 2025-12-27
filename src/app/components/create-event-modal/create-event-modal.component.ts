import { Component, inject, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonItem, IonLabel, IonInput, IonTextarea, IonDatetime, IonDatetimeButton, IonModal, IonPopover, IonList, IonListHeader, IonAvatar, IonCheckbox, ModalController, IonIcon, IonNote } from '@ionic/angular/standalone';
import { ContactsService, AppContact } from '../../services/contacts.service';
import { TribuEvent } from '../../services/events.service';
import { addIcons } from 'ionicons';
import { person, heart } from 'ionicons/icons';

@Component({
  selector: 'app-create-event-modal',
  templateUrl: './create-event-modal.component.html',
  styleUrls: ['./create-event-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonItem, IonLabel, IonInput, IonTextarea, IonDatetime, IonDatetimeButton, IonModal, IonPopover, IonList, IonListHeader, IonAvatar, IonCheckbox, IonIcon, IonNote]
})
export class CreateEventModalComponent implements OnInit {
  private modalCtrl = inject(ModalController);
  private contactsService = inject(ContactsService);

  @Input() event?: TribuEvent; // For editing

  title = '';
  description = '';
  date = new Date().toISOString();
  locationName = '';
  // googleMapsLink removed as it is auto-generated

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

    // Initialize if editing
    if (this.event) {
      this.title = this.event.title;
      this.description = this.event.description || '';
      this.date = this.event.date && this.event.date.seconds ? new Date(this.event.date.seconds * 1000).toISOString() : new Date().toISOString();
      this.locationName = this.event.locationName || '';
      // We don't need to load googleMapsLink as we generate it, or we could preserve it if passed.
      // But requirement says "auto generate", so we regenerate on save.

      this.selectedContactUids = this.event.participantIds || [];
      this.selectedHonoreeUids = this.event.honoreeIds || [];
      // Guests mapping is tricky to pre-fill back to checkboxes if we don't store their source, 
      // but for now we won't pre-select guests on edit to avoid duplication or complexity.
      // Or we could tries to match by name/phone.
    }

    try {
      const allContacts = await this.contactsService.getAllContacts();

      this.registeredContacts = allContacts.filter(c => c.isRegistered && c.uid);
      this.guestContacts = allContacts.filter(c => !c.isRegistered || !c.uid);

    } catch (e) {
      console.error('Error loading contacts for event modal', e);
    } finally {
      this.isLoadingContacts = false;
    }
  }

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    const guests = this.guestContacts.filter(c => this.selectedGuestPhones.includes(c.phone));

    // Auto-generate Google Maps Link
    let generatedLink = '';
    if (this.locationName) {
      generatedLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(this.locationName)}`;
    }

    this.modalCtrl.dismiss({
      title: this.title,
      description: this.description,
      date: this.date, // ISO string
      locationName: this.locationName,
      googleMapsLink: generatedLink,
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
