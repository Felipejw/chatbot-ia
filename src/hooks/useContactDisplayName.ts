// Stub: original module was removed during refactoring
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 13) {
    return `+${clean.slice(0, 2)} (${clean.slice(2, 4)}) ${clean.slice(4, 9)}-${clean.slice(9)}`;
  }
  return phone;
}

export function useContactDisplayName() {
  return { getDisplayName: (contact: { name?: string | null; phone?: string | null }) => contact?.name || contact?.phone || 'Contato' };
}

export function getContactSecondaryName(contact: { name?: string | null; phone?: string | null }) {
  return contact?.phone || '';
}
