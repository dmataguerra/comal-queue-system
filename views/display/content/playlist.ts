/** Human-readable file name of a media URL, used in log messages. */
export const mediaName = (url: string) => decodeURIComponent(url.split('/').pop() ?? url);

/** Shuffled copy of the list; avoids starting with `avoid` so a video never repeats back to back. */
export function shuffle(list: string[], avoid?: string) {
  const bag = [...list];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  if (bag.length > 1 && bag[0] === avoid) [bag[0], bag[1]] = [bag[1], bag[0]];
  return bag;
}
