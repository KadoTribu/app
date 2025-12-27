import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonLabel, IonNote, IonIcon, ModalController } from '@ionic/angular/standalone';
import { Debt, EventsService } from '../../services/events.service';
import { addIcons } from 'ionicons';
import { arrowForward, arrowBack, checkmarkDone } from 'ionicons/icons';

@Component({
    selector: 'app-debt-breakdown',
    template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Detalle de Deuda</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="close()">Cerrar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="ion-text-center ion-padding">
        <h3>Balance Total</h3>
        <h1 [class]="totalAmount >= 0 ? 'ion-text-color-success' : 'ion-text-color-danger'">
          {{ totalAmount | currency:'EUR' }}
        </h1>
        <p *ngIf="totalAmount > 0">Te deben en total</p>
        <p *ngIf="totalAmount < 0">Debes en total</p>
        <p *ngIf="totalAmount === 0">Está todo saldado</p>

        <ion-button *ngIf="totalAmount !== 0" (click)="settleAll()" color="primary" expand="block" class="ion-margin-top">
          <ion-icon slot="start" name="checkmark-done"></ion-icon>
          Saldar Todo
        </ion-button>
      </div>

      <ion-list>
        <ion-item *ngFor="let debt of debts">
          <ion-icon [name]="debt.toUid === currentUserId ? 'arrow-back' : 'arrow-forward'" 
                    [color]="debt.toUid === currentUserId ? 'success' : 'danger'" slot="start"></ion-icon>
          <ion-label>
            <h2>{{ debt.giftTitle }}</h2>
            <p *ngIf="debt.toUid === currentUserId">Te deben ({{ debt.amount | currency:'EUR' }})</p>
            <p *ngIf="debt.fromUid === currentUserId">Debes ({{ debt.amount | currency:'EUR' }})</p>
          </ion-label>
          <ion-note slot="end" [color]="debt.toUid === currentUserId ? 'success' : 'danger'">
             {{ debt.toUid === currentUserId ? '+' : '-' }}{{ debt.amount | currency:'EUR' }}
          </ion-note>
        </ion-item>
      </ion-list>
    </ion-content>
  `,
    standalone: true,
    imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonLabel, IonNote, IonIcon]
})
export class DebtBreakdownComponent implements OnInit {
    @Input() debts: Debt[] = [];
    @Input() currentUserId: string = '';
    @Input() totalAmount: number = 0;

    private modalCtrl = inject(ModalController);
    private eventsService = inject(EventsService);

    constructor() {
        addIcons({ arrowForward, arrowBack, checkmarkDone });
    }

    ngOnInit() { }

    close() {
        this.modalCtrl.dismiss(null, 'cancel');
    }

    async settleAll() {
        const ids = this.debts.map(d => d.id!);
        await this.eventsService.settleDebts(ids);
        this.modalCtrl.dismiss(true, 'confirm');
    }
}
