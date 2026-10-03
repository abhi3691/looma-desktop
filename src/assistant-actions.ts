export type AssistantIntent =
 | {kind:'open';app:string}
 | {kind:'files';query:string}
 | {kind:'reminder';text:string;due:number}
 | {kind:'task';text:string}
 | {kind:'tasks'}
 | {kind:'complete';id:number}
 | {kind:'briefing'}
 | {kind:'briefing-toggle';enabled:boolean};
export function assistantIntent(text:string,now=Date.now()):AssistantIntent|undefined {
 const t=text.trim().replace(/^(?:hi\s+)?(?:looma|luma)[,\s]+/i,'');let m;
 if((m=t.match(/^open\s+(browser|chrome|safari|calculator|notes|calendar|music|spotify|files|finder|notepad)$/i)))return {kind:'open',app:m[1].toLowerCase()};
 if((m=t.match(/^(?:find|search)\s+(?:my\s+)?files?\s+(?:named|for|called)\s+(.+)$/i)))return {kind:'files',query:m[1].trim()};
 if((m=t.match(/^remind me (?:in (\d+)\s*(seconds?|minutes?|hours?) to (.+)|to (.+) in (\d+)\s*(seconds?|minutes?|hours?))$/i))){
  const count=Number(m[1]||m[5]),unit=m[2]||m[6],message=m[3]||m[4];
  const delay=count*(unit.toLowerCase().startsWith('hour')?3600000:unit.toLowerCase().startsWith('minute')?60000:1000);
  if(count>0&&delay<=30*86400000)return {kind:'reminder',text:message,due:now+delay};
 }
 if((m=t.match(/^(?:set\s+(?:an?\s+)?alarm|wake me)\s+(?:at|for)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s+(?:for|to)\s+(.+))?$/i))){
  let hour=Number(m[1]);const minute=Number(m[2]||0),suffix=m[3]?.toLowerCase();
  if(minute>59||hour>23||(suffix&&(hour<1||hour>12)))return;
  if(suffix)hour=hour%12+(suffix==='pm'?12:0);
  const due=new Date(now);due.setHours(hour,minute,0,0);if(due.getTime()<=now)due.setDate(due.getDate()+1);
  return {kind:'reminder',text:'Alarm: '+(m[4]||'Time to wake up'),due:due.getTime()};
 }
 if((m=t.match(/^(?:add|create)\s+(?:a\s+)?local task\s*:?\s+(.+)$/i)))return {kind:'task',text:m[1]};
 if(/^(?:show|list|what are)\s+(?:my\s+)?local tasks(?: today)?\??$/i.test(t))return {kind:'tasks'};
 if((m=t.match(/^(?:complete|finish|mark done)\s+(?:local\s+)?task\s+(\d+)$/i)))return {kind:'complete',id:Number(m[1])};
 if(/^(?:give me (?:my |a )?|my |daily )?briefing\??$/i.test(t))return {kind:'briefing'};
 if((m=t.match(/^(enable|disable)\s+(?:daily|morning)\s+briefing$/i)))return {kind:'briefing-toggle',enabled:m[1].toLowerCase()==='enable'};
}
