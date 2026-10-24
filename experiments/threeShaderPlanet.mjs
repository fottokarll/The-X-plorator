/**
 * The X-plorator / CODE ART EXPERIMENT.
 * Real THREE.ShaderMaterial example; NOT integrated with P0 SDK.
 * Test and profile this on real GPU before declaring it production-ready.
 * No imported image textures or mesh assets.
 */
import * as THREE from 'three';
const sharedSphere = new THREE.SphereGeometry(1, 48, 32);
const vertexShader = [
  'varying vec3 vLocal;',
  'varying vec3 vViewNormal;',
  'void main(){',
  '  vLocal=normalize(position);',
  '  vViewNormal=normalize(normalMatrix*normal);',
  '  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);',
  '}'
].join('\n');
const fragmentShader = [
  'precision highp float;',
  'uniform vec3 uA, uB, uRim, uLight;',
  'uniform float uSeed, uPattern, uRimPower;',
  'varying vec3 vLocal, vViewNormal;',
  'float hash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}',
  'float noise3(vec3 p){',
  ' vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);',
  ' return mix(',
  '   mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),',
  '   mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),',
  '   f.z);',
  '}',
  'void main(){',
  ' vec3 n=normalize(vLocal),nv=normalize(vViewNormal);',
  ' float warp=noise3(n*uPattern+vec3(uSeed*.01));',
  ' float bands=.5+.5*sin(n.y*16.0+warp*5.0);',
  ' float mask=smoothstep(.35,.65,warp*.7+bands*.3);',
  ' vec3 tint=mix(uA,uB,mask);',
  ' float diff=.28+.72*max(dot(nv,normalize(uLight)),0.0);',
  ' float rim=pow(1.0-max(nv.z,0.0),3.0);',
  ' gl_FragColor=vec4(tint*diff+uRim*rim*uRimPower,1.0);',
  '}'
].join('\n');
export const PALETTES = Object.freeze({
  oceanic: ['#236C99','#37CDC7','#9AE1DB'],
  volcanic:['#332544','#F36A65','#FDB67B'],
  frozen:  ['#294B7D','#9BD6F5','#DDF6FF'],
});
export function makePlanet({kind='oceanic',seed=42,radius=3,pattern=3.0,rings=true}={}) {
  const palette=PALETTES[kind];
  if (!palette || !Number.isFinite(radius) || radius<=0) throw new RangeError('Invalid planet profile');
  const mat=new THREE.ShaderMaterial({
    vertexShader,fragmentShader,
    uniforms:{
      uA:{value:new THREE.Color(palette[0])},
      uB:{value:new THREE.Color(palette[1])},
      uRim:{value:new THREE.Color(palette[2])},
      uLight:{value:new THREE.Vector3(.7,.35,1).normalize()},
      uSeed:{value:seed},
      uPattern:{value:pattern},
      uRimPower:{value:.25},
    },
  });
  const group=new THREE.Group();
  const body=new THREE.Mesh(sharedSphere,mat);
  body.scale.setScalar(radius);body.name='PlanetBody';group.add(body);
  if(rings) {
    const ring=new THREE.Mesh(
      new THREE.RingGeometry(radius*1.27,radius*1.56,96),
      new THREE.MeshBasicMaterial({
        color:palette[2],side:THREE.DoubleSide,
        transparent:true,opacity:.28,depthWrite:false,
      })
    );
    ring.rotation.set(1.14,.2,.15);ring.name='Ring';group.add(ring);
  }
  group.userData={kind,seed,radius};
  return group;
}
// Reuse the sharedSphere; release each unique material and ring geometry on unload.
// Production TODO: profile GLSL loops, verify alpha sorting and view-space normals,
// enforce P0 SDK renderer ownership and compare screenshots on a real GPU.
