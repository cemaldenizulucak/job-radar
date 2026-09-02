import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

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
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.backgroundElement,
        },
      }}>
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
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
          title: 'Searches',
          tabBarIcon: ({ focused }) => (
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={22}
              tintColor={focused ? theme.accent : theme.textSecondary}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
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
          title: 'Profile',
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
