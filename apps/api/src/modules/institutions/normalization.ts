export function normalizeLabel(value: string): string {
  const label = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!label) throw new Error('Name must not be empty');
  return label;
}

export function normalizeKey(value: string): string {
  return normalizeLabel(value).normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
}

export function normalizeAcronym(value: string): string {
  const acronym = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,16}$/u.test(acronym)) {
    throw new Error('Acronym must contain 2–16 letters or digits');
  }
  return acronym;
}
