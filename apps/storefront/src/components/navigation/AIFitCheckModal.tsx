'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, Check, ArrowRight, ShieldCheck, Shirt, Ruler } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export const AIFitCheckModal: React.FC = () => {
  const { isFitCheckOpen, closeFitCheck } = useCart();
  const router = useRouter();

  const [heightFeet, setHeightFeet] = useState<number>(5);
  const [heightInches, setHeightInches] = useState<number>(9);
  const [weightKg, setWeightKg] = useState<number>(70);
  const [bodyBuild, setBodyBuild] = useState<'slim' | 'athletic' | 'average' | 'stocky'>('athletic');
  const [fitPreference, setFitPreference] = useState<'oversized' | 'relaxed' | 'regular'>('oversized');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Load previously saved fit preferences if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('poshplex_ai_fit');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.heightFeet) setHeightFeet(parsed.heightFeet);
          if (parsed.heightInches) setHeightInches(parsed.heightInches);
          if (parsed.weightKg) setWeightKg(parsed.weightKg);
          if (parsed.bodyBuild) setBodyBuild(parsed.bodyBuild);
          if (parsed.fitPreference) setFitPreference(parsed.fitPreference);
        }
      } catch (e) {
        // Ignore JSON error
      }
    }
  }, [isFitCheckOpen]);

  if (!isFitCheckOpen) return null;

  // Calculate Streetwear Size Recommendation Algorithm
  const calculateRecommendation = () => {
    const totalInches = heightFeet * 12 + heightInches;
    let baseScore = 0;

    // Height heuristic
    if (totalInches < 65) baseScore += 1;
    else if (totalInches <= 69) baseScore += 2;
    else if (totalInches <= 73) baseScore += 3;
    else baseScore += 4;

    // Weight heuristic
    if (weightKg < 60) baseScore += 0;
    else if (weightKg <= 75) baseScore += 1;
    else if (weightKg <= 90) baseScore += 2;
    else baseScore += 3;

    // Build heuristic
    if (bodyBuild === 'slim') baseScore -= 0.5;
    if (bodyBuild === 'stocky') baseScore += 1;

    // Fit preference adjustment (Streetwear standard)
    if (fitPreference === 'oversized') baseScore += 1;
    if (fitPreference === 'regular') baseScore -= 0.5;

    let size = 'M';
    if (baseScore <= 2) size = 'S';
    else if (baseScore <= 3.5) size = 'M';
    else if (baseScore <= 5.5) size = 'L';
    else if (baseScore <= 7) size = 'XL';
    else size = 'XXL';

    const confidence = Math.min(99, Math.max(94, 94 + (heightInches % 5)));

    return { size, confidence };
  };

  const { size: recommendedSize, confidence } = calculateRecommendation();

  const handleApplyAndBrowse = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'poshplex_ai_fit',
        JSON.stringify({
          heightFeet,
          heightInches,
          weightKg,
          bodyBuild,
          fitPreference,
          recommendedSize,
        })
      );
      localStorage.setItem('poshplex_fit_size', recommendedSize);
    }
    setSavedSuccess(true);
    setTimeout(() => {
      closeFitCheck();
      router.push(`/catalog?size=${recommendedSize}`);
    }, 400);
  };

  return (
    <div
      onClick={closeFitCheck}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm sm:max-w-md bg-slate-900 border border-white/15 rounded-2xl shadow-2xl text-white overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
      >
        {/* Top Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-violet-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.5)]">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold tracking-tight text-white flex items-center gap-1.5">
                <span>AI Fit Check™</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  PRO
                </span>
              </h3>
              <p className="text-[10.5px] text-slate-400">Streetwear Silhouette & Sizing Engine</p>
            </div>
          </div>

          <button
            onClick={closeFitCheck}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
            aria-label="Close Fit Check"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto no-scrollbar flex-1 text-xs">
          {/* 1. Height & Weight Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-white/10">
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                Height
              </label>
              <div className="flex items-center gap-1 font-mono text-sm font-bold">
                <select
                  value={heightFeet}
                  onChange={(e) => setHeightFeet(Number(e.target.value))}
                  className="bg-slate-800 text-white rounded px-2 py-1 outline-none border border-white/10"
                >
                  <option value={4}>4'</option>
                  <option value={5}>5'</option>
                  <option value={6}>6'</option>
                </select>
                <select
                  value={heightInches}
                  onChange={(e) => setHeightInches(Number(e.target.value))}
                  className="bg-slate-800 text-white rounded px-2 py-1 outline-none border border-white/10"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i} value={i}>
                      {i}"
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-white/10">
              <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                Weight
              </label>
              <div className="flex items-center gap-1 font-mono text-sm font-bold">
                <input
                  type="number"
                  min={40}
                  max={150}
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  className="w-16 bg-slate-800 text-white rounded px-2 py-1 outline-none border border-white/10"
                />
                <span className="text-slate-400 text-xs">KG</span>
              </div>
            </div>
          </div>

          {/* 2. Body Build */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
              Body Frame / Build
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { key: 'slim', label: 'Slim' },
                { key: 'athletic', label: 'Athletic' },
                { key: 'average', label: 'Average' },
                { key: 'stocky', label: 'Stocky' },
              ].map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBodyBuild(b.key as any)}
                  className={`py-2 rounded-lg text-center font-bold transition text-[11px] border ${
                    bodyBuild === b.key
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.4)]'
                      : 'bg-slate-950/50 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Fit Silhouette Preference */}
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
              Streetwear Silhouette Preference
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { key: 'oversized', label: 'Boxy / Oversized', badge: 'Signature' },
                { key: 'relaxed', label: 'Relaxed Fit', badge: 'Standard' },
                { key: 'regular', label: 'Regular Fit', badge: 'Fitted' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFitPreference(f.key as any)}
                  className={`p-2 rounded-lg text-left transition border ${
                    fitPreference === f.key
                      ? 'bg-cyan-950/80 text-cyan-200 border-cyan-400/80 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : 'bg-slate-950/50 text-slate-400 border-white/10 hover:text-white'
                  }`}
                >
                  <span className="block text-[11px] font-bold text-white">{f.label}</span>
                  <span className="block text-[9.5px] text-cyan-400/80 font-mono mt-0.5">{f.badge}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. AI Calculated Recommendation Box */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-violet-950/70 via-slate-900 to-cyan-950/70 border border-cyan-500/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-cyan-300 flex items-center gap-1.5">
                <Shirt className="h-3.5 w-3.5" />
                Recommended Size
              </span>
              <span className="text-[10.5px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {confidence}% Match
              </span>
            </div>

            <div className="flex items-baseline space-x-3">
              <span className="text-3xl font-black font-mono text-white tracking-tight">
                {recommendedSize}
              </span>
              <span className="text-xs text-slate-300 font-medium">
                {fitPreference === 'oversized' ? 'Streetwear Boxy Drop-Shoulder' : 'Standard Cut'}
              </span>
            </div>

            <p className="text-[11px] text-slate-300 leading-snug">
              {fitPreference === 'oversized'
                ? `Size ${recommendedSize} delivers the signature boxy drop-shoulder look with generous chest drape and relaxed hem break.`
                : `Size ${recommendedSize} offers clean tailored lines while preserving comfortable all-day movement.`}
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={closeFitCheck}
            className="py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            Dismiss
          </button>

          <button
            type="button"
            onClick={handleApplyAndBrowse}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-400 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-[0_0_16px_rgba(99,102,241,0.5)] flex items-center justify-center space-x-1.5 transition active:scale-[0.98]"
          >
            {savedSuccess ? (
              <>
                <Check className="h-4 w-4" />
                <span>Size {recommendedSize} Applied!</span>
              </>
            ) : (
              <>
                <span>Apply & Browse Size {recommendedSize}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

