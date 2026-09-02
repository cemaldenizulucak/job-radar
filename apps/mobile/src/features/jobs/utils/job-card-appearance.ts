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
  isUnread: boolean;
  isNew: boolean;
  isFavorite?: boolean;
  matchLabel?: string;
}): string {
  const parts: string[] = [];

  if (input.isUnread) {
    parts.push('Unread');
  }
  if (input.isNew) {
    parts.push('New');
  }

  parts.push(`${input.title} at ${input.companyName}`);

  if (input.matchLabel) {
    parts.push(input.matchLabel);
  }
  if (input.isFavorite) {
    parts.push('Saved');
  }

  return parts.join(', ');
}
