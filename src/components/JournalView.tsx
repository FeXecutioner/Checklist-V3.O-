import React, { useState, useMemo } from 'react';
import { TradeRecord, SetupType } from '../types';
import {
  Trash2,
  ZoomIn,
  Search,
  Download,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Camera,
} from 'lucide-react';

interface JournalViewProps {
  trades: TradeRecord[];
  onDeleteTrade: (id: number) => Promise<void>;
  onClearAllTrades: () => Promise<void>;
  onOpenLightbox: (imageUrl: string) => void;
  onNavigateToExec: () => void;
}

export const JournalView: React.FC<JournalViewProps> = ({
  trades,
  onDeleteTrade,
  onClearAllTrades,
  onOpenLightbox,
  onNavigateToExec,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [setupFilter, setSetupFilter] = useState<'all' | SetupType>('all');
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'win' | 'loss'>('all');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Statistics calculation
  const stats = useMemo(() => {
    if (trades.length === 0) {
      return { totalTrades: 0, winRate: 0, netPnL: 0, rulesFollowedPct: 0 };
    }
    const total = trades.length;
    const wins = trades.filter((t) => t.pnl > 0).length;
    const net = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);
    const rules = trades.filter((t) => t.followedRules).length;

    return {
      totalTrades: total,
      winRate: Math.round((wins / total) * 100),
      netPnL: net,
      rulesFollowedPct: Math.round((rules / total) * 100),
    };
  }, [trades]);

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      // Search term
      const query = searchTerm.toLowerCase();
      const matchSearch =
        query === '' ||
        trade.directionalBias.toLowerCase().includes(query) ||
        trade.htfLogic.toLowerCase().includes(query) ||
        trade.ltfTarget.toLowerCase().includes(query) ||
        trade.entryModelTime.toLowerCase().includes(query) ||
        trade.feelings.toLowerCase().includes(query) ||
        trade.ruleBreaks.toLowerCase().includes(query) ||
        trade.improvements.toLowerCase().includes(query) ||
        trade.timestamp.toLowerCase().includes(query);

      // Setup filter
      const matchSetup = setupFilter === 'all' || trade.setup === setupFilter;

      // Outcome filter
      const matchOutcome =
        outcomeFilter === 'all' ||
        (outcomeFilter === 'win' && trade.pnl > 0) ||
        (outcomeFilter === 'loss' && trade.pnl <= 0);

      return matchSearch && matchSetup && matchOutcome;
    });
  }, [trades, searchTerm, setupFilter, outcomeFilter]);

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete this trade record from the internal journal?')) {
      setDeletingId(id);
      try {
        await onDeleteTrade(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(trades, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `FExec_Trades_Backup_${Date.now()}.json`);
    dlAnchor.click();
  };

  return (
    <div id="page-journal" className="space-y-6">
      {/* Analytics Banner */}
      <div className="bg-zinc-900/40 border border-white/10 backdrop-blur-xl rounded-2xl md:rounded-3xl p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-white/10 gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] font-bold uppercase bg-gradient-to-r from-teal-400 to-purple-600 text-white px-2.5 py-1 rounded-full shadow-[0_0_10px_rgba(45,212,191,0.3)]">
              SYNCHRONIZED DATABASE
            </span>
            <h2 className="font-disp font-bold text-lg sm:text-xl uppercase text-zinc-100 m-0 tracking-wide">
              Trade Execution History
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {trades.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="font-mono text-[11px] font-bold bg-white/5 hover:bg-white/10 text-zinc-300 px-3.5 py-2 rounded-xl border border-white/10 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Download size={13} className="text-teal-400" />
                  <span>EXPORT BACKUP</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Clear all trade history records? This cannot be undone.')) {
                      onClearAllTrades();
                    }
                  }}
                  className="font-mono text-[11px] font-bold text-rose-400 hover:bg-rose-950/30 px-3 py-2 rounded-xl border border-rose-500/20 flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Trash2 size={13} />
                  <span>CLEAR ALL</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="p-4 bg-zinc-950/40 rounded-2xl border border-white/5 shadow-inner">
            <div className="font-mono text-[10px] font-bold uppercase text-teal-400 flex items-center gap-1.5 tracking-wider">
              <FileText size={12} />
              <span>Total Trades</span>
            </div>
            <div className="font-disp text-2xl sm:text-3xl font-bold text-zinc-100 mt-1.5">
              {stats.totalTrades}
            </div>
          </div>

          <div className="p-4 bg-zinc-950/40 rounded-2xl border border-white/5 shadow-inner">
            <div className="font-mono text-[10px] font-bold uppercase text-teal-400 flex items-center gap-1.5 tracking-wider">
              {stats.netPnL >= 0 ? <TrendingUp size={12} className="text-teal-400" /> : <TrendingDown size={12} className="text-rose-400" />}
              <span>Net PnL</span>
            </div>
            <div
              className={`font-disp text-2xl sm:text-3xl font-bold mt-1.5 ${
                stats.netPnL > 0
                  ? 'text-teal-300 drop-shadow-[0_0_10px_rgba(45,212,191,0.3)]'
                  : stats.netPnL < 0
                  ? 'text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                  : 'text-zinc-200'
              }`}
            >
              {stats.netPnL >= 0 ? '+' : ''}${stats.netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="p-4 bg-zinc-950/40 rounded-2xl border border-white/5 shadow-inner">
            <div className="font-mono text-[10px] font-bold uppercase text-teal-400 flex items-center gap-1.5 tracking-wider">
              <DollarSign size={12} />
              <span>Win Rate</span>
            </div>
            <div className="font-disp text-2xl sm:text-3xl font-bold text-zinc-100 mt-1.5">
              {stats.winRate}%
            </div>
          </div>

          <div className="p-4 bg-zinc-950/40 rounded-2xl border border-white/5 shadow-inner">
            <div className="font-mono text-[10px] font-bold uppercase text-teal-400 flex items-center gap-1.5 tracking-wider">
              <ShieldCheck size={12} />
              <span>Rules Followed</span>
            </div>
            <div className="font-disp text-2xl sm:text-3xl font-bold text-zinc-100 mt-1.5">
              {stats.rulesFollowedPct}%
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-zinc-900/40 backdrop-blur-xl p-3.5 rounded-2xl border border-white/10 shadow-lg">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by bias, notes, feelings, or rule breaks..."
            className="w-full pl-10 pr-3.5 py-2.5 border border-white/10 bg-zinc-950/60 font-body text-xs rounded-xl text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 transition-all"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={setupFilter}
            onChange={(e) => setSetupFilter(e.target.value as 'all' | SetupType)}
            aria-label="Filter by setup"
            className="border border-white/10 bg-zinc-950/60 px-3.5 py-2 font-mono text-xs rounded-xl text-zinc-200 font-bold cursor-pointer focus:outline-hidden focus:border-teal-400"
          >
            <option value="all">ALL SETUPS</option>
            <option value="continuation">CONTINUATION</option>
            <option value="reversal">REVERSAL</option>
          </select>

          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as 'all' | 'win' | 'loss')}
            aria-label="Filter by outcome"
            className="border border-white/10 bg-zinc-950/60 px-3.5 py-2 font-mono text-xs rounded-xl text-zinc-200 font-bold cursor-pointer focus:outline-hidden focus:border-teal-400"
          >
            <option value="all">ALL OUTCOMES</option>
            <option value="win">WINS ONLY (+)</option>
            <option value="loss">LOSSES ONLY (-)</option>
          </select>
        </div>
      </div>

      {/* Trade Entries List */}
      {filteredTrades.length === 0 ? (
        <div className="bg-zinc-900/40 border border-white/10 backdrop-blur-xl rounded-3xl p-12 text-center shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.25)]">
            <FileText size={22} />
          </div>
          <div className="font-mono text-sm font-bold text-zinc-300 mb-2 uppercase tracking-wide">
            {trades.length === 0 ? 'Internal Journal Empty' : 'No records match filter'}
          </div>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6 font-body leading-relaxed">
            {trades.length === 0
              ? 'Complete your trade checklist and commit your execution record in Execution Console. Full typed contents and analysis will be permanently preserved here.'
              : 'Try clearing your search terms or changing your setup and outcome filters.'}
          </p>
          {trades.length === 0 && (
            <button
              type="button"
              onClick={onNavigateToExec}
              className="font-mono text-xs font-bold uppercase bg-gradient-to-r from-teal-500 to-purple-600 hover:from-teal-400 hover:to-purple-500 text-white px-6 py-3 rounded-xl shadow-[0_0_20px_rgba(45,212,191,0.4)] cursor-pointer transition-all border border-teal-300/40"
            >
              Open Execution Console
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredTrades.map((trade) => {
            const isWin = trade.pnl > 0;
            const isLoss = trade.pnl < 0;

            return (
              <article
                key={trade.id}
                className="bg-zinc-900/40 border border-white/10 hover:border-teal-400/40 backdrop-blur-xl rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl transition-all duration-300"
              >
                {/* Record Header */}
                <div className="p-4 bg-white/[0.03] text-zinc-100 font-mono text-xs flex flex-wrap items-center justify-between gap-3 border-b border-white/10">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-bold tracking-wider text-teal-300">
                      RECORD: {trade.timestamp}
                    </span>

                    <span
                      className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${
                        trade.setup === 'continuation'
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                          : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                      }`}
                    >
                      {trade.setup}
                    </span>

                    <div
                      className={`font-disp font-bold text-sm px-3 py-0.5 rounded-lg border ${
                        isWin
                          ? 'text-teal-300 border-teal-500/40 bg-teal-950/40 shadow-[0_0_12px_rgba(45,212,191,0.25)]'
                          : isLoss
                          ? 'text-rose-400 border-rose-500/40 bg-rose-950/40 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                          : 'text-zinc-200 border-white/10 bg-zinc-950/60'
                      }`}
                    >
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Rule indicator tags */}
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold border ${
                        trade.followedRules
                          ? 'bg-teal-950/40 text-teal-300 border-teal-500/30'
                          : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {trade.followedRules ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      <span>Rules</span>
                    </span>

                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 font-bold border ${
                        trade.emotionsControlled
                          ? 'bg-teal-950/40 text-teal-300 border-teal-500/30'
                          : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {trade.emotionsControlled ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      <span>Emotions</span>
                    </span>

                    <button
                      type="button"
                      disabled={deletingId === trade.id}
                      onClick={() => handleDelete(trade.id)}
                      className="px-2.5 py-1 font-mono text-[10px] font-bold text-rose-400 hover:bg-rose-950/40 border border-rose-500/30 rounded-lg cursor-pointer transition-colors ml-2"
                    >
                      {deletingId === trade.id ? 'DELETING...' : 'DELETE'}
                    </button>
                  </div>
                </div>

                {/* Sub-bar: Directional Bias & Financial Summary */}
                <div className="bg-zinc-950/50 px-5 py-3 border-b border-white/10 flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-teal-400 uppercase text-[10px] tracking-wider">
                      BIAS:
                    </span>
                    <span className="font-bold text-zinc-100">
                      {trade.directionalBias || 'None stated'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-400">
                    {trade.balanceBefore > 0 && (
                      <span>
                        BAL BEFORE: <b className="text-zinc-200">${trade.balanceBefore.toLocaleString()}</b>
                      </span>
                    )}
                    {trade.balanceAfter > 0 && (
                      <span>
                        BAL AFTER: <b className="text-zinc-200">${trade.balanceAfter.toLocaleString()}</b>
                      </span>
                    )}
                    {trade.bufferSurvivalTrades !== undefined && (
                      <span>
                        BUFFER: <b className="text-rose-400">{trade.bufferSurvivalTrades} Losses</b>
                      </span>
                    )}
                  </div>
                </div>

                {/* FULL CONTENTS DISPLAY */}
                <div className="p-5 sm:p-6 space-y-4 text-xs font-body">
                  {/* Section 1: Post-Trade Analysis Full Text */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border border-white/5 bg-zinc-950/40 p-4 rounded-2xl">
                      <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-2 flex items-center justify-between tracking-wider">
                        <span>HTF Bias Logic & Context</span>
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                          FULL CONTENT
                        </span>
                      </div>
                      <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap font-medium">
                        {trade.htfLogic || <span className="text-zinc-600 italic">No HTF bias logic logged.</span>}
                      </p>
                    </div>

                    <div className="border border-white/5 bg-zinc-950/40 p-4 rounded-2xl">
                      <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-2 flex items-center justify-between tracking-wider">
                        <span>LTF Target & Liquidity</span>
                        <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                          FULL CONTENT
                        </span>
                      </div>
                      <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap font-medium">
                        {trade.ltfTarget || <span className="text-zinc-600 italic">No LTF target logged.</span>}
                      </p>
                    </div>
                  </div>

                  {/* Entry Model & Execution Time */}
                  {trade.entryModelTime && (
                    <div className="border border-white/5 bg-zinc-950/40 p-3.5 rounded-xl flex items-center gap-2.5 font-mono text-xs">
                      <Clock size={14} className="text-teal-400 shrink-0" />
                      <span className="font-bold text-zinc-400 uppercase text-[10px] tracking-wider">
                        ENTRY MODEL & EXACT TIME:
                      </span>
                      <span className="text-zinc-100 font-semibold">{trade.entryModelTime}</span>
                    </div>
                  )}

                  {/* Section 2: Psychology & Feelings Full Text */}
                  {(trade.morningRoutine || trade.feelings) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {trade.morningRoutine && (
                        <div className="border border-white/5 bg-zinc-950/40 p-4 rounded-2xl">
                          <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-1.5 tracking-wider">
                            Morning Routine / Wake Up
                          </div>
                          <p className="text-zinc-200 leading-relaxed font-medium">
                            {trade.morningRoutine}
                          </p>
                        </div>
                      )}

                      {trade.feelings && (
                        <div className="border border-white/5 bg-zinc-950/40 p-4 rounded-2xl">
                          <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-1.5 flex items-center justify-between tracking-wider">
                            <span>Feelings (Pre / During / After)</span>
                            <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
                              FULL CONTENT
                            </span>
                          </div>
                          <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap font-medium">
                            {trade.feelings}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section 3: Reflection, Rule Breaks & Improvements Full Text */}
                  {(trade.ruleBreaks || trade.improvements) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {trade.ruleBreaks ? (
                        <div className="border border-rose-500/30 bg-rose-950/20 p-4 rounded-2xl">
                          <div className="font-mono text-[10px] font-bold uppercase text-rose-400 mb-1.5 flex items-center gap-1.5 tracking-wider">
                            <AlertTriangle size={13} />
                            <span>Rule Breaks / Errors</span>
                          </div>
                          <p className="text-rose-200 leading-relaxed whitespace-pre-wrap font-medium">
                            {trade.ruleBreaks}
                          </p>
                        </div>
                      ) : (
                        <div className="border border-teal-500/30 bg-teal-950/20 p-4 rounded-2xl flex items-center gap-2.5 text-xs text-teal-300">
                          <CheckCircle2 size={16} className="text-teal-400" />
                          <span className="font-medium">No rule breaks reported. Execution plan followed completely.</span>
                        </div>
                      )}

                      {trade.improvements && (
                        <div className="border border-white/5 bg-zinc-950/40 p-4 rounded-2xl">
                          <div className="font-mono text-[10px] font-bold uppercase text-teal-300 mb-1.5 flex items-center justify-between tracking-wider">
                            <span>Planned Improvements</span>
                            <span className="text-[9px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-full font-mono">
                              NEXT SESSION
                            </span>
                          </div>
                          <p className="text-zinc-200 leading-relaxed whitespace-pre-wrap font-medium">
                            {trade.improvements}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Section 4: Attached Screenshot Image */}
                  {trade.chartImage && (
                    <div className="mt-5 pt-4 border-t border-white/10">
                      <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-2.5 flex items-center justify-between tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Camera size={13} />
                          <span>Attached Chart Snapshot</span>
                        </span>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                          <ZoomIn size={12} /> Click to inspect
                        </span>
                      </div>

                      <div
                        onClick={() => onOpenLightbox(trade.chartImage!)}
                        className="border border-white/10 rounded-2xl overflow-hidden max-h-[380px] bg-black/80 cursor-zoom-in group relative shadow-2xl"
                      >
                        <img
                          src={trade.chartImage}
                          alt="Trade Chart Record"
                          className="w-full h-auto object-contain max-h-[380px] mx-auto group-hover:scale-[1.01] transition-transform duration-300"
                        />
                        <div className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md text-white font-mono text-[10px] px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 pointer-events-none">
                          <ZoomIn size={12} className="text-teal-300" /> ENLARGE PHOTO
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section 5: Visual Card Backup Image if present */}
                  {trade.visualCardImage && !trade.chartImage && (
                    <div className="mt-5 pt-4 border-t border-white/10">
                      <div className="font-mono text-[10px] font-bold uppercase text-teal-400 mb-2.5 flex items-center justify-between tracking-wider">
                        <span>Captured Trade Canvas</span>
                        <span className="text-[10px] text-zinc-400 flex items-center gap-1 cursor-pointer">
                          <ZoomIn size={12} /> Click to inspect
                        </span>
                      </div>
                      <div
                        onClick={() => onOpenLightbox(trade.visualCardImage!)}
                        className="border border-white/10 rounded-2xl overflow-hidden max-h-[280px] bg-zinc-950/80 cursor-zoom-in"
                      >
                        <img
                          src={trade.visualCardImage}
                          alt="Visual Snapshot"
                          className="w-full h-auto object-contain max-h-[280px] mx-auto"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
