import React from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends React.ComponentProps<typeof motion.button> {
  title: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}

export function Button({ title, loading, variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const baseClasses = "w-full py-3 px-6 rounded-xl font-bold flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_15px_rgba(5,150,105,0.3)]",
    secondary: "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700",
    danger: "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`${baseClasses} ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        children || title
      )}
    </motion.button>
  );
}
