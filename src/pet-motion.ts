export type Bounds = {x:number;y:number;width:number;height:number};
/** Move toward a target while keeping the entire companion inside one display. */
export function motionStep(pet: Bounds, target: {x:number;y:number}, area: Bounds, speed=4) {
  const tx=Math.max(area.x,Math.min(area.x+Math.max(0,area.width-pet.width),target.x));
  const ty=Math.max(area.y,Math.min(area.y+Math.max(0,area.height-pet.height),target.y));
  const dx=tx-pet.x,dy=ty-pet.y,d=Math.hypot(dx,dy);
  return {x:Math.round(d<=speed?tx:pet.x+dx/d*speed),y:Math.round(d<=speed?ty:pet.y+dy/d*speed),arrived:d<=speed};
}
