export function attachFavoriteState<T extends { id: string }>(
  items: readonly T[],
  favoriteIds: ReadonlySet<string>,
): Array<T & { isFavorite: boolean }> {
  return items.map((item) => ({
    ...item,
    isFavorite: favoriteIds.has(item.id),
  }));
}
