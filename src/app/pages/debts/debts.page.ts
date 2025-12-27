import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonLabel, IonList, IonItem, IonIcon, IonNote, IonButton, IonAvatar, IonMenuButton } from '@ionic/angular/standalone';
import { EventsService, Debt } from '../../services/events.service';
import { AuthService } from '../../services/auth.service';
import { ContactsService, AppContact } from '../../services/contacts.service';
import { ActivatedRoute } from '@angular/router';
import { Observable, map, of } from 'rxjs';
import { addIcons } from 'ionicons';
import { checkmarkCircle, cash } from 'ionicons/icons';

import { DebtBreakdownComponent } from '../../components/debt-breakdown/debt-breakdown.component';
import { ModalController } from '@ionic/angular/standalone';

interface DebtBalance {
  contactUid: string;
  netAmount: number;
  debts: Debt[];
}

@Component({
  selector: 'app-debts',
  templateUrl: './debts.page.html',
  styleUrls: ['./debts.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonLabel, IonList, IonItem, IonIcon, IonNote, IonButton, CommonModule, FormsModule, IonAvatar, IonMenuButton]
})
export class DebtsPage implements OnInit {

  private eventsService = inject(EventsService);
  private authService = inject(AuthService);
  private contactsService = inject(ContactsService);
  private route = inject(ActivatedRoute);
  private modalCtrl = inject(ModalController);

  currentUserUid = this.authService.currentUser?.uid;

  // Event Specific
  isEventMode = false;
  debtsToPay$: Observable<Debt[]> = of([]);
  debtsToReceive$: Observable<Debt[]> = of([]);

  // Global
  globalBalances: DebtBalance[] = [];

  contacts: AppContact[] = [];
  viewMode = 'pay'; // Used only in Event Mode really, or we can repurpose

  constructor() {
    addIcons({ checkmarkCircle, cash });
  }

  async ngOnInit() {
    this.contacts = await this.contactsService.getAllContacts();
    const eventId = this.route.snapshot.paramMap.get('id');

    if (eventId) {
      this.isEventMode = true;
      const allDebts$ = this.eventsService.getEventDebts(eventId);

      this.debtsToPay$ = allDebts$.pipe(
        map(debts => debts.filter(d => d.fromUid === this.currentUserUid && !d.isPaid))
      );

      this.debtsToReceive$ = allDebts$.pipe(
        map(debts => debts.filter(d => d.toUid === this.currentUserUid && !d.isPaid))
      );
    } else {
      this.isEventMode = false;
      this.loadGlobalDebts();
    }
  }

  async loadGlobalDebts() {
    const allDebts = await this.eventsService.getAllMyDebts();
    this.calculateBalances(allDebts);
  }

  calculateBalances(debts: Debt[]) {
    const balancesMap = new Map<string, DebtBalance>();

    debts.forEach(debt => {
      const isMyDebt = debt.fromUid === this.currentUserUid;
      const counterpartyUid = isMyDebt ? debt.toUid : debt.fromUid;
      const amount = isMyDebt ? -debt.amount : debt.amount;

      if (!balancesMap.has(counterpartyUid)) {
        balancesMap.set(counterpartyUid, {
          contactUid: counterpartyUid,
          netAmount: 0,
          debts: []
        });
      }

      const entry = balancesMap.get(counterpartyUid)!;
      entry.netAmount += amount;
      entry.debts.push(debt);
    });

    this.globalBalances = Array.from(balancesMap.values());
  }

  getContactName(uid: string): string {
    return this.contacts.find(c => c.uid === uid)?.name || 'Desconocido';
  }

  getContactAvatar(uid: string): string | undefined {
    return this.contacts.find(c => c.uid === uid)?.photoURL;
  }

  async openBreakdown(balance: DebtBalance) {
    const modal = await this.modalCtrl.create({
      component: DebtBreakdownComponent,
      componentProps: {
        debts: balance.debts,
        currentUserId: this.currentUserUid,
        totalAmount: balance.netAmount
      }
    });
    await modal.present();

    const { role } = await modal.onWillDismiss();
    if (role === 'confirm') {
      this.loadGlobalDebts(); // Refresh
    }
  }

  async markAsPaid(debt: Debt) {
    if (debt.id) {
      await this.eventsService.markDebtAsPaid(debt.id, true);
    }
  }
}
