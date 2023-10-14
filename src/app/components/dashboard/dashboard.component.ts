import { Component } from '@angular/core';
import { Event } from 'src/app/models/event';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent {
  upcomingEvents: Event[]; // Předpokládáme, že máte datovou strukturu Event
  constructor() {
    // Simulace dat - tři události
    this.upcomingEvents = [
      { id: 1, name: 'Událost 1', date: '2023-10-15', isRegistered: true },
      { id: 2, name: 'Událost 2', date: '2023-11-05', isRegistered: true },
      { id: 3, name: 'Událost 3', date: '2023-11-20', isRegistered: true },
    ];
  }
}
