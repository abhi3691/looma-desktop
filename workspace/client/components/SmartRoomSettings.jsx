"use client";
import {useEffect,useState} from "react";
import {desktopService} from "../lib/api";
export default function SmartRoomSettings(){
 const [room,setRoom]=useState(null),[token,setToken]=useState(""),[devices,setDevices]=useState([]),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;desktopService("home",{action:"status"}).then(x=>{if(live)setRoom(x)}).catch(e=>{if(live)setMessage(e.message)});return()=>{live=false}},[]);
 const run=async(action,value)=>{setBusy(true);setMessage("");try{const result=await desktopService("home",{action,value});if(action==="save"){setRoom(result);setToken("");setMessage("Smart room settings saved.")}else if(action==="devices"){setDevices(result);setMessage(`Found ${result.length} devices.`)}else setMessage(result)}catch(e){setMessage(e.message)}finally{setBusy(false)}};
 const update=(index,key,value)=>setRoom({...room,bindings:room.bindings.map((b,i)=>i===index?{...b,[key]:value}:b)});
 const input="w-full rounded-lg border border-[#dfcdb5] bg-white p-2 text-sm text-[#503d2e]";
 return <section className="rounded-2xl border border-[#eadbc7] bg-[#fffdf8] p-4 space-y-3 text-[#503d2e]">
 <h3 className="font-semibold">Smart room</h3><p className="text-sm">Connect local Home Assistant for lights, plugs, routines and Broadlink appliances. Room commands stay on your network.</p>
 {room&&<><label className="block text-sm">Home Assistant address<input className={input} placeholder="http://192.168.1.20:8123" value={room.url} onChange={e=>setRoom({...room,url:e.target.value})}/></label>
 <label className="block text-sm">Access token<input className={input} type="password" autoComplete="off" placeholder={room.configured?"Saved securely — enter to replace":"Home Assistant long-lived access token"} value={token} onChange={e=>setToken(e.target.value)}/></label>
 <label className="flex gap-2 text-sm"><input type="checkbox" checked={room.enabled} onChange={e=>setRoom({...room,enabled:e.target.checked})}/>Enable spoken room commands</label>
 {room.bindings.map((b,i)=><div key={i} className="rounded-lg border p-3 space-y-2">
 <label className="block text-sm">Spoken name<input className={input} placeholder="desk lamp" value={b.name} onChange={e=>update(i,"name",e.target.value)}/></label>
 <label className="block text-sm">Device or routine<input className={input} list="room-devices" placeholder="light.desk" value={b.entity} onChange={e=>update(i,"entity",e.target.value)}/></label>
 {b.entity.startsWith("remote.")&&<><p className="text-xs">Use commands already learned in Home Assistant’s Broadlink integration.</p>{[["device","Learned device"],["commandOn","On command"],["commandOff","Off command"]].map(([key,label])=><label key={key} className="block text-sm">{label}<input className={input} value={b[key]} onChange={e=>update(i,key,e.target.value)}/></label>)}</>}
 <button disabled={busy} onClick={()=>setRoom({...room,bindings:room.bindings.filter((_,j)=>i!==j)})}>Remove device</button></div>)}
 <datalist id="room-devices">{devices.map(d=><option key={d.entity} value={d.entity}>{d.name}</option>)}</datalist>
 <div className="flex flex-wrap gap-3 text-sm"><button disabled={busy} onClick={()=>setRoom({...room,bindings:[...room.bindings,{name:"",entity:"",device:"",commandOn:"",commandOff:""}]})}>Add device</button><button disabled={busy} onClick={()=>run("save",{url:room.url,token,enabled:room.enabled,bindings:room.bindings})}>Save connection</button><button disabled={busy||!room.configured} onClick={()=>run("devices")}>Find devices</button></div>
 <p className="text-xs">Try “Hi Looma, turn on desk lamp”, “dim desk lamp to 35 percent”, or “run movie time”. Save changes before speaking. Routines must be configured in Home Assistant.</p></>}
 {message&&<p role="status" className="text-sm">{message}</p>}
 </section>;
}
