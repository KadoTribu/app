import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonLabel, IonList, IonItem, IonIcon, IonNote, IonButton } from '@ionic/angular/standalone';
import { EventsService, Debt } from '../../services/events.service';
import { AuthService } from '../../services/auth.service';
import { ContactsService, AppContact } from '../../services/contacts.service';
import { ActivatedRoute } from '@angular/router';
import { Observable, map, of } from 'rxjs';
import { addIcons } from 'ionicons';
import { checkmarkCircle, cash } from 'ionicons/icons';

@Component({
  selector: 'app-debts',
  templateUrl: './debts.page.html',
  styleUrls: ['./debts.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonLabel, IonList, IonItem, IonIcon, IonNote, IonButton, CommonModule, FormsModule]
})
export class DebtsPage implements OnInit {

  private eventsService = inject(EventsService);
  private authService = inject(AuthService);
  private contactsService = inject(ContactsService);
  private route = inject(ActivatedRoute);

  currentUserUid = this.authService.currentUser?.uid;
  debtsToPay$: Observable<Debt[]> = of([]);
  debtsToReceive$: Observable<Debt[]> = of([]);
  contacts: AppContact[] = [];
  viewMode = 'pay';

  constructor() {
    addIcons({ checkmarkCircle, cash });
  }

  async ngOnInit() {
    const eventId = this.route.snapshot.paramMap.get('id');
    if (!eventId) return;

    this.contacts = await this.contactsService.getAllContacts();

    const allDebts$ = this.eventsService.getEventDebts(eventId);

    this.debtsToPay$ = allDebts$.pipe(
      map(debts => debts.filter(d => d.fromUid === this.currentUserUid && !d.isPaid))
    );

    this.debtsToReceive$ = allDebts$.pipe(
      map(debts => debts.filter(d => d.toUid === this.currentUserUid && !d.isPaid))
    );
  }

  getContactName(uid: string): string {
    return this.contacts.find(c => c.uid === uid)?.name || 'Desconocido';
  }

  async markAsPaid(debt: Debt) {
    if (debt.id) {
      await this.eventsService.markDebtAsPaid(debt.id, true);
    }
  }
}
