import { ref } from 'vue';
import { supabase } from '../../supabase';

const STORAGE_KEY = 'supabase_session';

export function useAuth() {
  const isLoggedIn = ref(false);
  const user = ref<any>(null);

  async function checkSession() {
    if (!supabase) {
      isLoggedIn.value = false;
      user.value = null;
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        isLoggedIn.value = true;
        user.value = session.user;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        isLoggedIn.value = false;
        user.value = null;
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Failed to check session:', error);
      isLoggedIn.value = false;
      user.value = null;
    }
  }

  async function signInWithOAuth(provider: 'github' | 'google') {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: chrome.runtime.getURL('options.html'),
        },
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Login failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function signInWithEmail(email: string, password: string) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      await checkSession();
      return { success: true };
    } catch (error: any) {
      console.error('Login failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function signUpWithEmail(email: string, password: string) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Sign up failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function signOut() {
    if (!supabase) {
      isLoggedIn.value = false;
      user.value = null;
      localStorage.removeItem(STORAGE_KEY);
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      isLoggedIn.value = false;
      user.value = null;
      localStorage.removeItem(STORAGE_KEY);
      return { success: true };
    } catch (error: any) {
      console.error('Logout failed:', error);
      return { success: false, error: error.message };
    }
  }

  return {
    isLoggedIn,
    user,
    checkSession,
    signInWithOAuth,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
