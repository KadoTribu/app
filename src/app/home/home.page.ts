import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCardContent, IonFab, IonFabButton, IonIcon, IonButtons, IonMenuButton, IonRefresher, IonRefresherContent, ModalController, IonItem, IonLabel, IonButton } from '@ionic/angular/standalone';
import { EventsService, TribuEvent } from '../services/events.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { add, calendar, mailOpen, time, card } from 'ionicons/icons';
import { SkeletonLoaderComponent } from '../components/skeleton-loader/skeleton-loader.component';
import { CreateEventModalComponent } from '../components/create-event-modal/create-event-modal.component';
import { UserBadgeComponent } from '../components/user-badge/user-badge.component';
import { Observable } from 'rxjs';

import { PendingInvitationsModalComponent } from '../components/pending-invitations-modal/pending-invitations-modal.component';
import { EventHistoryModalComponent } from '../components/event-history-modal/event-history-modal.component';
import { map, shareReplay, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCardContent, IonFab, IonFabButton, IonIcon, IonButtons, IonMenuButton, CommonModule, SkeletonLoaderComponent, UserBadgeComponent, IonItem, IonLabel, IonButton],

})
export class HomePage implements OnInit {

  private eventsService = inject(EventsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);

  // Raw events
  private allEvents$ = this.eventsService.getMyEvents().pipe(shareReplay(1));
  private uid = this.authService.currentUser?.uid;

  // Filtered Streams
  confirmedEvents$ = this.allEvents$.pipe(
    map(events => {
      const now = new Date();
      // Reset time to start of day to show today's events? Or precise time.
      // Let's keep it simple: event date >= current date (roughly)

      return events.filter(event => {
        // 1. Check Date (Future)
        const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
        const isFuture = eventDate >= new Date(now.setHours(0, 0, 0, 0));

        // 2. Check Confirmation
        // If I am organizer, I am confirmed.
        // If I am participant, status must be 'accepted'.
        const myStatus = event.participationStatus?.[this.uid!] || 'pending';
        const isConfirmed = event.organizerId === this.uid || myStatus === 'accepted';

        return isFuture && isConfirmed;
      }).sort((a, b) => {
        // Sort by date ascending (nearest first)
        return (a.date?.toDate().getTime() || 0) - (b.date?.toDate().getTime() || 0);
      });
    })
  );

  pastEvents$ = this.allEvents$.pipe(
    map(events => {
      const now = new Date();
      return events.filter(event => {
        const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
        const isPast = eventDate < new Date(now.setHours(0, 0, 0, 0));

        const myStatus = event.participationStatus?.[this.uid!] || 'pending';
        // Show past events if I accepted them or was organizer
        const isConfirmed = event.organizerId === this.uid || myStatus === 'accepted';

        return isPast && isConfirmed;
      }).sort((a, b) => (b.date?.toDate().getTime() || 0) - (a.date?.toDate().getTime() || 0)); // Descending
    })
  );

  pendingEvents$ = this.allEvents$.pipe(
    map(events => events.filter(event => {
      // Show pending invitations (future only? usually yes)
      // const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
      // const isFuture = eventDate >= new Date(new Date().setHours(0, 0, 0, 0)); // Optional: Show old pending? Maybe not.

      const myStatus = event.participationStatus?.[this.uid!] || 'pending';
      // Organizer doesn't have pending status on their own event usually
      return event.organizerId !== this.uid && myStatus === 'pending'; // && isFuture
    }))
  );

  pendingCount = 0;
  pendingList: TribuEvent[] = [];
  pastList: TribuEvent[] = [];

  constructor() {
    addIcons({ add, calendar, mailOpen, time, card });
  }

  ngOnInit() {
    this.pendingEvents$.subscribe(list => {
      this.pendingCount = list.length;
      this.pendingList = list;
    });
    this.pastEvents$.subscribe(list => {
      this.pastList = list;
    });
  }

  openEvent(id: string) {
    this.router.navigate(['/event', id]);
  }

  async openPendingInvitations() {
    const modal = await this.modalCtrl.create({
      component: PendingInvitationsModalComponent,
      componentProps: {
        pendingEvents: this.pendingList
      }
    });
    await modal.present();
  }

  async openHistory() {
    const modal = await this.modalCtrl.create({
      component: EventHistoryModalComponent,
      componentProps: {
        historyEvents: this.pastList
      }
    });
    await modal.present();
  }

  async createEvent() {
    const modal = await this.modalCtrl.create({
      component: CreateEventModalComponent
    });
    modal.present();

    const { data, role } = await modal.onWillDismiss();

    if (role === 'confirm') {
      try {
        await this.eventsService.createEvent({
          title: data.title,
          description: data.description,
          date: new Date(data.date), // Convert string to Date object
          participantIds: data.participantIds,
          guests: data.guests,
          honoreeIds: data.honoreeIds
        });
      } catch (e) {
        console.error('Error creating event', e);
      }
    }
  }

}
