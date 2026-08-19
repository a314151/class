import React, { useState, useRef } from 'react';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const MAX_EMBEDDED_FALLBACK_SIZE = 512 * 1024;

const readFileAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
  reader.readAsDataURL(file);
});

interface R2UploadButtonProps {
  onUploaded: (fileUrl: string, fileName: string) => void;
  workerUrl?: string;
  buttonText?: string;
  accept?: string;
  className?: string;
}

export const R2UploadButton: React.FC<R2UploadButtonProps> = ({
  onUploaded,
  workerUrl,
  buttonText = '上传附件/图片 (R2)',
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip',
  className = ''
}) => {
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (10MB for client processing)
    if (file.size > MAX_UPLOAD_SIZE) {
      alert('文件大小不能超过 10MB');
      return;
    }

    setUploading(true);
    setStatusMsg('正在处理文件...');

    try {
      if (workerUrl && workerUrl.startsWith('http')) {
        // Real Cloudflare Worker + R2 Upload
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(workerUrl, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const resData = await response.json();
          const uploadedUrl = resData.url || resData.fileUrl;
          if (!uploadedUrl) {
            throw new Error('上传接口未返回文件地址');
          }
          onUploaded(uploadedUrl, file.name);
          setStatusMsg('✅ 已成功上传至 Cloudflare R2');
        } else {
          throw new Error(`上传接口响应异常 (${response.status})`);
        }
      } else {
        if (file.size > MAX_EMBEDDED_FALLBACK_SIZE) {
          throw new Error('未配置可用的上传服务，附件不能超过 512KB');
        }
        const base64String = await readFileAsDataUrl(file);
        onUploaded(base64String, file.name);
        setStatusMsg('✅ 附件已就绪');
      }
    } catch (err: any) {
      console.warn('Worker upload failed:', err);
      if (file.size <= MAX_EMBEDDED_FALLBACK_SIZE) {
        try {
          const base64String = await readFileAsDataUrl(file);
          onUploaded(base64String, file.name);
          setStatusMsg('✅ 云端上传失败，已改用小文件内嵌模式');
        } catch (readError) {
          console.error('File fallback failed:', readError);
          setStatusMsg('❌ 文件读取失败，请重试');
        }
      } else {
        setStatusMsg(`❌ ${err?.message || '上传失败，请检查上传服务配置'}`);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
      setTimeout(() => {
        setStatusMsg(null);
      }, 3500);
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept={accept}
        className="hidden"
      />
      <button
        type="button"
        id="r2-upload-btn"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-2xl border border-indigo-300/60 dark:border-indigo-800/60 bg-white/60 dark:bg-slate-800/60 hover:bg-white/90 text-indigo-700 dark:text-indigo-300 shadow-xs backdrop-blur-md transition-all active:scale-95 ${className}`}
      >
        {uploading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
            <span>上传中...</span>
          </>
        ) : (
          <>
            <UploadCloud className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{buttonText}</span>
          </>
        )}
      </button>
      {statusMsg && (
        <span className={`text-[11px] flex items-center gap-1 ${
          statusMsg.startsWith('❌')
            ? 'text-rose-600 dark:text-rose-400'
            : 'text-emerald-600 dark:text-emerald-400'
        }`}>
          {statusMsg.startsWith('❌')
            ? <AlertCircle className="w-3 h-3" />
            : <CheckCircle2 className="w-3 h-3" />}
          {statusMsg}
        </span>
      )}
    </div>
  );
};
