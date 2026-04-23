export interface UploadedImageResult {
  deleteUrl?: string;
  directUrl: string;
  provider: 'imgbb';
  viewerUrl?: string;
}

interface UploadImageToImgBbOptions {
  apiKey: string;
  fileName: string;
  image: Blob;
}

interface ImgBbUploadResponse {
  data?: {
    delete_url?: string;
    url?: string;
    url_viewer?: string;
  };
  error?: {
    message?: string;
  };
  status?: number;
  success?: boolean;
}

const getResponseErrorMessage = (payload: ImgBbUploadResponse, status: number) => {
  const message = payload.error?.message?.trim();
  if (message) {
    return message;
  }

  if (status === 400) {
    return 'ImgBB rejected the upload request.';
  }

  if (status === 401 || status === 403) {
    return 'The ImgBB API key was rejected.';
  }

  if (status >= 500) {
    return 'ImgBB is unavailable right now.';
  }

  return 'The image host did not accept the upload.';
};

export const uploadImageToImgBb = async (
  options: UploadImageToImgBbOptions
): Promise<UploadedImageResult> => {
  const apiKey = options.apiKey.trim();
  if (!apiKey) {
    throw new Error('Add an ImgBB API key first.');
  }

  const body = new FormData();
  body.append('image', options.image, options.fileName);
  body.append('name', options.fileName.replace(/\.[^.]+$/, ''));

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    body
  });

  const payload = await response.json() as ImgBbUploadResponse;

  if (!response.ok || !payload.success || !payload.data?.url) {
    throw new Error(getResponseErrorMessage(payload, response.status));
  }

  return {
    deleteUrl: payload.data.delete_url,
    directUrl: payload.data.url,
    provider: 'imgbb',
    viewerUrl: payload.data.url_viewer
  };
};

export const copyTextToClipboard = async (value: string) => {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard access is not available in this browser.');
  }

  await navigator.clipboard.writeText(value);
};
