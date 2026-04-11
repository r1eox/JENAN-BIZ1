import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

// ── السنوات الثلاث الأخيرة للإقرارات والقوائم ──
const CY = new Date().getFullYear();
const TAX_YEARS  = [`إقرار ${CY - 1}`, `إقرار ${CY - 2}`, `إقرار ${CY - 3}`];
const FIN_YEARS  = [`قوائم ${CY - 1}`, `قوائم ${CY - 2}`];

// ── بادج الحالة ──
const STATUS_MAP = {
  draft:            { label: 'مسودة',                      color: 'bg-slate-100 text-slate-600' },
  bank_uploaded:    { label: 'كشوفات مرفوعة',              color: 'bg-blue-100 text-blue-700' },
  docs_pending:     { label: 'مستندات مطلوبة',             color: 'bg-yellow-100 text-yellow-700' },
  docs_ready:       { label: 'مستندات جاهزة',              color: 'bg-teal-100 text-teal-700' },
  file_submitted:   { label: 'مُرسَل للمدير ✓',            color: 'bg-purple-100 text-purple-700' },
  sent_to_entity:   { label: 'مُرسَل للجهة التمويلية ✓',   color: 'bg-indigo-100 text-indigo-700' },
  approved:         { label: 'موافقة ✓',                   color: 'bg-green-100 text-green-700' },
  contract_signed:  { label: 'تم التوقيع ✓',               color: 'bg-emerald-100 text-emerald-700' },
  contract_submitted: { label: 'عقد مُرسَل',               color: 'bg-teal-100 text-teal-700' },
  contract_received:  { label: 'عقد مُستلَم',              color: 'bg-teal-100 text-teal-700' },
  transferred:      { label: 'تم تحويل التمويل 🎉',        color: 'bg-green-200 text-green-800' },
  fees_received:    { label: 'تم استلام الرسوم',            color: 'bg-green-100 text-green-700' },
  missing:          { label: 'يوجد نواقص ⚠️',              color: 'bg-orange-100 text-orange-700' },
  rejected:         { label: 'مرفوض',                      color: 'bg-red-100 text-red-700' },
};

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, color: 'bg-slate-100 text-slate-600' };
  return <span className={`px-3 py-1 rounded-full text-xs font-bold ${s.color}`}>{s.label}</span>;
}

