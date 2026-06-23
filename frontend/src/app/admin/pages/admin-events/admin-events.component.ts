import { Component, OnInit, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { EventsService } from '../../../features/events/events.service';
import { AppEvent } from '../../../features/events/models/event.model';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
    <div class="admin-events">
      <div class="admin-events__header">
        <h2>Akce</h2>
        <div class="admin-events__actions">
          <a [routerLink]="'/app/admin/events/new'" class="admin-events__btn-add">+ Přidat akci</a>
          <a [routerLink]="'/app/admin'" class="admin-events__back-link">← Zpět</a>
        </div>
      </div>

      @if (loading()) {
        <p class="admin-events__loading">Načítám...</p>
      }

      @if (!loading() && events().length === 0) {
        <p class="admin-events__empty">Žádné akce. <a [routerLink]="'/app/admin/events/new'">Přidejte první.</a></p>
      }

      @if (!loading() && events().length > 0) {
        <div class="admin-events__list">
          @for (event of events(); track event.id) {
            <div class="admin-events__item">
              <div class="admin-events__item-header">
                <h3 class="admin-events__item-title">{{ event.title }}</h3>
                <span class="admin-events__badge-type">{{ event.type }}</span>
              </div>
              <p class="admin-events__item-location">📍 {{ event.location }}</p>
              <div class="admin-events__item-meta">
                <span class="admin-events__item-date">{{ event.startsAt | date: 'short' }}</span>
                @if (event.description) {
                  <span class="admin-events__item-desc">{{ event.description.substring(0, 50) }}...</span>
                }
              </div>
              <div class="admin-events__item-actions">
                <a [routerLink]="'/app/admin/events/' + event.id + '/edit'" class="admin-events__btn-edit">
                  Upravit
                </a>
                <button
                  type="button"
                  class="admin-events__btn-delete"
                  (click)="onDelete(event.id)"
                >
                  Smazat
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .admin-events { max-width: 900px; margin: 0 auto; }
    .admin-events__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #ddd; }
    .admin-events__header h2 { margin: 0; font-size: 1.25rem; }
    .admin-events__actions { display: flex; gap: 1rem; align-items: center; }
    .admin-events__btn-add { padding: 0.5rem 1rem; background: #0066cc; color: #fff; text-decoration: none; border-radius: 4px; font-size: 0.9rem; font-weight: 500; }
    .admin-events__btn-add:hover { background: #0052a3; }
    .admin-events__back-link { font-size: 0.9rem; color: #0066cc; text-decoration: none; }
    .admin-events__back-link:hover { text-decoration: underline; }
    .admin-events__loading, .admin-events__empty { padding: 2rem; text-align: center; color: #666; }
    .admin-events__empty a { color: #0066cc; text-decoration: none; }
    .admin-events__empty a:hover { text-decoration: underline; }
    .admin-events__list { display: flex; flex-direction: column; gap: 1rem; }
    .admin-events__item { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .admin-events__item-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
    .admin-events__item-title { margin: 0; font-size: 1.05rem; font-weight: 600; flex: 1; }
    .admin-events__badge-type { padding: 0.25rem 0.75rem; background: #e3f2fd; color: #0066cc; border-radius: 12px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
    .admin-events__item-location { margin: 0; color: #666; font-size: 0.95rem; }
    .admin-events__item-meta { font-size: 0.85rem; color: #999; }
    .admin-events__item-date { display: block; }
    .admin-events__item-desc { display: block; margin-top: 0.5rem; }
    .admin-events__item-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
    .admin-events__btn-edit, .admin-events__btn-delete { padding: 0.5rem 1rem; border-radius: 4px; border: 1px solid #ccc; background: #fff; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
    .admin-events__btn-edit { color: #0066cc; text-decoration: none; display: inline-block; }
    .admin-events__btn-edit:hover { background: #e6f2ff; border-color: #0066cc; }
    .admin-events__btn-delete { color: #d32f2f; }
    .admin-events__btn-delete:hover { background: #ffebee; border-color: #d32f2f; }
  `],
})
export class AdminEventsComponent implements OnInit {
  events = signal<AppEvent[]>([]);
  loading = signal(true);

  constructor(
    private eventsService: EventsService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  private loadEvents(): void {
    this.loading.set(true);
    this.eventsService.getEvents().subscribe({
      next: (events) => {
        this.events.set(events);
        this.loading.set(false);
      },
    });
  }

  onDelete(id: number): void {
    if (!confirm('Opravdu chcete smazat tuto akci?')) {
      return;
    }
    this.eventsService.deleteEvent(id).subscribe({
      next: () => {
        this.loadEvents();
      },
    });
  }
}
