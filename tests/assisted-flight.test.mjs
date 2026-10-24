import test from "node:test";
import assert from "node:assert/strict";
import {createFlightState,stepFlight,setCruise,resetFlight} from "../src/flight/assisted-flight.js";
const sim=(s,i={},secs=2)=>{for(let j=0;j<secs*60;j++)stepFlight(s,i,1/60);return s;};
test("cruise moves automatically without holding RT",()=>{
 const s=sim(createFlightState()); assert.ok(s.speed>9&&s.position.z>0);
});
test("one left stick changes 3D course, no right stick necessary",()=>{
 const s=sim(createFlightState(),{yaw:1,pitch:.4},1);
 assert.ok(s.yaw>.5&&s.pitch>.2);assert.notEqual(s.position.x,0);assert.notEqual(s.position.y,0);
});
test("boost with RT/RB and brake with LT",()=>{
 const s=sim(createFlightState(),{thrust:1});
 assert.ok(s.speed>12);sim(s,{brake:1},1);assert.ok(s.speed<3);
 sim(s,{boost:true});assert.ok(s.speed>12);
});
test("optional free-look returns behind the ship",()=>{
 const s=sim(createFlightState(),{cameraYaw:.9},1);
 assert.ok(s.lookYaw>.4);sim(s,{},3);assert.ok(Math.abs(s.lookYaw)<.02);
});
test("pause and dt clamping prevent tab-resume teleport",()=>{
 const s=createFlightState();stepFlight(s,{yaw:100,thrust:100},5);
 assert.ok(s.position.z<4);const z=s.position.z;
 s.paused=true;stepFlight(s,{yaw:1},1);assert.equal(s.position.z,z);
 s.paused=false;stepFlight(s,{pause:true},1);assert.equal(s.position.z,z);
 stepFlight(s,{},0);assert.equal(s.position.z,z);
});
test("cruise can be disabled for docking and reset",()=>{
 const s=createFlightState();sim(s);setCruise(s,false);sim(s,{},7);
 assert.ok(s.speed<1);resetFlight(s);assert.equal(s.cruiseEnabled,true);
 assert.equal(s.speed,0);
});
