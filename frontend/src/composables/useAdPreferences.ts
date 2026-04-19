import { ref } from 'vue';

const SHOW_ADS_STORAGE_KEY = 'magicianShowAds';
const showAds = ref(true);
let isInitialized = false;

const readStoredPreference = () => {
  if (typeof window === 'undefined') return true;

  const storedPreference = window.localStorage.getItem(SHOW_ADS_STORAGE_KEY);
  if (storedPreference === null) return true;
  return storedPreference !== 'false';
};

const writeStoredPreference = (value: boolean) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SHOW_ADS_STORAGE_KEY, String(value));
};

const initializeAdPreferences = () => {
  if (isInitialized || typeof window === 'undefined') return;

  showAds.value = readStoredPreference();
  window.addEventListener('storage', (event) => {
    if (event.key === SHOW_ADS_STORAGE_KEY) {
      showAds.value = event.newValue !== 'false';
    }
  });

  isInitialized = true;
};

export const useAdPreferences = () => {
  initializeAdPreferences();

  const setShowAds = (value: boolean) => {
    showAds.value = value;
    writeStoredPreference(value);
  };

  return {
    showAds,
    setShowAds
  };
};
