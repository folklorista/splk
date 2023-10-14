import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-event',
  templateUrl: './event.component.html',
  styleUrls: ['./event.component.css'],
})
export class EventComponent {
  eventId: number;

  constructor(private route: ActivatedRoute) {
    this.eventId = parseInt(this.route.snapshot.paramMap.get('eventId') || '');
  }
}
