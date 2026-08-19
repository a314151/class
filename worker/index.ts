import firebaseConfig from '../firebase-applet-config.json';

interface Env {
  ASSETS: Fetcher;
}

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

type JsonRecord = Record<string, unknown>;

interface SessionTokens {
  idToken: string;
  refreshToken?: string;
  refreshed?: boolean;
}

interface FirebaseAuthResult {
  localId: string;
  email?: string;
  displayName?: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId;
const API_KEY = firebaseConfig.apiKey;
const OWNER_EMAIL = 'lry674515314@gmail.com';
const ID_TOKEN_COOKIE = 'class_id_token';
const REFRESH_TOKEN_COOKIE = 'class_refresh_token';
const ALLOWED_COLLECTIONS = new Set([
  'users',
  'notices',
  'schedules',
  'schoolEvents',
  'messages',
  'directMessages',
  'birthdayWishes',
  'polls',
  'forms',
  'feedbacks',
  'settings',
  'system'
]);

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'REQUEST_FAILED'
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const jsonResponse = (
  data: unknown,
  status = 200,
  extraHeaders?: Headers
): Response => {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(data), { status, headers });
};

const success = (data: unknown, headers?: Headers) =>
  jsonResponse({ ok: true, data }, 200, headers);

const readJson = async <T extends JsonRecord>(request: Request): Promise<T> => {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    throw new HttpError(415, '请求格式不正确', 'INVALID_CONTENT_TYPE');
  }
  try {
    return await request.json() as T;
  } catch {
    throw new HttpError(400, '请求内容不是有效 JSON', 'INVALID_JSON');
  }
};

const assertSameOriginWrite = (request: Request) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new HttpError(403, '拒绝跨站请求', 'INVALID_ORIGIN');
  }
};

const parseCookies = (request: Request): Map<string, string> => {
  const cookies = new Map<string, string>();
  const raw = request.headers.get('Cookie') || '';
  raw.split(';').forEach((entry) => {
    const separator = entry.indexOf('=');
    if (separator < 0) return;
    const name = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1).trim();
    if (name) cookies.set(name, decodeURIComponent(value));
  });
  return cookies;
};

const cookieLine = (
  name: string,
  value: string,
  request: Request,
  maxAge: number
): string => {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
};

const sessionHeaders = (request: Request, tokens: SessionTokens): Headers => {
  const headers = new Headers();
  headers.append('Set-Cookie', cookieLine(ID_TOKEN_COOKIE, tokens.idToken, request, 60 * 60));
  if (tokens.refreshToken) {
    headers.append(
      'Set-Cookie',
      cookieLine(REFRESH_TOKEN_COOKIE, tokens.refreshToken, request, 60 * 60 * 24 * 30)
    );
  }
  return headers;
};

const clearSessionHeaders = (request: Request): Headers => {
  const headers = new Headers();
  headers.append('Set-Cookie', cookieLine(ID_TOKEN_COOKIE, '', request, 0));
  headers.append('Set-Cookie', cookieLine(REFRESH_TOKEN_COOKIE, '', request, 0));
  return headers;
};

const mapFirebaseAuthError = (rawCode: string): HttpError => {
  const code = rawCode.split(' : ')[0];
  const known: Record<string, [number, string, string]> = {
    EMAIL_EXISTS: [409, '这个学号已经注册，请直接登录', 'ACCOUNT_EXISTS'],
    INVALID_LOGIN_CREDENTIALS: [401, '学号或密码错误', 'INVALID_CREDENTIALS'],
    EMAIL_NOT_FOUND: [401, '学号或密码错误', 'INVALID_CREDENTIALS'],
    INVALID_PASSWORD: [401, '学号或密码错误', 'INVALID_CREDENTIALS'],
    USER_DISABLED: [403, '此账号已被停用，请联系管理员', 'ACCOUNT_DISABLED'],
    TOO_MANY_ATTEMPTS_TRY_LATER: [429, '尝试次数过多，请稍后再试', 'RATE_LIMITED'],
    WEAK_PASSWORD: [400, '密码强度不足，请至少使用 8 位密码', 'WEAK_PASSWORD'],
    TOKEN_EXPIRED: [401, '登录已过期，请重新登录', 'SESSION_EXPIRED'],
    INVALID_ID_TOKEN: [401, '登录已过期，请重新登录', 'SESSION_EXPIRED']
  };
  const mapped = known[code] || [502, '身份服务暂时不可用，请稍后重试', 'IDENTITY_UNAVAILABLE'];
  return new HttpError(mapped[0], mapped[1], mapped[2]);
};

