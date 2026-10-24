/**
 * The X-plorator: prototype of one-stick assisted 3D flight and automatic
 * follow camera. Pure logic (no P0/Three.js assumptions). Values are our
 * experimental defaults, NOT measurements from ABZU. Not yet playtested.
 */
export const DEFAULT_FLIGHT_PROFILE=Object.freeze({
 cruiseSpeed:12,boostSpeed:28,maxSpeed:34,acceleration:10,braking:24,
 coastDamping:2.2,yawRate:1.8,pitchRate:1.3,maxPitch:Math.PI*.47,
 turnSmoothing:9,autoBank:.32,bankSmoothing:5,
 cameraDistance:15,cameraHeight:4.6,cameraFollow:5.2,
 freeLookRate:1.4,freeLookReturn:2.8
});
const fin=(n,d=0)=>Number.isFinite(n)?n:d;
const cap=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const ease=(v,t,k,dt)=>v+(t-v)*(1-Math.exp(-k*dt));
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function createFlightState(){return {
 position:{x:0,y:0,z:0},yaw:0,pitch:0,bank:0,yawInput:0,pitchInput:0,speed:0,
 cruiseEnabled:true,lookYaw:0,lookPitch:0,
 cameraPosition:{x:0,y:4.6,z:-15},paused:false
};}
export function stepFlight(s,input={},dt=1/60,p=DEFAULT_FLIGHT_PROFILE){
 const d=cap(fin(dt),0,.05); // no huge tab-resume movement
 if(!d||s.paused||input.pause)return s;
 const yaw=cap(fin(input.yaw),-1,1),pitch=cap(fin(input.pitch),-1,1);
 s.yawInput=ease(s.yawInput,yaw,p.turnSmoothing,d);
 s.pitchInput=ease(s.pitchInput,pitch,p.turnSmoothing,d);
 s.yaw=wrap(s.yaw+s.yawInput*p.yawRate*d);
 s.pitch=cap(s.pitch+s.pitchInput*p.pitchRate*d,-p.maxPitch,p.maxPitch);
 // Optional gentle stabilisation: with the stick released the nose drifts level.
 if(p.autoLevel&&Math.abs(pitch)<.05)s.pitch=ease(s.pitch,0,p.autoLevel,d);
 s.bank=ease(s.bank,-s.yawInput*p.autoBank,p.bankSmoothing,d);
 const brake=cap(fin(input.brake),0,1),thrust=cap(fin(input.thrust),0,1);
 let target=s.cruiseEnabled?p.cruiseSpeed:0;
 if(input.boost||thrust>.15)target=Math.max(target,p.boostSpeed*thrust,input.boost?p.boostSpeed:0);
 if(brake>0)target=Math.max(0,target*(1-brake));
 const rate=brake>0?p.braking:(target>s.speed?p.acceleration:p.coastDamping);
 s.speed=cap(s.speed+cap(target-s.speed,-rate*d,rate*d),0,p.maxSpeed);
 const cp=Math.cos(s.pitch);
 s.position.x+=Math.sin(s.yaw)*cp*s.speed*d;
 s.position.y+=Math.sin(s.pitch)*s.speed*d;
 s.position.z+=Math.cos(s.yaw)*cp*s.speed*d;
 // Right stick is optional; without input view recenters smoothly.
 const lookX=cap(fin(input.cameraYaw),-1,1),lookY=cap(fin(input.cameraPitch),-1,1);
 if(Math.abs(lookX)+Math.abs(lookY)>.06){
  s.lookYaw=cap(s.lookYaw+lookX*p.freeLookRate*d,-Math.PI*.76,Math.PI*.76);
  s.lookPitch=cap(s.lookPitch+lookY*p.freeLookRate*d,-.65,.65);
 }else{
  s.lookYaw=ease(s.lookYaw,0,p.freeLookReturn,d);
  s.lookPitch=ease(s.lookPitch,0,p.freeLookReturn,d);
 }
 const viewYaw=s.yaw+s.lookYaw;
 const viewPitch=cap(s.pitch+s.lookPitch,-1.2,1.2);
 const cos=Math.cos(viewPitch);
 const desired={
  x:s.position.x-Math.sin(viewYaw)*cos*p.cameraDistance,
  y:s.position.y-Math.sin(viewPitch)*p.cameraDistance+p.cameraHeight,
  z:s.position.z-Math.cos(viewYaw)*cos*p.cameraDistance
 };
 for(const a of ['x','y','z'])s.cameraPosition[a]=ease(s.cameraPosition[a],desired[a],p.cameraFollow,d);
 return s;
}
export function setCruise(s,enabled){s.cruiseEnabled=Boolean(enabled);return s;}
export function resetFlight(s){Object.assign(s,createFlightState());return s;}
