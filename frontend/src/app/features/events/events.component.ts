import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AppEvent } from './models/event.model';
import { EventsService } from './events.service';

const EVENT_TYPE_LABELS: Record<string, string> = {
  rehearsal: 'Zkouška',
  performance: 'Vystoupení',
  camp: 'Soustředění',
  meeting: 'Schůzka',
  other: 'Jiné',
};

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './events.component.html',
})
export class EventsComponent implements OnInit {
  events = signal<AppEvent[]>([]);
  loading = signal(true);

  constructor(private eventsService: EventsService) {}

  ngOnInit(): void {
    this.eventsService.getEvents().subscribe((events) => {
      this.events.set(events);
      this.loading.set(false);
    });
  }

  typeLabel(type: string): string {
    return EVENT_TYPE_LABELS[type] ?? type;
  }
}
