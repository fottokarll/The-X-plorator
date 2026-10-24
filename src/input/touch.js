/**
 * Device-agnostic touch/Pointer Events flight input. No DOM, renderer or P0 dependencies.
 * UI adapter should call down/move/up/cancel using event.pointerId/clientX/clientY.
 * Call snapshot() during the EXISTING game update loop. No new game loop.
 */
export function radialStick(x, y, radius=64, deadzone=0.08) {
  if (![x,y,radius,deadzone].every(Number.isFinite) || radius<=0 || deadzone<0 || deadzone>=1) return {x:0,y:0};
  const nx=x/radius, ny=y/radius, magnitude=Math.hypot(nx,ny);
  if(magnitude<=deadzone) return {x:0,y:0};
  const scaled=(Math.min(magnitude,1)-deadzone)/(1-deadzone);
  return {x:Number((nx/magnitude*scaled).toFixed(4)),y:Number((ny/magnitude*scaled).toFixed(4))};
}
const ACTIONS=new Set(["thrust","brake","boost","scan","interact","map","pause","back","rollLeft","rollRight"]);
const empty=()=>({
  connected:false, yaw:0,pitch:0,roll:0,thrust:0,brake:0,boost:false,
  cameraYaw:0,cameraPitch:0,interact:false,scan:false,galaxyMap:false,pause:false,back:false
});
export function createTouchFlightController({stickRadius=64,lookRadius=140,deadzone=0.08}={}) {
  const pointers = new Map();
  const validRole = role=>role==="stick"||role==="look"||ACTIONS.has(role);
  function down(id,role,x,y) {
    if (id===null||id===undefined||!Number.isFinite(x)||!Number.isFinite(y)||!validRole(role)||pointers.has(id)) return false;
    if ((role==="stick"||role==="look") && [...pointers.values()].some(p=>p.role===role)) return false;
    pointers.set(id,{role,originX:x,originY:y,x,y});return true;
  }
  function move(id,x,y) {
    const p=pointers.get(id);if (!p||!Number.isFinite(x)||!Number.isFinite(y)) return false;
    p.x=x;p.y=y;return true;
  }
  function up(id){return pointers.delete(id);}
  function reset(){pointers.clear();}
  function snapshot(){
    const s=empty();s.connected=pointers.size>0;
    const active=new Set();
    for(const p of pointers.values()){
      if(p.role==="stick") {
        const v=radialStick(p.x-p.originX,p.y-p.originY,stickRadius,deadzone);
        s.yaw=v.x;s.pitch=-v.y;
      } else if(p.role==="look") {
        const v=radialStick(p.x-p.originX,p.y-p.originY,lookRadius,deadzone);
        s.cameraYaw=v.x;s.cameraPitch=-v.y;
      } else active.add(p.role);
    }
    s.thrust=active.has("thrust")?1:0;
    s.brake=active.has("brake")?1:0;
    s.boost=active.has("boost");
    s.scan=active.has("scan");s.interact=active.has("interact");
    s.galaxyMap=active.has("map");s.pause=active.has("pause");s.back=active.has("back");
    s.roll=(active.has("rollRight")?1:0)-(active.has("rollLeft")?1:0);
    return s;
  }
  return {down,move,up,cancel:up,reset,snapshot};
}
/**
 * Recommended UI integration only after P0 SDK input audit:
 * - Each virtual control has touch-action:none and setPointerCapture/releasePointerCapture.
 * - On pointercancel/visibilitychange/blur call cancel/reset as appropriate.
 * - Prevent browser gestures only within interactive flight control regions.
 * - Use separate responsive CSS overlays for portrait/landscape, do NOT scale the canvas bitmap.
 */