const firebaseAuthRequest = async <T>(endpoint: string, body: JsonRecord): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${encodeURIComponent(API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
  } catch {
    throw new HttpError(502, '身份服务连接失败，请稍后重试', 'IDENTITY_UNAVAILABLE');
  }
  const payload = await response.json().catch(() => ({})) as JsonRecord;
  if (!response.ok) {
    const error = payload.error as JsonRecord | undefined;
    throw mapFirebaseAuthError(String(error?.message || 'IDENTITY_UNAVAILABLE'));
  }
  return payload as T;
};

const refreshFirebaseToken = async (refreshToken: string): Promise<SessionTokens> => {
  let response: Response;
  try {
    response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
      }
    );
  } catch {
    throw new HttpError(502, '身份服务连接失败，请稍后重试', 'IDENTITY_UNAVAILABLE');
  }
  const payload = await response.json().catch(() => ({})) as JsonRecord;
  if (!response.ok || !payload.id_token) {
    const error = payload.error as JsonRecord | undefined;
    throw mapFirebaseAuthError(String(error?.message || 'TOKEN_EXPIRED'));
  }
  return {
    idToken: String(payload.id_token),
    refreshToken: String(payload.refresh_token || refreshToken),
    refreshed: true
  };
};

const decodeJwtPayload = (token: string): JsonRecord => {
  try {
    const encoded = token.split('.')[1];
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as JsonRecord;
  } catch {
    throw new HttpError(401, '登录状态无效，请重新登录', 'SESSION_EXPIRED');
  }
};

const getSessionTokens = async (request: Request): Promise<SessionTokens> => {
  const cookies = parseCookies(request);
  const idToken = cookies.get(ID_TOKEN_COOKIE);
  const refreshToken = cookies.get(REFRESH_TOKEN_COOKIE);
  if (!idToken && !refreshToken) {
    throw new HttpError(401, '请先登录', 'NOT_AUTHENTICATED');
  }

  if (idToken) {
    const claims = decodeJwtPayload(idToken);
    const expiresAt = Number(claims.exp || 0);
    if (expiresAt > Math.floor(Date.now() / 1000) + 60) {
      return { idToken, refreshToken };
    }
  }

  if (!refreshToken) {
    throw new HttpError(401, '登录已过期，请重新登录', 'SESSION_EXPIRED');
  }
  return refreshFirebaseToken(refreshToken);
};

