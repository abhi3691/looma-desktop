import { dog } from "./dog";
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import puppyBytes from '../public/looma-baby.glb';
let view: PuppyView | undefined;
class PuppyView {
 readonly renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 readonly scene=new THREE.Scene();
 readonly camera=new THREE.PerspectiveCamera(35,1,0.1,20);
 mixer?:THREE.AnimationMixer;
 model?:THREE.Group;
 actions=new Map<string,THREE.AnimationAction>();
 current='';requested='Idle';last=0;frame=0;
 constructor(){
  this.renderer.setClearColor(0,0);this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(210,210);
  this.renderer.domElement.className='dog puppy-3d';this.renderer.domElement.setAttribute('aria-label','Looma animated 3D baby puppy');
  this.camera.position.set(.35,.74,2.65);this.camera.lookAt(0,.56,0);
  this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.85;
  this.scene.add(new THREE.HemisphereLight(0xfffaf0,0x69614f,1.5));
  for(const [x,y,z,power] of [[2,4,3,2],[-3,2,1,1]]){const light=new THREE.DirectionalLight(0xffedcf,power);light.position.set(x,y,z);this.scene.add(light);}
  const loader=new GLTFLoader();
  // Embedded GLB keeps the pet renderer offline and requires no network permission.
  loader.parse(puppyBytes.slice().buffer as ArrayBuffer,'',gltf=>{
   this.model=gltf.scene;
   const box=new THREE.Box3().setFromObject(this.model);const dimensions=box.getSize(new THREE.Vector3());const center=box.getCenter(new THREE.Vector3());
   const scale=1.1/dimensions.y;this.model.scale.setScalar(scale);this.model.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);
   // Fine coat strands use gentle transparency at desktop scale to avoid harsh aliasing.
   this.model.traverse(o=>{if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.name.endsWith(' - fur')){m.transparent=true;m.opacity=.6;m.depthWrite=false;}});
   this.scene.add(this.model);this.mixer=new THREE.AnimationMixer(this.model);
   for(const clip of gltf.animations)this.actions.set(clip.name,this.mixer.clipAction(clip));
   const maps=new Set<THREE.Texture>();let skinned=0;
   this.model.traverse(o=>{if(o instanceof THREE.SkinnedMesh)skinned++;if(o instanceof THREE.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial&&m.map)maps.add(m.map);});
   this.renderer.domElement.dataset.textures=String(maps.size);this.renderer.domElement.dataset.skinnedMeshes=String(skinned);
   this.renderer.domElement.dataset.asset='golden-0.3.9';this.renderer.domElement.dataset.loaded='true';this.renderer.domElement.dataset.clips=String(this.actions.size);this.change(this.requested);
  },error=>{console.error('Puppy model could not load',error);this.renderer.domElement.dataset.error='true';const host=this.renderer.domElement.parentElement;if(host)showFallback(host);});
  const animate=(now:number)=>{this.frame=requestAnimationFrame(animate);if(now-this.last<1000/30)return;const dt=this.last?Math.min((now-this.last)/1000,.1):0;this.last=now;if(!this.renderer.domElement.isConnected)return;this.mixer?.update(matchMedia('(prefers-reduced-motion: reduce)').matches?0:dt);this.renderer.render(this.scene,this.camera);};
  this.frame=requestAnimationFrame(animate);
 }
 change(name:string){this.requested=name;if(!this.mixer||this.current===name)return;const next=this.actions.get(name)||this.actions.get('Idle');if(!next)return;this.actions.get(this.current)?.fadeOut(.22);next.reset().fadeIn(.22).play();this.current=name;this.renderer.domElement.dataset.animation=name;}
 dispose(){cancelAnimationFrame(this.frame);this.mixer?.stopAllAction();this.model?.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});this.renderer.dispose();}
}
function showFallback(host:HTMLElement){const img=document.createElement('img');img.className='dog puppy-portrait';img.src='../public/looma-golden.png';img.alt='Looma golden puppy';host.replaceChildren(img);}
export function mountPuppy(host:HTMLElement,state:string,gesture:string,phase:string,appearance:"cartoon"|"model"|"portrait"="cartoon"){
 if(appearance==="cartoon"){host.innerHTML=dog();return;}
 if(appearance==="portrait"){showFallback(host);return;}
 try {view??=new PuppyView();if(view.renderer.domElement.dataset.error){showFallback(host);return;}host.replaceChildren(view.renderer.domElement);
 const gestures:Record<string,string>={sit:'Sit',stretch:'Stretch',spin:'Spin',cuddle:'Cuddle',wag:'Happy',play:'Walking',fetch:'Walking',walk:'Walking',sleep:'Sleeping'};
 view.change(phase==='Speaking'?'Talking':phase==='Thinking'?'Thinking':gestures[gesture]||state);
 }catch(error){showFallback(host);}
}
window.addEventListener('beforeunload',()=>view?.dispose());
