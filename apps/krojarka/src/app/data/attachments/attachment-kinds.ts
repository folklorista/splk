import type { AttachmentKind, AttachmentOwnerType } from '@splk/api-contracts';

export const ATTACHMENT_KINDS: Record<AttachmentOwnerType, readonly AttachmentKind[]> = {
  person: ['person_card', 'loose_slip'], kit: ['kit_card', 'kit_label', 'loose_slip'], series: ['series_card', 'loose_slip'],
  item: ['item_photo', 'loose_slip'], inventory_check: ['check_photo'], archive: ['loan_book', 'loose_slip'],
};
