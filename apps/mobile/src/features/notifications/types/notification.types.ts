export type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export type NotificationListResponse = {
  items: NotificationItem[];
};
