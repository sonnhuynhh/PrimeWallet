import React from 'react';
import { motion } from 'framer-motion';

interface CardProps extends React.ComponentProps<typeof motion.div> {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-slate-800/80 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border border-slate-700/50 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}
