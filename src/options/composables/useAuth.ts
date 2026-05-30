import { ref } from 'vue';
import { supabase } from '../../supabase';
import { STORAGE_KEYS } from '../../shared/constants';
import { logger } from '../../shared/logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

const STORAGE_KEY = 'supabase_session';

const isLoggedIn = ref(false);
const user = ref<any>(null);

function getExtensionRedirectUrl() {
  return chrome.runtime.getURL('/options.html?login=true');
}

async function persistAuthState(session?: any) {
  const authMeta: Record<string, unknown> = {
    isLoggedIn: isLoggedIn.value,
    user: user.value ? { id: user.value.id, email: user.value.email } : null,
    updatedAt: Date.now(),
  };

  if (session?.access_token) {
    authMeta.accessToken = session.access_token;
  }
  if (session?.refresh_token) {
    authMeta.refreshToken = session.refresh_token;
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.AUTH_META]: authMeta,
  });
}

async function clearSyncState() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SYNC_META]: {
      state: 'idle',
      lastSyncAt: null,
    },
  });
}

export function useAuth() {
  async function loadAuthMeta() {
    const data = await chrome.storage.local.get(STORAGE_KEYS.AUTH_META);
    const authMeta = data[STORAGE_KEYS.AUTH_META];

    if (!authMeta) {
      return;
    }

    isLoggedIn.value = Boolean(authMeta.isLoggedIn);
    user.value = authMeta.user ?? null;
  }

  async function checkSession() {
    if (!supabase) {
      isLoggedIn.value = false;
      user.value = null;
      await persistAuthState();
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
      await persistAuthState(session ?? undefined);
    } catch (error) {
      logger.error('Failed to check session:', error);
      isLoggedIn.value = false;
      user.value = null;
      await persistAuthState();
    }
  }

  async function handleAuthCallback(url = window.location.href) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const parsedUrl = new URL(url);
      const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
      const searchParams = parsedUrl.searchParams;
      const accessToken = hashParams.get('access_token') ?? searchParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') ?? searchParams.get('refresh_token');

      if (!accessToken) {
        return { success: false, error: 'No access token in callback' };
      }

      const { data: { session }, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || '',
      });

      if (error) throw error;
      if (!session) {
        return { success: false, error: 'Failed to establish session' };
      }

      await checkSession();
      window.history.replaceState(null, '', getExtensionRedirectUrl());
      return { success: true };
    } catch (error: any) {
      logger.error('Failed to handle auth callback:', error);
      return { success: false, error: error.message };
    }
  }

  async function signInWithOAuth(provider: 'github' | 'google') {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const startTime = Date.now();
      // Generate OAuth URL with chrome.identity redirect URI
      const redirectUrl = chrome.identity.getRedirectURL();
      logger.log('Redirect URL:', redirectUrl);
      logger.log('Extension ID:', chrome.runtime.id);
      logger.log('Time - getRedirectURL:', Date.now() - startTime, 'ms');

      const supabaseStartTime = Date.now();
      const { data, error: urlError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });
      logger.log('Time - signInWithOAuth:', Date.now() - supabaseStartTime, 'ms');
      logger.log('Supabase OAuth URL:', data.url);
      if (data.url) {
        logger.log('OAuth URL params:', new URL(data.url).searchParams.toString());
      }

      if (urlError) throw urlError;

      // Use chrome.identity API to launch auth flow
      return new Promise((resolve) => {
        chrome.identity.launchWebAuthFlow(
          {
            url: data.url,
            interactive: true,
          },
          async (responseUrl) => {
            logger.log('OAuth response URL:', responseUrl);
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
              return;
            }

            if (!responseUrl) {
              resolve({ success: false, error: 'No response URL' });
              return;
            }

            // Parse the response URL - tokens are in the hash fragment
            const url = new URL(responseUrl);
            logger.log('Response URL hash:', url.hash);

            // Extract tokens from hash fragment
            const hashParams = new URLSearchParams(url.hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            logger.log('Access token:', accessToken ? 'found' : 'not found');
            logger.log('Refresh token:', refreshToken ? 'found' : 'not found');

            if (accessToken) {
              // Set the session manually
              supabase?.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken || '',
              }).then(({ data: { session }, error: sessionError }) => {
                if (sessionError) {
                  logger.error('Session error:', sessionError);
                  resolve({ success: false, error: sessionError.message });
                  return;
                }
                if (session) {
                  checkSession();
                  resolve({ success: true });
                } else {
                  resolve({ success: false, error: 'Failed to establish session' });
                }
              });
            } else {
              resolve({ success: false, error: 'No access token in response' });
            }
          }
        );
      });
    } catch (error: any) {
      logger.error('Login failed:', error);
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
      logger.error('Login failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function signUpWithEmail(email: string, password: string) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getExtensionRedirectUrl(),
        },
      });

      if (error) throw error;

      // If email confirmation is disabled, user is automatically signed in
      if (data.session) {
        await checkSession();
        return { success: true, needEmailConfirmation: false };
      }

      // If email confirmation is required
      return { success: true, needEmailConfirmation: true };
    } catch (error: any) {
      logger.error('Sign up failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function signOut() {
    logger.log('Signing out...');
    logger.log('Supabase URL:', supabaseUrl);
    if (!supabase) {
      isLoggedIn.value = false;
      user.value = null;
      localStorage.removeItem(STORAGE_KEY);
      await persistAuthState();
      await clearSyncState();
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.warn('Supabase signOut failed, clearing local state:', error);
      } else {
        logger.log('Sign out successful');
      }
    } catch (error: any) {
      logger.warn('SignOut error, clearing local state:', error);
      logger.warn('Error details:', error.message, error.cause);
    }

    // Always clear local state regardless of API result
    isLoggedIn.value = false;
    user.value = null;
    localStorage.removeItem(STORAGE_KEY);
    await persistAuthState();
    await clearSyncState();
    return { success: true };
  }

  async function resetPassword(email: string) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getExtensionRedirectUrl(),
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      logger.error('Reset password failed:', error);
      return { success: false, error: error.message };
    }
  }

  async function updatePassword(newPassword: string) {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      logger.error('Update password failed:', error);
      return { success: false, error: error.message };
    }
  }

  return {
    isLoggedIn,
    user,
    loadAuthMeta,
    checkSession,
    handleAuthCallback,
    signInWithOAuth,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
    updatePassword,
  };
}
