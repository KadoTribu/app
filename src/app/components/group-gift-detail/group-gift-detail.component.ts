import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonLabel, IonNote, IonIcon, ModalController, AlertController, IonListHeader, IonAvatar, IonFab, IonFabButton, IonSelect, IonSelectOption, IonChip, ActionSheetController } from '@ionic/angular/standalone';
import { EventsService, GiftGroup, Gift } from '../../services/events.service';
import { ContactsService, AppContact } from '../../services/contacts.service';
import { AuthService } from '../../services/auth.service';
import { addIcons } from 'ionicons';
import { add, trash, checkmarkCircle, lockClosed, closeCircle, create, list, close } from 'ionicons/icons';
import { Observable, of } from 'rxjs';

@Component({
    selector: 'app-group-gift-detail',
    template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button (click)="close()">Cerrar</ion-button>
        </ion-buttons>
        <ion-title>{{ group.name }}</ion-title>
        <ion-buttons slot="end">
             <ion-button *ngIf="!amIMember" (click)="joinGroup()" color="primary" fill="solid">
                Unirme
             </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
        
        <div *ngIf="group.isClosed" class="ion-text-center ion-margin-bottom">
            <ion-chip color="medium">
                <ion-icon name="lock-closed"></ion-icon>
                <ion-label>Grupo Cerrado y Saldado</ion-label>
            </ion-chip>
        </div>

        <!-- MEMBERS -->
        <ion-list>
            <ion-list-header>
                Participantes ({{ groupMembers.length }})
            </ion-list-header>
            <div class="horizontal-scroll">
                <div class="member-chip" *ngFor="let member of groupMembers">
                     <div style="position: relative;">
                        <ion-avatar class="small-avatar">
                            <img [src]="member.photoURL || 'https://ionicframework.com/docs/img/demos/avatar.svg'" />
                        </ion-avatar>
                        <ion-icon *ngIf="amIAdmin && group.memberIds.length > 1 && member.uid !== group.adminId" 
                                  name="close-circle" color="danger" class="remove-icon"
                                  (click)="removeMember(member)"></ion-icon>
                     </div>
                     <span>{{ member.name }}</span>
                </div>
            </div>
        </ion-list>

        <!-- INFO & LIMITS -->
        <div class="ion-padding-horizontal ion-margin-bottom" style="font-size: 0.9em;">
             <ion-chip [color]="isOverLimit ? 'danger' : 'success'" outline="true">
                 <ion-label>
                    Total: {{ totalSpent | currency:'EUR' }}
                 </ion-label>
             </ion-chip>
             <ion-chip [color]="isOverLimit ? 'danger' : 'success'" outline="true">
                 <ion-label>
                    {{ currentCostPerPerson | currency:'EUR' }} / persona
                 </ion-label>
             </ion-chip>
             <ion-chip *ngIf="group.maxPerPerson" color="warning" outline="true">
                <ion-label>Límite: {{ group.maxPerPerson | currency:'EUR' }}</ion-label>
             </ion-chip>
             <p *ngIf="isOverLimit" class="ion-text-center ion-text-color-danger" style="margin: 5px 0;">
                ⚠ Se ha superado el límite de gasto por persona.
             </p>
        </div>

        <!-- GIFTS -->
        <ion-list>
            <ion-list-header>
                <ion-label>Gastos / Regalos</ion-label>
                <ion-button *ngIf="!group.isClosed" size="small" (click)="addGift()">
                    <ion-icon name="add"></ion-icon> Añadir
                </ion-button>
            </ion-list-header>

            <div *ngIf="(gifts$ | async)?.length === 0" class="ion-text-center ion-padding">
                <p class="ion-text-muted">Añade los regalos o gastos de este grupo.</p>
            </div>

            <ion-item *ngFor="let gift of (gifts$ | async)">
                <ion-label>
                    <h2>{{ gift.title }}</h2>
                    <p>{{ gift.price | currency:'EUR' }}</p>
                </ion-label>
                
                <ion-select slot="end" placeholder="¿Quién paga?" [disabled]="group.isClosed" 
                            [value]="gift.payerId" (ionChange)="updatePayer(gift, $event)">
                    <ion-select-option *ngFor="let m of groupMembers" [value]="m.uid">
                        {{ m.name }}
                    </ion-select-option>
                </ion-select>
            </ion-item>
        </ion-list>
        
        <!-- SUMMARY PREVIEW -->
        <div class="ion-padding ion-margin-top" *ngIf="!group.isClosed && (gifts$ | async) as gifts">
             <ion-button expand="block" color="primary" (click)="settleGroup(gifts)" [disabled]="gifts.length === 0 || hasUnassignedPayers(gifts)">
                <ion-icon slot="start" name="checkmark-circle"></ion-icon>
                Cerrar Grupo y Repartir Gastos
             </ion-button>
             <p *ngIf="hasUnassignedPayers(gifts)" class="ion-text-center ion-text-color-danger input-error">
                Asigna quién paga cada regalo antes de cerrar.
             </p>
        </div>

    </ion-content>
  `,
    styles: [`
    .horizontal-scroll {
        display: flex;
        overflow-x: auto;
        padding: 5px;
        gap: 10px;
    }
    .member-chip {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 60px;
        font-size: 0.8rem;
        text-align: center;
        color: var(--ion-text-color);
    }
    .small-avatar {
        width: 40px;
        height: 40px;
        margin-bottom: 5px;
    }
    .remove-icon {
        position: absolute;
        top: -5px;
        right: -5px;
        background: white;
        border-radius: 50%;
        font-size: 18px;
    }
    .input-error {
        font-size: 0.8rem;
        margin-top: 5px;
    }
  `],
    standalone: true,
    imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonLabel, IonNote, IonIcon, IonListHeader, IonAvatar, IonFab, IonFabButton, IonSelect, IonSelectOption, IonChip]
})
export class GroupGiftDetailComponent implements OnInit {
    @Input() group!: GiftGroup;
    @Input() allContacts: AppContact[] = []; // Passed from parent to avoid re-fetching

    gifts$: Observable<Gift[]> = of([]);
    groupMembers: AppContact[] = [];

    private modalCtrl = inject(ModalController);
    private alertCtrl = inject(AlertController);
    private actionSheetCtrl = inject(ActionSheetController);
    private eventsService = inject(EventsService);
    private authService = inject(AuthService);

    amIAdmin = false;
    amIMember = false;
    totalSpent = 0;
    currentCostPerPerson = 0;
    isOverLimit = false;

    constructor() {
        addIcons({ add, trash, checkmarkCircle, lockClosed, closeCircle });
    }

    ngOnInit() {
        if (this.group) {
            this.prepareComponent();
        }
    }

    prepareComponent() {
        const myUid = this.authService.currentUser?.uid;
        this.amIAdmin = this.group.adminId === myUid;
        this.amIMember = !!myUid && this.group.memberIds.includes(myUid);

        this.gifts$ = this.eventsService.getGroupGifts(this.group.id!);
        // Resolve members
        this.groupMembers = this.allContacts.filter(c => c.uid && this.group.memberIds.includes(c.uid!));

        // Ensure "Yo" is there if I am in memberIds but not in contacts
        if (myUid && this.group.memberIds.includes(myUid) && !this.groupMembers.find(m => m.uid === myUid)) {
            // Add fake contact for me
            this.groupMembers.unshift({ uid: myUid, name: 'Yo', phone: '' });
        }

        // Resolve unknown members
        this.group.memberIds.forEach(async uid => {
            if (uid !== myUid && !this.groupMembers.find(m => m.uid === uid)) {
                // Try to fetch profile
                const profile = await this.authService.getUserProfile(uid);
                if (profile) {
                    this.groupMembers.push({
                        uid,
                        name: profile.displayName || 'Usuario',
                        phone: profile.phoneNumber || '',
                        photoURL: profile.photoURL || undefined
                    });
                } else {
                    this.groupMembers.push({ uid, name: 'Desconocido', phone: '' });
                }
            }
        });

        this.gifts$.subscribe(gifts => {
            this.calculateFinances(gifts);
        });
    }

    calculateFinances(gifts: Gift[]) {
        if (!gifts || this.group.memberIds.length === 0) {
            this.totalSpent = 0;
            this.currentCostPerPerson = 0;
            return;
        }

        const total = gifts.reduce((sum, g) => sum + (g.price || 0), 0);
        this.totalSpent = total;
        this.currentCostPerPerson = total / this.group.memberIds.length;

        if (this.group.maxPerPerson) {
            this.isOverLimit = this.currentCostPerPerson > this.group.maxPerPerson;
        }
    }

    close() {
        this.modalCtrl.dismiss();
    }

    async joinGroup() {
        if (!this.group.id) return;

        await this.eventsService.joinGiftGroup(this.group.id);

        // Refresh local state manually or trust observable if we were observing the group doc
        // Since input is static, we must refresh manually or close/reopen.
        // Better: let's just close and tell parent to refresh? Or assume we stay open.
        // We need to update memberIds.
        const myUid = this.authService.currentUser?.uid;
        if (myUid) {
            this.group.memberIds.push(myUid);
            this.prepareComponent(); // Re-run logic
        }
    }

    async removeMember(member: AppContact) {
        if (!member.uid || !this.group.id) return;

        const alert = await this.alertCtrl.create({
            header: 'Expulsar Participante',
            message: `¿Seguro que quieres eliminar a ${member.name} del grupo?`,
            buttons: [
                { text: 'Cancelar', role: 'cancel' },
                {
                    text: 'Eliminar',
                    role: 'destructive',
                    handler: async () => {
                        await this.eventsService.removeMemberFromGroup(this.group.id!, member.uid!);
                        // Local update
                        this.group.memberIds = this.group.memberIds.filter(id => id !== member.uid);
                        this.groupMembers = this.groupMembers.filter(m => m.uid !== member.uid);
                        this.prepareComponent();
                    }
                }
            ]
        });
        await alert.present();
    }

    async addGift() {
        const actionSheet = await this.actionSheetCtrl.create({
            header: 'Añadir Regalo al Grupo',
            buttons: [
                {
                    text: 'Nuevo (Manual)',
                    icon: 'create',
                    handler: () => {
                        this.addManualGift();
                    }
                },
                {
                    text: 'Seleccionar de la Lista',
                    icon: 'list',
                    handler: () => {
                        this.selectGiftFromList();
                    }
                },
                {
                    text: 'Cancelar',
                    icon: 'close',
                    role: 'cancel'
                }
            ]
        });
        await actionSheet.present();
    }

    async addManualGift() {
        const alert = await this.alertCtrl.create({
            header: 'Añadir Gasto/Regalo',
            inputs: [
                { name: 'title', type: 'text', placeholder: 'Concepto (ej: Cena)' },
                { name: 'price', type: 'number', placeholder: 'Precio (€)' }
            ],
            buttons: [
                { text: 'Cancelar', role: 'cancel' },
                {
                    text: 'Añadir',
                    handler: (data) => {
                        if (data.title && data.price) {
                            const price = parseFloat(data.price);
                            this.checkLimitWarning(price);
                            this.eventsService.addGiftToGroup(this.group.id!, this.group.eventId, {
                                title: data.title,
                                price: price
                            });
                        }
                    }
                }
            ]
        });
        await alert.present();
    }

    async selectGiftFromList() {
        const availableGifts = await this.eventsService.getAvailableEventGifts(this.group.eventId);

        if (availableGifts.length === 0) {
            const alert = await this.alertCtrl.create({
                header: 'Sin Regalos Disponibles',
                message: 'No hay regalos en la lista general que puedan añadirse.',
                buttons: ['OK']
            });
            await alert.present();
            return;
        }

        const inputs = availableGifts.map(g => ({
            type: 'radio' as const,
            label: `${g.title} (${g.price ? g.price + '€' : 'Sin precio'})`,
            value: g
        }));

        const alert = await this.alertCtrl.create({
            header: 'Selecciona un Regalo',
            inputs: inputs,
            buttons: [
                { text: 'Cancelar', role: 'cancel' },
                {
                    text: 'Añadir al Grupo',
                    handler: (selectedGift: Gift) => {
                        if (selectedGift) {
                            if (selectedGift.price) this.checkLimitWarning(selectedGift.price);
                            this.eventsService.assignGiftToGroup(this.group.id!, selectedGift.id!);
                        }
                    }
                }
            ]
        });
        await alert.present();
    }

    checkLimitWarning(newPrice: number) {
        if (this.group.maxPerPerson) {
            const predictedCost = this.currentCostPerPerson + (newPrice / this.group.memberIds.length);
            // We could show a toast here if we wanted to be invasive, but the UI update is usually enough.
        }
    }

    updatePayer(gift: Gift, event: any) {
        const payerId = event.detail.value;
        if (gift.id && payerId) {
            this.eventsService.setGiftPayer(gift.id, payerId);
        }
    }

    hasUnassignedPayers(gifts: Gift[]): boolean {
        return gifts.some(g => !g.payerId);
    }

    async settleGroup(gifts: Gift[]) {
        const alert = await this.alertCtrl.create({
            header: 'Cerrar Grupo',
            message: 'Se calcularán las deudas y se cerrará el grupo. Esta acción no se puede deshacer.',
            buttons: [
                { text: 'Cancelar', role: 'cancel' },
                {
                    text: 'Confirmar',
                    handler: async () => {
                        await this.eventsService.closeGroupAndGenerateDebts(this.group, gifts);
                        this.modalCtrl.dismiss(null, 'refresh');
                    }
                }
            ]
        });
        await alert.present();
    }
}
