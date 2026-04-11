import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

export default function Brokers() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [brokers, setBrokers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    api.getBrokers()
      .then(setBrokers)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    setErr('');
    try {
      await api.addBroker(form);
      setForm({ name: '', phone: '', notes: '' });
      setShowForm(false);
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل تريد حذف هذا الوسيط؟')) return;
    try {
      await api.deleteBroker(id);
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const canDelete = (broker) => user?.role === 'admin' || broker.added_by_id === user?.id;
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-blue-600 text-sm font-medium">
            ← الرئيسية
          </button>
          <span className="text-slate-300">|</span>
          <h1 className="font-bold text-blue-900">🤝 {isAdmin ? 'جميع الوسطاء' : 'وسطاءي'}</h1>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} className="text-xs text-red-400 hover:text-red-600">خروج</button>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {err && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">⚠ {err}</div>}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-700">
            {isAdmin ? `الوسطاء المسجلون (${brokers.length})` : `وسطاءي (${brokers.length})`}
          </h2>
          <button
            onClick={() => setShowForm(v => !v)}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800"
          >+ إضافة وسيط</button>
        </div>

        {/* نموذج الإضافة */}
        {showForm && (
          <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
            <p className="font-semibold text-blue-800 text-sm">وسيط جديد</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">الاسم *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="اسم الوسيط"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">الجوال *</label>
                <input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="05XXXXXXXX"
                  dir="ltr"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">ملاحظات</label>
              <input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="ملاحظات اختيارية"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={saving || !form.name.trim() || !form.phone.trim()}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              >{saving ? '...' : 'حفظ'}</button>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-500 px-4 py-2 rounded-lg text-sm hover:bg-slate-100"
              >إلغاء</button>
            </div>
          </div>
        )}

        {/* جدول للأدمن */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">جاري التحميل...</div>
        ) : brokers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">🤝</div>
            <p>{isAdmin ? 'لا يوجد وسطاء مسجلون بعد' : 'لم تُضف أي وسيط بعد'}</p>
          </div>
        ) : isAdmin ? (
          /* عرض الجدول للأدمن */
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">اسم الوسيط</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">رقم الجوال</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">أضافه</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">التاريخ</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">ملاحظات</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {brokers.map(b => {
                    const phone = b.phone?.replace(/\D/g, '');
                    const date = b.created_at ? new Date(b.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
                    return (
                      <tr key={b.id} className="hover:bg-slate-50 transition">
                        <td className="px-4 py-3 font-semibold text-slate-800">{b.name}</td>
                        <td className="px-4 py-3 text-slate-600" dir="ltr">{b.phone || '—'}</td>
                        <td className="px-4 py-3 text-blue-700 font-medium">{b.added_by_name || '—'}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{date}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{b.notes || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            {phone && (
                              <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-600">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                </svg>
                                واتساب
                              </a>
                            )}
                            <button onClick={() => handleDelete(b.id)}
                              className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg text-xs">🗑️</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* عرض البطاقات للموظف */
          <div className="space-y-3">
            {brokers.map(b => {
              const phone = b.phone?.replace(/\D/g, '');
              return (
                <div key={b.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🤝</span>
                      <p className="font-bold text-slate-800">{b.name}</p>
                    </div>
                    {b.phone && <p className="text-sm text-slate-500 mt-1" dir="ltr">{b.phone}</p>}
                    {b.notes && <p className="text-xs text-slate-400 mt-1">{b.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {phone && (
                      <a href={`https://wa.me/${phone}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-600">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        واتساب
                      </a>
                    )}
                    <button onClick={() => handleDelete(b.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg text-xs">🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
