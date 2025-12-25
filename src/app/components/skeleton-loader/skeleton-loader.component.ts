import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonSkeletonText, IonItem, IonList, IonLabel, IonThumbnail } from '@ionic/angular/standalone';

@Component({
  selector: 'app-skeleton-loader',
  templateUrl: './skeleton-loader.component.html',
  styleUrls: ['./skeleton-loader.component.scss'],
  standalone: true,
  imports: [IonSkeletonText, IonItem, IonList, IonLabel, IonThumbnail, CommonModule],
})
export class SkeletonLoaderComponent {
  @Input() count = 3;
  @Input() type: 'list' | 'card' = 'list';

  items: any[] = [];

  ngOnChanges() {
    this.items = Array(this.count).fill(0);
  }
}

