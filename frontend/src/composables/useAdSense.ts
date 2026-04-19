declare global {
  interface Window {
    adsbygoogle?: unknown[];
    __adsenseScriptPromise?: Promise<void>;
  }
}

const ADSENSE_SCRIPT_ID = 'adsense-script';

const getAdSenseScriptSrc = (clientId: string) =>
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;

export const loadAdSenseScript = (clientId: string) => {
  if (typeof window === 'undefined' || !clientId) {
    return Promise.resolve();
  }

  if (window.__adsenseScriptPromise) {
    return window.__adsenseScriptPromise;
  }

  window.__adsenseScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(ADSENSE_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = getAdSenseScriptSrc(clientId);
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load AdSense script.'));

    document.head.appendChild(script);
  });

  return window.__adsenseScriptPromise;
};

export const requestAdSenseSlot = async (element: HTMLElement, clientId: string) => {
  if (!clientId || element.dataset.adStatus === 'filled' || element.dataset.adRequestStatus === 'requested') {
    return;
  }

  await loadAdSenseScript(clientId);

  try {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
    element.dataset.adRequestStatus = 'requested';
  } catch (error) {
    element.dataset.adRequestStatus = 'error';
    throw error;
  }
};
