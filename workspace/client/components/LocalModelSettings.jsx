'use client';
import {useEffect,useState} from 'react';
import {desktopService} from '../lib/api';
export default function LocalModelSettings(){
 const [state,setState]=useState({phase:'Checking',progress:0}),[error,setError]=useState('');
 useEffect(()=>{let live=true,last='';const load=()=>desktopService('local-server',{action:'status'}).then(s=>{if(live){setState(s);if(s.phase==='Ready'&&last!=='Ready')window.dispatchEvent(new Event('looma-models-changed'));last=s.phase;}}).catch(e=>{if(live)setError(e.message);});load();const timer=setInterval(load,2000);return()=>{live=false;clearInterval(timer);};},[]);
 const run=async action=>{setError('');try{setState(await desktopService('local-server',{action}));}catch(e){setError(e.message);}};
 return <section className="rounded-2xl border border-[#eadbc7] p-4 space-y-3"><h3 className="font-semibold">Local AI inside Looma</h3><p className="text-xs">Qwen 4B runs on this computer. The runtime is included. First setup downloads about 2.5 GB. Looma starts the server when it opens and stops it when it quits.</p><p role="status">{state.phase}{state.phase.startsWith('Downloading')?` · ${state.progress}%`:''}</p>{(error||state.error)&&<p role="alert" className="text-sm text-red-700">{error||state.error}</p>}<div className="flex gap-3"><button className="rounded-lg bg-[#eadbc7] p-2" onClick={()=>run('start')} disabled={state.phase.startsWith('Downloading')||state.phase.startsWith('Starting')}>Start local AI</button><button onClick={()=>run('stop')}>Stop</button></div><p className="text-xs">Once Ready, choose Local models in the chat model picker. Muse 30B requires more memory.</p></section>;
}
