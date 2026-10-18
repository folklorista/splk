import { CostumeItem, CostumeState, ItemCondition, ItemLocation } from '../../models/costume.model';
import {
  ItemAvailability,
  findSeries,
  itemAvailability,
  itemClassification,
  itemLabel,
  matchesSearch,
  openWorkOrdersFor,
  seriesLabel,
  sortItems,
} from '../../utils/costume-logic';

export interface StockFilter {
  search: string;
  genderId: string;
  regionId: string;
  partTypeId: string;
  seriesId: string;
  availability: '' | ItemAvailability;
  condition: '' | ItemCondition;
  location: '' | ItemLocation;
  workOrders: boolean;
}

export const EMPTY_STOCK_FILTER: StockFilter = {
  search: '', genderId: '', regionId: '', partTypeId: '', seriesId: '', availability: '', condition: '', location: '', workOrders: false,
};

// Filtr skladu – bez výslovného filtru „Vyřazeno“ se vyřazené kusy nezobrazují
export function filterStock(state: CostumeState, filter: StockFilter, holderLabel: (item: CostumeItem) => string = () => ''): CostumeItem[] {
  return sortItems(
    state,
    state.items.filter((item) => {
      const cls = itemClassification(state, item);
      const availability = itemAvailability(state, item);
      if (filter.availability ? availability !== filter.availability : availability === 'retired') return false;
      if (filter.genderId && cls.genderId !== filter.genderId) return false;
      if (filter.regionId && cls.regionId !== filter.regionId) return false;
      if (filter.partTypeId && String(cls.partTypeId) !== filter.partTypeId) return false;
      if (filter.seriesId && String(item.seriesId) !== filter.seriesId) return false;
      if (filter.condition && item.condition !== filter.condition) return false;
      if (filter.location && item.location !== filter.location) return false;
      if (filter.workOrders && !openWorkOrdersFor(state, item.id).length) return false;
      return matchesSearch(`${itemLabel(state, item)} ${item.size ?? ''} ${item.description ?? ''} ${holderLabel(item)}`, filter.search);
    }),
  );
}

export interface StockGroup {
  seriesId: number;
  label: string;
  items: CostumeItem[];
}

export function groupBySeries(state: CostumeState, items: CostumeItem[]): StockGroup[] {
  const groups = new Map<number, StockGroup>();
  for (const item of items) {
    if (!groups.has(item.seriesId)) groups.set(item.seriesId, { seriesId: item.seriesId, label: seriesLabel(state, findSeries(state, item.seriesId)), items: [] });
    groups.get(item.seriesId)!.items.push(item);
  }
  return [...groups.values()];
}
