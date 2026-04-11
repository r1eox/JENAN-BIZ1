import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="text-xs text-slate-500 mb-2">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [teamOverview, setTeamOverview] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [statsData, usersData, teamData, settingsData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getTeamOverview(),
        api.getSettings(),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setTeamOverview(teamData);
      setSettings(settingsData);
    } catch (e) {
      setFeedback(e.message || 'تعذر تحميل لوحة المدير');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleStatusChange = async (userId, status) => {
    try {
      await api.updateUserStatus(userId, status);
      setUsers(prev => prev.map(item => item.id === userId ? { ...item, status } : item));
    } catch (e) {
      setFeedback(e.message || 'تعذر تحديث حالة المستخدم');
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setFeedback('');
    try {
      await api.updateSettings(settings || {});
      setFeedback('تم حفظ الإعدادات بنجاح');
    } catch (e) {
      setFeedback(e.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">جاري تحميل لوحة المدير...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/logo.jpeg" alt="جنان بيز" className="h-10" onError={e => e.target.style.display = 'none'} />
          <div>
            <div className="font-bold text-blue-900 text-lg">لوحة المدير</div>
            <div className="text-xs text-slate-400">إدارة المستخدمين والإعدادات والمتابعة العامة</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">{user?.name}</span>
          <button onClick={() => navigate('/dashboard')} className="text-sm text-blue-700 hover:underline">العودة للطلبات</button>
          <button onClick={logout} className="text-sm text-red-500 hover:underline">خروج</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {feedback && (
          <div className="bg-blue-50 text-blue-700 border border-blue-200 rounded-xl p-4">{feedback}</div>
        )}

        <section>
          <h1 className="text-2xl font-bold text-slate-900 mb-4">نظرة عامة</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="إجمالي الطلبات" value={stats?.totalRequests || 0} color="text-blue-700" />
            <StatCard label="مستخدمون بانتظار الموافقة" value={stats?.pendingUsers || 0} color="text-amber-700" />
            <StatCard label="ملفات مرسلة" value={stats?.fileSubmitted || 0} color="text-purple-700" />
            <StatCard label="طلبات معتمدة" value={stats?.approved || 0} color="text-green-700" />
            <StatCard label="رسوم مستلمة" value={stats?.feesReceived || 0} color="text-emerald-700" />
            <StatCard label="طلبات فيها نواقص" value={stats?.missing || 0} color="text-orange-700" />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h2 className="font-bold text-slate-800 mb-3">ملخص الفريق</h2>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>الموظفون</span><span className="font-semibold">{teamOverview?.employees?.length || 0}</span></div>
              <div className="flex items-center justify-between"><span>الشركاء</span><span className="font-semibold">{teamOverview?.partners?.all?.length || 0}</span></div>
              <div className="flex items-center justify-between"><span>الشركاء النشطون</span><span className="font-semibold">{teamOverview?.partners?.active?.length || 0}</span></div>
              <div className="flex items-center justify-between"><span>الجهات التمويلية</span><span className="font-semibold">{teamOverview?.funding_entities?.length || 0}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm lg:col-span-2">
            <h2 className="font-bold text-slate-800 mb-3">إعدادات المنصة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                type="text"
                value={settings?.platform_name || ''}
                onChange={e => setSettings(prev => ({ ...prev, platform_name: e.target.value }))}
                placeholder="اسم المنصة"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={settings?.admin_whatsapp || ''}
                onChange={e => setSettings(prev => ({ ...prev, admin_whatsapp: e.target.value }))}
                placeholder="واتساب الإدارة"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={settings?.ai_model || ''}
                onChange={e => setSettings(prev => ({ ...prev, ai_model: e.target.value }))}
                placeholder="نموذج الذكاء الاصطناعي"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={settings?.ai_api_key || ''}
                onChange={e => setSettings(prev => ({ ...prev, ai_api_key: e.target.value }))}
                placeholder="مفتاح OpenAI"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
              </button>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">إدارة المستخدمين</h2>
            <span className="text-sm text-slate-400">{users.length} مستخدم</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right border-b border-slate-200 text-slate-500">
                  <th className="py-2">الاسم</th>
                  <th className="py-2">البريد</th>
                  <th className="py-2">الدور</th>
                  <th className="py-2">الحالة</th>
                  <th className="py-2">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {users.map(item => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="py-3 font-medium text-slate-700">{item.name}</td>
                    <td className="py-3 text-slate-500">{item.email}</td>
                    <td className="py-3 text-slate-500">{item.role === 'admin' ? 'مدير' : item.role === 'partner' ? 'شريك' : 'موظف'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.status === 'approved' ? 'bg-green-100 text-green-700' : item.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {item.status === 'approved' ? 'مفعل' : item.status === 'pending' ? 'معلق' : 'محظور'}
                      </span>
                    </td>
                    <td className="py-3">
                      {item.role !== 'admin' && (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleStatusChange(item.id, 'approved')} className="text-xs bg-green-600 text-white px-3 py-1 rounded-md">تفعيل</button>
                          <button onClick={() => handleStatusChange(item.id, 'blocked')} className="text-xs bg-red-600 text-white px-3 py-1 rounded-md">حظر</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}