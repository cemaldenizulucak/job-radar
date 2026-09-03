export type NotificationDiscoveryData = {
  discoveryRunId?: string;
  savedSearchId?: string | null;
  newJobCount?: number;
  createdAt?: string;
};

export type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  data?: NotificationDiscoveryData | null;
};

export type NotificationListResponse = {
  items: NotificationItem[];
};