const firestoreBase = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(PROJECT_ID)}/databases/${encodeURIComponent(DATABASE_ID)}/documents`;

const encodePathSegment = (value: string): string => encodeURIComponent(value);

const assertCollection = (collection: unknown): string => {
  const value = String(collection || '');
  if (!ALLOWED_COLLECTIONS.has(value)) {
    throw new HttpError(400, '不允许访问此数据集合', 'INVALID_COLLECTION');
  }
  return value;
};

const assertDocumentId = (id: unknown): string => {
  const value = String(id || '');
  if (!value || value.length > 1500 || value.includes('/')) {
    throw new HttpError(400, '数据编号无效', 'INVALID_DOCUMENT_ID');
  }
  return value;
};

const encodeValue = (value: unknown): FirestoreValue => {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    Object.entries(value as JsonRecord).forEach(([key, fieldValue]) => {
      if (fieldValue !== undefined) fields[key] = encodeValue(fieldValue);
    });
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
};

const decodeValue = (value: FirestoreValue | undefined): unknown => {
  if (!value) return undefined;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('stringValue' in value) return value.stringValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, fieldValue]) => [
        key,
        decodeValue(fieldValue)
      ])
    );
  }
  return undefined;
};

const encodeFields = (data: JsonRecord): Record<string, FirestoreValue> => {
  const fields: Record<string, FirestoreValue> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) fields[key] = encodeValue(value);
  });
  return fields;
};

const expandDottedFields = (data: JsonRecord): JsonRecord => {
  const result: JsonRecord = {};
  Object.entries(data).forEach(([path, value]) => {
    const segments = path.split('.');
    let cursor = result;
    segments.forEach((segment, index) => {
      if (index === segments.length - 1) {
        cursor[segment] = value;
      } else {
        const next = cursor[segment];
        if (!next || typeof next !== 'object' || Array.isArray(next)) cursor[segment] = {};
        cursor = cursor[segment] as JsonRecord;
      }
    });
  });
  return result;
};

const decodeDocument = (document: FirestoreDocument): JsonRecord => ({
  ...Object.fromEntries(
    Object.entries(document.fields || {}).map(([key, value]) => [key, decodeValue(value)])
  ),
  id: document.name.split('/').pop() || ''
});

const firestoreFetch = async (
  url: string,
  idToken: string,
  init?: RequestInit,
  allowedStatuses: number[] = []
): Promise<Response> => {
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${idToken}`);
    if (init?.body) headers.set('Content-Type', 'application/json');
    response = await fetch(url, { ...init, headers });
  } catch {
    throw new HttpError(502, '班级数据服务连接失败，请稍后重试', 'DATA_UNAVAILABLE');
  }
  if (!response.ok && !allowedStatuses.includes(response.status)) {
    const payload = await response.json().catch(() => ({})) as JsonRecord;
    const error = payload.error as JsonRecord | undefined;
    const message = String(error?.message || '班级数据请求失败');
    if (response.status === 401) {
      throw new HttpError(401, '登录已过期，请重新登录', 'SESSION_EXPIRED');
    }
    if (response.status === 403) {
      throw new HttpError(403, '没有执行此操作的权限', 'PERMISSION_DENIED');
    }
    throw new HttpError(response.status, message, 'FIRESTORE_ERROR');
  }
  return response;
};

const getDocument = async (
  idToken: string,
  collection: string,
  id: string
): Promise<{ data: JsonRecord; updateTime?: string } | null> => {
  const response = await firestoreFetch(
    `${firestoreBase}/${encodePathSegment(collection)}/${encodePathSegment(id)}`,
    idToken,
    undefined,
    [404]
  );
  if (response.status === 404) return null;
  const document = await response.json() as FirestoreDocument;
  return { data: decodeDocument(document), updateTime: document.updateTime };
};

const patchDocument = async (
  idToken: string,
  collection: string,
  id: string,
  data: JsonRecord,
  merge: boolean,
  updateTime?: string
): Promise<JsonRecord> => {
  const url = new URL(`${firestoreBase}/${encodePathSegment(collection)}/${encodePathSegment(id)}`);
  if (merge) {
    Object.keys(data).forEach((fieldPath) => url.searchParams.append('updateMask.fieldPaths', fieldPath));
  }
  if (updateTime) url.searchParams.set('currentDocument.updateTime', updateTime);
  const expanded = expandDottedFields(data);
  const response = await firestoreFetch(url.toString(), idToken, {
    method: 'PATCH',
    body: JSON.stringify({ fields: encodeFields(expanded) })
  });
  return decodeDocument(await response.json() as FirestoreDocument);
};

const addDocument = async (
  idToken: string,
  collection: string,
  data: JsonRecord
): Promise<JsonRecord> => {
  const response = await firestoreFetch(
    `${firestoreBase}/${encodePathSegment(collection)}`,
    idToken,
    {
      method: 'POST',
      body: JSON.stringify({ fields: encodeFields(data) })
    }
  );
  return decodeDocument(await response.json() as FirestoreDocument);
};

