export class MusicRequest {
  private pending?: {stage:"type"|"title";genre:string;until:number};
  next(raw:string, now=Date.now()): {answer:string;query?:string}|undefined {
    const text=raw.trim();
    if(this.pending && this.pending.until<now)this.pending=undefined;
    if(this.pending && /^(cancel|never mind|stop|വേണ്ട)$/i.test(text)){this.pending=undefined;return {answer:"Okay, cancelled the song request."};}
    const start=/^(?:please\s+)?(?:sing|play)(?:\s+me)?\s+(?:(?:a|the|some)\s+)?(?:song|songs|music)(?:\s+(.*))?$/i.exec(text);
    const named=/^(?:please\s+)?(?:sing|play)\s+(.+?)(?:\s+(?:on|from)\s+youtube(?:\s+music)?)?$/i.exec(text);
    const ml=/പാട്ട്.*പാട|പാടൂ|paattu.*paad|pattu.*pad/i.test(text);
    if(start || ml){
      if(start?.[1]){this.pending=undefined;return this.search(start[1]);}
      this.pending={stage:"type",genre:"",until:now+120000};
      return {answer:"What kind of song would you like—movie, devotional, pop, or another type?"};
    }
    if(named && !/^(?:with\s+)?(?:ball|me|puppy)$/i.test(named[1])){this.pending=undefined;return this.search(named[1]);}
    if(!this.pending)return;
    // Other commands leave this short-lived music conversation immediately.
    if(/^(?:what|why|how|open|turn|set|remind|show|tell|check)\b/i.test(text)){this.pending=undefined;return;}
    if(this.pending.stage==="type"){
      const genre=text.replace(/\s+(?:song|songs|music)$/i,"");
      if(/^(movie|film|cinema|സിനിമ|movie song)$/i.test(genre)){
        this.pending={stage:"title",genre:"movie",until:now+120000};
        return {answer:"Which movie or song would you like? Tell me its name."};
      }
      if(/^(devotional|pop|classical|lullaby|malayalam|english|hindi|tamil)$/i.test(genre)){
        this.pending={stage:"title",genre,until:now+120000};
        return {answer:`Which ${genre} song or artist would you like?`};
      }
    }
    const genre=this.pending.genre;this.pending=undefined;
    return this.search(text+(genre==="movie"?" movie song":genre?` ${genre} song`:""));
  }
  private search(query:string){return {query:query.slice(0,500),answer:"Opening your selection in YouTube Music."};}
}
