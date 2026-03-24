import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { database, seedAppSettings } from '@/db';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30s
      retry: 1,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    seedAppSettings().catch((err) =>
      console.error('[RootLayout] seedAppSettings error:', err)
    );
  }, []);

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