const listDocuments = async (
  idToken: string,
  collection: string,
  filters: Array<JsonRecord> = [],
  orderBy: Array<JsonRecord> = [],
  requestedLimit = 500
): Promise<JsonRecord[]> => {
  const limit = Math.max(1, Math.min(500, Number(requestedLimit) || 500));
  const fieldFilters = filters.map((filter) => ({
    fieldFilter: {
      field: { fieldPath: String(filter.field || '') },
      op: filter.op === 'array-contains' ? 'ARRAY_CONTAINS' : 'EQUAL',
      value: encodeValue(filter.value)
    }
  }));
  const structuredQuery: JsonRecord = {
    from: [{ collectionId: collection }],
    limit
  };
  if (fieldFilters.length === 1) structuredQuery.where = fieldFilters[0];
  if (fieldFilters.length > 1) {
    structuredQuery.where = { compositeFilter: { op: 'AND', filters: fieldFilters } };
  }
  if (orderBy.length) {
    structuredQuery.orderBy = orderBy.map((order) => ({
      field: { fieldPath: String(order.field || '') },
      direction: order.direction === 'desc' ? 'DESCENDING' : 'ASCENDING'
    }));
  }
  const response = await firestoreFetch(`${firestoreBase}:runQuery`, idToken, {
    method: 'POST',
    body: JSON.stringify({ structuredQuery })
  });
  const rows = await response.json() as Array<{ document?: FirestoreDocument }>;
  return rows.filter((row) => row.document).map((row) => decodeDocument(row.document!));
};

const deleteDocument = async (idToken: string, collection: string, id: string): Promise<void> => {
  await firestoreFetch(
    `${firestoreBase}/${encodePathSegment(collection)}/${encodePathSegment(id)}`,
    idToken,
    { method: 'DELETE' },
    [404]
  );
};

const transformDocument = async (
  idToken: string,
  collection: string,
  id: string,
  transforms: Array<JsonRecord>
): Promise<void> => {
  const documentName = `projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/${collection}/${id}`;
  const fieldTransforms = transforms.map((item) => {
    const values = Array.isArray(item.values) ? item.values.map(encodeValue) : [];
    if (item.operation === 'arrayRemove') {
      return { fieldPath: String(item.field || ''), removeAllFromArray: { values } };
    }
    return { fieldPath: String(item.field || ''), appendMissingElements: { values } };
  });
  await firestoreFetch(`${firestoreBase}:commit`, idToken, {
    method: 'POST',
    body: JSON.stringify({
      writes: [{ transform: { document: documentName, fieldTransforms } }]
    })
  });
};

const tokenIdentity = (idToken: string) => {
  const claims = decodeJwtPayload(idToken);
  const firebaseClaim = (claims.firebase || {}) as JsonRecord;
  const provider = String(firebaseClaim.sign_in_provider || 'password');
  const uid = String(claims.user_id || claims.sub || '');
  if (!uid) throw new HttpError(401, '登录状态无效，请重新登录', 'SESSION_EXPIRED');
  return {
    uid,
    email: String(claims.email || ''),
    emailVerified: claims.email_verified === true,
    provider
  };
};

