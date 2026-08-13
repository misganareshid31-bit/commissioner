import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const Button = ({ children, variant = 'primary', className = '', ...props }) => {
  const styles = {
    primary: { background: '#E6007A', color: 'white' },
    secondary: { background: 'transparent', color: '#036377', border: '2px solid #00D9FF' },
    dark: { background: '#111827', color: 'white' },
    ghost: { background: 'transparent', color: '#374151' },
  };
  return (
    <button
      {...props}
      style={styles[variant]}
      className={`text-sm font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
};

export const Card = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border p-5 ${className}`} style={{ borderColor: '#E5E7EB' }}>
    {children}
  </div>
);

export const Input = ({ label, icon: Icon, ...props }) => (
  <div>
    {label && <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>{label}</label>}
    <div className="flex items-center gap-2 border rounded-lg px-3 py-2.5" style={{ borderColor: '#E5E7EB' }}>
      {Icon && <Icon size={15} style={{ color: '#6B7280' }} />}
      <input {...props} className="flex-1 outline-none text-sm bg-transparent" />
    </div>
  </div>
);

export const Select = ({ label, children, ...props }) => (
  <div>
    {label && <label className="text-xs font-semibold block mb-1.5" style={{ color: '#374151' }}>{label}</label>}
    <select {...props} className="w-full border rounded-lg px-3 py-2.5 text-sm outline-none" style={{ borderColor: '#E5E7EB' }}>
      {children}
    </select>
  </div>
);

export const Badge = ({ children, tone = 'magenta' }) => {
  const tones = {
    magenta: { background: '#FDE7F1', color: '#99154F' },
    cyan: { background: '#E0FBFF', color: '#036377' },
    gray: { background: '#F8FAFC', color: '#374151' },
    green: { background: '#E9FBEF', color: '#0E7A3B' },
  };
  return (
    <span style={tones[tone]} className="text-[11px] font-semibold px-2.5 py-1 rounded-full inline-block">
      {children}
    </span>
  );
};

export const VerifiedBadge = () => (
  <span style={{ background: '#E0FBFF', color: '#036377' }} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold">
    <CheckCircle2 size={12} strokeWidth={2.5} />
    Verified by Commissioner
  </span>
);
