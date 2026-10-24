import test from "node:test";
import assert from "node:assert/strict";
import {applyDeadzone,mapStandardGamepad,neutralInput,readGamepad} from "../src/input/gamepad.js";

function makePad({axes=[0,0,0,0],buttons={},connected=true,mapping='standard'}={}) {
  const keys=Array.from({length:16},(_,i)=>({value:buttons[i]??0,pressed:(buttons[i]??0)>.5}));
  return {axes,buttons:keys,connected,mapping};
}
test("no browser API or controller yields neutral controls",()=>{
  assert.deepEqual(readGamepad({}),neutralInput());
  assert.deepEqual(mapStandardGamepad(null),neutralInput());
  assert.deepEqual(readGamepad({getGamepads(){throw new Error("denied")}}),neutralInput());
});
test("small axis noise is removed by deadzone",()=>{
  assert.equal(applyDeadzone(.07),0);
  assert.equal(applyDeadzone(-.11),0);
  assert.ok(applyDeadzone(.9)>.8);
  assert.equal(applyDeadzone(-1),-1);
});
test("standard Xbox layout maps flight axes and buttons",()=>{
  const p=makePad({axes:[.6,-.9,.5,.7],buttons:{0:1,2:1,3:1,5:1,7:.85,6:.1}});
  const c=mapStandardGamepad(p);
  assert.equal(c.connected,true);
  assert.ok(c.yaw>0&&c.pitch>0);
  assert.ok(c.cameraYaw>0&&c.cameraPitch<0);
  assert.equal(c.thrust,.85);
  assert.equal(c.brake,.1);
  assert.equal(c.boost,true);
  assert.equal(c.interact,true);
  assert.equal(c.scan,true);
  assert.equal(c.galaxyMap,true);
});
test("LB + left-stick horizontal rolls rather than yaws",()=>{
  const c=mapStandardGamepad(makePad({axes:[.7,0,0,0],buttons:{4:1}}));
  assert.equal(c.yaw,0);
  assert.ok(c.roll>.5);
});
test("unsupported, disconnected controllers never inject input",()=>{
  assert.deepEqual(mapStandardGamepad(makePad({mapping:'unknown'})),neutralInput());
  assert.deepEqual(mapStandardGamepad(makePad({connected:false})),neutralInput());
});
test("controller index selects distinct pads; D-pad and menu work",()=>{
  const p0=makePad();
  const p1=makePad({buttons:{12:1,14:1,9:1}});
  const browser={getGamepads:()=>[p0,p1]};
  const c=readGamepad(browser,1);
  assert.equal(c.up,true);assert.equal(c.left,true);assert.equal(c.pause,true);
  assert.equal(readGamepad(browser,0).up,false);
});
