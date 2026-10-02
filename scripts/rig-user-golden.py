import bpy,math,random,json,sys,bmesh
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1]).resolve();bpy.ops.wm.open_mainfile(filepath=str(out/'looma-golden-refined.blend'))
mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');bpy.context.view_layer.objects.active=mesh
bpy.ops.object.select_all(action='DESELECT');mesh.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Weld coincident UV-split positions while preserving per-loop texture coordinates.
bm=bmesh.new();bm.from_mesh(mesh.data);before=len(bm.verts)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh.data);bm.free()
print('Seam audit vertices before/after:',before,len(mesh.data.vertices),flush=True)
# Reduce unnecessary scanning triangles without replacing the supplied silhouette.
dec=mesh.modifiers.new('Desktop topology reduction','DECIMATE');dec.ratio=.55;bpy.ops.object.modifier_apply(modifier=dec.name)
sm=mesh.modifiers.new('Relax scan spikes','SMOOTH');sm.factor=.08;sm.iterations=1;bpy.ops.object.modifier_apply(modifier=sm.name)
for img in bpy.data.images:
 if img.size[0]>1024:img.scale(1024,1024);img.pack()
spec={'Root':((0,0,0),(0,0,.1),None),'Body':((0,.12,.23),(0,-.08,.32),'Root'),'Chest':((0,-.08,.32),(0,-.20,.40),'Body'),'Head':((0,-.20,.40),(0,-.30,.58),'Chest'),'Jaw':((0,-.30,.43),(0,-.41,.40),'Head'),'Tail':((0,.25,.08),(0,.39,.04),'Body'),'TailTip':((0,.39,.04),(0,.49,.035),'Tail')}
for side,s in [('L',-1),('R',1)]:
 x=s*.11
 spec['Front_'+side]=((x,-.18,.31),(x,-.21,.16),'Chest');spec['FrontLower_'+side]=((x,-.21,.16),(x,-.23,.055),'Front_'+side);spec['FrontPaw_'+side]=((x,-.23,.055),(x,-.29,.035),'FrontLower_'+side)
 spec['Back_'+side]=((x,.12,.22),(x,.18,.11),'Body');spec['BackLower_'+side]=((x,.18,.11),(x,.085,.04),'Back_'+side);spec['BackPaw_'+side]=((x,.085,.04),(x,.025,.025),'BackLower_'+side)
 spec['Ear_'+side]=((s*.12,-.23,.56),(s*.17,-.23,.40),'Head')
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='Looma_Golden_Articulated_Rig';bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0])
for name,(head,tail,parent) in spec.items():
 b=rig.data.edit_bones.new(name);b.head=head;b.tail=tail
 if parent:b.parent=rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True

def weights(p):
 # Region limits prevent ears and feet pulling unrelated body areas.
 if p.y>.26 and p.z<.11:names=['Tail','TailTip','Body']
 elif p.z>.40:names=['Head','Chest']+(['Ear_L' if p.x<0 else 'Ear_R'] if abs(p.x)>.12 and p.y<-.14 else [])
 elif p.z<.24 and abs(p.x)>.05:
  leg='Front' if p.y<-.10 else 'Back';side='L' if p.x<0 else 'R';names=[leg+'_'+side,leg+'Lower_'+side,leg+'Paw_'+side,'Chest' if leg=='Front' else 'Body']
 else:names=['Body','Chest','Head']
 values=[]
 for n in names:
  a,b,_=spec[n];a=Vector(a);b=Vector(b);d=b-a;t=max(0,min(1,(p-a).dot(d)/d.length_squared));dist=(p-(a+d*t)).length
  values.append((n,math.exp(-min(50,(dist/.065)**2))))
 total=sum(w for _,w in values) or 1
 return [(n,w/total) for n,w in values]
