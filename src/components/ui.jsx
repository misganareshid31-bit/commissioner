import React from 'react';

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

export const VerifiedBadge = ({ size = 'default' }) => {
  const iconSize = size === 'small' ? 14 : 16;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: '#036377' }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
        <path
          d="M12.00,1.00 L14.25,3.60 L17.50,2.47 L18.15,5.85 L21.53,6.50 L20.40,9.75 L23.00,12.00 L20.40,14.25 L21.53,17.50 L18.15,18.15 L17.50,21.53 L14.25,20.40 L12.00,23.00 L9.75,20.40 L6.50,21.53 L5.85,18.15 L2.47,17.50 L3.60,14.25 L1.00,12.00 L3.60,9.75 L2.47,6.50 L5.85,5.85 L6.50,2.47 L9.75,3.60 Z"
          fill="#00D9FF"
        />
        <path d="M8 12.2L10.8 15L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      Verified by Commissioner
    </span>
  );
};
