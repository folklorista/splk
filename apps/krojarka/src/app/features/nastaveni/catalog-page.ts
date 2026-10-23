import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Gender, PartType, Region } from '@splk/api-contracts';
import { errorMessage } from '../../core/auth/error-messages';
import { genderLabel } from '../../core/labels';
import { CatalogStore } from './catalog.store';
import { FundHeader } from './fund-header';

type GenderFilter = 'all' | Gender | 'none';

/** K24 – regions (region → area) and part types of the selected fund. Archive instead of delete. */
@Component({
  selector: 'app-catalog-page',
  imports: [ReactiveFormsModule, FundHeader],
  providers: [CatalogStore],
  templateUrl: './catalog-page.html',
})
export class CatalogPage {
  protected readonly store = inject(CatalogStore);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly genderLabel = genderLabel;

  protected readonly message = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly editingRegion = signal<Region | null>(null);
  protected readonly editingType = signal<PartType | null>(null);

  protected readonly regionForm = this.fb.group({ name: ['', Validators.required], parentId: [0] });
  protected readonly typeForm = this.fb.group({
    name: ['', Validators.required],
    gender: ['' as '' | Gender],
    regionId: [0],
    numbered: [true],
  });

  protected readonly filter = signal({ text: '', gender: 'all' as GenderFilter, regionId: 0, archived: false });
  protected readonly topRegions = computed(() => this.store.activeRegions().filter((r) => r.parentId === null));
  protected readonly visibleTypes = computed(() => {
    const { text, gender, regionId, archived } = this.filter();
    const needle = text.trim().toLocaleLowerCase('cs');
    return this.store
      .partTypes()
      .filter((t) => archived || !t.archived)
      .filter((t) => gender === 'all' || (gender === 'none' ? t.gender === null : t.gender === gender))
      .filter((t) => !regionId || t.regionId === regionId || this.store.regions().find((r) => r.id === t.regionId)?.parentId === regionId)
      .filter((t) => !needle || t.name.toLocaleLowerCase('cs').includes(needle))
      .sort((a, b) => this.store.regionName(a.regionId).localeCompare(this.store.regionName(b.regionId), 'cs') || a.name.localeCompare(b.name, 'cs'));
  });

  protected setFilter(patch: Partial<ReturnType<typeof this.filter>>): void {
    this.filter.update((f) => ({ ...f, ...patch }));
  }

  protected editRegion(region: Region | null): void {
    this.editingRegion.set(region);
    this.regionForm.reset({ name: region?.name ?? '', parentId: region?.parentId ?? 0 });
  }

  protected async saveRegion(): Promise<void> {
    const { name, parentId } = this.regionForm.getRawValue();
    if (!name.trim()) {
      return this.show(false, 'Vyplňte název regionu.');
    }
    const input = { name: name.trim(), parentId: parentId || null };
    const editing = this.editingRegion();
    await this.run(
      () => (editing ? this.store.updateRegion(editing.id, input) : this.store.createRegion(input)),
      editing ? 'Region je uložený.' : 'Region je přidaný.',
      () => this.editRegion(null),
    );
  }

  protected async toggleRegionArchive(region: Region): Promise<void> {
    await this.run(() => this.store.updateRegion(region.id, { archived: !region.archived }), region.archived ? 'Region je obnovený.' : 'Region je archivovaný.');
  }

  protected editType(type: PartType | null): void {
    this.editingType.set(type);
    this.typeForm.reset({ name: type?.name ?? '', gender: type?.gender ?? '', regionId: type?.regionId ?? 0, numbered: type?.numbered ?? true });
  }

  protected async saveType(): Promise<void> {
    const { name, gender, regionId, numbered } = this.typeForm.getRawValue();
    if (!name.trim()) {
      return this.show(false, 'Vyplňte název druhu.');
    }
    const input = { name: name.trim(), gender: gender || null, regionId: regionId || null, numbered };
    const editing = this.editingType();
    await this.run(
      () => (editing ? this.store.updatePartType(editing.id, input) : this.store.createPartType(input)),
      editing ? 'Druh je uložený.' : 'Druh je přidaný.',
      () => this.editType(null),
    );
  }

  protected async toggleTypeArchive(type: PartType): Promise<void> {
    await this.run(() => this.store.updatePartType(type.id, { archived: !type.archived }), type.archived ? 'Druh je obnovený.' : 'Druh je archivovaný.');
  }

  private async run(action: () => Promise<void>, success: string, after?: () => void): Promise<void> {
    try {
      await action();
      after?.();
      this.show(true, success);
    } catch (error) {
      this.show(false, errorMessage(error));
    }
  }

  private show(ok: boolean, text: string): void {
    this.message.set({ ok, text });
  }
}
