export type JobCardAppearance = {
  isUnread: boolean;
  showNewBadge: boolean;
  titleWeight: '500' | '700';
};

export function jobCardAppearance(input: {
  isNew: boolean;
  isSeen: boolean;
}): JobCardAppearance {
  const isUnread = !input.isSeen;

  return {
    isUnread,
    showNewBadge: input.isNew,
    titleWeight: isUnread ? '700' : '500',
  };
}

export function jobCardAccessibilityLabel(input: {
  title: string;
  companyName: string;
  sourceLabel: string;
  isUnread: boolean;
  isNew: boolean;
  isFavorite?: boolean;
  relevanceLabel?: string;
}): string {
  const parts: string[] = [];

  if (input.isUnread) {
    parts.push('Okunmadı');
  }
  if (input.isNew) {
    parts.push('Yeni');
  }

  parts.push(input.title, input.companyName, input.sourceLabel);

  if (input.relevanceLabel) {
    parts.push(input.relevanceLabel);
  }
  if (input.isFavorite) {
    parts.push('Favori');
  }

  return parts.join(', ');
}
