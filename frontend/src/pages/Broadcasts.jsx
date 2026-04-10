import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const AUDIENCE_LABELS = {
  all:      'الكل',
  employee: 'الموظفون',
  partner:  'الشركاء',
};

export default function Broadcasts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [broadcasts, setBroadcasts]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [broadcastLastSeenAt, setLastSeen] = useState(0);

  // نموذج الإرسال — للأدمن
  const [title, setTitle]       = useState('');
  const [message, setMessage]   = useState('');
  const [audience, setAudience] = useState('all');
  const [sending, setSending]   = useState(false);
  const [feedback, setFeedback] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    const fn = isAdmin ? api.adminGetBroadcastMessages : api.getBroadcastMessages;
    fn().then(setBroadcasts).catch(() => {}).finally(() => setLoading(false));

    if (!isAdmin) {
      api.getBroadcastReadState()
        .then(r => setLastSeen(r.last_read_at ? new Date(r.last_read_at).getTime() : 0))
        .catch(() => {});
    }
  }, [isAdmin]);

  // تأخير الوضع "مقروء" بعد 2.5 ثانية من العرض
  useEffect(() => {
    if (isAdmin || broadcasts.length === 0) return;
    const latestTs = Math.max(...broadcasts.map(m => new Date(m.created_at).getTime()).filter(Boolean));
    if (!latestTs || latestTs <= broadcastLastSeenAt) return;
    const t = setTimeout(async () => {
      try {
        const iso = new Date(latestTs).toISOString();
        await api.markBroadcastRead(iso);
        setLastSeen(latestTs);
      } catch (_) {}
    }, 2500);
    return () => clearTimeout(t);
  }, [broadcasts, broadcastLastSeenAt, isAdmin]);

  const unreadCount = useMemo(
    () => broadcasts.filter(m => new Date(m.created_at).getTime() > broadcastLastSeenAt).length,
    [broadcasts, broadcastLastSeenAt]
  );

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true); setFeedback('');
    try {
      const r = await api.adminSendBroadcastMessage({
        target_audience: audience,
        title: title.trim() || null,
        message: message.trim(),
      });
      setFeedback(`✓ تم الإرسال إلى ${r.recipients || 0} مستلم`);
      setTitle(''); setMessage('');
      const list = await api.adminGetBroadcastMessages();
      setBroadcasts(list);
    } catch (e) {
      setFeedback(e.message || 'فشل الإرسال');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف هذه الرسالة نهائياً؟')) return;
    setDeleting(id);
    try {
      await api.adminDeleteBroadcast(id);
      setBroadcasts(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      alert(e.message || 'فشل الحذف');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.jpeg" alt="جنان بيز" className="h-10" onError={e => e.target.style.display='none'} />
          <div>
            <div className="font-bold text-blue-900 text-lg">جنان بيز</div>
            <div className="text-xs text-slate-400">الرسائل الجماعية</div>
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-sm text-blue-700 hover:underline font-medium"
        >
          ← العودة للرئيسية
        </button>
      </nav>

      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-blue-900 flex items-center gap-2">
            📣 الرسائل الجماعية
            {!isAdmin && unreadCount > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">
                {unreadCount} جديدة
              </span>
            )}
          </h1>
          <span className="text-sm text-slate-400">{broadcasts.length} رسالة</span>
        </div>

        {/* نموذج الإرسال — للأدمن */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
            <h2 className="font-semibold text-slate-700 mb-3 text-sm">+ إرسال رسالة جماعية جديدة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <select
                value={audience}
                onChange={e => setAudience(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">الكل (موظفين + شركاء)</option>
                <option value="employee">الموظفون فقط</option>
                <option value="partner">الشركاء فقط</option>
              </select>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="عنوان مختصر (اختياري)"
                className="text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="اكتب نص الرسالة..."
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex items-center justify-between">
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="bg-blue-700 text-white rounded-lg px-5 py-2 text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                {sending ? 'جاري الإرسال...' : 'إرسال'}
              </button>
              {feedback && (
                <span className={`text-sm font-medium ${feedback.startsWith('✓') ? 'text-green-700' : 'text-red-600'}`}>
                  {feedback}
                </span>
              )}
            </div>
          </div>
        )}

        {/* قائمة الرسائل */}
        {loading && <div className="text-center py-16 text-slate-400">جاري التحميل...</div>}

        {!loading && broadcasts.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">📭</div>
            <div>لا توجد رسائل جماعية حتى الآن</div>
          </div>
        )}

        <div className="space-y-3">
          {broadcasts.map(msg => {
            const isUnread = !isAdmin && new Date(msg.created_at).getTime() > broadcastLastSeenAt;
            return (
              <div
                key={msg.id}
                className={`rounded-xl border p-4 transition-all ${
                  isUnread ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">
                        {msg.title || 'تحديث جديد'}
                      </span>
                      {isUnread && (
                        <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
                          جديد
                        </span>
                      )}
                      {isAdmin && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {AUDIENCE_LABELS[msg.target_audience] || msg.target_audience}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{msg.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{new Date(msg.created_at).toLocaleDateString('ar-SA')}</span>
                      {isAdmin && msg.created_by_name && (
                        <span>بواسطة: {msg.created_by_name}</span>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(msg.id)}
                      disabled={deleting === msg.id}
                      className="text-xs text-red-400 hover:text-red-600 flex-shrink-0 mt-1 disabled:opacity-50"
                      title="حذف الرسالة"
                    >
                      {deleting === msg.id ? '...' : '🗑'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