def bind(obj,assign):
 groups={n:obj.vertex_groups.new(name=n) for n in spec}
 for index,ws in enumerate(assign):
  for name,w in ws:groups[name].add([index],w,'REPLACE')
 mod=obj.modifiers.new('Articulated puppy deformation','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True;obj.parent=rig
bind(mesh,[weights(v.co) for v in mesh.data.vertices])
# Fine tapered mesh strands survive GLB export and inherit their root's skin weights.
rng=random.Random(71);mesh.data.calc_loop_triangles();tris=list(mesh.data.loop_triangles);chosen=rng.choices(tris,weights=[t.area for t in tris],k=9000)
vertices=[];faces=[];assign=[]
for tri in chosen:
 a,b,c=[mesh.data.vertices[i] for i in tri.vertices];u=rng.random();v=rng.random()
 if u+v>1:u=1-u;v=1-v
 p=a.co*(1-u-v)+b.co*u+c.co*v;n=(a.normal*(1-u-v)+b.normal*u+c.normal*v).normalized()
 if p.y<-.33 and p.z>.38:continue
 if p.z<.022:continue
 guide=Vector((p.x*.3,.2,-.7));tangent=guide-n*guide.dot(n)
 if tangent.length<.01:tangent=n.cross(Vector((1,0,0)))
 tangent.normalize();direction=(n*.5+tangent).normalized();side=direction.cross(n).normalized();length=rng.uniform(.005,.012);width=.00016;start=len(vertices);ws=weights(p)
 for j in range(3):
  t=j/2;center=p+direction*length*t+n*.001*math.sin(t*math.pi)
  for sign in [-1,1]:vertices.append(center+side*width*(1-t*.96)*sign);assign.append(ws)
 for j in range(2):k=start+j*2;faces.extend([(k,k+1,k+2),(k+1,k+3,k+2)])
hair=bpy.data.meshes.new('Fine skinned coat');hair.from_pydata(vertices,[],faces);hair.update();fur=bpy.data.objects.new('Looma fine golden fur',hair);bpy.context.collection.objects.link(fur)
mat=bpy.data.materials.new('Golden soft fur');mat.use_nodes=True;shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.38,.20,.075,1);shader.inputs['Roughness'].default_value=.88;shader.inputs['Sheen Weight'].default_value=.3;hair.materials.append(mat);bind(fur,assign)
scene=bpy.context.scene;scene.frame_start=0;scene.frame_end=48;scene.render.fps=24;rig.animation_data_create()
states=['Idle','Walking','Watching','Thinking','Warning','Talking','Happy','Sleeping','Sit','Stretch','Spin','Cuddle']
for state in states:
 action=bpy.data.actions.new(state);rig.animation_data.action=action
 for f in range(0,49,3):
  t=f/48*math.tau
  for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  rig.pose.bones['Chest'].scale.x=1+.004*math.sin(t);rig.pose.bones['Tail'].rotation_euler.z=.12*math.sin(t*2)
  if state=='Walking':
   for i,n in enumerate(['Front_L','Front_R','Back_L','Back_R']):
    wave=math.sin(t*2+(math.pi if i in [1,2] else 0));rig.pose.bones[n].rotation_euler.x=.14*wave;leg,side=n.split('_');rig.pose.bones[leg+'Lower_'+side].rotation_euler.x=-.13*max(0,wave)
  if state in ['Watching','Thinking','Cuddle']:rig.pose.bones['Head'].rotation_euler.y=.05*math.sin(t)
  if state=='Talking':rig.pose.bones['Jaw'].rotation_euler.x=.025*(1+math.sin(t*5))
  if state=='Happy':rig.pose.bones['Tail'].rotation_euler.z=.35*math.sin(t*4)
  if state=='Sleeping':rig.pose.bones['Head'].rotation_euler.x=.06
  if state=='Spin':rig.pose.bones['Root'].rotation_euler.z=t
  for b in rig.pose.bones:
   for path in ['location','rotation_euler','scale']:b.keyframe_insert(data_path=path,frame=f)
 track=rig.animation_data.nla_tracks.new();track.name=state;track.strips.new(state,0,action);rig.animation_data.action=None;track.mute=True
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
bpy.ops.object.select_all(action='DESELECT')
for obj in [mesh,fur,rig]:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(out/'looma-golden-rigged.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS')
scene.render.resolution_x=600;scene.render.resolution_y=700;scene.cycles.samples=24;scene.camera.data.ortho_scale=1.2
scene.render.filepath=str(out/'rigged-preview.png');bpy.ops.render.render(write_still=True)
track=next(t for t in rig.animation_data.nla_tracks if t.name=='Walking');track.mute=False
for f in [0,6,12,18]:scene.frame_set(f);scene.render.filepath=str(out/f'walk-{f}.png');bpy.ops.render.render(write_still=True)
track.mute=True;scene.frame_set(0);bpy.ops.wm.save_as_mainfile(filepath=str(out/'looma-golden-rigged.blend'))
(out/'rig-report.json').write_text(json.dumps({'bones':len(spec),'fur_strands':len(vertices)//6,'animations':states,'bytes':(out/'looma-golden-rigged.glb').stat().st_size,'walking':'seated mesh step candidate, needs visual gait review'},indent=2))
