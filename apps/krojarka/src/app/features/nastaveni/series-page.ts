import { AttachmentGallery } from '../dokumenty/attachment-gallery';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Gender, Series, SeriesKind } from '@splk/api-contracts';
import { errorMessage } from '../../core/auth/error-messages';
import { genderLabel } from '../../core/labels';
import { CatalogStore } from './catalog.store';
import { FundHeader } from './fund-header';

/**
 * K24 – evidence series of parts and kits (D-20, D-35). The kind and the part type of a series never change;
 * renaming changes the label of every item in the series, so the form warns about it.
 */
@Component({
  selector: 'app-series-page',
  imports: [AttachmentGallery, ReactiveFormsModule, FundHeader],
  providers: [CatalogStore],
  templateUrl: './series-page.html',
})
export class SeriesPage {
  protected readonly store = inject(CatalogStore);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly genderLabel = genderLabel;

  protected readonly kind = signal<SeriesKind>('part');
  protected readonly text = signal('');
  protected readonly showArchived = signal(false);
  protected readonly editing = signal<Series | null>(null);
  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);

  protected readonly form = this.fb.group({
    partTypeId: [0],
    name: [''],
    variant: [''],
    gender: ['' as '' | Gender],
    regionId: [0],
    allowNumberReuse: [true],
  });

  protected readonly numberedTypes = computed(() =>
    this.store
      .partTypes()
      .filter((t) => t.numbered && !t.archived)
      .sort((a, b) => this.typeLabel(a.id).localeCompare(this.typeLabel(b.id), 'cs')),
  );

  protected readonly visible = computed(() => {
    const needle = this.text().trim().toLocaleLowerCase('cs');
    return this.store
      .series()
      .filter((s) => s.kind === this.kind() && (this.showArchived() || !s.archived))
      .filter((s) => !needle || `${s.name} ${s.variant ?? ''}`.toLocaleLowerCase('cs').includes(needle))
      .sort((a, b) => this.store.regionName(a.regionId).localeCompare(this.store.regionName(b.regionId), 'cs') || a.name.localeCompare(b.name, 'cs'));
  });

  /** Unnumbered types are counted per kind (kytička, korále, mašle) and get no series (D-37). */
  protected readonly unnumberedCount = computed(() => this.store.partTypes().filter((t) => !t.numbered && !t.archived).length);

  protected typeLabel(partTypeId: number | null): string {
    const type = this.store.partTypes().find((t) => t.id === partTypeId);
    return type ? `${type.name} (${genderLabel(type.gender)}, ${this.store.regionName(type.regionId)})` : '';
  }

  protected setKind(kind: SeriesKind): void {
    this.kind.set(kind);
    this.edit(null);
  }

  protected edit(series: Series | null): void {
    this.editing.set(series);
    this.form.reset({
      partTypeId: series?.partTypeId ?? 0,
      name: series?.name ?? '',
      variant: series?.variant ?? '',
      gender: series?.gender ?? '',
      regionId: series?.regionId ?? 0,
      allowNumberReuse: series?.allowNumberReuse ?? true,
    });
  }

  protected renamed(): boolean {
    const editing = this.editing();
    return !!editing && this.form.controls.name.value.trim() !== editing.name;
  }

  protected async save(): Promise<void> {
    const value = this.form.getRawValue();
    const editing = this.editing();
    try {
      if (editing) {
        await this.store.updateSeries(editing.id, {
          name: value.name.trim(),
          variant: value.variant.trim() || null,
          gender: value.gender || null,
          regionId: value.regionId || null,
          allowNumberReuse: value.allowNumberReuse,
        });
      } else if (this.kind() === 'part') {
        if (!value.partTypeId) {
          return this.show(false, 'Vyberte druh součástky.');
        }
        await this.store.createSeries({
          kind: 'part',
          partTypeId: value.partTypeId,
          ...(value.name.trim() ? { name: value.name.trim() } : {}),
          variant: value.variant.trim() || null,
          allowNumberReuse: value.allowNumberReuse,
        });
      } else {
        if (!value.name.trim()) {
          return this.show(false, 'Vyplňte název řady kompletů.');
        }
        await this.store.createSeries({
          kind: 'kit',
          name: value.name.trim(),
          gender: value.gender || null,
          regionId: value.regionId || null,
          variant: value.variant.trim() || null,
          allowNumberReuse: value.allowNumberReuse,
        });
      }
      this.show(true, editing ? 'Řada je uložená.' : 'Řada je založená.');
      this.edit(null);
    } catch (error) {
      this.show(false, errorMessage(error));
    }
  }

  protected async toggleArchive(series: Series): Promise<void> {
    try {
      await this.store.updateSeries(series.id, { archived: !series.archived });
      this.show(true, series.archived ? 'Řada je obnovená.' : 'Řada je archivovaná.');
    } catch (error) {
      this.show(false, errorMessage(error));
    }
  }

  private show(ok: boolean, text: string): void {
    this.message.set({ ok, text });
  }
}
