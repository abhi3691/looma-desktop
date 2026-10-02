"""Build portable skinned fur and state animations; inspect the exported GLB in Looma."""
import bpy,sys,math,random,json
from pathlib import Path
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from golden_rig import build_rig
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'assets/user-golden'
bpy.ops.wm.open_mainfile(filepath=str(out/'looma-golden-portable-coat.blend'))
mesh=bpy.data.objects['Looma-continuous-coat-surface']
for attr in list(mesh.data.color_attributes):mesh.data.color_attributes.remove(attr)
rig,spec,weights,bind=build_rig(mesh)
# Each tapered four-vertex strand shares its root's skin weights, both UV sets,
# and coat material. No Blender-only particles or Python runtime dependencies.
rng=random.Random(249);mesh.data.calc_loop_triangles();tris=list(mesh.data.loop_triangles)
vertices=[];faces=[];assign=[];uv0=[];uv1=[];material_ids=[];directions=[]
for tri in rng.choices(tris,weights=[t.area for t in tris],k=25000):
 a,b,c=[mesh.data.vertices[i] for i in tri.vertices];u=rng.random();v=rng.random()
 if u+v>1:u=1-u;v=1-v
 bary=[1-u-v,u,v];p=a.co*bary[0]+b.co*bary[1]+c.co*bary[2];n=(a.normal*bary[0]+b.normal*bary[1]+c.normal*bary[2]).normalized()
 # Preserve leather, nose, eyes, mouth and paw pads without fur growing through them.
 if .345<p.z<.425 and -.31<p.y<-.10:continue
 if p.z<.027:continue
 if p.y<-.43 and .395<p.z<.545:continue
 if any((p-Vector(q)).length<.022 for q in [(-.034565,-.38965,.570862),(.063103,-.389893,.555649)]):continue
 face=p.z>.46 and p.y<-.30
 ear=abs(p.x)>.115 and p.z>.40
 length=rng.uniform(.0025,.005) if face else rng.uniform(.012,.023) if ear else rng.uniform(.009,.018)
 guide=Vector((p.x*.45,.5,-1))
 if p.z>.59:guide=Vector((p.x*.9,-1,-.2))
 if p.y>.1:guide=Vector((p.x*.2,1,-.35))
 tangent=guide-n*guide.dot(n)
 if tangent.length<.01:tangent=n.cross(Vector((1,0,0)))
 tangent.normalize();direction=(n*.28+tangent).normalized();side=direction.cross(n).normalized();width=rng.uniform(.00018,.00036)
 root=p+n*.00012;mid=root+direction*length*.52+n*length*.10;tip=root+direction*length+n*length*.07
 start=len(vertices);vertices.extend([root-side*width,root+side*width,mid,tip]);faces.extend([(start,start+1,start+2),(start+1,start+3,start+2)])
 ws=weights(p);assign.extend([ws]*4)
 for layer,dst in zip(mesh.data.uv_layers,[uv0,uv1]):
  q=sum((layer.data[j].uv*b for j,b in zip(tri.loops,bary)),Vector((0,0)))
  dst.extend([q.copy()]*4)
 material_ids.extend([mesh.data.polygons[tri.polygon_index].material_index]*2)
h=bpy.data.meshes.new('Tapered exported coat strands');h.from_pydata(vertices,[],faces);h.update();fur=bpy.data.objects.new('Looma skinned golden coat',h);bpy.context.collection.objects.link(fur)
for src in mesh.data.materials:
 m=src.copy();m.name=src.name+' - fur';p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.95;p.inputs['Sheen Weight'].default_value=.40;m.use_backface_culling=False;h.materials.append(m)
for name,coords in zip([l.name for l in mesh.data.uv_layers],[uv0,uv1]):
 layer=h.uv_layers.new(name=name)
 for l in h.loops:layer.data[l.index].uv=coords[l.vertex_index]
