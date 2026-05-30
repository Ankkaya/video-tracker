import { ref, onMounted, computed } from 'vue';
import type { GlobalTheme } from 'naive-ui';
import { darkTheme } from 'naive-ui';

type Theme = 'light' | 'dark' | 'auto';

const THEME_KEY = 'theme';

// Global shared state
const theme = ref<Theme>('auto');
const isDark = ref(false);
let initialized = false;

function applyTheme(t: Theme) {
  if (t === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    isDark.value = prefersDark;
  } else {
    isDark.value = t === 'dark';
  }
  // Apply dark class to document
  if (isDark.value) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Eagerly initialize from storage (runs immediately when module is loaded)
chrome.storage.local.get(THEME_KEY).then((data) => {
  if (data[THEME_KEY]) {
    theme.value = data[THEME_KEY];
  }
  applyTheme(theme.value);
});

export function useTheme() {
  const naiveTheme = computed<GlobalTheme | null>(() => {
    return isDark.value ? darkTheme : null;
  });

  function setTheme(t: Theme) {
    theme.value = t;
    chrome.storage.local.set({ [THEME_KEY]: t });
    applyTheme(t);
  }

  function toggleTheme() {
    const themes: Theme[] = ['light', 'dark', 'auto'];
    const currentIndex = themes.indexOf(theme.value);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  }

  onMounted(() => {
    if (!initialized) {
      initialized = true;

      // Listen for system theme changes when in auto mode
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', (e) => {
        if (theme.value === 'auto') {
          isDark.value = e.matches;
          applyTheme(theme.value);
        }
      });

      // Listen for theme changes from other contexts (popup <-> options sync)
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[THEME_KEY]) {
          theme.value = changes[THEME_KEY].newValue || 'auto';
          applyTheme(theme.value);
        }
      });
    }
  });

  return {
    theme,
    isDark,
    naiveTheme,
    setTheme,
    toggleTheme,
  };
}
