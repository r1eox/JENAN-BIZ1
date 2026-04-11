import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const STATUS_LABELS = {
  draft:            { label: 'مسودة',            color: 'bg-slate-100 text-slate-600' },
  bank_uploaded:    { label: 'كشوفات مرفوعة',    color: 'bg-blue-100 text-blue-700' },
  docs_pending:     { label: 'مستندات ناقصة',    color: 'bg-yellow-100 text-yellow-700' },
  docs_ready:       { label: 'مستندات مكتملة',   color: 'bg-teal-100 text-teal-700' },
  file_submitted:   { label: 'مُرسَل للمدير ✓',  color: 'bg-purple-100 text-purple-700' },
  contract_submitted:{ label: 'عقد مرسل',         color: 'bg-indigo-100 text-indigo-700' },
  approved:         { label: 'موافقة ✓',          color: 'bg-green-200 text-green-800' },
  rejected:         { label: 'مرفوض',             color: 'bg-red-100 text-red-700' },
  missing:          { label: 'نواقص',             color: 'bg-orange-100 text-orange-700' },
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests]   = useState([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState('');
  const [search,   setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastAudience, setBroadcastAudience] = useState('all');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState('');
  const [broadcastLastSeenAt, setBroadcastLastSeenAt] = useState(0);
  const [totalUnread, setTotalUnread] = useState(0);

  const isAdmin = user?.role === 'admin';
  const isPartner = user?.role === 'partner' || user?.role === 'company';
  const canViewAllRequests = isAdmin || user?.permissions?.includes('view_all_requests');
  const dashboardType = isAdmin
    ? 'admin'
    : canViewAllRequests
      ? 'supervisor'
      : isPartner
        ? 'partner'
        : 'employee';

  const dashboardMeta = {
    admin: {
      navSubtitle: 'لوحة تحكم المدير',
      title: `جميع الطلبات (${requests.length})`,
      newRequestLabel: '+ طلب جديد',
      badge: 'مدير',
      badgeClass: 'bg-purple-100 text-purple-700',
      emptyHint: ''
    },
    supervisor: {
      navSubtitle: 'لوحة المشرف',
      title: `متابعة الطلبات (${requests.length})`,
      newRequestLabel: '+ طلب جديد',
      badge: 'مشرف',
      badgeClass: 'bg-amber-100 text-amber-700',
      emptyHint: 'يمكنك متابعة الطلبات الحالية من هنا'
    },
    employee: {
      navSubtitle: 'لوحة الموظف',
      title: 'طلباتي',
      newRequestLabel: '+ طلب جديد',
      badge: 'موظف',
      badgeClass: 'bg-sky-100 text-sky-700',
      emptyHint: 'اضغط "طلب جديد" لبدء طلب تمويل'
    },
    partner: {
      navSubtitle: 'لوحة الشريك',
      title: 'طلبات الشريك',
      newRequestLabel: '+ طلب شريك جديد',
      badge: 'شريك',
      badgeClass: 'bg-emerald-100 text-emerald-700',
      emptyHint: 'يمكنك إنشاء ومتابعة الطلبات المرتبطة بك من هنا'
    }
  }[dashboardType];

  useEffect(() => {
    const fn = canViewAllRequests ? api.getAdminRequests : api.getRequests;
    fn()
      .then(setRequests)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [canViewAllRequests]);

  useEffect(() => {
    const fn = isAdmin ? api.adminGetBroadcastMessages : api.getBroadcastMessages;
    fn().then(setBroadcasts).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    api.getBroadcastReadState()
      .then(r => setBroadcastLastSeenAt(r.last_read_at ? new Date(r.last_read_at).getTime() : 0))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) return;
    api.getUnreadSummary().then(r => setTotalUnread(r.total || 0)).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin || broadcasts.length === 0) return;
    const latestCreatedAt = Math.max(...broadcasts.map(msg => new Date(msg.created_at).getTime()).filter(Boolean));
    if (!latestCreatedAt || latestCreatedAt <= broadcastLastSeenAt) return;
    const timer = setTimeout(async () => {
      const lastReadAtIso = new Date(latestCreatedAt).toISOString();
      try {
        await api.markBroadcastRead(lastReadAtIso);
        setBroadcastLastSeenAt(latestCreatedAt);
      } catch (_) {}
    }, 2500);
    return () => clearTimeout(timer);
  }, [broadcastLastSeenAt, broadcasts, isAdmin]);

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) return;
    setBroadcastSending(true);
    setBroadcastFeedback('');
    try {
      const r = await api.adminSendBroadcastMessage({
        target_audience: broadcastAudience,
        title: broadcastTitle.trim() || null,
        message: broadcastMessage.trim(),
      });
      setBroadcastFeedback(`تم الإرسال بنجاح إلى ${r.recipients || 0} مستلم`);
      setBroadcastTitle('');
      setBroadcastMessage('');
      const list = await api.adminGetBroadcastMessages();
      setBroadcasts(list);
    } catch (e) {
      setBroadcastFeedback(e.message || 'فشل الإرسال');
    } finally {
      setBroadcastSending(false);
    }
  };

  const filtered = useMemo(() => {
    let list = requests;
    if (filterStatus !== 'all') list = list.filter(r => r.status === filterStatus);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.company_name?.toLowerCase().includes(q) ||
        r.owner_name?.toLowerCase().includes(q) ||
        r.user_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, filterStatus, search]);

  const unreadBroadcastCount = useMemo(() => (
    broadcasts.filter(msg => new Date(msg.created_at).getTime() > broadcastLastSeenAt).length
  ), [broadcastLastSeenAt, broadcasts]);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* شريط التنقل */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.jpeg" alt="جنان بيز" className="h-10" onError={e => e.target.style.display='none'} />
          <div>
            <div className="font-bold text-blue-900 text-lg">جنان بيز</div>
            <div className="text-xs text-slate-400">
              {dashboardMeta.navSubtitle}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">مرحباً، {user?.name}</span>
          <button
            onClick={() => navigate('/broadcasts')}
            className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-slate-100 transition"
            title="الرسائل الجماعية"
          >
            <span className="text-xl">🔔</span>
            {!isAdmin && totalUnread > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </button>
          {dashboardMeta.badge && (
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${dashboardMeta.badgeClass}`}>{dashboardMeta.badge}</span>
          )}
          <button onClick={logout} className="text-sm text-red-500 hover:underline">خروج</button>
        </div>
      </nav>

      {/* شريط التنقل بين الأقسام */}
      <div className="bg-white border-b border-slate-100 px-4 overflow-x-auto">
        <div className="flex items-center gap-1 max-w-5xl mx-auto min-w-max">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-semibold text-blue-700 border-b-2 border-blue-700 whitespace-nowrap"
          >📋 الطلبات</button>
          <button
            onClick={() => navigate('/brokers')}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent whitespace-nowrap"
          >🤝 الوسطاء</button>
          <button
            onClick={() => navigate('/attendance')}
            className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent whitespace-nowrap"
          >🕐 الحضور والانصراف</button>
          {isAdmin && (
            <>
              <button
                onClick={() => navigate('/companies')}
                className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent whitespace-nowrap"
              >🏢 المنشآت</button>
              <button
                onClick={() => navigate('/funding-entities')}
                className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-b-2 border-transparent whitespace-nowrap"
              >🏦 جهات التمويلية</button>
            </>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* رأس الصفحة */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold text-blue-900">
            {dashboardMeta.title}
          </h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="bg-slate-900 text-white px-4 py-2 rounded-lg font-semibold hover:bg-slate-800 transition"
              >
                لوحة المدير
              </button>
            )}
            <button
              onClick={() => navigate('/request/new')}
              className="bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-800 transition"
            >
              {dashboardMeta.newRequestLabel}
            </button>
          </div>
        </div>

        {/* فلاتر البحث — للأدمن */}
        {canViewAllRequests && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث باسم الشركة أو المالك أو الموظف..."
              className="flex-1 text-sm border border-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="all">كل الحالات</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* الرسائل الجماعية */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-700">📣 الرسائل الجماعية (عروض وتحديثات)</h2>
              {!isAdmin && unreadBroadcastCount > 0 && (
                <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-semibold">
                  {unreadBroadcastCount} جديدة
                </span>
              )}
            </div>
            <button
              onClick={() => navigate('/broadcasts')}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              عرض الكل ({broadcasts.length})
            </button>
          </div>

          {isAdmin && (
            <div className="border border-slate-200 rounded-lg p-3 mb-4 bg-slate-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                <select
                  value={broadcastAudience}
                  onChange={e => setBroadcastAudience(e.target.value)}
                  className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="all">الكل (موظفين + شركاء)</option>
                  <option value="employee">الموظفون فقط</option>
                  <option value="partner">الشركاء فقط</option>
                </select>
                <input
                  type="text"
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  placeholder="عنوان مختصر (اختياري)"
                  className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  onClick={handleSendBroadcast}
                  disabled={broadcastSending || !broadcastMessage.trim()}
                  className="bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
                >
                  {broadcastSending ? 'جاري الإرسال...' : 'إرسال جماعي بضغطة واحدة'}
                </button>
              </div>
              <textarea
                value={broadcastMessage}
                onChange={e => setBroadcastMessage(e.target.value)}
                rows={3}
                placeholder="اكتب رسالة العرض أو التحديث الجديد..."
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {broadcastFeedback && (
                <p className="text-xs mt-2 text-blue-700 font-medium">{broadcastFeedback}</p>
              )}
            </div>
          )}

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {broadcasts.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-3">لا توجد رسائل جماعية حالياً</p>
            )}
            {broadcasts.map(msg => {
              const isUnread = new Date(msg.created_at).getTime() > broadcastLastSeenAt;
              return (
              <div key={msg.id} className={`border rounded-lg p-3 ${isUnread && !isAdmin ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-sm text-slate-700">{msg.title || 'تحديث جديد'}</div>
                    {isUnread && !isAdmin && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">جديد</span>}
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(msg.created_at).toLocaleDateString('ar-SA')}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{msg.message}</p>
                {isAdmin && (
                  <p className="text-xs text-slate-400 mt-1">
                    إلى: {msg.target_audience === 'all' ? 'الكل' : msg.target_audience === 'employee' ? 'الموظفين' : 'الشركاء'}
                  </p>
                )}
              </div>
            )})}
          </div>
        </div>

        {/* المحتوى */}
        {loading && <div className="text-center py-20 text-slate-400">جاري التحميل...</div>}
        {error && <div className="bg-red-50 text-red-600 rounded-lg p-4 mb-4">{error}</div>}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-slate-400">
            <div className="text-5xl mb-4">📋</div>
            <div className="text-lg">لا توجد طلبات</div>
            {dashboardMeta.emptyHint && <div className="text-sm mt-2">{dashboardMeta.emptyHint}</div>}
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(r => {
            const st = STATUS_LABELS[r.status] || { label: r.status, color: 'bg-slate-100 text-slate-600' };
            return (
              <div
                key={r.id}
                onClick={() => navigate(`/request/${r.id}`)}
                className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 cursor-pointer hover:shadow-md transition hover:border-blue-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-blue-900 text-lg truncate">{r.company_name}</div>
                    <div className="text-sm text-slate-500 mt-1">
                      {r.entity_type} · {r.ownership_type} · {r.funding_type}
                    </div>
                    {/* اسم الموظف — للأدمن فقط */}
                    {canViewAllRequests && r.user_name && (
                      <div className="text-xs text-purple-600 mt-1 font-medium">
                        👤 {r.user_name}
                        {r.user_phone && <span className="text-slate-400 mr-2">{r.user_phone}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 mr-3 flex-shrink-0">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${st.color}`}>{st.label}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-3">
                  آخر تحديث: {new Date(r.updated_at).toLocaleDateString('ar-SA')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