for p,i in zip(h.polygons,material_ids):p.material_index=i;p.use_smooth=True
bind(fur,assign)
scene=bpy.context.scene;scene.view_settings.exposure=-.35;scene.frame_start=0;scene.frame_end=48;scene.render.fps=24;rig.animation_data_create()
states=['Idle','Walking','Watching','Thinking','Warning','Talking','Happy','Sleeping','Sit','Stretch','Spin','Cuddle']
for state in states:
 action=bpy.data.actions.new(state);rig.animation_data.action=action
 for f in range(0,49,3):
  t=f/48*math.tau
  for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  rig.pose.bones['Chest'].scale.x=1+.004*math.sin(t);rig.pose.bones['Tail'].rotation_euler.z=.12*math.sin(t*2)
  if state=='Walking':
   for i,n in enumerate(['Front_L','Front_R','Back_L','Back_R']):
    wave=math.sin(t*2+(math.pi if i in [1,2] else 0));rig.pose.bones[n].rotation_euler.x=.12*wave;leg,side=n.split('_');rig.pose.bones[leg+'Lower_'+side].rotation_euler.x=-.10*max(0,wave)
  if state in ['Watching','Thinking','Cuddle']:rig.pose.bones['Head'].rotation_euler.y=.055*math.sin(t)
  if state=='Warning':rig.pose.bones['Head'].rotation_euler.x=-.035;rig.pose.bones['Ear_L'].rotation_euler.y=.04*math.sin(t)
  if state=='Talking':rig.pose.bones['Jaw'].rotation_euler.x=.055*(1+math.sin(t*5))
  if state=='Happy':rig.pose.bones['Tail'].rotation_euler.z=.32*math.sin(t*4);rig.pose.bones['TailTip'].rotation_euler.z=.13*math.sin(t*4-.5)
  if state=='Sleeping':rig.pose.bones['Head'].rotation_euler.x=.09;rig.pose.bones['Chest'].scale.x=1+.008*math.sin(t)
  if state=='Stretch':
   for n in ['Front_L','Front_R']:rig.pose.bones[n].rotation_euler.x=.09*math.sin(t/2)**2
   rig.pose.bones['Head'].rotation_euler.x=-.07*math.sin(t/2)**2
  if state=='Spin':rig.pose.bones['Root'].rotation_euler.z=t
  for b in rig.pose.bones:
   for path in ['location','rotation_euler','scale']:b.keyframe_insert(data_path=path,frame=f)
 track=rig.animation_data.nla_tracks.new();track.name=state;track.strips.new(state,0,action);rig.animation_data.action=None;track.mute=True
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
# No extraneous scene content is included in the app's GLB.
bpy.ops.object.select_all(action='DESELECT')
for o in [mesh,fur,rig]:o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out/'looma-golden-desktop.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_image_format='AUTO')
scene.cycles.samples=32;scene.render.resolution_x=650;scene.render.resolution_y=750;scene.render.filepath=str(out/'desktop-golden-preview.png');bpy.ops.render.render(write_still=True)
# Explicit anatomy views and sampled gait frames are kept with the editable source.
cam=scene.camera;pos=cam.location.copy();rot=cam.rotation_euler.copy();scale=cam.data.ortho_scale
focus=Vector((0,0,.32));scene.render.resolution_x=480;scene.render.resolution_y=480;scene.cycles.samples=16;cam.data.ortho_scale=1.12
for name,offset in [('front',(0,-3,0)),('back',(0,3,0)),('left',(-3,0,0)),('right',(3,0,0)),('top',(0,0,3)),('bottom',(0,0,-3))]:
 cam.location=focus+Vector(offset);cam.rotation_euler=(focus-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/f'desktop-{name}.png');bpy.ops.render.render(write_still=True)
cam.location=pos;cam.rotation_euler=rot;cam.data.ortho_scale=scale
track=next(t for t in rig.animation_data.nla_tracks if t.name=='Walking');track.mute=False
for frame in [0,3,9,15]:scene.frame_set(frame);scene.render.filepath=str(out/f'desktop-walk-{frame:02}.png');bpy.ops.render.render(write_still=True)
track.mute=True;scene.frame_set(0)
scene.render.resolution_x=650;scene.render.resolution_y=750
bpy.ops.wm.save_as_mainfile(filepath=str(out/'looma-golden-desktop.blend'))
report={'bones':len(spec),'body_vertices':len(mesh.data.vertices),'fur_strands':len(vertices)//4,'fur_vertices':len(vertices),'animations':states,'bytes':(out/'looma-golden-desktop.glb').stat().st_size,'native_particles':0,'max_weights_per_vertex':4,'limitations':['Photo detail is projected onto the front of real 3D geometry; side detail comes from the original supplied model.','Seated stepping animation; not a natural standing gait.','Expression clips are simple bone motion, not full facial muscle animation.']}
(out/'desktop-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
