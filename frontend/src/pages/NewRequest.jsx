import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
// ======================================================
// أسئلة التأهيل — الإجابة على هذه الأسئلة تحدد إمكانية التأهيل
// ======================================================
const QUESTIONS = [
  {
    id: 'has_activity',
    text: 'هل المنشأة لديها نشاط تجاري فعال ومسجل؟',
    options: ['نعم', 'لا'],
    disqualify: 'لا',
  },
  {
    id: 'activity_age',
    text: 'كم عمر النشاط التجاري؟',
    options: ['أقل من 6 أشهر', '6-12 شهر', 'أكثر من 12 شهر'],
    disqualify: 'أقل من 6 أشهر',
  },
  {
    id: 'has_revenue',
    text: 'هل توجد إيرادات أو مبيعات (نقاط بيع، كاش، تحويلات)؟',
    options: ['نعم', 'لا'],
    disqualify: 'لا',
  },
  {
    id: 'has_bank_account',
    text: 'هل يوجد حساب بنكي باسم المنشأة؟',
    options: ['نعم', 'لا'],
    disqualify: 'لا',
  },
];

const FUNDING_TYPES = ['نقاط بيع', 'كاش', 'إقرارات ضريبية', 'تمويل تجاري', 'تمويل شخصي'];
const ENTITY_TYPES = ['شركة', 'مؤسسة', 'شخص واحد'];
const OWNERSHIP_TYPES = ['سعودي', 'خليجي', 'أجنبي'];

export default function NewRequest() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0=أسئلة التأهيل, 1=بيانات الطلب
  const [answers, setAnswers] = useState({});
  const [disqualified, setDisqualified] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    owner_name: '',
    owner_phone: '',
    entity_type: 'شركة',
    ownership_type: 'سعودي',
    funding_type: 'نقاط بيع',
  });
  const [broker, setBroker] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentQ = QUESTIONS[step];
  const totalQ = QUESTIONS.length;

  const handleAnswer = (answer) => {
    const newAnswers = { ...answers, [currentQ.id]: answer };
    setAnswers(newAnswers);

    if (currentQ.disqualify === answer) {
      setDisqualified(true);
      return;
    }

    if (step < totalQ - 1) {
      setStep(step + 1);
    } else {
      // انتهت الأسئلة — مؤهل
      setStep('form');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim()) return setError('اسم المنشأة مطلوب');
    setLoading(true);
    setError('');
    try {
      const req = await api.createRequest(form);
      // إذا أدخل الموظف بيانات وسيط، يتم حفظه تلقائياً
      if (broker.name.trim() && broker.phone.trim()) {
        await api.addBroker({ name: broker.name.trim(), phone: broker.phone.trim() }).catch(() => {});
      }
      navigate(`/request/${req.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── غير مؤهل ───
  if (disqualified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⛔</div>
          <h2 className="text-xl font-bold text-red-700 mb-3">غير مؤهل للتمويل حالياً</h2>
          <p className="text-slate-500 text-sm mb-6">
            بناءً على إجاباتك، لا تستوفي المنشأة الشروط الأساسية للتمويل في الوقت الحالي.
          </p>
          <button
            onClick={() => { setStep(0); setAnswers({}); setDisqualified(false); }}
            className="bg-slate-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-slate-700"
          >
            إعادة المحاولة
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="mr-3 text-sm text-blue-600 hover:underline"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  // ─── نموذج بيانات الطلب ───
  if (step === 'form') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full">
          <button onClick={() => navigate('/dashboard')} className="text-sm text-slate-400 hover:text-blue-600 mb-4">
            ← العودة
          </button>
          <h2 className="text-2xl font-bold text-blue-900 mb-6">بيانات الطلب</h2>

          {error && <div className="bg-red-50 text-red-600 rounded-lg p-3 text-sm mb-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">اسم المنشأة / الشركة *</label>
              <input
                type="text" required className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                placeholder="مثال: شركة النجم للتجارة"
                value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">اسم المالك</label>
              <input
                type="text" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                placeholder="اسم صاحب المنشأة"
                value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">رقم الهاتف</label>
              <input
                type="tel" className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                placeholder="05XXXXXXXX"
                value={form.owner_phone} onChange={e => setForm({ ...form, owner_phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">نوع المنشأة</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  value={form.entity_type} onChange={e => setForm({ ...form, entity_type: e.target.value })}>
                  {ENTITY_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">الجنسية</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  value={form.ownership_type} onChange={e => setForm({ ...form, ownership_type: e.target.value })}>
                  {OWNERSHIP_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">نوع التمويل</label>
                <select className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                  value={form.funding_type} onChange={e => setForm({ ...form, funding_type: e.target.value })}>
                  {FUNDING_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* ── بيانات الوسيط (اختيارية) ── */}
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400 font-semibold mb-3 uppercase tracking-wide">🤝 الوسيط (اختياري)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">اسم الوسيط</label>
                  <input
                    type="text"
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="اسم الوسيط"
                    value={broker.name}
                    onChange={e => setBroker({ ...broker, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">جوال الوسيط</label>
                  <input
                    type="tel"
                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="05XXXXXXXX"
                    value={broker.phone}
                    onChange={e => setBroker({ ...broker, phone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-700 text-white py-3 rounded-lg font-bold hover:bg-blue-800 transition disabled:opacity-50 mt-2"
            >
              {loading ? 'جاري الإنشاء...' : 'إنشاء الطلب →'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ─── أسئلة التأهيل ───
  const progress = ((step) / totalQ) * 100;
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full">
        <button onClick={() => navigate('/dashboard')} className="text-sm text-slate-400 hover:text-blue-600 mb-4">
          ← العودة
        </button>

        {/* شريط التقدم */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>التأهيل الأولي</span>
            <span>{step + 1} / {totalQ}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="text-center mb-8">
          <div className="text-3xl mb-4">❓</div>
          <h2 className="text-xl font-bold text-slate-800 leading-relaxed">{currentQ.text}</h2>
        </div>

        <div className="space-y-3">
          {currentQ.options.map(opt => (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              className="w-full text-right px-5 py-4 rounded-xl border-2 border-slate-200 font-semibold text-slate-700 hover:border-blue-500 hover:bg-blue-50 transition"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
