import React, { useEffect, useRef, useState } from 'react';
import { Cloud, RefreshCw, ChevronDown, X } from 'lucide-react';
import { subscribeSync, connectPrivateSync, disconnectPrivateSync, tick, exportSyncBackup, type SyncStatus } from '../utils/privateSync';

export function PrivateSyncPanel() {
  const [state,setState]=useState<SyncStatus>({mode:'signed-out',signedIn:false,remoteExists:false,message:'Your journal is saved on this device.'});
  const [open,setOpen]=useState(false);
  const [notice,setNotice]=useState('');
  const panelRef=useRef<HTMLElement>(null);
  const toggleRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>subscribeSync(setState),[]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(panelRef.current && !panelRef.current.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);toggleRef.current?.focus();}};
    const focusOutside=(event:FocusEvent)=>{if(panelRef.current && !panelRef.current.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);document.addEventListener('focusin',focusOutside);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);document.removeEventListener('focusin',focusOutside);};
  },[open]);
  const run=async(action:()=>Promise<unknown>)=>{setNotice('');try{await action();}catch(error){setNotice(error instanceof Error?error.message:'The operation could not be completed.');}};
  const choose=(choice:'local'|'cloud')=>{
    const text=choice==='local'
      ? 'Use this device’s accounts, trades and risk settings as the synced journal? Other linked devices will receive this version. If you changed both devices, export both backups first.'
      : 'Receive the synced accounts, trades and risk settings on this device? Its current saved journal will be kept as a local backup.';
    if(window.confirm(text))void run(()=>tick(choice));
  };
  const needsAttention=state.mode==='error'||state.mode==='conflict';
  const label=({ 'signed-out':'Device sync',link:'Sync · Set up',synced:'Sync · Up to date',syncing:'Syncing…',offline:'Sync · Offline',conflict:'Sync · Review',error:'Sync · Attention' } as const)[state.mode];
  const secondary='rounded-lg border border-white/10 px-3 py-2 text-zinc-300 hover:bg-white/5 disabled:opacity-40 transition-colors';
  return <section ref={panelRef} className="relative mb-3 flex justify-end text-xs font-mono">
    <button ref={toggleRef} type="button" aria-expanded={open} aria-controls="private-sync-options" onClick={()=>setOpen(!open)} className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${needsAttention?'border-amber-400/30 bg-amber-400/5 text-amber-300':'border-white/10 bg-zinc-950/60 text-zinc-300 hover:border-teal-400/40 hover:text-teal-300'}`}>
      {state.mode==='syncing'?<RefreshCw size={13} className="animate-spin" aria-hidden="true"/>:<Cloud size={14} aria-hidden="true"/>}
      <span>{label}</span><ChevronDown size={12} aria-hidden="true" className={open?'rotate-180':''}/>
    </button>
    {open && <div id="private-sync-options" role="region" aria-label="Private sync settings" className="absolute right-0 top-full z-40 mt-2 w-80 max-w-full rounded-2xl border border-white/10 bg-zinc-950 p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-zinc-100">Private sync</h2>
        <button type="button" aria-label="Close sync settings" onClick={()=>{setOpen(false);toggleRef.current?.focus();}} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"><X size={15}/></button>
      </div>
      <p role="status" className={`mb-3 text-[11px] leading-relaxed ${needsAttention?'text-amber-300':'text-zinc-400'}`}>{state.message}</p>
      {notice && <p role="alert" className="mb-3 text-[11px] text-amber-300">{notice}</p>}
      {!state.signedIn ? <>
        <p className="mb-3 text-[11px] leading-relaxed text-zinc-500">Link your phone and PC with your existing Google login.</p>
        <button type="button" onClick={()=>void run(connectPrivateSync)} className="w-full rounded-lg bg-teal-400 px-3 py-2 font-semibold text-zinc-950 hover:bg-teal-300">Sign in with Google</button>
      </> : <>
        {(state.mode==='link'||state.mode==='conflict') && <div className="mb-3 grid gap-2">
          <button type="button" onClick={()=>choose('local')} className="rounded-lg bg-teal-400 px-3 py-2 font-semibold text-zinc-950 hover:bg-teal-300">Use this device’s journal</button>
          {state.remoteExists && <button type="button" onClick={()=>choose('cloud')} className={secondary}>Receive synced journal</button>}
        </div>}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-zinc-500">{state.lastSync?`Checked ${state.lastSync}`:'Phone ↔ PC'}</span>
          <button type="button" disabled={state.mode==='syncing'} onClick={()=>void run(()=>tick())} className={`${secondary} inline-flex items-center gap-1.5`}><RefreshCw size={12} aria-hidden="true"/>Sync now</button>
        </div>
        <details className="mt-3 border-t border-white/10 pt-3">
          <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300">Backups & device options</summary>
          <div className="mt-3 grid gap-2">
            <button type="button" onClick={()=>void run(()=>exportSyncBackup())} className={secondary}>Export full backup</button>
            <button type="button" onClick={()=>void run(()=>exportSyncBackup(true))} className={secondary}>Export previous local backup</button>
            <button type="button" disabled={state.mode==='syncing'} onClick={()=>void run(disconnectPrivateSync)} className={secondary}>Disconnect this device</button>
          </div>
          <p className="mt-3 text-[10px] leading-relaxed text-zinc-500">Saved entries sync automatically. Offline edits stay local until you reconnect. Disconnecting keeps this device’s journal.</p>
        </details>
      </>}
    </div>}
  </section>;
}
