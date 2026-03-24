import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import database from '@/db';
import AppSettings from '@/db/models/AppSettings';

export const APP_SETTINGS_QUERY_KEY = 'appSettings';

export function useAppSettings() {
  return useQuery({
    queryKey: [APP_SETTINGS_QUERY_KEY],
    queryFn: async () => {
      try {
        return await database.get<AppSettings>('app_settings').find('singleton');
      } catch {
        return null;
      }
    },
  });
}

export interface UpdateAppSettingsPayload {
  homeAddressLine1: string | null;
  homeAddressLine2: string | null;
  homeCity: string | null;
  homeZip: string | null;
  confirmationEmail: string | null;
}

export function useUpdateAppSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateAppSettingsPayload): Promise<void> => {
      const settings = await database.get<AppSettings>('app_settings').find('singleton');
      await database.write(async () => {
        await settings.update((record) => {
          record.homeAddressLine1 = payload.homeAddressLine1;
          record.homeAddressLine2 = payload.homeAddressLine2;
          record.homeCity = payload.homeCity;
          record.homeZip = payload.homeZip;
          record.confirmationEmail = payload.confirmationEmail;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (record as any)._raw.updated_at = Date.now();
        });
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [APP_SETTINGS_QUERY_KEY] });
    },
  });
}
