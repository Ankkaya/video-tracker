import { ref } from 'vue';
import { supabase, type Record, type LocalRecord } from '../../supabase';

export function useSync() {
  const isSyncing = ref(false);

  async function uploadRecords(localRecords: LocalRecord[]) {
    try {
      isSyncing.value = true;

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const recordsToUpload: Record[] = localRecords.map(record => ({
        id: `${record.platform}-${record.videoId}`,
        user_id: user.id,
        platform: record.platform,
        video_id: record.videoId,
        title: record.title,
        thumbnail: record.thumbnail,
        progress: record.progress,
        duration: record.duration,
        watched_at: new Date(record.watchedAt).toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('records')
        .upsert(recordsToUpload, { onConflict: 'id' });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error('Upload failed:', error);
      return { success: false, error: error.message };
    } finally {
      isSyncing.value = false;
    }
  }

  async function downloadRecords(): Promise<LocalRecord[]> {
    try {
      isSyncing.value = true;

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('records')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      const localRecords: LocalRecord[] = (data || []).map(record => ({
        id: record.id,
        platform: record.platform,
        videoId: record.video_id,
        title: record.title,
        thumbnail: record.thumbnail,
        progress: record.progress,
        duration: record.duration,
        watchedAt: new Date(record.watched_at).getTime(),
      }));

      return localRecords;
    } catch (error: any) {
      console.error('Download failed:', error);
      throw error;
    } finally {
      isSyncing.value = false;
    }
  }

  async function syncRecords(localRecords: LocalRecord[]) {
    try {
      isSyncing.value = true;

      // Upload local records
      const uploadResult = await uploadRecords(localRecords);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }

      // Download cloud records
      const cloudRecords = await downloadRecords();

      return { success: true, records: cloudRecords };
    } catch (error: any) {
      console.error('Sync failed:', error);
      return { success: false, error: error.message };
    } finally {
      isSyncing.value = false;
    }
  }

  return {
    isSyncing,
    uploadRecords,
    downloadRecords,
    syncRecords,
  };
}
