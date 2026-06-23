import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { EventsService } from '../../../../features/events/events.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppEvent, EventType } from '../../../../features/events/models/event.model';

@Component({
  selector: 'app-admin-event-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="admin-event-form">
      <div class="admin-event-form__header">
        <h2>{{ isEditMode ? 'Upravit akci' : 'Nová akce' }}</h2>
        <a [routerLink]="'/app/admin/events'" class="admin-event-form__back-link">← Zpět na seznam</a>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="admin-event-form__form">
        <div class="admin-event-form__field">
          <label for="title">Název *</label>
          <input id="title" type="text" formControlName="title" placeholder="Název akce" required />
          @if (form.get('title')?.invalid && form.get('title')?.touched) {
            <span class="admin-event-form__error">Název je povinný</span>
          }
        </div>

        <div class="admin-event-form__field">
          <label for="type">Typ *</label>
          <select id="type" formControlName="type" required>
            <option value="">-- Vyberte typ --</option>
            <option value="rehearsal">Zkouška</option>
            <option value="performance">Vystoupení</option>
            <option value="camp">Soustředění</option>
            <option value="meeting">Schůzka</option>
            <option value="other">Jiné</option>
          </select>
          @if (form.get('type')?.invalid && form.get('type')?.touched) {
            <span class="admin-event-form__error">Typ je povinný</span>
          }
        </div>

        <div class="admin-event-form__field">
          <label for="startsAt">Začátek *</label>
          <input id="startsAt" type="datetime-local" formControlName="startsAt" required />
          @if (form.get('startsAt')?.invalid && form.get('startsAt')?.touched) {
            <span class="admin-event-form__error">Čas začátku je povinný</span>
          }
        </div>

        <div class="admin-event-form__field">
          <label for="endsAt">Konec *</label>
          <input id="endsAt" type="datetime-local" formControlName="endsAt" required />
          @if (form.get('endsAt')?.invalid && form.get('endsAt')?.touched) {
            <span class="admin-event-form__error">Čas konce je povinný</span>
          }
        </div>

        <div class="admin-event-form__field">
          <label for="location">Místo *</label>
          <input id="location" type="text" formControlName="location" placeholder="Místo konání" required />
          @if (form.get('location')?.invalid && form.get('location')?.touched) {
            <span class="admin-event-form__error">Místo je povinné</span>
          }
        </div>

        <div class="admin-event-form__field">
          <label for="description">Popis</label>
          <textarea id="description" formControlName="description" placeholder="Popis akce" rows="4"></textarea>
        </div>

        <div class="admin-event-form__actions">
          <button type="submit" class="admin-event-form__btn-primary" [disabled]="form.invalid || isSubmitting">
            {{ isSubmitting ? 'Ukládám...' : (isEditMode ? 'Uložit' : 'Vytvořit') }}
          </button>
          <a [routerLink]="'/app/admin/events'" class="admin-event-form__btn-secondary">Zrušit</a>
        </div>

        @if (submitError) {
          <div class="admin-event-form__error-message">{{ submitError }}</div>
        }
      </form>
    </div>
  `,
  styles: [`
    .admin-event-form { max-width: 600px; margin: 0 auto; }
    .admin-event-form__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid #ddd; }
    .admin-event-form__header h2 { margin: 0; font-size: 1.25rem; }
    .admin-event-form__back-link { font-size: 0.9rem; color: #0066cc; text-decoration: none; }
    .admin-event-form__back-link:hover { text-decoration: underline; }
    .admin-event-form__form { display: flex; flex-direction: column; gap: 1.5rem; }
    .admin-event-form__field { display: flex; flex-direction: column; gap: 0.5rem; }
    .admin-event-form__field label { font-weight: 500; color: #333; font-size: 0.95rem; }
    .admin-event-form__field input[type="text"],
    .admin-event-form__field input[type="datetime-local"],
    .admin-event-form__field select,
    .admin-event-form__field textarea { padding: 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.95rem; font-family: inherit; outline: none; }
    .admin-event-form__field input:focus,
    .admin-event-form__field select:focus,
    .admin-event-form__field textarea:focus { border-color: #0066cc; }
    .admin-event-form__error { font-size: 0.85rem; color: #d32f2f; }
    .admin-event-form__actions { display: flex; gap: 1rem; margin-top: 1rem; }
    .admin-event-form__btn-primary,
    .admin-event-form__btn-secondary { padding: 0.75rem 1.5rem; border-radius: 4px; font-size: 0.95rem; font-weight: 500; border: none; cursor: pointer; }
    .admin-event-form__btn-primary { background: #0066cc; color: #fff; }
    .admin-event-form__btn-primary:hover:not(:disabled) { background: #0052a3; }
    .admin-event-form__btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .admin-event-form__btn-secondary { background: #f0f0f0; color: #333; text-decoration: none; display: inline-block; text-align: center; }
    .admin-event-form__btn-secondary:hover { background: #e0e0e0; }
    .admin-event-form__error-message { padding: 0.75rem; background: #ffebee; color: #d32f2f; border-radius: 4px; border-left: 4px solid #d32f2f; }
  `],
})
export class AdminEventFormComponent implements OnInit {
  form!: FormGroup;
  isEditMode = false;
  isSubmitting = false;
  submitError = '';
  private eventId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private eventsService: EventsService,
    private authService: AuthService,
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      type: ['', Validators.required],
      startsAt: ['', Validators.required],
      endsAt: ['', Validators.required],
      location: ['', Validators.required],
      description: [''],
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode = true;
      this.eventId = parseInt(idParam, 10);
      this.loadEvent(this.eventId);
    }
  }

  private loadEvent(id: number): void {
    this.eventsService.getEvent(id).subscribe({
      next: (event) => {
        if (event) {
          this.form.patchValue({
            title: event.title,
            type: event.type,
            startsAt: event.startsAt.substring(0, 16),
            endsAt: event.endsAt.substring(0, 16),
            location: event.location,
            description: event.description || '',
          });
        }
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';

    const formValue = this.form.value;
    const eventData: Omit<AppEvent, 'id'> = {
      ensembleId: 1,
      title: formValue.title,
      type: formValue.type as EventType,
      startsAt: formValue.startsAt,
      endsAt: formValue.endsAt,
      location: formValue.location,
      description: formValue.description || undefined,
      targetGroupIds: [],
    };

    if (this.isEditMode && this.eventId !== null) {
      this.eventsService.updateEvent(this.eventId, eventData).subscribe({
        next: () => {
          this.router.navigate(['/app/admin/events']);
        },
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se uložit akci';
        },
      });
    } else {
      this.eventsService.createEvent(eventData).subscribe({
        next: () => {
          this.router.navigate(['/app/admin/events']);
        },
        error: () => {
          this.isSubmitting = false;
          this.submitError = 'Nepodařilo se vytvořit akci';
        },
      });
    }
  }
}
