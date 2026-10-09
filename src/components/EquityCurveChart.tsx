import React, { useState, useMemo, useRef } from 'react';
import { TradeRecord, AccountType } from '../types';
import {
  Activity,
  Maximize2,
  Minimize2,
  DollarSign,
  Percent,
  Edit2,
  Crosshair,
  Pin,
  X,
  Eye,
  EyeOff,
  Sparkles,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface EquityPoint {
  index: number;
  tradeId?: number;
  timestamp: string;
  setup?: string;
  directionalBias?: string;
  pnl: number;
  equity: number;
  pnlPct: number;
  drawdown: number;
  drawdownPct: number;
  isNoTrade?: boolean;
  isBE?: boolean;
  accountName?: string;
}

interface EquityCurveChartProps {
  trades: TradeRecord[];
  initialBalance: number;
  maxDrawdown?: number;
  profitTarget?: number;
  accountName: string;
  accountType?: AccountType;
  currency?: string;
  onEditAccount?: () => void;
}

type ChartHeightMode = 'standard' | 'expanded' | 'tall';

export const EquityCurveChart: React.FC<EquityCurveChartProps> = ({
  trades,
  initialBalance,
  maxDrawdown,
  profitTarget,
  accountName,
  accountType = 'live',
  currency = '$',
  onEditAccount,
}) => {
  const [viewMode, setViewMode] = useState<'balance' | 'percentage'>('balance');
  const [heightMode, setHeightMode] = useState<ChartHeightMode>('standard');
  const [showTooltip, setShowTooltip] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<EquityPoint | null>(null);
  const [pinnedPoint, setPinnedPoint] = useState<EquityPoint | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Height configurations:
  // standard = 380 (58% taller than old 240)
  // expanded = 500 (more than double old 240)
  // tall = 620 (for ultra-high-resolution view)
  const chartHeightMap: Record<ChartHeightMode, number> = {
    standard: 380,
    expanded: 500,
    tall: 620,
  };
  const height = chartHeightMap[heightMode];
  const width = 880;
  const padding = { top: 40, right: 60, bottom: 45, left: 80 };

  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Compute chronological equity points starting from trade #0 (baseline)
  const { points, peakEquity, maxDrawdown: tradeMaxDrawdown, maxDrawdownPct: tradeMaxDrawdownPct, netPnL, netReturnPct } = useMemo(() => {
    // Sort trades chronologically (oldest to newest)
    const sortedTrades = [...trades].sort((a, b) => a.id - b.id);

    const pts: EquityPoint[] = [];

    // Starting baseline point
    pts.push({
      index: 0,
      timestamp: sortedTrades[0]?.timestamp ? `Baseline Initialized` : 'Account Initialized',
      pnl: 0,
      equity: initialBalance,
      pnlPct: 0,
      drawdown: 0,
      drawdownPct: 0,
      accountName,
    });

    let runningEquity = initialBalance;
    let peak = initialBalance;
    let maxDD = 0;
    let maxDDPct = 0;

    sortedTrades.forEach((trade, i) => {
      const pnl = trade.pnl || 0;
      runningEquity += pnl;

      if (runningEquity > peak) {
        peak = runningEquity;
      }

      const dd = peak - runningEquity;
      const ddPct = peak > 0 ? (dd / peak) * 100 : 0;

      if (dd > maxDD) maxDD = dd;
      if (ddPct > maxDDPct) maxDDPct = ddPct;

      const pnlPct = initialBalance > 0 ? ((runningEquity - initialBalance) / initialBalance) * 100 : 0;

      const isBE = trade.isBreakEven || (!trade.isNoTradeDay && trade.setup !== 'no_trade' && trade.pnl === 0);
      const isNoTrade = trade.isNoTradeDay || trade.setup === 'no_trade';

      pts.push({
        index: i + 1,
        tradeId: trade.id,
        timestamp: trade.timestamp,
        setup: trade.setup,
        directionalBias: trade.directionalBias || trade.noTradeReason,
        pnl,
        equity: runningEquity,
        pnlPct,
        drawdown: dd,
        drawdownPct: ddPct,
        isNoTrade,
        isBE,
        accountName: trade.accountName || accountName,
      });
    });

    const net = runningEquity - initialBalance;
    const netPct = initialBalance > 0 ? (net / initialBalance) * 100 : 0;

    return {
      points: pts,
      peakEquity: peak,
      maxDrawdown: maxDD,
      maxDrawdownPct: maxDDPct,
      netPnL: net,
      netReturnPct: netPct,
    };
  }, [trades, initialBalance, accountName]);

  // Determine Y range including target and max drawdown if present
  const values = points.map((p) => (viewMode === 'balance' ? p.equity : p.pnlPct));
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);

  // Floor and target levels for visual guide rails
  const floorVal = maxDrawdown ? (viewMode === 'balance' ? initialBalance - maxDrawdown : -(maxDrawdown / (initialBalance || 1)) * 100) : null;
  const targetVal = profitTarget ? (viewMode === 'balance' ? initialBalance + profitTarget : (profitTarget / (initialBalance || 1)) * 100) : null;

  // Buffer range so lines have ample vertical breathing room
  const minVal = viewMode === 'balance'
    ? Math.min(rawMin, initialBalance * 0.97, floorVal !== null ? floorVal * 0.99 : initialBalance * 0.95)
    : Math.min(rawMin, -1.5, floorVal !== null ? floorVal - 0.5 : -2);

  const maxVal = viewMode === 'balance'
    ? Math.max(rawMax, initialBalance * 1.03, targetVal !== null ? targetVal * 1.01 : initialBalance * 1.05)
    : Math.max(rawMax, 1.5, targetVal !== null ? targetVal + 0.5 : 2);

  const rangeY = maxVal - minVal || 1;

  const getX = (index: number) => {
    if (points.length <= 1) return padding.left + chartW / 2;
    return padding.left + (index / (points.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    return padding.top + chartH - ((val - minVal) / rangeY) * chartH;
  };

  const baselineY = getY(viewMode === 'balance' ? initialBalance : 0);
  const peakY = getY(viewMode === 'balance' ? peakEquity : ((peakEquity - initialBalance) / initialBalance) * 100);
  const targetY = targetVal !== null ? getY(targetVal) : null;
  const floorY = floorVal !== null ? getY(floorVal) : null;

  // Generate SVG path for line
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, i) => {
      const x = getX(i);
      const val = viewMode === 'balance' ? p.equity : p.pnlPct;
      const y = getY(val);
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }, [points, viewMode, minVal, maxVal, height]);

  // Generate SVG area fill (from line down to bottom of chart)
  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = getX(0);
    const lastX = getX(points.length - 1);
    const bottomY = padding.top + chartH;
    return `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [pathD, points, chartH]);

  // Color scheme based on overall profit
  const isProfitable = netPnL >= 0;
  const strokeColor = isProfitable ? '#2dd4bf' : '#f43f5e';
  const gradientId = isProfitable ? 'equityGradientTeal' : 'equityGradientRose';

  // Handle pointer tracking for crosshair tooltip
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || points.length <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;

    // Constrain to chart bounds
    if (svgX < padding.left - 10 || svgX > padding.left + chartW + 10) {
      setHoveredPoint(null);
      setHoverX(null);
      return;
    }

    // Find nearest point
    const relativeX = (svgX - padding.left) / chartW;
    const nearestIndex = Math.min(
      points.length - 1,
      Math.max(0, Math.round(relativeX * (points.length - 1)))
    );

    setHoveredPoint(points[nearestIndex]);
    setHoverX(getX(nearestIndex));
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoverX(null);
  };

  const handlePointClick = (pt: EquityPoint) => {
    if (pinnedPoint && pinnedPoint.index === pt.index) {
      setPinnedPoint(null);
    } else {
      setPinnedPoint(pt);
    }
  };

  // Y-axis tick values (5 to 7 evenly spaced steps depending on height)
  const yTicks = useMemo(() => {
    const ticks = [];
    const count = heightMode === 'tall' ? 7 : heightMode === 'expanded' ? 6 : 5;
    for (let i = 0; i <= count; i++) {
      const val = minVal + (rangeY * i) / count;
      ticks.push(val);
    }
    return ticks;
  }, [minVal, rangeY, heightMode]);

  // Point to display in the dedicated Inspector Ribbon (pinned > hovered > latest)
  const displayPoint: EquityPoint | null =
    pinnedPoint || hoveredPoint || (points.length > 0 ? points[points.length - 1] : null);

  const displayPointY = displayPoint ? getY(viewMode === 'balance' ? displayPoint.equity : displayPoint.pnlPct) : 0;
  const isHoverNearTop = hoveredPoint ? getY(viewMode === 'balance' ? hoveredPoint.equity : hoveredPoint.pnlPct) < height * 0.45 : false;
  const isHoverNearLeft = hoverX !== null && hoverX < width * 0.28;
  const isHoverNearRight = hoverX !== null && hoverX > width * 0.72;

  return (
    <div
      ref={containerRef}
      className="mt-5 p-4 sm:p-6 rounded-2xl bg-zinc-950/80 border border-teal-500/30 backdrop-blur-xl shadow-2xl relative"
    >
      {/* Background Neon Subtle Orbs contained strictly */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-48 bg-teal-500/10 rounded-full blur-[90px]" />
        <div className="absolute bottom-0 left-1/4 w-96 h-48 bg-purple-600/10 rounded-full blur-[90px]" />
      </div>

      {/* Top Header: Account Equity Title & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-teal-500/20 to-purple-600/20 border border-teal-500/40 flex items-center justify-center text-teal-300 shadow-[0_0_18px_rgba(45,212,191,0.25)] shrink-0">
            <Activity size={22} className="text-teal-400" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-teal-400 bg-teal-950/80 border border-teal-500/50 px-2 py-0.5 rounded-md shadow-xs">
                EQUITY CURVE
              </span>
              <span className="font-mono text-xs font-bold text-zinc-200">
                {accountName}
              </span>
              {onEditAccount && (
                <button
                  type="button"
                  onClick={onEditAccount}
                  className="font-mono text-[10px] font-bold text-teal-300 hover:text-white bg-teal-950/70 hover:bg-teal-900/90 border border-teal-500/50 hover:border-teal-400 px-2.5 py-0.5 rounded-md flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
                  title="Edit this account's name or starting figure"
                >
                  <Edit2 size={11} className="text-teal-400" />
                  <span>Edit Account</span>
                </button>
              )}
            </div>
            <h3 className="font-disp font-bold text-base sm:text-lg text-zinc-100 uppercase tracking-wide mt-1">
              Live Balance & Performance Trajectory
            </h3>
          </div>
        </div>

        {/* View Mode Toggle, Size Controls & Telemetry Badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Metrics summary */}
          <div className="flex items-center gap-2 font-mono text-xs bg-zinc-900/90 border border-white/10 px-3 py-1.5 rounded-xl shadow-xs">
            <span className="text-zinc-400 text-[11px] font-medium">NET:</span>
            <span
              className={`font-bold flex items-center gap-1 ${
                netPnL > 0
                  ? 'text-teal-300'
                  : netPnL < 0
                  ? 'text-rose-400'
                  : 'text-zinc-200'
              }`}
            >
              {netPnL >= 0 ? '+' : ''}${netPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[10px] opacity-80 font-normal">
                ({netReturnPct >= 0 ? '+' : ''}{netReturnPct.toFixed(2)}%)
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs bg-zinc-900/90 border border-white/10 px-3 py-1.5 rounded-xl shadow-xs">
            <span className="text-zinc-400 text-[11px] font-medium">MAX DD:</span>
            <span className="font-bold text-rose-400">
              -${tradeMaxDrawdown.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[10px] opacity-80 font-normal ml-0.5">
                (-{tradeMaxDrawdownPct.toFixed(2)}%)
              </span>
            </span>
          </div>

          {/* Currency vs % Toggle */}
          <div className="flex bg-zinc-900/90 border border-white/10 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode('balance')}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                viewMode === 'balance'
                  ? 'bg-teal-500/25 text-teal-300 border border-teal-500/50 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Show Balance in Currency"
            >
              $ BAL
            </button>
            <button
              type="button"
              onClick={() => setViewMode('percentage')}
              className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                viewMode === 'percentage'
                  ? 'bg-teal-500/25 text-teal-300 border border-teal-500/50 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Show Cumulative Gain in Percent"
            >
              % GAIN
            </button>
          </div>

          {/* Chart Height / Size Selector to fix "Chart is not big enough" */}
          <div className="flex items-center bg-zinc-900/90 border border-white/10 p-0.5 rounded-xl">
            <span className="text-zinc-400 font-mono text-[10px] px-2 font-bold uppercase tracking-wider hidden sm:inline">
              HEIGHT:
            </span>
            <button
              type="button"
              onClick={() => setHeightMode('standard')}
              className={`px-2 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                heightMode === 'standard'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Standard Height (380px)"
            >
              STD
            </button>
            <button
              type="button"
              onClick={() => setHeightMode('expanded')}
              className={`px-2 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                heightMode === 'expanded'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Expanded Height (500px) - Great for seeing all curve details"
            >
              EXPAND
            </button>
            <button
              type="button"
              onClick={() => setHeightMode('tall')}
              className={`px-2 py-1 rounded-lg font-mono text-[10px] font-bold transition-all cursor-pointer ${
                heightMode === 'tall'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Full Height (620px) - Maximum vertical resolution"
            >
              MAX
            </button>
          </div>

          {/* Tooltip Toggle Button */}
          <button
            type="button"
            onClick={() => setShowTooltip(!showTooltip)}
            className={`px-2.5 py-1.5 rounded-xl font-mono text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              showTooltip
                ? 'bg-teal-950/70 text-teal-300 border-teal-500/40 hover:bg-teal-900/80'
                : 'bg-zinc-900/80 text-zinc-400 border-white/10 hover:text-white'
            }`}
            title={showTooltip ? "Floating Tooltip is ON (Click to hide float and use HUD bar only)" : "Floating Tooltip is OFF (HUD bar only - line unobstructed)"}
          >
            {showTooltip ? <Eye size={12} className="text-teal-400" /> : <EyeOff size={12} />}
            <span className="hidden sm:inline">{showTooltip ? 'FLOAT ON' : 'HUD ONLY'}</span>
          </button>
        </div>
      </div>

      {/* DEDICATED TELEMETRY & DATA INSPECTION HUD RIBBON
          This ribbon guarantees that NO information is EVER blocked out when inspecting trades! */}
      {displayPoint && (
        <div className="mt-3.5 p-3 sm:px-4 sm:py-2.5 rounded-xl bg-zinc-900/90 border border-teal-500/30 backdrop-blur-md shadow-lg transition-all relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            {/* Left: Identification & Timestamp */}
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-xs ${
                  pinnedPoint
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : hoveredPoint
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50'
                    : 'bg-zinc-800 text-zinc-300 border border-white/10'
                }`}
              >
                {pinnedPoint ? (
                  <>
                    <Pin size={11} className="fill-amber-300 text-amber-300" />
                    <span>PINNED: {displayPoint.index === 0 ? 'STARTING BASELINE' : `TRADE #${displayPoint.index}`}</span>
                  </>
                ) : hoveredPoint ? (
                  <>
                    <Crosshair size={11} className="text-teal-400" />
                    <span>HOVERING: {displayPoint.index === 0 ? 'STARTING BASELINE' : `TRADE #${displayPoint.index}`}</span>
                  </>
                ) : (
                  <>
                    <Activity size={11} className="text-zinc-400" />
                    <span>LATEST: {displayPoint.index === 0 ? 'STARTING BASELINE' : `TRADE #${displayPoint.index}`}</span>
                  </>
                )}
              </div>

              <span className="text-zinc-400 text-[11px] font-medium">
                {displayPoint.timestamp}
              </span>

              {pinnedPoint && (
                <button
                  type="button"
                  onClick={() => setPinnedPoint(null)}
                  className="text-[10px] text-amber-300 hover:text-white bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <X size={10} />
                  <span>Unpin</span>
                </button>
              )}
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">EQUITY:</span>
                <span className="font-bold text-white text-sm font-disp">
                  ${displayPoint.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {displayPoint.index > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">TRADE RESULT:</span>
                  <span
                    className={`font-bold font-mono ${
                      displayPoint.isNoTrade
                        ? 'text-teal-300'
                        : displayPoint.isBE
                        ? 'text-cyan-300'
                        : displayPoint.pnl > 0
                        ? 'text-teal-300'
                        : displayPoint.pnl < 0
                        ? 'text-rose-400'
                        : 'text-zinc-300'
                    }`}
                  >
                    {displayPoint.isNoTrade
                      ? '$0.00 (No Trade Day)'
                      : displayPoint.isBE
                      ? 'BE ($0.00)'
                      : `${displayPoint.pnl >= 0 ? '+' : ''}$${displayPoint.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">FROM BASELINE:</span>
                <span
                  className={`font-bold font-mono ${
                    displayPoint.pnlPct >= 0 ? 'text-teal-300' : 'text-rose-400'
                  }`}
                >
                  {displayPoint.pnlPct >= 0 ? '+' : ''}{displayPoint.pnlPct.toFixed(2)}%
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 text-[11px] uppercase tracking-wider font-semibold">DRAWDOWN:</span>
                <span className="font-bold text-rose-400 font-mono">
                  -${displayPoint.drawdown.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-[10px] opacity-80 ml-0.5">(-{displayPoint.drawdownPct.toFixed(1)}%)</span>
                </span>
              </div>

              {displayPoint.setup && (
                <div className="hidden xl:flex items-center gap-1 text-[10px] bg-zinc-950 px-2 py-0.5 rounded-md border border-white/10 text-zinc-300">
                  <span className="text-zinc-400">Setup:</span>
                  <span className="text-teal-300 font-bold">{displayPoint.setup}</span>
                </div>
              )}

              {displayPoint.directionalBias && (
                <div className="hidden 2xl:flex items-center gap-1 text-[10px] bg-zinc-950 px-2 py-0.5 rounded-md border border-white/10 text-zinc-300">
                  <span className="text-zinc-400">Bias:</span>
                  <span className="text-purple-300 font-bold">{displayPoint.directionalBias}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive SVG Chart Container (overflow-visible to prevent tooltip clipping) */}
      <div className="relative mt-3.5 w-full overflow-visible select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Teal Gradient for Profitable Curve */}
            <linearGradient id="equityGradientTeal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.38" />
              <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0.0" />
            </linearGradient>

            {/* Rose Gradient for Drawdown Curve */}
            <linearGradient id="equityGradientRose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.38" />
              <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor={strokeColor} floodOpacity="0.6" />
            </filter>
          </defs>

          {/* Grid lines & Y-Axis Labels */}
          {yTicks.map((val, idx) => {
            const y = getY(val);
            const labelStr =
              viewMode === 'balance'
                ? `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                : `${val >= 0 ? '+' : ''}${val.toFixed(1)}%`;

            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartW}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 10}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-zinc-400 font-mono text-[10px] font-medium"
                >
                  {labelStr}
                </text>
              </g>
            );
          })}

          {/* Baseline Reference (Starting Balance) */}
          <line
            x1={padding.left}
            y1={baselineY}
            x2={padding.left + chartW}
            y2={baselineY}
            stroke="rgba(45, 212, 191, 0.45)"
            strokeDasharray="5 5"
            strokeWidth="1.5"
          />
          <text
            x={padding.left + chartW + 8}
            y={baselineY + 3.5}
            className="fill-teal-400 font-mono text-[9px] font-bold"
          >
            START
          </text>

          {/* Peak Equity Reference Line if above baseline */}
          {peakEquity > initialBalance && viewMode === 'balance' && (
            <>
              <line
                x1={padding.left}
                y1={peakY}
                x2={padding.left + chartW}
                y2={peakY}
                stroke="rgba(168, 85, 247, 0.5)"
                strokeDasharray="3 3"
                strokeWidth="1.5"
              />
              <text
                x={padding.left + chartW + 8}
                y={peakY + 3.5}
                className="fill-purple-400 font-mono text-[9px] font-bold"
              >
                PEAK
              </text>
            </>
          )}

          {/* Profit Target Reference Line if configured */}
          {profitTarget && targetY !== null && targetY >= padding.top && targetY <= padding.top + chartH && (
            <>
              <line
                x1={padding.left}
                y1={targetY}
                x2={padding.left + chartW}
                y2={targetY}
                stroke="rgba(45, 212, 191, 0.6)"
                strokeDasharray="4 2"
                strokeWidth="1.5"
              />
              <text
                x={padding.left + chartW + 8}
                y={targetY + 3.5}
                className="fill-teal-300 font-mono text-[9px] font-bold"
              >
                TARGET
              </text>
            </>
          )}

          {/* Max Drawdown Floor Reference Line if configured */}
          {maxDrawdown && floorY !== null && floorY >= padding.top && floorY <= padding.top + chartH && (
            <>
              <line
                x1={padding.left}
                y1={floorY}
                x2={padding.left + chartW}
                y2={floorY}
                stroke="rgba(244, 63, 94, 0.6)"
                strokeDasharray="4 2"
                strokeWidth="1.5"
              />
              <text
                x={padding.left + chartW + 8}
                y={floorY + 3.5}
                className="fill-rose-400 font-mono text-[9px] font-bold"
              >
                FLOOR
              </text>
            </>
          )}

          {/* Shaded Area Fill */}
          {points.length > 1 && (
            <path d={areaD} fill={`url(#${gradientId})`} />
          )}

          {/* Equity Line */}
          {points.length > 1 ? (
            <path
              d={pathD}
              fill="none"
              stroke={strokeColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#neonGlow)"
            />
          ) : (
            /* Flat baseline line if 0 trades logged yet */
            <line
              x1={padding.left}
              y1={baselineY}
              x2={padding.left + chartW}
              y2={baselineY}
              stroke="#2dd4bf"
              strokeWidth="2.5"
              strokeDasharray="6 6"
              className="animate-pulse"
            />
          )}

          {/* Trade Points (Nodes) */}
          {points.map((p, i) => {
            const cx = getX(i);
            const val = viewMode === 'balance' ? p.equity : p.pnlPct;
            const cy = getY(val);
            const isHovered = hoveredPoint?.index === p.index;
            const isPinned = pinnedPoint?.index === p.index;

            return (
              <g
                key={i}
                className="cursor-pointer"
                onClick={() => handlePointClick(p)}
              >
                {/* Outer ring for hovered or pinned point */}
                {(isHovered || isPinned) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isPinned ? 9 : 8}
                    fill="none"
                    stroke={isPinned ? '#f59e0b' : strokeColor}
                    strokeWidth={2}
                    className="animate-pulse opacity-80"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered || isPinned ? 6 : i === 0 ? 4 : 3}
                  className="transition-all duration-150"
                  fill={
                    i === 0
                      ? '#ffffff'
                      : p.isNoTrade
                      ? '#2dd4bf'
                      : p.isBE
                      ? '#06b6d4'
                      : p.pnl > 0
                      ? '#2dd4bf'
                      : '#f43f5e'
                  }
                  stroke="#09090b"
                  strokeWidth={isHovered || isPinned ? 3 : 2}
                />
              </g>
            );
          })}

          {/* Active Hover Crosshair Line (Vertical & Horizontal) */}
          {hoverX !== null && hoveredPoint && (
            <>
              {/* Vertical Crosshair */}
              <line
                x1={hoverX}
                y1={padding.top}
                x2={hoverX}
                y2={padding.top + chartH}
                stroke="rgba(255, 255, 255, 0.45)"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
              {/* Horizontal Crosshair to Y-Axis */}
              <line
                x1={padding.left}
                y1={getY(viewMode === 'balance' ? hoveredPoint.equity : hoveredPoint.pnlPct)}
                x2={hoverX}
                y2={getY(viewMode === 'balance' ? hoveredPoint.equity : hoveredPoint.pnlPct)}
                stroke="rgba(45, 212, 191, 0.5)"
                strokeDasharray="3 3"
                strokeWidth="1.2"
              />
              {/* Y-Axis Value Badge Highlight */}
              <rect
                x={padding.left - 78}
                y={getY(viewMode === 'balance' ? hoveredPoint.equity : hoveredPoint.pnlPct) - 10}
                width={72}
                height={20}
                rx={4}
                fill="#09090b"
                stroke="#2dd4bf"
                strokeWidth={1}
              />
              <text
                x={padding.left - 42}
                y={getY(viewMode === 'balance' ? hoveredPoint.equity : hoveredPoint.pnlPct) + 4}
                textAnchor="middle"
                className="fill-teal-300 font-mono text-[9px] font-bold"
              >
                {viewMode === 'balance'
                  ? `$${hoveredPoint.equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : `${hoveredPoint.pnlPct >= 0 ? '+' : ''}${hoveredPoint.pnlPct.toFixed(1)}%`}
              </text>
            </>
          )}

          {/* X-Axis bottom boundary */}
          <line
            x1={padding.left}
            y1={padding.top + chartH}
            x2={padding.left + chartW}
            y2={padding.top + chartH}
            stroke="rgba(255, 255, 255, 0.15)"
          />

          {/* X-Axis Trade Number Indicators */}
          {points.map((p, i) => {
            const step = Math.max(1, Math.floor(points.length / 9));
            if (i !== 0 && i !== points.length - 1 && i % step !== 0) return null;
            const x = getX(i);
            const isHovered = hoveredPoint?.index === p.index;

            return (
              <text
                key={i}
                x={x}
                y={padding.top + chartH + 18}
                textAnchor="middle"
                className={`font-mono text-[10px] font-medium transition-colors ${
                  isHovered ? 'fill-teal-300 font-bold' : 'fill-zinc-400'
                }`}
              >
                {i === 0 ? 'START' : `T#${i}`}
              </text>
            );
          })}
        </svg>

        {/* Floating Telemetry Tooltip when Point is Hovered
            Includes smart vertical flipping & horizontal clamping so it NEVER clips or blocks out data */}
        {showTooltip && hoveredPoint && hoverX !== null && (
          <div
            className={`absolute z-30 pointer-events-none p-3.5 rounded-xl bg-zinc-950/95 border border-teal-500/60 shadow-[0_0_30px_rgba(45,212,191,0.35)] backdrop-blur-xl font-mono text-xs text-white transition-all duration-75 min-w-[210px] max-w-[280px] ${
              isHoverNearTop ? 'translate-y-3' : '-translate-y-full -translate-y-3'
            } ${
              isHoverNearLeft
                ? 'translate-x-3'
                : isHoverNearRight
                ? '-translate-x-full -translate-x-3'
                : '-translate-x-1/2'
            }`}
            style={{
              left: `${(hoverX / width) * 100}%`,
              top: `${(getY(viewMode === 'balance' ? hoveredPoint.equity : hoveredPoint.pnlPct) / height) * 100}%`,
            }}
          >
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-white/10 text-[10px]">
              <span className="font-bold text-teal-300 flex items-center gap-1">
                <Sparkles size={11} className="text-teal-400" />
                {hoveredPoint.index === 0 ? 'STARTING BASELINE' : `TRADE #${hoveredPoint.index}`}
              </span>
              <span className="text-zinc-400 font-mono text-[9px]">{hoveredPoint.timestamp}</span>
            </div>

            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between gap-4">
                <span className="text-zinc-400 text-[10px] uppercase font-semibold">BALANCE:</span>
                <b className="text-white text-xs font-disp">
                  ${hoveredPoint.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </b>
              </div>

              {hoveredPoint.index > 0 && (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-400 text-[10px] uppercase font-semibold">RESULT:</span>
                    <b
                      className={
                        hoveredPoint.isNoTrade
                          ? 'text-teal-300'
                          : hoveredPoint.isBE
                          ? 'text-cyan-300'
                          : hoveredPoint.pnl > 0
                          ? 'text-teal-300'
                          : hoveredPoint.pnl < 0
                          ? 'text-rose-400'
                          : 'text-zinc-300'
                      }
                    >
                      {hoveredPoint.isNoTrade
                        ? '$0.00 (No Trade Day)'
                        : hoveredPoint.isBE
                        ? 'BE ($0.00)'
                        : `${hoveredPoint.pnl >= 0 ? '+' : ''}$${hoveredPoint.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </b>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-zinc-400 text-[10px] uppercase font-semibold">GAIN:</span>
                    <b className={hoveredPoint.pnlPct >= 0 ? 'text-teal-300' : 'text-rose-400'}>
                      {hoveredPoint.pnlPct >= 0 ? '+' : ''}{hoveredPoint.pnlPct.toFixed(2)}%
                    </b>
                  </div>

                  {hoveredPoint.drawdown > 0 && (
                    <div className="flex items-center justify-between gap-4 text-[10px] text-rose-400/95 pt-1 border-t border-white/10">
                      <span className="font-semibold uppercase">DRAWDOWN:</span>
                      <span>
                        -${hoveredPoint.drawdown.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({hoveredPoint.drawdownPct.toFixed(1)}%)
                      </span>
                    </div>
                  )}

                  {hoveredPoint.setup && (
                    <div className="text-[10px] text-zinc-300 pt-1 border-t border-white/5 flex items-center justify-between">
                      <span className="text-zinc-400 font-semibold">SETUP:</span>
                      <span className="text-teal-300 font-bold truncate max-w-[140px]">{hoveredPoint.setup}</span>
                    </div>
                  )}

                  {hoveredPoint.directionalBias && (
                    <div className="text-[10px] text-zinc-400 italic truncate max-w-[200px]">
                      {hoveredPoint.directionalBias}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-2 pt-1 border-t border-white/5 text-[9px] text-zinc-400 text-center">
              Click node to pin details
            </div>
          </div>
        )}
      </div>

      {/* Bottom Sub-Bar: Account Overview & Interaction Guidance */}
      <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between text-[11px] font-mono text-zinc-400 gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-[0_0_8px_#2dd4bf]" />
          <span>
            INITIAL BASELINE: <b className="text-zinc-200">${initialBalance.toLocaleString()}</b>
          </span>
          {onEditAccount && (
            <button
              type="button"
              onClick={onEditAccount}
              className="text-[10px] text-teal-400 hover:text-teal-200 underline underline-offset-2 flex items-center gap-1 cursor-pointer transition-colors"
              title="Change starting figure or account name"
            >
              <Edit2 size={10} />
              <span>Change Starting Figure</span>
            </button>
          )}
          <span className="text-white/20">|</span>
          <span>
            PEAK: <b className="text-purple-300">${peakEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
          </span>
          {maxDrawdown && (
            <>
              <span className="text-white/20">|</span>
              <span className="text-rose-300">
                MAX DD: <b className="font-bold">${maxDrawdown.toLocaleString()}</b>
              </span>
            </>
          )}
          {profitTarget && (
            <>
              <span className="text-white/20">|</span>
              <span className="text-teal-300">
                TARGET: <b className="font-bold">${profitTarget.toLocaleString()}</b>
              </span>
            </>
          )}
          <span className="text-white/20">|</span>
          <span className="text-zinc-400 text-[10px]">
            Tip: Use <b className="text-teal-300">EXPAND / MAX</b> height or toggle <b className="text-teal-300">HUD ONLY</b> to customize your view
          </span>
        </div>

        <div className="flex items-center gap-3">
          {points.length <= 1 ? (
            <span className="text-zinc-500 italic">
              Awaiting executed trades to map equity curve for this account.
            </span>
          ) : (
            <span className="text-zinc-400">
              TRADES MAPPED: <b className="text-teal-300 font-bold">{points.length - 1}</b>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
