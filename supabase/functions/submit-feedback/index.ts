import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { createFeedbackHandler, type FeedbackStore } from '../_shared/feedback-handler.ts';

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = client.storage.from('feedback-images');
const store: FeedbackStore = {
  async claim(data) {
    const { data: result, error } = await client.rpc('claim_video_feedback', { p_id: data.id, p_hash: data.hash, p_content: data.content, p_email: data.email, p_ip_hash: data.ipHash });
    if (error) throw error;
    return result;
  },
  async upload(path, image) {
    const { error } = await bucket.upload(path, image, { contentType: image.type, upsert: true });
    if (error) throw error;
  },
  async complete(id, token, path) {
    const { data, error } = await client.rpc('complete_video_feedback', { p_id: id, p_token: token, p_image_path: path });
    if (error) throw error;
    return data === true;
  },
  async fail(id, token) {
    const { data, error } = await client.rpc('fail_video_feedback', { p_id: id, p_token: token });
    if (error) throw error;
    return data === true;
  },
  async remove(path) { const { error } = await bucket.remove([path]); if (error) throw error; },
};
Deno.serve(createFeedbackHandler(store, { apiKey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', ipSalt: serviceKey }));
