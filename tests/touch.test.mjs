import test from "node:test";
import assert from "node:assert/strict";
import {createTouchFlightController,radialStick} from "../src/input/touch.js";

test("radial deadzone filters thumb jitter",()=>{
  assert.deepEqual(radialStick(1,2,64),{x:0,y:0});
  assert.deepEqual(radialStick(NaN,2,64),{x:0,y:0});
  assert.equal(radialStick(200,0,64).x,1);
  assert.equal(radialStick(-200,0,64).x,-1);
  const diagonal=radialStick(90,90,64);
  assert.ok(Math.hypot(diagonal.x,diagonal.y) <= 1.001);
});
test("joystick and boost can be used simultaneously with separate fingers",()=>{
  const ctl=createTouchFlightController();
  assert.equal(ctl.down(11,"stick",100,200),true);
  ctl.move(11,140,170);
  assert.equal(ctl.down(12,"boost",310,670),true);
  let s=ctl.snapshot();
  assert.ok(s.yaw>0&&s.pitch>0);
  assert.equal(s.boost,true);
  ctl.up(12);
  s=ctl.snapshot();
  assert.equal(s.boost,false);assert.ok(s.yaw>0);
});
test("look region is independent from flight stick",()=>{
  const ctl=createTouchFlightController();
  ctl.down(1,"stick",30,40);ctl.down(2,"look",280,400);
  ctl.move(1,70,80);ctl.move(2,250,350);
  const s=ctl.snapshot();
  assert.ok(s.yaw>0&&s.pitch<0);
  assert.ok(s.cameraYaw<0&&s.cameraPitch>0);
});
test("only one pointer can own each gesture role",()=>{
  const ctl=createTouchFlightController();
  assert.equal(ctl.down(1,"stick",1,1),true);
  assert.equal(ctl.down(2,"stick",2,2),false);
  assert.equal(ctl.down(1,"boost",3,3),false);
  assert.equal(ctl.down(3,"unknown",3,3),false);
});
test("touch buttons map to flight and navigation actions",()=>{
  const ctl=createTouchFlightController();
  for(const [id,role] of [[1,"thrust"],[2,"scan"],[3,"rollLeft"],[4,"map"],[5,"interact"]]) ctl.down(id,role,0,0);
  const s=ctl.snapshot();
  assert.equal(s.thrust,1);assert.equal(s.scan,true);
  assert.equal(s.roll,-1);assert.equal(s.galaxyMap,true);
  assert.equal(s.interact,true);
});
test("cancel, reset and pointer release stop stuck thrust",()=>{
  const ctl=createTouchFlightController();
  ctl.down(1,"thrust",10,10);
  assert.equal(ctl.snapshot().thrust,1);
  ctl.cancel(1);
  assert.equal(ctl.snapshot().thrust,0);
  ctl.down(2,"boost",1,1);ctl.down(3,"stick",10,10);
  ctl.reset();
  assert.deepEqual(ctl.snapshot(),{
    connected:false,yaw:0,pitch:0,roll:0,thrust:0,brake:0,boost:false,
    cameraYaw:0,cameraPitch:0,interact:false,scan:false,galaxyMap:false,pause:false,back:false
  });
});
