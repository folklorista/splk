import { IconName } from '../../shared/icon/icon.component';

export interface Group {
  id: number;
  ensembleId: number;
  name: string;
  slug: string;
  icon?: IconName;
  // Nástěnka skupiny; chybějící hodnota = povolena (výchozí)
  boardEnabled?: boolean;
}
