import React from 'react';

export default function LogoHeader({ subtitle }) {
  return (
    <div className="flex flex-col items-center mb-6">
      <img src="/logo.jpeg" alt="شعار جنان بيز" className="h-20 mb-2 drop-shadow" />
      <h1 className="text-3xl font-bold text-blue-900 mb-1 tracking-wide" style={{fontFamily:'Tajawal, Cairo, sans-serif'}}>Jenan <span className="text-gradient">BIZ</span></h1>
      {subtitle && <p className="text-slate-500 text-sm">{subtitle}</p>}
    </div>
  );
}