const ownerProfile = (identity: ReturnType<typeof tokenIdentity>, existing?: JsonRecord): JsonRecord => ({
  ...Object.fromEntries(Object.entries(existing || {}).filter(([key]) => key !== 'id')),
  uid: identity.uid,
  authUid: identity.uid,
  name: String(existing?.name || '李班长（超级管理员）'),
  email: OWNER_EMAIL,
  studentId: '20260001',
  role: 'super_admin',
  approved: true,
  disabled: false,
  avatar: String(existing?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=class-owner'),
  birthday: String(existing?.birthday || '2008-01-01'),
  bio: String(existing?.bio || '班级空间超级管理员 / 班长'),
  phone: String(existing?.phone || ''),
  createdAt: String(existing?.createdAt || new Date().toISOString())
});

const fetchProfileByToken = async (
  idToken: string,
  requireApproved: boolean
): Promise<{ user: JsonRecord; profile: JsonRecord }> => {
  const identity = tokenIdentity(idToken);
  let profileResult = await getDocument(idToken, 'users', identity.uid);
  if (!profileResult) {
    const matches = await listDocuments(
      idToken,
      'users',
      [{ field: 'authUid', op: '==', value: identity.uid }],
      [],
      1
    );
    if (matches[0]) profileResult = { data: matches[0] };
  }

  const isOwner = identity.email.toLowerCase() === OWNER_EMAIL
    && identity.emailVerified
    && identity.provider === 'google.com';

  if (isOwner) {
    const canonical = ownerProfile(identity, profileResult?.data);
    if (!profileResult || profileResult.data.role !== 'super_admin' || profileResult.data.uid !== identity.uid) {
      await patchDocument(idToken, 'users', identity.uid, canonical, true);
    }
    return {
      user: {
        uid: identity.uid,
        email: OWNER_EMAIL,
        emailVerified: true,
        displayName: canonical.name,
        photoURL: canonical.avatar,
        isAnonymous: false,
        providerData: [{ providerId: 'google.com' }]
      },
      profile: canonical
    };
  }

  let profile = profileResult?.data
    ? Object.fromEntries(Object.entries(profileResult.data).filter(([key]) => key !== 'id'))
    : undefined;
  if (!profile || profile.authUid !== identity.uid) {
    throw new HttpError(403, '找不到与此登录账号匹配的注册申请', 'PROFILE_NOT_FOUND');
  }
  if (requireApproved && profile.approved !== true) {
    if (profile.disabled === true) {
      throw new HttpError(403, '注册申请未通过，请联系管理员核对姓名和学号', 'REGISTRATION_REJECTED');
    }
    throw new HttpError(403, '注册申请正在等待管理员审批，批准后即可登录', 'PENDING_APPROVAL');
  }
  if (requireApproved && profile.disabled === true) {
    throw new HttpError(403, '此账号的班级访问权限已被管理员撤销', 'ACCOUNT_DISABLED');
  }

  // Approved legacy profiles may still be stored under a student-number document.
  // Migrate them to the Firebase UID while the original document still proves the link.
  const legacyDocumentId = String(profileResult?.data.id || '');
  if (
    requireApproved
    && profile.approved === true
    && legacyDocumentId
    && legacyDocumentId !== identity.uid
  ) {
    const { password: _password, passwordHash: _passwordHash, ...safeProfile } = profile;
    const canonical = {
      ...safeProfile,
      uid: identity.uid,
      authUid: identity.uid,
      role: profile.role === 'super_admin' ? 'member' : profile.role
    };
    await patchDocument(idToken, 'users', identity.uid, canonical, false);
    profile = canonical;
  } else if (profile.role === 'super_admin') {
    profile = { ...profile, role: 'member' };
  }

  return {
    user: {
      uid: identity.uid,
      email: identity.email,
      emailVerified: identity.emailVerified,
      displayName: profile.name,
      photoURL: profile.avatar,
      isAnonymous: false,
      providerData: [{ providerId: identity.provider }]
    },
    profile
  };
};

const getStudentEmail = (studentId: string): string =>
  `stu_${studentId.trim().toLowerCase()}@class.student.internal`;

const handleLogin = async (request: Request): Promise<Response> => {
  const body = await readJson(request);
  const studentId = String(body.studentId || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[a-z0-9_-]{2,32}$/.test(studentId) || !password) {
    throw new HttpError(400, '请输入正确的学号和密码', 'INVALID_INPUT');
  }
  const authResult = await firebaseAuthRequest<FirebaseAuthResult>('signInWithPassword', {
    email: getStudentEmail(studentId),
    password,
    returnSecureToken: true
  });
  const session = await fetchProfileByToken(authResult.idToken, true);
  return success(
    session,
    sessionHeaders(request, {
      idToken: authResult.idToken,
      refreshToken: authResult.refreshToken
    })
  );
};

const handleRegistration = async (request: Request): Promise<Response> => {
  const body = await readJson(request);
  const studentId = String(body.studentId || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[a-z0-9_-]{2,32}$/.test(studentId)) {
    throw new HttpError(400, '学号需为 2-32 位字母、数字、下划线或短横线', 'INVALID_STUDENT_ID');
  }
  if (!name || name.length > 40) {
    throw new HttpError(400, '请输入 1-40 个字的真实姓名', 'INVALID_NAME');
  }
  if (email.length > 120) {
    throw new HttpError(400, '联系邮箱过长', 'INVALID_EMAIL');
  }
  if (password.length < 8) {
    throw new HttpError(400, '密码至少需要 8 位', 'WEAK_PASSWORD');
  }

  const authResult = await firebaseAuthRequest<FirebaseAuthResult>('signUp', {
    email: getStudentEmail(studentId),
    password,
    returnSecureToken: true
  });
  const profile: JsonRecord = {
    uid: authResult.localId,
    authUid: authResult.localId,
    name,
    email,
    studentId,
    role: 'member',
    approved: false,
    disabled: false,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=applicant_${encodeURIComponent(studentId)}`,
    bio: '等待管理员审批',
    createdAt: new Date().toISOString()
  };
  try {
    await patchDocument(authResult.idToken, 'users', authResult.localId, profile, false);
  } catch (error) {
    await firebaseAuthRequest('delete', { idToken: authResult.idToken }).catch(() => undefined);
    throw error;
  }
  return success({ registered: true }, clearSessionHeaders(request));
};

const handleFirebaseSession = async (request: Request): Promise<Response> => {
  const body = await readJson(request);
  const idToken = String(body.idToken || '');
  const refreshToken = String(body.refreshToken || '');
  if (!idToken) throw new HttpError(400, '缺少管理员身份令牌', 'INVALID_INPUT');
  const session = await fetchProfileByToken(idToken, true);
  if (session.profile.role !== 'super_admin') {
    throw new HttpError(403, '只有指定管理员 Google 账号可以进入管理空间', 'ADMIN_REQUIRED');
  }
  return success(session, sessionHeaders(request, { idToken, refreshToken }));
};

const handleSession = async (request: Request): Promise<Response> => {
  const tokens = await getSessionTokens(request);
  const session = await fetchProfileByToken(tokens.idToken, true);
  return success(session, tokens.refreshed ? sessionHeaders(request, tokens) : undefined);
};

const handleManagedUser = async (request: Request): Promise<Response> => {
  const adminTokens = await getSessionTokens(request);
  const adminSession = await fetchProfileByToken(adminTokens.idToken, true);
  if (adminSession.profile.role !== 'super_admin') {
    throw new HttpError(403, '只有超级管理员可以创建成员账号', 'ADMIN_REQUIRED');
  }
  const body = await readJson(request);
  const studentId = String(body.studentId || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const role = body.role === 'committee' ? 'committee' : 'member';
  if (!/^[a-z0-9_-]{2,32}$/.test(studentId) || !name || name.length > 40) {
    throw new HttpError(400, '请填写有效的学号和姓名', 'INVALID_INPUT');
  }
  if (password.length < 8) {
    throw new HttpError(400, '初始密码至少需要 8 位', 'WEAK_PASSWORD');
  }

  let created: FirebaseAuthResult;
  try {
    created = await firebaseAuthRequest<FirebaseAuthResult>('signUp', {
      email: getStudentEmail(studentId),
      password,
      returnSecureToken: true
    });
  } catch (error) {
    if (!(error instanceof HttpError) || error.code !== 'ACCOUNT_EXISTS') throw error;
    created = await firebaseAuthRequest<FirebaseAuthResult>('signInWithPassword', {
      email: getStudentEmail(studentId),
      password,
      returnSecureToken: true
    });
  }

  const profile: JsonRecord = {
    uid: created.localId,
    authUid: created.localId,
    name,
    email: email || `${studentId}@class.local`,
    studentId,
    role,
    approved: true,
    disabled: false,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=student_${encodeURIComponent(studentId)}`,
    birthday: '2008-06-15',
    bio: '班级成员',
    createdAt: new Date().toISOString()
  };
  await patchDocument(adminTokens.idToken, 'users', created.localId, profile, true);
  return success(profile, adminTokens.refreshed ? sessionHeaders(request, adminTokens) : undefined);
};

const handleFirestore = async (request: Request): Promise<Response> => {
  const tokens = await getSessionTokens(request);
  const body = await readJson(request);
  const action = String(body.action || '');
  const collection = assertCollection(body.collection);
  let data: unknown;

  if (action === 'get') {
    data = (await getDocument(tokens.idToken, collection, assertDocumentId(body.id)))?.data || null;
  } else if (action === 'list') {
    data = await listDocuments(
      tokens.idToken,
      collection,
      Array.isArray(body.filters) ? body.filters as JsonRecord[] : [],
      Array.isArray(body.orderBy) ? body.orderBy as JsonRecord[] : [],
      Number(body.limit || 500)
    );
  } else if (action === 'add') {
    data = await addDocument(tokens.idToken, collection, (body.data || {}) as JsonRecord);
  } else if (action === 'set' || action === 'update') {
    data = await patchDocument(
      tokens.idToken,
      collection,
      assertDocumentId(body.id),
      (body.data || {}) as JsonRecord,
      action === 'update' || body.merge === true
    );
  } else if (action === 'delete') {
    await deleteDocument(tokens.idToken, collection, assertDocumentId(body.id));
    data = { deleted: true };
  } else if (action === 'transform') {
    await transformDocument(
      tokens.idToken,
      collection,
      assertDocumentId(body.id),
      Array.isArray(body.transforms) ? body.transforms as JsonRecord[] : []
    );
    data = { updated: true };
  } else {
    throw new HttpError(400, '不支持的数据操作', 'INVALID_ACTION');
  }

  return success(data, tokens.refreshed ? sessionHeaders(request, tokens) : undefined);
};

const handleVote = async (request: Request): Promise<Response> => {
  const tokens = await getSessionTokens(request);
  const identity = tokenIdentity(tokens.idToken);
  const body = await readJson(request);
  const pollId = assertDocumentId(body.pollId);
  const optionIds = Array.isArray(body.optionIds) ? body.optionIds.map(String) : [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const latest = await getDocument(tokens.idToken, 'polls', pollId);
    if (!latest) throw new HttpError(404, '找不到这项投票', 'POLL_NOT_FOUND');
    const options = Array.isArray(latest.data.options) ? latest.data.options as JsonRecord[] : [];
    const updatedOptions = options.map((option) => {
      const voters = Array.isArray(option.voterUids) ? option.voterUids.map(String) : [];
      const next = voters.filter((uid) => uid !== identity.uid);
      if (optionIds.includes(String(option.id))) next.push(identity.uid);
      return { ...option, voterUids: Array.from(new Set(next)) };
    });
    try {
      await patchDocument(
        tokens.idToken,
        'polls',
        pollId,
        { options: updatedOptions },
        true,
        latest.updateTime
      );
      return success(
        { updated: true },
        tokens.refreshed ? sessionHeaders(request, tokens) : undefined
      );
    } catch (error) {
      if (!(error instanceof HttpError) || ![409, 412].includes(error.status) || attempt === 2) {
        throw error;
      }
    }
  }
  throw new HttpError(409, '投票更新冲突，请重试', 'VOTE_CONFLICT');
};

const routeApi = async (request: Request): Promise<Response> => {
  assertSameOriginWrite(request);
  const url = new URL(request.url);
  const route = `${request.method} ${url.pathname}`;

  if (route === 'GET /api/health') {
    return success({ service: 'class-space-worker', time: new Date().toISOString() });
  }
  if (route === 'POST /api/auth/login') return handleLogin(request);
  if (route === 'POST /api/auth/register') return handleRegistration(request);
  if (route === 'POST /api/auth/firebase-session') return handleFirebaseSession(request);
  if (route === 'GET /api/auth/session') return handleSession(request);
  if (route === 'POST /api/auth/logout') {
    return success({ loggedOut: true }, clearSessionHeaders(request));
  }
  if (route === 'POST /api/auth/managed-user') return handleManagedUser(request);
  if (route === 'POST /api/firestore') return handleFirestore(request);
  if (route === 'POST /api/polls/vote') return handleVote(request);
  throw new HttpError(404, '接口不存在', 'NOT_FOUND');
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      return await routeApi(request);
    } catch (error) {
      const httpError = error instanceof HttpError
        ? error
        : new HttpError(500, '服务器处理请求时发生错误', 'INTERNAL_ERROR');
      const logDetails = {
        path: url.pathname,
        code: httpError.code,
        message: error instanceof Error ? error.message : String(error)
      };
      if (httpError.status >= 500) console.error('[api]', logDetails);
      else if (!['NOT_AUTHENTICATED', 'INVALID_CREDENTIALS'].includes(httpError.code)) {
        console.warn('[api]', logDetails);
      }
      const headers = httpError.status === 401 ? clearSessionHeaders(request) : undefined;
      return jsonResponse(
        { ok: false, error: httpError.message, code: httpError.code },
        httpError.status,
        headers
      );
    }
  }
};
