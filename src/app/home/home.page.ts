import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCardContent, IonFab, IonFabButton, IonIcon, IonButtons, IonMenuButton, IonRefresher, IonRefresherContent, ModalController } from '@ionic/angular/standalone';
import { EventsService, TribuEvent } from '../services/events.service';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { add, calendar } from 'ionicons/icons';
import { SkeletonLoaderComponent } from '../components/skeleton-loader/skeleton-loader.component';
import { CreateEventModalComponent } from '../components/create-event-modal/create-event-modal.component';
import { UserBadgeComponent } from '../components/user-badge/user-badge.component';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonCard, IonCardHeader, IonCardSubtitle, IonCardTitle, IonCardContent, IonFab, IonFabButton, IonIcon, IonButtons, IonMenuButton, CommonModule, SkeletonLoaderComponent, UserBadgeComponent],

})
export class HomePage implements OnInit {

  private eventsService = inject(EventsService);
  private router = inject(Router);
  private modalCtrl = inject(ModalController);


  events$: Observable<TribuEvent[]> = this.eventsService.getMyEvents();

  constructor() {
    addIcons({ add, calendar });
  }

  ngOnInit() { }

  openEvent(id: string) {
    this.router.navigate(['/event', id]);
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
