import { Component } from '@angular/core';
import { Event } from 'src/app/models/event';

@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css'],
})
export class EventsComponent {
  events: Event[]; // Předpokládáme, že máte pole událostí
  isAdmin: boolean = true; // Předpokládáme, že máte informaci o administrátorských právech

  constructor() {
    // Simulace dat - seznam událostí
    this.events = [
      new Event(1, 'Událost 1', '2023-10-15', true),
      new Event(2, 'Událost 2', '2023-11-05', true),
      new Event(3, 'Událost 3', '2023-11-20'),
      // Další události podle potřeby
    ];
  }
}