// ── خانة رفع ملف واحد ──
function SingleSlot({ label, sublabel, accept, existingFile, onUpload, disabled }) {
  const inputRef = useRef();
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  const handle = async (file) => {
    if (!file) return;
    setLoading(true); setErr('');
    try { await onUpload(file); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const uploaded = !!existingFile;

  return (
    <div
      onClick={() => !disabled && !loading && inputRef.current?.click()}
      className={`relative flex items-center gap-3 rounded-xl border-2 p-4 cursor-pointer transition
        ${uploaded ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50'}
        ${disabled ? 'opacity-60 cursor-default' : ''}`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-lg flex-shrink-0
        ${uploaded ? 'bg-green-100' : 'bg-slate-100'}`}>
        {loading ? '⏳' : uploaded ? '✅' : '📄'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-700">{label}</p>
        {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
        {uploaded && <p className="text-xs text-green-600 truncate mt-0.5">✓ {existingFile}</p>}
        {err && <p className="text-xs text-red-500 mt-0.5">⚠ {err}</p>}
      </div>
      {!uploaded && !loading && (
        <span className="text-xs text-blue-600 font-semibold flex-shrink-0">رفع ↑</span>
      )}
      <input ref={inputRef} type="file" className="hidden" accept={accept}
        onChange={e => handle(e.target.files?.[0])} />
    </div>
  );
}

// ── خانة رفع متعددة (للكشوفات) ──
function MultiSlot({ label, sublabel, accept, existingFiles, onUpload }) {
  const inputRef = useRef();
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [ok, setOk]           = useState('');

  const handle = async (files) => {
    if (!files?.length) return;
    setLoading(true); setErr(''); setOk('');
    try { const r = await onUpload(Array.from(files)); setOk(r.message || 'تم الرفع'); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-bold text-slate-700">{label}</p>
          {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={loading}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'جاري...' : 'رفع ↑'}
        </button>
      </div>
      {ok  && <p className="text-xs text-green-600 mb-2">✓ {ok}</p>}
      {err && <p className="text-xs text-red-500 mb-2">⚠ {err}</p>}
      {existingFiles?.length > 0 && (
        <div className="space-y-1.5">
          {existingFiles.map(f => (
            <div key={f.id} className="flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
              <span>✓</span><span className="truncate">{f.file_name}</span>
            </div>
          ))}
        </div>
      )}
      <input ref={inputRef} type="file" className="hidden" multiple accept={accept}
        onChange={e => handle(e.target.files)} />
    </div>
  );
}

// ── قسم أكورديون ──
function Section({ icon, title, badgeCount, total, isOpen, onToggle, children, color = 'blue' }) {
  const done   = badgeCount;
  const pct    = total > 0 ? Math.round((done / total) * 100) : 0;
  const allOk  = total > 0 && done >= total;
  const colors = { blue: 'border-blue-200 bg-blue-50', green: 'border-green-200 bg-green-50', purple: 'border-purple-200 bg-purple-50', amber: 'border-amber-200 bg-amber-50' };
  const hdr    = { blue: 'text-blue-800', green: 'text-green-800', purple: 'text-purple-800', amber: 'text-amber-800' };

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${allOk ? 'border-green-300' : 'border-slate-200'} bg-white shadow-sm`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-5 text-right transition
          ${isOpen ? colors[color] : 'bg-white hover:bg-slate-50'}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="text-right">
            <p className={`font-bold text-base ${isOpen ? hdr[color] : 'text-slate-700'}`}>{title}</p>
            {total > 0 && (
              <p className="text-xs text-slate-400 mt-0.5">
                {done} / {total} {allOk ? '— مكتمل ✓' : ''}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 && (
            <div className="w-24 bg-slate-200 rounded-full h-2">
              <div className={`h-2 rounded-full transition-all ${allOk ? 'bg-green-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }} />
            </div>
          )}
          <span className={`text-slate-400 text-sm transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
        </div>
      </button>
      {isOpen && <div className="p-5 border-t border-slate-100 space-y-3">{children}</div>}
    </div>
  );
}

// ── الخط الزمني لتتبع حالة الطلب (للموظف) ──
const TIMELINE_STEPS = [
  { key: 'draft',           label: 'تم إنشاء الطلب',              icon: '📝', statuses: ['draft', 'bank_uploaded', 'docs_pending', 'docs_ready', 'analyzing', 'analyzed'] },
  { key: 'file_submitted',  label: 'تم الإرسال للمدير',           icon: '📤', statuses: ['file_submitted'] },
  { key: 'sent_to_entity',  label: 'تم الإرسال للجهة التمويلية', icon: '🏦', statuses: ['sent_to_entity', 'submitted', 'approved', 'forms_ready', 'forms_sent'] },
  { key: 'contract',        label: 'تم التوقيع على العقد',        icon: '✍️', statuses: ['contract_submitted', 'contract_received', 'contract_signed'] },
  { key: 'transferred',     label: 'تم تحويل مبلغ التمويل',      icon: '💰', statuses: ['transferred', 'fees_received'] },
];

function StatusTimeline({ status }) {
  if (!status || status === 'rejected') return null;

  const missingActive = status === 'missing' || status === 'missing_submitted';

  // تحديد الخطوة الحالية
  let activeStep = 0;
  for (let i = TIMELINE_STEPS.length - 1; i >= 0; i--) {
    if (TIMELINE_STEPS[i].statuses.includes(status)) { activeStep = i; break; }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-bold text-slate-600 mb-4">📍 تتبع حالة الطلب</h3>

      {missingActive && (
        <div className="mb-4 flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-bold text-orange-800">يوجد نواقص في ملفك</p>
            <p className="text-xs text-orange-600">يرجى راجعة المحادثة أدناه لمعرفة المطلوب</p>
          </div>
        </div>
      )}

      <div className="relative">
        {/* خط رأسي */}
        <div className="absolute right-5 top-5 bottom-5 w-0.5 bg-slate-200" />
        <div className="space-y-4">
          {TIMELINE_STEPS.map((step, idx) => {
            const done    = idx < activeStep;
            const current = idx === activeStep;
            return (
              <div key={step.key} className="flex items-center gap-4 relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 z-10 border-2
                  ${done    ? 'bg-green-500 border-green-500 text-white'
                  : current ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100'
                  :           'bg-white border-slate-200 text-slate-300'}`}>
                  {done ? '✓' : step.icon}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${done ? 'text-green-700' : current ? 'text-blue-800' : 'text-slate-400'}`}>
                    {step.label}
                  </p>
                  {current && !missingActive && <p className="text-xs text-blue-500 mt-0.5">الحالة الحالية</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── موداl إرسال الطلب للجهة التمويلية (للأدمن) ──
function SendToEntityModal({ request, onClose, onSent }) {
  const [entities,   setEntities]   = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [sending,    setSending]    = useState(false);
  const [err,        setErr]        = useState('');

  useEffect(() => {
    api.adminGetFundingEntities().then(setEntities).catch(() => {});
  }, []);

  const selectedEntity = entities.find(e => String(e.id) === String(selectedId));

  const handleSend = async () => {
    if (!selectedId) return;
    setSending(true); setErr('');
    try {
      await api.adminAssignFundingEntity(request.id, selectedId);
      onSent(selectedEntity);
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  };

  const waMessage = selectedEntity
    ? encodeURIComponent(
        `*طلب تمويل جديد* 🏢\n\n` +
        `الشركة: ${request.company_name}\n` +
        `نوع المنشأة: ${request.entity_type || '—'}\n` +
        `ملكية: ${request.ownership_type || '—'}\n` +
        `نوع التمويل: ${request.funding_type || '—'}\n` +
        (request.owner_name  ? `المالك: ${request.owner_name}\n`     : '') +
        (request.owner_phone ? `جوال المالك: ${request.owner_phone}\n` : '') +
        (request.user_name   ? `الموظف: ${request.user_name}\n`     : '') +
        `\nجاهز للمراجعة ✅`
      )
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-blue-900 text-lg">📤 إرسال الطلب للجهة التمويلية</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
        </div>

        {/* معلومات الطلب */}
        <div className="bg-slate-50 rounded-xl p-4 mb-5 text-sm space-y-1">
          <p><span className="text-slate-400">الشركة: </span><span className="font-semibold">{request.company_name}</span></p>
          {request.user_name  && <p><span className="text-slate-400">الموظف: </span>{request.user_name}</p>}
          {request.owner_name && <p><span className="text-slate-400">المالك: </span>{request.owner_name}</p>}
          <p><span className="text-slate-400">نوع التمويل: </span>{request.funding_type || '—'}</p>
        </div>

        {/* اختيار الجهة */}
        <label className="block text-sm font-semibold text-slate-700 mb-2">اختر جهة التمويل:</label>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
        >
          <option value="">— اختر جهة التمويل —</option>
          {entities.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        {err && <p className="text-red-500 text-xs mb-3">⚠ {err}</p>}

        <div className="flex gap-3">
          {/* زر الإرسال + تحديث الحالة */}
          <button
            onClick={handleSend}
            disabled={sending || !selectedId}
            className="flex-1 bg-blue-700 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-800 disabled:opacity-50 transition"
          >
            {sending ? '⏳ جاري...' : '✓ تأكيد الإرسال'}
          </button>

          {/* زر واتساب (يفتح بعد اختيار الجهة) */}
          {selectedEntity?.whatsapp_number && (
            <a
              href={`https://wa.me/${selectedEntity.whatsapp_number.replace(/\D/g, '')}?text=${waMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500 text-white px-4 py-3 rounded-xl font-bold text-sm hover:bg-green-600 transition"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              واتساب
            </a>
          )}

          <button onClick={onClose} className="px-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}


function AdminDocManager({ requestId, docs, onRefresh }) {
  const [newName,    setNewName]    = useState('');
  const [adding,     setAdding]     = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [editName,   setEditName]   = useState('');
  const [saving,     setSaving]     = useState(false);
  const [err,        setErr]        = useState('');

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true); setErr('');
    try { await api.adminAddDocument(requestId, newName.trim()); setNewName(''); onRefresh(); }
    catch (e) { setErr(e.message); }
    finally { setAdding(false); }
  };

  const handleEdit = async (docId) => {
    if (!editName.trim()) return;
    setSaving(true); setErr('');
    try { await api.adminUpdateDocument(requestId, docId, editName.trim()); setEditId(null); onRefresh(); }
    catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('هل تريد حذف هذا المستند؟')) return;
    setErr('');
    try { await api.adminDeleteDocument(requestId, docId); onRefresh(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">🔧 أدمن — إدارة المستندات</p>

      {err && <p className="text-xs text-red-600">⚠ {err}</p>}

      {/* قائمة المستندات مع تعديل/حذف */}
      {docs.map(doc => (
        <div key={doc.id} className="flex items-center gap-2">
          {editId === doc.id ? (
            <>
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEdit(doc.id)}
                className="flex-1 text-sm border border-blue-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={() => handleEdit(doc.id)}
                disabled={saving}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >{saving ? '...' : 'حفظ'}</button>
              <button
                onClick={() => setEditId(null)}
                className="text-xs text-slate-500 hover:text-slate-700 px-2"
              >إلغاء</button>
            </>
          ) : (
            <>
              <span className="flex-1 text-sm text-slate-700 truncate">{doc.document_name}</span>
              <button
                onClick={() => { setEditId(doc.id); setEditName(doc.document_name); setErr(''); }}
                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-100"
                title="تعديل الاسم"
              >✏️</button>
              <button
                onClick={() => handleDelete(doc.id)}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-100"
                title="حذف المستند"
              >🗑️</button>
            </>
          )}
        </div>
      ))}

      {/* إضافة مستند جديد */}
      <div className="flex items-center gap-2 pt-2 border-t border-blue-200">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="اسم المستند الجديد..."
          className="flex-1 text-sm border border-blue-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newName.trim()}
          className="text-xs bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
        >{adding ? '...' : '+ إضافة'}</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  الصفحة الرئيسية
// ═══════════════════════════════════════════════════════════════
export default function RequestDetail() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin   = user?.role === 'admin';

  const [request,  setRequest]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState('');
  const [openSec,  setOpenSec]  = useState(null);
  const [sending,  setSending]  = useState(false);
  const [sendMsg,  setSendMsg]  = useState('');
  const [sendErr,  setSendErr]  = useState('');
  const [showSendModal, setShowSendModal] = useState(false);
  const [skipFinancial, setSkipFinancial] = useState(false);

  // ── الرسائل ──
  const [messages,    setMessages]    = useState([]);
  const [msgText,     setMsgText]     = useState('');
  const [msgSending,  setMsgSending]  = useState(false);
  const [messageLastSeenAt, setMessageLastSeenAt] = useState(0);
  const msgEndRef = useRef(null);

  const isOwnMessage = useCallback((msg) => (
    (isAdmin && msg.sender_role === 'admin') || (!isAdmin && msg.sender_role !== 'admin')
  ), [isAdmin]);

  const fetchRequest = async () => {
    try {
      const d = isAdmin ? await api.adminGetRequestDetail(id) : await api.getRequest(id);
      setRequest(d);
    }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const fetchMessages = useCallback(async () => {
    try {
      const msgs = isAdmin ? await api.adminGetMessages(id) : await api.getMessages(id);
      setMessages(msgs);
      setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (_) {}
  }, [id, isAdmin]);

  const handleSendMessage = async () => {
    const text = msgText.trim();
    if (!text) return;
    setMsgSending(true);
    try {
      if (isAdmin) { await api.adminSendMessage(id, text); }
      else         { await api.sendMessage(id, text); }
      setMsgText('');
      fetchMessages();
    } catch (_) {}
    finally { setMsgSending(false); }
  };

  useEffect(() => { fetchRequest(); }, [id]);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  useEffect(() => {
    const fn = isAdmin ? api.adminGetMessageReadState : api.getMessageReadState;
    fn(id)
      .then(r => setMessageLastSeenAt(r.last_read_at ? new Date(r.last_read_at).getTime() : 0))
      .catch(() => {});
  }, [id, isAdmin]);

  useEffect(() => {
    if (messages.length === 0) return;
    const latestForeignMessageAt = Math.max(
      ...messages
        .filter(msg => !isOwnMessage(msg))
        .map(msg => new Date(msg.created_at).getTime())
        .filter(Boolean)
    );
    if (!latestForeignMessageAt || latestForeignMessageAt <= messageLastSeenAt) return;
    const timer = setTimeout(async () => {
      const lastReadAtIso = new Date(latestForeignMessageAt).toISOString();
      try {
        if (isAdmin) await api.adminMarkMessagesRead(id, lastReadAtIso);
        else await api.markMessagesRead(id, lastReadAtIso);
        setMessageLastSeenAt(latestForeignMessageAt);
      } catch (_) {}
    }, 1800);
    return () => clearTimeout(timer);
  }, [id, isAdmin, isOwnMessage, messageLastSeenAt, messages]);

  const toggle = (sec) => setOpenSec(v => v === sec ? null : sec);

  // ── حساب التقدم ──
  const bankFiles    = request?.bank_statements || [];
  const accFiles     = request?.account_statements || [];
  const taxDecls     = request?.tax_declarations || [];
  const finStmts     = request?.financial_statements || [];
  const docsList     = request?.documents || [];
  const docsUploaded = docsList.filter(d => d.file_path || d.status === 'valid').length;

  const uploadedTaxByYear = {};
  taxDecls.forEach(t => { uploadedTaxByYear[t.year_label] = t; });
  const uploadedFinByYear = {};
  finStmts.forEach(f => { uploadedFinByYear[f.year_label] = f; });

  const statementsCount = (bankFiles.length > 0 ? 1 : 0) + (accFiles.length > 0 ? 1 : 0);
  const taxDoneCount    = TAX_YEARS.filter(y => uploadedTaxByYear[y]).length;
  const finDoneCount    = FIN_YEARS.filter(y => uploadedFinByYear[y]).length;
  const unreadMessageCount = messages.filter(msg => {
    if (isOwnMessage(msg)) return false;
    return new Date(msg.created_at).getTime() > messageLastSeenAt;
  }).length;

  const canSubmit = request?.status !== 'file_submitted' && request?.status !== 'approved';

  // ── إرسال التقديم النهائي ──
  const handleFinalize = async () => {
    setSending(true); setSendMsg(''); setSendErr('');
    try {
      const r = await api.finalizeSubmission(id);
      setSendMsg(r.message || 'تم الإرسال بنجاح');
      fetchRequest();
    } catch (e) { setSendErr(e.message); }
    finally { setSending(false); }
  };

  // ── حالات التحميل/الخطأ ──
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-4" />
        <p className="text-slate-500">جاري التحميل...</p>
      </div>
    </div>
  );

  if (err) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <p className="text-red-500 mb-4">{err}</p>
        <button onClick={() => navigate('/dashboard')} className="text-blue-600 hover:underline">العودة للرئيسية</button>
      </div>
    </div>
  );

  const isSubmitted = request?.status === 'file_submitted' || request?.status === 'approved'
    || request?.status === 'sent_to_entity' || request?.status === 'contract_signed'
    || request?.status === 'transferred' || request?.status === 'fees_received';

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* ── شريط التنقل ── */}
      <nav className="bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-blue-600 text-sm">
            ← الرئيسية
          </button>
          <span className="text-slate-300">|</span>
          <h1 className="font-bold text-blue-900 text-sm truncate max-w-[180px]">{request?.company_name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={request?.status} />
          <button onClick={() => { logout(); navigate('/login'); }} className="text-xs text-red-400 hover:text-red-600">خروج</button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── معلومات الطلب ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-lg font-bold text-blue-900 mb-1">{request?.company_name}</h2>
          <p className="text-sm text-slate-500">{request?.entity_type} · {request?.ownership_type} · {request?.funding_type}</p>
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-600 mt-3">
            {request?.owner_name  && <div><span className="text-slate-400">المالك: </span>{request.owner_name}</div>}
            {request?.owner_phone && <div><span className="text-slate-400">الهاتف: </span>{request.owner_phone}</div>}
            {isAdmin && request?.user_name && <div><span className="text-slate-400">الموظف: </span>{request.user_name}</div>}
            {isAdmin && request?.user_phone && <div><span className="text-slate-400">جوال الموظف: </span>{request.user_phone}</div>}
            {isAdmin && request?.funding_entity_name && <div className="col-span-2"><span className="text-slate-400">الجهة التمويلية: </span><span className="font-semibold">{request.funding_entity_name}</span></div>}
          </div>

          {/* ── زر إرسال للجهة التمويلية (للأدمن) ── */}
          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setShowSendModal(true)}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow"
                >
                  📤 إرسال للجهة التمويلية
                </button>
                {request?.funding_entity_name && (
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-semibold border border-indigo-200">
                    ✓ {request.funding_entity_name}
                  </span>
                )}
                {request?.fe_whatsapp && (
                  <a
                    href={`https://wa.me/${request.fe_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `*طلب تمويل جديد* 🏢\n\nالشركة: ${request.company_name}\n` +
                      `نوع المنشأة: ${request.entity_type || '—'}\n` +
                      `ملكية: ${request.ownership_type || '—'}\n` +
                      `نوع التمويل: ${request.funding_type || '—'}\n` +
                      (request.owner_name  ? `المالك: ${request.owner_name}\n`     : '') +
                      (request.owner_phone ? `جوال المالك: ${request.owner_phone}\n` : '') +
                      (request.user_name   ? `الموظف: ${request.user_name}\n`      : '') +
                      `\nجاهز للمراجعة ✅`
                    )}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-green-600 transition"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    واتساب الجهة
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ── زر واتساب للموظف (للأدمن فقط) ── */}
          {isAdmin && request?.user_phone && (
            <div className="mt-3">
              <a
                href={`https://wa.me/${request.user_phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-blue-600 transition"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                واتساب الموظف
              </a>
            </div>
          )}
        </div>

        {isSubmitted && (
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
            <p className="text-2xl mb-2">📤</p>
            <p className="font-bold text-purple-800">تم إرسال الطلب للمدير بـ 3 ملفات مجمّعة</p>
            <p className="text-sm text-purple-500 mt-1">جاري المراجعة — سيتم التواصل معك قريباً</p>
          </div>
        )}

        {/* ── خط زمني لتتبع الحالة (للموظف فقط) ── */}
        {!isAdmin && <StatusTimeline status={request?.status} />}


        {/* 1 ── المستندات */}
        {/* ══════════════════════════════════════════════ */}
        <Section
          icon="📋" title="المستندات" color="blue"
          badgeCount={docsUploaded} total={docsList.length || 0}
          isOpen={openSec === 'docs'} onToggle={() => toggle('docs')}
        >
          {/* أدوات الأدمن لإدارة المستندات */}
          {user?.role === 'admin' && (
            <AdminDocManager requestId={id} docs={docsList} onRefresh={fetchRequest} />
          )}

          {docsList.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">
              <p className="text-2xl mb-2">📭</p>
              <p>لا توجد مستندات مطلوبة حتى الآن</p>
              <p className="text-xs mt-1 text-slate-300">يحددها الإداري بعد مراجعة نوع التمويل</p>
            </div>
          ) : (
            docsList.map(doc => (
              <SingleSlot
                key={doc.id}
                label={doc.document_name}
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                existingFile={doc.file_name || (doc.file_path ? 'مرفوع' : null)}
                onUpload={async (file) => { await api.uploadDocument(id, doc.id, file); fetchRequest(); }}
                disabled={isSubmitted}
              />
            ))
          )}
        </Section>

        {/* ══════════════════════════════════════════════ */}
        {/* 2 ── كشوفات الحساب */}
        {/* ══════════════════════════════════════════════ */}
        <Section
          icon="🏦" title="كشوفات الحساب" color="amber"
          badgeCount={statementsCount} total={2}
          isOpen={openSec === 'stmts'} onToggle={() => toggle('stmts')}
        >
          <MultiSlot
            label="كشوفات الحساب — PDF (كشوفات البنك)"
            sublabel="ارفع كشوفات PDF — يمكن رفع عدة ملفات دفعة واحدة"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            existingFiles={bankFiles}
            onUpload={async (files) => { const r = await api.uploadBankStatements(id, files); fetchRequest(); return r; }}
          />
          <MultiSlot
            label="كشوفات الحساب — Excel"
            sublabel="ارفع الكشوفات Excel — يمكن رفع عدة ملفات"
            accept=".xlsx,.xls"
            existingFiles={accFiles}
            onUpload={async (files) => { const r = await api.uploadAccountStatements(id, files); fetchRequest(); return r; }}
          />
        </Section>

        {/* ══════════════════════════════════════════════ */}
        {/* 3 ── الإقرارات الضريبية (3 سنوات) */}
        {/* ══════════════════════════════════════════════ */}

        {/* خيار التخطي لمن لا يحتاج */}
        {!isAdmin && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <input
              type="checkbox"
              id="skipFinancial"
              checked={skipFinancial}
              onChange={e => setSkipFinancial(e.target.checked)}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
            <label htmlFor="skipFinancial" className="text-sm text-amber-800 cursor-pointer select-none">
              منشأتي لا تحتاج إقرارات ضريبية أو قوائم مالية (مثلاً: أقل من سنتين نشاط)
            </label>
          </div>
        )}

        {!skipFinancial && (
          <Section
            icon="📊" title="الإقرارات الضريبية" color="purple"
            badgeCount={taxDoneCount} total={TAX_YEARS.length}
            isOpen={openSec === 'tax'} onToggle={() => toggle('tax')}
          >
            {TAX_YEARS.map(yr => (
              <SingleSlot
                key={yr}
                label={yr}
                sublabel="ارفع الإقرار الضريبي لهذه السنة (اختياري)"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                existingFile={uploadedTaxByYear[yr]?.file_name || null}
                onUpload={async (file) => { await api.uploadTaxDeclaration(id, yr, file); fetchRequest(); }}
                disabled={isSubmitted}
              />
            ))}
          </Section>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* 4 ── القوائم المالية (2 سنوات) */}
        {/* ══════════════════════════════════════════════ */}
        {!skipFinancial && (
          <Section
            icon="📈" title="القوائم المالية" color="green"
            badgeCount={finDoneCount} total={FIN_YEARS.length}
            isOpen={openSec === 'fin'} onToggle={() => toggle('fin')}
          >
            {FIN_YEARS.map(yr => (
              <SingleSlot
                key={yr}
                label={yr}
                sublabel="ارفع الميزانية أو القائمة المالية لهذه السنة (اختياري)"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                existingFile={uploadedFinByYear[yr]?.file_name || null}
                onUpload={async (file) => { await api.uploadFinancialStatement(id, yr, file); fetchRequest(); }}
                disabled={isSubmitted}
              />
            ))}
          </Section>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* زر الإرسال النهائي */}
        {/* ══════════════════════════════════════════════ */}
        {!isSubmitted && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
            <p className="text-sm text-slate-500 mb-4">
              بعد الانتهاء من رفع جميع الملفات، اضغط الزر أدناه لتجميعها في <strong>3 ملفات</strong> وإرسالها للمدير.
            </p>
            {sendMsg && <p className="text-green-600 text-sm mb-3 font-semibold">✓ {sendMsg}</p>}
            {sendErr && <p className="text-red-500 text-sm mb-3">⚠ {sendErr}</p>}
            <button
              onClick={handleFinalize}
              disabled={sending || !canSubmit}
              className="w-full bg-blue-700 text-white py-4 rounded-xl font-bold text-base hover:bg-blue-800 transition disabled:opacity-50 shadow-lg"
            >
              {sending ? '🔄 جاري التجميع والإرسال...' : '📤 إرسال التقديم الكامل للمدير'}
            </button>
            <p className="text-xs text-slate-400 mt-3">
              سيتم تجميع: المستندات + الكشوفات + القوائم/الإقرارات في 3 ملفات منفصلة
            </p>
          </div>
        )}

        {request?.status === 'approved' && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <p className="text-4xl mb-3">🎉</p>
            <h3 className="font-bold text-green-800 text-lg mb-1">تم الموافقة على طلبك</h3>
            <p className="text-sm text-green-600">سيتم التواصل معك قريباً لاستكمال الإجراءات.</p>
          </div>
        )}

        {request?.status === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center">
            <p className="text-4xl mb-3">❌</p>
            <h3 className="font-bold text-red-800 text-lg mb-1">لم يتم قبول الطلب</h3>
            {request.rejection_reason && <p className="text-sm text-red-500">{request.rejection_reason}</p>}
          </div>
        )}

        {/* ══════════════════════════════════════════════ */}
        {/* 💬 الرسائل بين الموظف والأدمن */}
        {/* ══════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100 bg-slate-50">
            <span className="text-xl">💬</span>
            <h3 className="font-bold text-slate-700">المحادثة</h3>
            {messages.length > 0 && (
              <span className="ml-auto text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold">{messages.length}</span>
            )}
            {unreadMessageCount > 0 && (
              <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-semibold">{unreadMessageCount} جديدة</span>
            )}
          </div>

          {/* منطقة الرسائل */}
          <div className="flex flex-col gap-3 p-4 max-h-72 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">لا توجد رسائل بعد — ابدأ المحادثة</p>
            ) : (
              messages.map(msg => {
                const isMine = isOwnMessage(msg);
                const isUnread = !isMine && new Date(msg.created_at).getTime() > messageLastSeenAt;
                return (
                  <div key={msg.id} className={`flex flex-col max-w-[80%] ${isMine ? 'self-end items-end' : 'self-start items-start'}`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm border
                      ${isMine ? 'bg-blue-600 text-white rounded-br-none border-blue-600' : isUnread ? 'bg-red-50 text-slate-800 rounded-bl-none border-red-200' : 'bg-slate-100 text-slate-800 rounded-bl-none border-slate-100'}`}>
                      {msg.message}
                    </div>
                    <span className="text-xs text-slate-400 mt-1 px-1 flex items-center gap-2">
                      {msg.sender_name} · {new Date(msg.created_at).toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                      {isUnread && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">جديد</span>}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={msgEndRef} />
          </div>

          {/* حقل الإرسال */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50">
            <input
              value={msgText}
              onChange={e => setMsgText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              placeholder="اكتب رسالة..."
              className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            />
            <button
              onClick={handleSendMessage}
              disabled={msgSending || !msgText.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >{msgSending ? '...' : 'إرسال'}</button>
          </div>
        </div>

      </div>
    </div>

    {/* ── موداl إرسال الطلب للجهة التمويلية (أدمن) ── */}
    {showSendModal && request && (
      <SendToEntityModal
        request={request}
        onClose={() => setShowSendModal(false)}
        onSent={(entity) => {
          setShowSendModal(false);
          fetchRequest();
        }}
      />
    )}
  );
}
