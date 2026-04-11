
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await login(form.email, form.password);
      navigate(loggedInUser?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      setError(err.message || 'بيانات الدخول غير صحيحة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col lg:flex-row" dir="ltr">
      <section
        className="w-full lg:w-1/2 h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center p-5 overflow-hidden"
        dir="rtl"
      >
        <div className="w-full max-w-[400px] rounded-[24px] bg-white/95 border border-white shadow-[0_20px_60px_rgba(15,23,42,0.16)] px-6 py-5 backdrop-blur-sm">
          <p className="text-[10px] font-bold tracking-[0.14em] text-sky-600 text-center mb-1">WELCOME BACK</p>
          <h2 className="text-2xl font-extrabold text-slate-800 text-center">تسجيل الدخول</h2>
          <p className="text-xs text-slate-500 text-center mt-1 mb-4">أدخل بياناتك للوصول إلى المنصة</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div>
              <label className="label">البريد الإلكتروني</label>
              <div className="relative" dir="ltr">
                <input
                  type="email"
                  className="input-field bg-slate-100 border-slate-100"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
            </div>

            <div>
              <label className="label">كلمة المرور</label>
              <div className="relative" dir="ltr">
                <input
                  type="password"
                  className="input-field bg-slate-100 border-slate-100"
                  style={{ paddingLeft: '2.5rem' }}
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V7a5 5 0 0110 0v4" />
                  </svg>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end text-sm">
              <label className="inline-flex items-center gap-2 text-slate-500 cursor-pointer select-none">
                <input type="checkbox" className="rounded border-slate-300" />
                تذكرني
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-2.5 font-bold text-white bg-gradient-to-r from-blue-800 to-sky-500 hover:from-blue-700 hover:to-sky-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'جاري الدخول...' : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>دخول</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center text-xs text-slate-500 mt-4">
            ليس لديك حساب؟{' '}
            <Link to="/register" className="text-blue-700 hover:underline font-semibold">سجل الآن</Link>
          </div>
        </div>
      </section>

      <aside
        className="w-full lg:w-1/2 h-full relative overflow-hidden bg-gradient-to-b from-blue-900 via-blue-800 to-blue-950 text-white"
        dir="rtl"
      >
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: 'repeating-linear-gradient(-35deg, rgba(255,255,255,0.3) 0, rgba(255,255,255,0.3) 1px, transparent 1px, transparent 18px)' }}
        />

        <div
          className="absolute z-0 pointer-events-none select-none"
          style={{ bottom: '-3rem', left: '-1rem', opacity: 0.07, lineHeight: 1 }}
        >
          <div style={{ fontFamily: 'Georgia, serif', fontWeight: 900, fontSize: '13rem', color: 'white', letterSpacing: '-0.02em' }}>Jenan</div>
          <div style={{ fontFamily: 'Georgia, serif', fontWeight: 900, fontSize: '7.5rem', color: '#bae6fd', letterSpacing: '0.18em', marginTop: '-1rem' }}>BIZ</div>
        </div>

        <div className="absolute top-5 right-5 z-10 leading-none select-none" dir="ltr">
          <div className="flex items-baseline gap-0">
            <span className="font-serif font-bold text-white drop-shadow-[0_4px_14px_rgba(10,20,60,0.45)]" style={{ fontSize: '3rem', lineHeight: 1 }}>J</span>
            <span className="font-serif italic text-white/90 tracking-tight" style={{ fontSize: '1.35rem', lineHeight: 1 }}>enan</span>
          </div>
          <div className="text-left text-sky-300 font-bold tracking-[0.22em] text-[0.85rem] mt-[-4px]">BIZ</div>
        </div>

        <div className="relative z-10 flex flex-col justify-between px-6 md:px-10 lg:px-14 text-right h-full" style={{ paddingTop: '4.5rem', paddingBottom: '1.5rem' }}>
          <div>
            <p className="text-[10px] text-sky-300 mb-2 font-semibold tracking-[0.16em] uppercase">
              منصة متكاملة · تحليل وإدارة الاستشارات الإدارية
            </p>

            <h1 className="text-[1.7rem] md:text-[2.2rem] font-extrabold leading-tight mb-1 text-white">حلول الأعمال</h1>
            <h1 className="text-[1.7rem] md:text-[2.2rem] font-extrabold leading-tight mb-3 text-sky-300">المتكاملة</h1>

            <p className="text-blue-100/75 text-[11px] md:text-xs leading-[1.7] max-w-[400px]">
              تحليل وإدارة الاستشارات الإدارية، وتأهيل وإعادة هيكلة المنشآت باحترافية عالية.
            </p>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div className="max-w-[500px] w-full space-y-3">
              <div className="group w-full py-1.5 transition-all duration-300 hover:-translate-y-0.5">
                <div className="flex items-center gap-3 justify-end">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-sky-300 transition-colors duration-300 group-hover:text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <div className="text-right">
                    <p className="font-bold text-white text-xs md:text-sm leading-tight transition-colors duration-300 group-hover:text-cyan-300">تحليل ذكي</p>
                    <p className="text-blue-100/65 text-[10px] md:text-[11px] leading-tight mt-1 transition-colors duration-300 group-hover:text-cyan-100">تحليل ذكي لبيانات المنشآت والكشوفات</p>
                  </div>
                </div>
              </div>

              <div className="group w-full py-1.5 transition-all duration-300 hover:-translate-y-0.5">
                <div className="flex items-center gap-3 justify-end">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-sky-300/90 transition-colors duration-300 group-hover:text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-right">
                    <p className="font-bold text-white text-xs md:text-sm leading-tight transition-colors duration-300 group-hover:text-cyan-300">إدارة المستندات</p>
                    <p className="text-blue-100/62 text-[10px] md:text-[11px] leading-tight mt-1 transition-colors duration-300 group-hover:text-cyan-100">رفع وتنظيم ملفات المنشأة والعقود</p>
                  </div>
                </div>
              </div>

              <div className="group w-full py-1.5 transition-all duration-300 hover:-translate-y-0.5">
                <div className="flex items-center gap-3 justify-end">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-sky-300/80 transition-colors duration-300 group-hover:text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div className="text-right">
                    <p className="font-bold text-white text-xs md:text-sm leading-tight transition-colors duration-300 group-hover:text-cyan-300">متابعة شاملة</p>
                    <p className="text-blue-100/58 text-[10px] md:text-[11px] leading-tight mt-1 transition-colors duration-300 group-hover:text-cyan-100">متابعة الطلبات والشركاء والوسطاء</p>
                  </div>
                </div>
              </div>

              <div className="group w-full py-1.5 transition-all duration-300 hover:-translate-y-0.5">
                <div className="flex items-center gap-3 justify-end">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-sky-300/70 transition-colors duration-300 group-hover:text-cyan-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <div className="text-right">
                    <p className="font-bold text-white text-xs md:text-sm leading-tight transition-colors duration-300 group-hover:text-cyan-300">إعادة هيكلة المنشآت</p>
                    <p className="text-blue-100/55 text-[10px] md:text-[11px] leading-tight mt-1 transition-colors duration-300 group-hover:text-cyan-100">تأهيل وإعادة هيكلة المنشآت والشركات</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-blue-200/60 select-none">
            © Jenan BIZ 2026 - جميع الحقوق محفوظة
          </p>
        </div>
      </aside>
    </div>
  );
}
