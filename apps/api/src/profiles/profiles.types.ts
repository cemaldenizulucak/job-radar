export type ProfileRecord = {
  userId: string;
  fullName: string | null;
  email: string | null;
  notificationsEnabled: boolean | null;
  timezone: string | null;
  country: string | null;
  city: string | null;
};

export type ProfileUpdateInput = {
  notificationsEnabled?: boolean;
  country?: string | null;
  city?: string | null;
};
