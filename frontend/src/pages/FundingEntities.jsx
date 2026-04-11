import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';

export default function FundingEntities() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [entities, setEntities] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // نموذج إضافة جهة
  const [showAddEntity, setShowAddEntity] = useState(false);
  const [entityForm, setEntityForm] = useState({ name: '', whatsapp_number: '', priority: 0 });
  const [savingEntity, setSavingEntity] = useState(false);

  // نموذج إضافة موظف جهة
  const [addingContactFor, setAddingContactFor] = useState(null);
  const [contactForm, setContactForm] = useState({ name: '', phone: '' });
  const [savingContact, setSavingContact] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [ents, conts] = await Promise.all([
        api.adminGetFundingEntities(),
        api.adminGetContacts(),
      ]);
      setEntities(ents);
      setContacts(conts);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const contactsOf = (entityId) => contacts.filter(c => c.funding_entity_id === entityId);

  const handleAddEntity = async () => {
    if (!entityForm.name.trim()) return;
    setSavingEntity(true);
    try {
      await api.adminAddFundingEntity({ ...entityForm, priority: Number(entityForm.priority) });
      setEntityForm({ name: '', whatsapp_number: '', priority: 0 });
      setShowAddEntity(false);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSavingEntity(false); }
  };

  const handleDeleteEntity = async (id) => {
    if (!window.confirm('هل تريد حذف هذه الجهة التمويلية؟')) return;
    try { await api.adminDeleteFundingEntity(id); load(); }
    catch (e) { setErr(e.message); }
  };

  const handleAddContact = async (entityId) => {
    if (!contactForm.name.trim() || !contactForm.phone.trim()) return;
    setSavingContact(true);
    try {
      await api.adminAddContact({ funding_entity_id: entityId, ...contactForm });
      setContactForm({ name: '', phone: '' });
      setAddingContactFor(null);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSavingContact(false); }
  };

  const handleDeleteContact = async (id) => {
    if (!window.confirm('هل تريد حذف هذا الموظف؟')) return;
    try { await api.adminDeleteContact(id); load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* شريط التنقل */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-blue-600 text-sm font-medium">
            ← الرئيسية
          </button>
          <span className="text-slate-300">|</span>
          <h1 className="font-bold text-blue-900">جهات التمويلية وموظفيها</h1>
        </div>
        <button onClick={() => { logout(); navigate('/login'); }} className="text-xs text-red-400 hover:text-red-600">خروج</button>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {err && <div className="bg-red-50 text-red-600 rounded-xl p-3 text-sm">⚠ {err}</div>}

        {/* زر إضافة جهة */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-700">الجهات التمويلية ({entities.length})</h2>
          <button
            onClick={() => setShowAddEntity(v => !v)}
            className="bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-800"
          >
            + إضافة جهة
          </button>
        </div>

        {/* نموذج إضافة جهة */}
        {showAddEntity && (
          <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
            <p className="font-semibold text-blue-800 text-sm">جهة تمويلية جديدة</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">اسم الجهة *</label>
                <input
                  value={entityForm.name}
                  onChange={e => setEntityForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: بنك الراجحي"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">رقم الواتساب</label>
                <input
                  value={entityForm.whatsapp_number}
                  onChange={e => setEntityForm(f => ({ ...f, whatsapp_number: e.target.value }))}
                  placeholder="966XXXXXXXXX"
                  dir="ltr"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddEntity}
                disabled={savingEntity || !entityForm.name.trim()}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
              >{savingEntity ? '...' : 'حفظ'}</button>
              <button
                onClick={() => setShowAddEntity(false)}
                className="text-slate-500 px-4 py-2 rounded-lg text-sm hover:bg-slate-100"
              >إلغاء</button>
            </div>
          </div>
        )}

        {/* قائمة الجهات */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">جاري التحميل...</div>
        ) : entities.length === 0 ? (
          <div className="text-center py-16 text-slate-400">لا توجد جهات تمويلية</div>
        ) : (
          entities.map(entity => {
            const cts = contactsOf(entity.id);
            const isOpen = openId === entity.id;
            const wa = entity.whatsapp_number?.replace(/\D/g, '');

            return (
              <div key={entity.id} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                {/* رأس الجهة */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                  onClick={() => setOpenId(isOpen ? null : entity.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      🏦
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{entity.name}</p>
                      <p className="text-xs text-slate-400">{cts.length} موظف · {entity.is_active ? 'نشطة' : 'غير نشطة'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-600"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        واتساب
                      </a>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteEntity(entity.id); }}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1.5 rounded-lg text-xs"
                    >🗑️</button>
                    <span className={`text-slate-400 text-sm transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                </div>

                {/* قائمة الموظفين (جهات الاتصال) */}
                {isOpen && (
                  <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-600">موظفو الجهة</p>
                      <button
                        onClick={() => setAddingContactFor(entity.id)}
                        className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 font-semibold"
                      >+ إضافة موظف</button>
                    </div>

                    {/* نموذج إضافة موظف */}
                    {addingContactFor === entity.id && (
                      <div className="bg-white rounded-xl border border-blue-200 p-3 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            value={contactForm.name}
                            onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                            placeholder="الاسم *"
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                          <input
                            value={contactForm.phone}
                            onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                            placeholder="الجوال *"
                            dir="ltr"
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddContact(entity.id)}
                            disabled={savingContact || !contactForm.name.trim() || !contactForm.phone.trim()}
                            className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                          >{savingContact ? '...' : 'حفظ'}</button>
                          <button
                            onClick={() => { setAddingContactFor(null); setContactForm({ name: '', phone: '' }); }}
                            className="text-slate-500 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-100"
                          >إلغاء</button>
                        </div>
                      </div>
                    )}

                    {/* قائمة موظفي الجهة */}
                    {cts.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">لا يوجد موظفون مسجلون</p>
                    ) : (
                      cts.map(c => {
                        const phone = c.phone?.replace(/\D/g, '');
                        return (
                          <div key={c.id} className="flex items-center justify-between bg-white rounded-xl border border-slate-100 px-4 py-3">
                            <div>
                              <p className="font-semibold text-sm text-slate-800">{c.name}</p>
                              {c.phone && (
                                <p className="text-xs text-slate-500 mt-0.5" dir="ltr">{c.phone}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {phone && (
                                <a
                                  href={`https://wa.me/${phone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 bg-green-500 text-white px-2.5 py-1 rounded-lg text-xs font-semibold hover:bg-green-600"
                                >
                                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                  </svg>
                                  واتساب
                                </a>
                              )}
                              <button
                                onClick={() => handleDeleteContact(c.id)}
                                className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg text-xs"
                              >🗑️</button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
