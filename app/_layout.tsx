import '../global.css';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import database from '@/db';
import queryClient from '@/lib/queryClient';

export default function RootLayout() {
  // database is imported directly in hooks — no DatabaseProvider needed
  void database; // ensures the singleton is initialized at app start

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Settings',
            headerStyle: { backgroundColor: '#F8FAFC' },
            headerTintColor: '#2563EB',
            presentation: 'card',
          }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
