import {BrowserWindow} from "electron";
let player:BrowserWindow|undefined;
export async function playMusic(query:string):Promise<string>{
  if(!player || player.isDestroyed()){
    player=new BrowserWindow({title:"Looma · YouTube Music",width:1000,height:720,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,partition:"persist:looma-music"}});
    player.webContents.setWindowOpenHandler(()=>({action:"deny"}));
    player.webContents.on("will-navigate",(event,url)=>{
      try {const u=new URL(url);if(u.protocol!=="https:" || !["music.youtube.com","accounts.google.com","consent.youtube.com","consent.google.com"].includes(u.hostname))event.preventDefault();}catch{event.preventDefault();}
    });
  }
  const current=player;current.show();
  await current.loadURL("https://music.youtube.com/search?q="+encodeURIComponent(query));
  // Use the official player rather than copying or synthesizing recorded music.
  let clicked=false;
  for(let attempt=0;attempt<12;attempt++){
    if(current.isDestroyed())return "YouTube Music was closed before playback started.";
    const state:{started?:boolean;clicked?:boolean}=await current.webContents.executeJavaScript(`(()=>{
      const video=document.querySelector('video');if(video && !video.paused)return {started:true};
      const row=document.querySelector('ytmusic-shelf-renderer ytmusic-responsive-list-item-renderer');
      const play=row?.querySelector('ytmusic-play-button-renderer');
      if(play && ${!clicked}){play.click();return {clicked:true};}return {};
    })()`,true).catch(()=>({}));
    clicked ||= !!state.clicked;
    if(state.started)return "Your selection is playing in YouTube Music.";
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  return "Your results are open in YouTube Music. Select the song to play it; sign in if YouTube asks.";
}
