import type { UserProfile } from '../types';

export interface SessionUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  isAnonymous: boolean;
  providerData: Array<{ providerId: string }>;
}

export interface AuthSession {
  user: SessionUser;
  profile: UserProfile;
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code = 'REQUEST_FAILED'
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiRequest = async <T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 15_000
): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(path, {
      ...init,
      headers,
      credentials: 'include',
      signal: controller.signal
    });
    const payload = await response.json() as ApiEnvelope<T>;
    if (!response.ok || !payload.ok) {
      throw new ApiError(
        payload.error || '班级服务请求失败，请稍后重试',
        response.status,
        payload.code
      );
    }
    return payload.data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('班级服务响应超时，请切换网络后重试', 504, 'API_TIMEOUT');
    }
    throw new ApiError('无法连接班级服务，请检查网络后重试', 502, 'API_UNAVAILABLE');
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const postJson = <T>(path: string, body: Record<string, unknown>, timeoutMs?: number) =>
  apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) }, timeoutMs);
