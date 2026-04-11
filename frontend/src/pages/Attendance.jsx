import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

function formatTime(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function calcDuration(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const ms = new Date(checkOut) - new Date(checkIn);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h} ساعة ${m > 0 ? `و ${m} دقيقة` : ''}`;
}

export default function Attendance() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [today, setToday] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const [recs, todayRec] = await Promise.all([
        api.getAttendance(),
        isAdmin ? Promise.resolve(null) : api.getTodayAttendance(),
      ]);
      setRecords(recs);
      if (!isAdmin) setToday(todayRec);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCheckIn = async () => {
    setActionLoading(true); setErr(''); setMsg('');
    try {
      const r = await api.checkIn();
      setMsg(r.message || 'تم تسجيل الحضور');
      load();
    } catch (e) { setErr(e.message); }
    finally { setActionLoading(false); }
  };

  const handleCheckOut = async () => {
    setActionLoading(true); setErr(''); setMsg('');
    try {
      const r = await api.checkOut();
      setMsg(r.message || 'تم تسجيل الانصراف');
      load();
    } catch (e) { setErr(e.message); }
    finally { setActionLoading(false); }
  };

  // تجميع سجلات الأدمن حسب الموظف
  const groupedByUser = isAdmin ? records.reduce((acc, r) => {
    const key = r.user_id;
    if (!acc[key]) acc[key] = { name: r.user_name, phone: r.user_phone, records: [] };
    acc[key].records.push(r);
    return acc;
  }, {}) : null;

  const filteredRecords = filterMonth
    ? records.filter(r => r.date?.startsWith(filterMonth))
    : records;

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-blue-600 text-sm font-medium">
            ← الرئيسية
          </button>
          <span className="text-slate-300">|</span>
          <h1 className="font-bold text-blue-900">الحضور والانصراف</h1>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} className="text-xs text-red-400 hover:text-red-600">خروج</button>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {err && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">⚠ {err}</div>}
        {msg && <div className="bg-green-50 text-green-700 rounded-xl p-3 text-sm font-semibold">✓ {msg}</div>}

        {/* ── قسم الموظف: تسجيل الحضور/الانصراف ── */}
        {!isAdmin && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-2xl">🕐</div>
              <div>
                <p className="font-bold text-slate-800 text-base">حضور اليوم</p>
                <p className="text-xs text-slate-400">{formatDate(todayStr)}</p>
              </div>
            </div>

            {today ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
                    <p className="text-xs text-green-600 font-semibold mb-1">وقت الحضور</p>
                    <p className="text-2xl font-bold text-green-700" dir="ltr">{formatTime(today.check_in)}</p>
                  </div>
                  <div className={`rounded-xl border p-4 text-center ${today.check_out ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                    <p className={`text-xs font-semibold mb-1 ${today.check_out ? 'text-blue-600' : 'text-amber-600'}`}>وقت الانصراف</p>
                    <p className={`text-2xl font-bold ${today.check_out ? 'text-blue-700' : 'text-amber-500'}`} dir="ltr">
                      {today.check_out ? formatTime(today.check_out) : 'لم يسجّل'}
                    </p>
                  </div>
                </div>

                {today.check_in && today.check_out && (
                  <div className="bg-slate-50 rounded-xl p-3 text-center text-sm text-slate-600">
                    ⏱ المدة الإجمالية: <span className="font-bold">{calcDuration(today.check_in, today.check_out)}</span>
                  </div>
                )}

                {!today.check_out && (
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-xl bg-blue-700 text-white font-bold text-base hover:bg-blue-800 disabled:opacity-50 transition"
                  >
                    {actionLoading ? 'جاري...' : '🚪 تسجيل الانصراف'}
                  </button>
                )}

                {today.check_out && (
                  <div className="text-center text-sm text-slate-400 py-2">✓ تم تسجيل الحضور والانصراف اليوم</div>
                )}
              </div>
            ) : (
              <button
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="w-full py-4 rounded-xl bg-green-600 text-white font-bold text-lg hover:bg-green-700 disabled:opacity-50 transition shadow-lg"
              >
                {actionLoading ? 'جاري...' : '✅ تسجيل حضوري الآن'}
              </button>
            )}
          </div>
        )}

        {/* ── سجل الحضور ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-700">{isAdmin ? 'سجل حضور الموظفين' : 'سجلي'} ({filteredRecords.length})</h2>
            <input
              type="month"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {loading ? (
            <div className="text-center py-10 text-slate-400">جاري التحميل...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <div className="text-3xl mb-2">📅</div>
              <p>لا توجد سجلات{filterMonth ? ' لهذا الشهر' : ''}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {isAdmin && <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">الموظف</th>}
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">التاريخ</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">الحضور</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">الانصراف</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">المدة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredRecords.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      {isAdmin && (
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800">{r.user_name}</p>
                          {r.user_phone && <p className="text-xs text-slate-400" dir="ltr">{r.user_phone}</p>}
                        </td>
                      )}
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{formatDate(r.date)}</td>
                      <td className="py-3 px-3">
                        <span className="text-green-700 font-semibold" dir="ltr">{formatTime(r.check_in)}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={r.check_out ? 'text-blue-700 font-semibold' : 'text-amber-500'} dir="ltr">
                          {formatTime(r.check_out)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-xs">
                        {calcDuration(r.check_in, r.check_out) || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
