import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

const STATUS_LABELS = {
  draft:             'مسودة',
  bank_uploaded:     'كشوفات مرفوعة',
  docs_pending:      'مستندات ناقصة',
  docs_ready:        'مستندات مكتملة',
  file_submitted:    'مُرسَل للمدير',
  contract_submitted:'عقد مرسل',
  approved:          'موافقة ✓',
  rejected:          'مرفوض',
  missing:           'نواقص',
};

export default function Companies() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [debSearch, setDebSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    api.adminGetCompanies(debSearch)
      .then(setCompanies)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [debSearch]);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-blue-600 text-sm font-medium">
            ← الرئيسية
          </button>
          <span className="text-slate-300">|</span>
          <h1 className="font-bold text-blue-900">المنشآت</h1>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} className="text-xs text-red-400 hover:text-red-600">خروج</button>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {err && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">⚠ {err}</div>}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-700">المنشآت ({companies.length})</h2>
        </div>

        {/* بحث */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث باسم الشركة أو المالك..."
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm"
        />

        {loading ? (
          <div className="text-center py-16 text-slate-400">جاري التحميل...</div>
        ) : companies.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">🏢</div>
            <p>لا توجد منشآت{search ? ' تطابق البحث' : ''}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold text-slate-600">#</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">اسم المنشأة</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">المالك</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">رقم الجوال</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">أضافها</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">التاريخ</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">الحالة</th>
                  <th className="px-4 py-3 font-semibold text-slate-600">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>🏢</span>
                        <span className="font-semibold text-slate-800">{c.company_name}</span>
                      </div>
                      {c.entity_type && <div className="text-xs text-slate-400 mt-0.5 mr-6">{c.entity_type}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{c.owner_name || '—'}</td>
                    <td className="px-4 py-3">
                      {c.owner_phone ? (
                        <span dir="ltr" className="text-slate-700 font-mono text-xs">{c.owner_phone}</span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-700">{c.employee_name || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {c.request_status ? (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                          {STATUS_LABELS[c.request_status] || c.request_status}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.owner_phone && (
                          <a
                            href={`https://wa.me/${c.owner_phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-semibold hover:bg-green-600"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            واتساب
                          </a>
                        )}
                        {c.request_id && (
                          <button
                            onClick={() => navigate(`/request/${c.request_id}`)}
                            className="text-xs text-blue-600 hover:underline whitespace-nowrap"
                          >الطلب ←</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
