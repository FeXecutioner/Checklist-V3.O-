import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import { privateSyncConfig, privateSyncDatabaseId } from './privateSyncConfig';
import { withDataLock } from './dataLock';
import { readJournalSnapshot, readSyncBaseline, writeSyncBaseline, replaceSyncedSnapshot, readPreSyncBackup, type JournalSnapshot } from './storage';
import { snapshotJSON, textHash, decideSync, validateSnapshot } from './syncLogic';

const OWNER = 'mihirramdhani@gmail.com';
type Mode = 'signed-out' | 'link' | 'synced' | 'syncing' | 'offline' | 'conflict' | 'error';
export interface SyncStatus { mode: Mode; message: string; signedIn: boolean; remoteExists: boolean; lastSync?: string }
let status: SyncStatus = {mode:'signed-out',message:'Your journal is saved on this device.',signedIn:false,remoteExists:false};
const subscribers = new Set<(state:SyncStatus)=>void>();
let auth: ReturnType<typeof getAuth>;
let database: Firestore;
let owner: User | null = null;
let started = false;
let timer: ReturnType<typeof setTimeout> | undefined;
const allowed = (user: User | null) => !!user && user.emailVerified && user.email?.toLowerCase() === OWNER;
const emit = (patch: Partial<SyncStatus>) => { status={...status,...patch}; subscribers.forEach(fn=>fn(status)); };
const fail = (error: unknown) => emit({mode:navigator.onLine?'error':'offline',message:error instanceof Error ? error.message : 'Sync failed. Your local journal is unchanged.'});
function initialize() {
  if (started) return;
  const app=initializeApp(privateSyncConfig,'fexec-owner-sync');
  database=getFirestore(app,privateSyncDatabaseId);
  auth=getAuth(app); started=true;
  onAuthStateChanged(auth, user=>{
    owner=allowed(user)?user:null;
    if (user && !owner) { emit({mode:'error',signedIn:false,message:'Private sync is restricted to the app owner. Your data was not uploaded.'}); void signOut(auth); return; }
    emit({signedIn:!!owner,mode:owner?'syncing':'signed-out',message:owner?'Checking private sync…':'Your journal is saved on this device.'});
    if (owner) void tick();
  });
  window.addEventListener('fexec-local-change',schedule);
  window.addEventListener('online',schedule);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible') schedule();});
  setInterval(()=>{if(owner && document.visibilityState==='visible') void tick();},15000);
}
function schedule() { if(timer) clearTimeout(timer); timer=setTimeout(()=>void tick(),1800); }
export function subscribeSync(fn:(state:SyncStatus)=>void) { subscribers.add(fn); fn(status); initialize(); return ()=>{subscribers.delete(fn);}; }
export async function connectPrivateSync() {
  initialize();
  const provider=new GoogleAuthProvider(); provider.setCustomParameters({login_hint:OWNER,prompt:'select_account'});
  try {await signInWithPopup(auth,provider);} catch(error){fail(error);}
}
export async function disconnectPrivateSync() { owner=null; await signOut(auth); }
interface Remote { revision:string; hash:string; chunks:number; accounts:number; trades:number }
function stateRef(uid:string) {return doc(database,'privateSync',uid,'state','current');}
async function remoteState(uid:string):Promise<Remote|null> {
  const result=await getDocFromServer(stateRef(uid));
  if(!result.exists())return null;
  const value=result.data() as Remote;
  if(typeof value.revision!=='string' || !/^[\w-]+$/.test(value.revision) || typeof value.hash!=='string' || !Number.isInteger(value.chunks) || value.chunks<1 || value.chunks>100) throw new Error('Invalid cloud snapshot metadata.');
  return value;
}
async function upload(uid:string, snapshot:JournalSnapshot, text:string, hash:string, previous:Remote|null) {
  const revision=crypto.randomUUID();
  // Base64 packs UTF-8 safely; each chunk is far below Firestore's document limit.
  const bytes=new TextEncoder().encode(text); let binary='';
  for(let i=0;i<bytes.length;i+=8192) binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  const encoded=btoa(binary); const chunks=Math.ceil(encoded.length/300000);
  if(chunks>100) throw new Error('This journal exceeds the 22 MB sync limit. Export a backup before reducing image sizes.');
  for(let index=0;index<chunks;index++) {
    if(owner?.uid!==uid) throw new Error('Sync disconnected.');
    await setDoc(doc(database,'privateSync',uid,'versions',revision,'chunks',String(index)),{data:encoded.slice(index*300000,(index+1)*300000)});
  }
  await runTransaction(database,async tx=>{
    const latest=await tx.get(stateRef(uid));
    if((latest.data()?.revision??null)!==(previous?.revision??null)) throw new Error('Another device changed the journal. Check sync again to resolve the conflict.');
    tx.set(stateRef(uid),{revision,hash,chunks,accounts:snapshot.accounts.length,trades:snapshot.trades.length,updatedAt:serverTimestamp()});
  });
  // If an edit happened during upload, this baseline preserves the old hash so
  // the next pass uploads the newer edit instead of incorrectly marking it synced.
  await withDataLock(()=>writeSyncBaseline({uid,revision,hash}));
  emit({mode:'synced',remoteExists:true,message:'Private journal synced.',lastSync:new Date().toLocaleTimeString()});
}
async function download(uid:string, remote:Remote, expectedLocalHash:string) {
  let encoded='';
  for(let index=0;index<remote.chunks;index++) {
    const chunk=await getDocFromServer(doc(database,'privateSync',uid,'versions',remote.revision,'chunks',String(index)));
    if(!chunk.exists() || typeof chunk.data()?.data!=='string') throw new Error('Cloud snapshot is incomplete. Local data was kept.');
    encoded+=chunk.data()!.data;
  }
  const text=new TextDecoder().decode(Uint8Array.from(atob(encoded),character=>character.charCodeAt(0)));
  if(await textHash(text)!==remote.hash) throw new Error('Cloud snapshot integrity check failed. Local data was kept.');
  const snapshot:JournalSnapshot=JSON.parse(text); validateSnapshot(snapshot);
  await withDataLock(async()=>{
    if(owner?.uid!==uid) throw new Error('Sync disconnected.');
    if(await textHash(snapshotJSON(await readJournalSnapshot()))!==expectedLocalHash) throw new Error('A local edit occurred during download. Check sync again.');
    await replaceSyncedSnapshot(snapshot,{uid,revision:remote.revision,hash:remote.hash});
  });
  emit({mode:'synced',remoteExists:true,message:'Latest journal received from your other device.',lastSync:new Date().toLocaleTimeString()});
}
export async function tick(choice?:'local'|'cloud') {
  if(!owner)return;
  if(!navigator.onLine){emit({mode:'offline',message:'Offline. Changes stay on this device and sync when you reconnect.'});return;}
  if(!navigator.locks){fail(new Error('This browser does not support the storage locks required for private sync.'));return;}
  try {await navigator.locks.request('fexec-cloud-sync',{ifAvailable:true},async lock=>{
    if(!lock || !owner)return;
    const uid=owner.uid;
    const {snapshot,text,hash,baseline}=await withDataLock(async()=>{
      const snapshot=await readJournalSnapshot(); const text=snapshotJSON(snapshot);
      return {snapshot,text,hash:await textHash(text),baseline:await readSyncBaseline()};
    });
    const remote=await remoteState(uid);
    if(owner?.uid!==uid)return;
    emit({remoteExists:!!remote});
    const decision=decideSync(baseline,uid,hash,remote);
    if(!choice && decision==='link') {emit({mode:'link',message:remote?'A private journal already exists. Choose whether this device receives it or replaces it.':'Start on your PC: use its existing journal as your private synced journal.'});return;}
    if(!choice && decision==='conflict') {emit({mode:'conflict',message:'Both devices changed since their last sync. Export this device’s backup, then choose which journal to keep. No changes have been overwritten.'});return;}
    emit({mode:'syncing',message:'Syncing your private journal…'});
    if(choice==='local' || (!choice && decision==='upload')) await upload(uid,snapshot,text,hash,remote);
    else if(choice==='cloud' || decision==='download') {
      if(!remote)throw new Error('No synced journal exists yet. Start from your PC first.');
      await download(uid,remote,hash);
    } else {
      await withDataLock(()=>writeSyncBaseline({uid,revision:remote?.revision??null,hash}));
      emit({mode:'synced',message:'Private journal synced.',lastSync:new Date().toLocaleTimeString()});
    }
  });} catch(error){fail(error);}
}
export async function exportSyncBackup(previous=false) {
  const snapshot=previous?await readPreSyncBackup():await withDataLock(readJournalSnapshot);
  if(!snapshot)throw new Error('No previous local backup is available.');
  const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='fexecutioner-full-backup-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
