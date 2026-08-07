import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      <label className="text-sm font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
      <input
        className="w-full bg-slate-900 text-white p-4 rounded-xl border border-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
        {...props}
      />
    </div>
  );
}
