const BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? '/api'
  : 'http://localhost:5001/api';

function token() { return localStorage.getItem('token') || ''; }

async function req(method, path, body, isForm = false) {
  const headers = { Authorization: `Bearer ${token()}` };
  if (!isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : (body ? JSON.stringify(body) : undefined)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'خطأ في الخادم');
  return data;
}

const api = {
  login: (email, password) => req('POST', '/auth/login', { email, password }),
  register: (data) => req('POST', '/auth/register', data),

  getRequests: () => req('GET', '/requests'),
  getAdminRequests: () => req('GET', '/admin/requests'),
  getAdminStats: () => req('GET', '/admin/stats'),
  getAdminUsers: () => req('GET', '/admin/users'),
  updateUserStatus: (userId, status) => req('PUT', `/admin/users/${userId}/status`, { status }),
  getTeamOverview: () => req('GET', '/admin/team-overview'),
  getSettings: () => req('GET', '/settings'),
  updateSettings: (data) => req('PUT', '/settings', data),
  createRequest: (data) => req('POST', '/requests', data),
  getRequest: (id) => req('GET', `/requests/${id}`),

  // كشوفات الحساب البنكية (PDF)
  uploadBankStatements: (id, files) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    return req('POST', `/requests/${id}/bank-statements`, fd, true);
  },

  // كشوفات الحساب (Excel)
  uploadAccountStatements: (id, files) => {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    return req('POST', `/requests/${id}/account-statements`, fd, true);
  },

  // رفع مستند واحد بالاسم
  uploadDocument: (reqId, docId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return req('POST', `/requests/${reqId}/documents/${docId}/upload`, fd, true);
  },

  // إقرار ضريبي بسنة محددة
  uploadTaxDeclaration: (id, yearLabel, file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('year_label', yearLabel);
    return req('POST', `/requests/${id}/tax-declarations`, fd, true);
  },

  // قائمة مالية بسنة محددة
  uploadFinancialStatement: (id, yearLabel, file) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('year_label', yearLabel);
    return req('POST', `/requests/${id}/financial-statements`, fd, true);
  },

  // تجميع وإرسال الطلب النهائي للمدير (3 ملفات ZIP)
  finalizeSubmission: (id) => req('POST', `/requests/${id}/finalize-submission`),

  // ===== أدمن: إدارة خانات المستندات =====
  adminAddDocument:    (requestId, name)        => req('POST',   `/admin/requests/${requestId}/documents`,       { document_name: name }),
  adminUpdateDocument: (requestId, docId, name) => req('PUT',    `/admin/requests/${requestId}/documents/${docId}`, { document_name: name }),
  adminDeleteDocument: (requestId, docId)       => req('DELETE', `/admin/requests/${requestId}/documents/${docId}`),

  // ===== الرسائل =====
  getMessages:   (requestId)          => req('GET',  `/requests/${requestId}/messages`),
  sendMessage:   (requestId, message) => req('POST', `/requests/${requestId}/messages`, { message }),
  getMessageReadState:  (requestId) => req('GET', `/requests/${requestId}/messages/read-state`),
  markMessagesRead:    (requestId, lastReadAt) => req('POST', `/requests/${requestId}/messages/mark-read`, { last_read_at: lastReadAt }),
  adminGetMessages:    (requestId) => req('GET',  `/admin/requests/${requestId}/messages`),
  adminSendMessage:    (requestId, message) => req('POST', `/admin/requests/${requestId}/messages`, { message }),
  adminGetMessageReadState: (requestId) => req('GET', `/admin/requests/${requestId}/messages/read-state`),
  adminMarkMessagesRead:   (requestId, lastReadAt) => req('POST', `/admin/requests/${requestId}/messages/mark-read`, { last_read_at: lastReadAt }),

  // ===== الرسائل الجماعية =====
  getBroadcastMessages: () => req('GET', '/requests/broadcast-messages'),
  getBroadcastReadState: () => req('GET', '/requests/broadcast-messages/read-state'),
  markBroadcastRead:    (lastReadAt) => req('POST', '/requests/broadcast-messages/mark-read', { last_read_at: lastReadAt }),
  getUnreadSummary: () => req('GET', '/requests/unread-summary'),
  adminGetBroadcastMessages: () => req('GET', '/admin/broadcast-messages'),
  adminSendBroadcastMessage: (payload) => req('POST', '/admin/broadcast-messages', payload),
  adminDeleteBroadcast: (id) => req('DELETE', `/admin/broadcast-messages/${id}`),

  submitFile: (id, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return req('POST', `/requests/${id}/submit-file`, fd, true);
  },

  // ===== Admin Request Detail (with funding entity info) =====
  adminGetRequestDetail: (id) => req('GET', `/admin/requests/${id}`),

  // ===== Admin Status Update =====
  adminUpdateRequestStatus: (id, status, note, rejection_reason) =>
    req('PUT', `/admin/requests/${id}/status`, { status, note, rejection_reason }),

  // ===== Admin Assign Funding Entity =====
  adminAssignFundingEntity: (id, funding_entity_id) =>
    req('PUT', `/admin/requests/${id}/assign-entity`, { funding_entity_id }),

  // ===== Users Management (Admin) =====
  adminGetUsers: () => req('GET', '/admin/users'),
  adminUpdateUserStatus: (id, status) => req('PUT', `/admin/users/${id}/status`, { status }),
  adminDeleteUser: (id) => req('DELETE', `/admin/users/${id}`),

  // ===== Funding Entities =====
  adminGetFundingEntities: () => req('GET', '/admin/funding-entities'),
  adminAddFundingEntity: (data) => req('POST', '/admin/funding-entities', data),
  adminUpdateFundingEntity: (id, data) => req('PUT', `/admin/funding-entities/${id}`, data),
  adminDeleteFundingEntity: (id) => req('DELETE', `/admin/funding-entities/${id}`),

  // ===== Funding Entity Contacts =====
  adminGetContacts: (entity_id) => req('GET', `/admin/contacts${entity_id ? `?entity_id=${entity_id}` : ''}`),
  adminAddContact: (data) => req('POST', '/admin/contacts', data),
  adminUpdateContact: (id, data) => req('PUT', `/admin/contacts/${id}`, data),
  adminDeleteContact: (id) => req('DELETE', `/admin/contacts/${id}`),

  // ===== Companies =====
  adminGetCompanies: (search) => req('GET', `/admin/companies${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  // ===== Brokers =====
  getBrokers: () => req('GET', '/brokers'),
  addBroker: (data) => req('POST', '/brokers', data),
  deleteBroker: (id) => req('DELETE', `/brokers/${id}`),

  // ===== Attendance =====
  getAttendance: () => req('GET', '/attendance'),
  getTodayAttendance: () => req('GET', '/attendance/today'),
  checkIn: () => req('POST', '/attendance/check-in', {}),
  checkOut: () => req('POST', '/attendance/check-out', {}),
};

export default api;

