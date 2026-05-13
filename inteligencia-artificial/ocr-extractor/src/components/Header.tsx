import React from 'react';
import { Cpu } from 'lucide-react';

export function Header() {
  return (
    <header className="h-20 border-b border-white/5 bg-slate-950/60 backdrop-blur-xl flex items-center justify-between px-8 relative z-50 flex-shrink-0">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-lg">
          <Cpu className="w-5 h-5 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-black tracking-tighter premium-gradient-text uppercase">
          Extrator de Texto
        </h1>
      </div>
    </header>
  );
}
