/**
 * Pure mapping layer for an Xbox-style standard browser Gamepad.
 * No access to navigator, canvas, DOM or Project 0; caller must poll only
 * during the game's approved update loop and detect browser permissions.
 * Outputs game logic actions, not camera or rendering implementation.
 */
export const GAMEPAD_DEADZONE = 0.16;
const readButton = (pad, index) => {
  const button = pad?.buttons?.[index];
  if (typeof button === "number") return Math.min(1,Math.max(0,button));
  if (!button) return 0;
  return Math.min(1,Math.max(0, Number(button.value ?? (button.pressed ? 1 : 0)) || 0));
};
const readAxis = (pad, index) => {
  const n = Number(pad?.axes?.[index] ?? 0);
  return Number.isFinite(n) ? Math.max(-1,Math.min(1,n)) : 0;
};
export function applyDeadzone(value, deadzone = GAMEPAD_DEADZONE) {
  if (!Number.isFinite(value)) return 0;
  const d = Number.isFinite(deadzone) ? Math.max(0,Math.min(.95,deadzone)) : GAMEPAD_DEADZONE;
  const raw = Math.max(-1,Math.min(1,value)), abs = Math.abs(raw);
  if (abs <= d) return 0;
  return Math.sign(raw) * (abs-d) / (1-d);
}
export function neutralInput() {
  return {
    connected:false, yaw:0, pitch:0, roll:0, thrust:0, brake:0,
    cameraYaw:0, cameraPitch:0, boost:false, interact:false, scan:false,
    galaxyMap:false, back:false, pause:false,
    up:false, down:false, left:false, right:false
  };
}
export function mapStandardGamepad(pad, options = {}) {
  const result = neutralInput();
  if (!pad || pad.connected === false || pad.mapping !== "standard") return result;
  const deadzone=options.deadzone ?? GAMEPAD_DEADZONE;
  const ax=i=>applyDeadzone(readAxis(pad,i),deadzone);
  const button=i=>readButton(pad,i) > .5;
  const trigger=i=>readButton(pad,i);
  const rollModifier=button(4); // LB
  const horizontal=ax(0);
  result.connected=true;
  result.yaw=rollModifier ? 0 : horizontal;
  result.roll=rollModifier ? horizontal : 0;
  result.pitch=-ax(1); // pushing left stick up should pitch up
  result.cameraYaw=ax(2);
  result.cameraPitch=-ax(3);
  result.thrust=trigger(7); // RT
  result.brake=trigger(6); // LT
  result.boost=button(5); // RB
  result.interact=button(0); // A
  result.back=button(1); // B
  result.scan=button(2); // X
  result.galaxyMap=button(3); // Y
  result.pause=button(9); // Start / menu
  result.up=button(12); result.down=button(13);
  result.left=button(14); result.right=button(15);
  return result;
}
/**
 * Browser helper, isolated from pure mapping. Returns neutral input on missing
 * API, on permission/access errors or when a pad is not found.
 * Call with real navigator from game loop; don't poll a hidden sandbox frame.
 */
export function readGamepad(browserNavigator, playerIndex=0, options={}) {
  if (!browserNavigator || typeof browserNavigator.getGamepads !== 'function') return neutralInput();
  try {
    const pads = browserNavigator.getGamepads();
    return mapStandardGamepad(pads?.[playerIndex],options);
  } catch {
    return neutralInput();
  }
}
