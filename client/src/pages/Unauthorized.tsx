import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function Unauthorized() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4">
      <div className="glass-panel max-w-md w-full p-8 rounded-2xl text-center border border-white/10 relative overflow-hidden">
        {/* Glow Element */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="mx-auto h-16 w-16 bg-rose-500/10 border border-rose-500/25 rounded-2xl flex items-center justify-center mb-6">
          <ShieldAlert className="h-8 w-8 text-rose-500 animate-pulse" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
          You do not have permission to access this page. This action has been logged for security review.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full bg-primary hover:bg-primary/95 text-white py-2.5 rounded-xl text-xs font-semibold transition-all shadow-[0_0_15px_rgba(59,130,246,0.2)]"
          >
            Return to Dashboard
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full flex items-center justify-center space-x-2 text-slate-400 hover:text-white py-2.5 rounded-xl text-xs font-semibold hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    </div>
  );
}
