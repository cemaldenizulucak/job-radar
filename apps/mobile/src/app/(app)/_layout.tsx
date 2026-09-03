import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePushNotifications } from '@/features/notifications/hooks/usePushNotifications';
import { useTheme } from '@/hooks/use-theme';

export const unstable_settings = {
  initialRouteName: 'jobs',
};

export default function AppTabsLayout() {
  const theme = useTheme();
  const { user } = useAuth();
  usePushNotifications(user?.id);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarActiveBackgroundColor: theme.accentMuted,
        tabBarItemStyle: {
          borderRadius: Radius.md,
          marginHorizontal: Spacing.one,
          marginVertical: Spacing.one,
        },
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 11,
        },
      }}>
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'İlanlar',
          tabBarIcon: ({ focused }) => (
            <SymbolView
              name={{ ios: 'briefcase.fill', android: 'work', web: 'work' }}
              size={22}
              tintColor={focused ? theme.accent : theme.textSecondary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="searches"
        options={{
          title: 'Aramalar',
          tabBarIcon: ({ focused }) => (
            <SymbolView
              name={{
                ios: focused ? 'magnifyingglass' : 'magnifyingglass',
                android: 'search',
                web: 'search',
              }}
              size={22}
              tintColor={focused ? theme.accent : theme.textSecondary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Başvurular',
          tabBarIcon: ({ focused }) => (
            <SymbolView
              name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }}
              size={22}
              tintColor={focused ? theme.accent : theme.textSecondary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => (
            <SymbolView
              name={{ ios: 'person.fill', android: 'person', web: 'person' }}
              size={22}
              tintColor={focused ? theme.accent : theme.textSecondary}
            />
          ),
        }}
      />
    </Tabs>
  );
}
