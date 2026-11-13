/** Human-readable file name of a media URL, used in log messages. */
export const mediaName = (url: string) => decodeURIComponent(url.split('/').pop() ?? url);

/** Shuffled copy of the list; avoids starting with `avoid` so a video never repeats back to back. */
export function shuffle(lista: string[], avoid?: string) {
  const bolsa = [...lista];
  for (let i = bolsa.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]];
  }
  if (bolsa.length > 1 && bolsa[0] === avoid) [bolsa[0], bolsa[1]] = [bolsa[1], bolsa[0]];
  return bolsa;
}
