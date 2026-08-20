import { domToBlob } from 'modern-screenshot';

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

export const downloadPosterFile = (file: File): ShareResult => {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
};

export const createPosterFile = async (node: HTMLElement, fileName: string): Promise<File> => {
  if ('fonts' in document) await document.fonts.ready;
  const blob = await domToBlob(node, {
    backgroundColor: '#f8fafc',
    scale: 2,
    timeout: 30_000
  });
  if (!blob) throw new Error('长图生成失败，请稍后重试');
  return new File([blob], fileName, { type: 'image/png' });
};

export const shareOrDownloadFile = async (
  file: File,
  title: string,
  text: string
): Promise<ShareResult> => {
  const shareData: ShareData = { files: [file], title, text };
  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    try {
      await navigator.share(shareData);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  return downloadPosterFile(file);
};
