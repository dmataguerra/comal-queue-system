/** Helper text shown under the ticket input for the current entry. */
export function entryHint(
  entry: string,
  parsed: number | null,
  current: number | null,
  called: number[],
) {
  if (!entry.trim()) return 'Se usan los dos últimos dígitos del ticket.';
  if (parsed === null) return 'Solo números, de 1 a 6 dígitos.';
  if (parsed === current) return 'Ya está en la TV: solo se repite el anuncio.';
  if (called.includes(parsed)) return 'Está en llamados: vuelve a ser el turno actual.';
  return 'Turno nuevo.';
}
