"""Build Looma's real articulated 3D baby puppy in Blender and export GLB clips."""
import bpy,math,sys,random
from mathutils import Vector
from pathlib import Path
root=Path(sys.argv[sys.argv.index('--')+1]).resolve();root.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def material(name,color,rough=.6):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
fur=material('Soft honey puppy fur',(.55,.28,.07));cream=material('Lighter golden muzzle',(.69,.46,.2));ear=material('Floppy caramel ears',(.46,.25,.08));black=material('Wet puppy nose',(.025,.018,.012),.22);eye=material('Warm brown eyes',(.045,.023,.012),.12);white=material('Eye glints',(.95,.98,1),.15);pink=material('Tiny puppy tongue',(.71,.23,.26),.4);collar=material('Sage collar',(.22,.42,.32));gold=material('Looma tag',(.7,.48,.15),.25);gold.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value=1
# Named bones independently drive all limbs, ears, jaw and tail.
bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='Looma_Baby_Puppy_Rig';bpy.ops.object.mode_set(mode='EDIT');arm=rig.data;arm.edit_bones.remove(arm.edit_bones[0])
spec={'Root':((0,0,0),(0,0,.2),None),'Body':((0,0,.6),(0,0,1),'Root'),'Head':((0,-.25,1.05),(0,-.25,1.55),'Body'),'Ear_L':((-.38,-.26,1.55),(-.46,-.26,1.05),'Head'),'Ear_R':((.38,-.26,1.55),(.46,-.26,1.05),'Head'),'Jaw':((0,-.53,1.22),(0,-.68,1.16),'Head'),'Tail':((0,.42,.8),(0,.78,.92),'Body')}
for label,x,y in [('Front_L',-.23,-.3),('Front_R',.23,-.3),('Back_L',-.26,.28),('Back_R',.26,.28)]:spec[label]=((x,y,.64),(x,y,.18),'Body');spec[label+'_Paw']=((x,y,.18),(x,y-.1,.08),label)
for side,x in [('L',-.2),('R',.2)]:spec['Lid_'+side]=((x,-.642,1.44),(x,-.642,1.51),'Head')
for name,(start,end,parent) in spec.items():
 b=arm.edit_bones.new(name);b.head=start;b.tail=end
 if parent:b.parent=arm.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
def sphere(name,loc,scale,mat,bone):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for p in o.data.polygons:p.use_smooth=True
 o.data.materials.append(mat);group=o.vertex_groups.new(name=bone);group.add(list(range(len(o.data.vertices))),1,'REPLACE');mod=o.modifiers.new('Puppy armature','ARMATURE');mod.object=rig;o.parent=rig
 if mat in [fur,ear,cream] and 'tuft' not in name:
  rng=random.Random(name);vv=[];ff=[];count=6500 if 'head' in name else 4200 if 'body' in name else 1700 if 'ear' in name else 500
  for i in range(count):
   u=rng.uniform(-1,1);a=rng.random()*math.tau;n=Vector((math.sqrt(1-u*u)*math.cos(a),math.sqrt(1-u*u)*math.sin(a),u))
   point=Vector(loc)+Vector((n.x*scale[0],n.y*scale[1],n.z*scale[2]));normal=Vector((n.x/scale[0],n.y/scale[1],n.z/scale[2])).normalized()
   side=normal.cross(Vector((0,0,1)))
   if side.length<.01:side=normal.cross(Vector((1,0,0)))
   side.normalize();width=.0004;tip=point+normal*rng.uniform(.007,.013)+Vector((0,0,-.007));k=len(vv);vv.extend([point-side*width,point+side*width,tip]);ff.append((k,k+1,k+2))
  mesh=bpy.data.meshes.new(name+' fur strands');mesh.from_pydata(vv,[],ff);hair=bpy.data.objects.new(name+' soft fur',mesh);bpy.context.collection.objects.link(hair);hair.data.materials.append(mat);group=hair.vertex_groups.new(name=bone);group.add(list(range(len(vv))),1,'REPLACE');mod=hair.modifiers.new('Fur follows bones','ARMATURE');mod.object=rig;hair.parent=rig
 return o
sphere('Round baby body',(0,0,.68),(.34,.48,.43),fur,'Body');
sphere('Oversized baby head',(0,-.3,1.35),(.46,.39,.43),fur,'Head');sphere('Short muzzle',(0,-.65,1.21),(.235,.18,.135),cream,'Head');sphere('Left whisker pad',(-.105,-.755,1.17),(.13,.075,.1),cream,'Head');sphere('Right whisker pad',(.105,-.755,1.17),(.13,.075,.1),cream,'Head')
for side,x in [('L',-.2),('R',.2)]:
 sphere('Eye_'+side,(x,-.642,1.44),(.073,.047,.076),eye,'Lid_'+side);sphere('Sparkle_'+side,(x-.014,-.681,1.46),(.011,.006,.015),white,'Head')

 sphere('Lower eyelid_'+side,(x,-.634,1.377),(.078,.018,.009),fur,'Head')
 sphere('Floppy ear_'+side,(-.43 if side=='L' else .43,-.25,1.28),(.13,.15,.28),ear,'Ear_'+side)
sphere('Nose',(0,-.814,1.245),(.09,.055,.066),black,'Head');sphere('Mouth',(0,-.756,1.105),(.105,.032,.075),black,'Jaw');sphere('Tongue',(0,-.787,1.079),(.073,.044,.074),pink,'Jaw')
for label,x,y in [('Front_L',-.23,-.3),('Front_R',.23,-.3),('Back_L',-.26,.28),('Back_R',.26,.28)]:
 sphere(label+' short leg',(x,y,.34),(.11,.12,.25),fur,label);sphere(label+' baby paw',(x,y-.065,.1),(.125,.17,.1),fur,label+'_Paw')
 for toe in range(3):sphere(label+' toe '+str(toe),(x+(toe-1)*.056,y-.19,.075),(.038,.068,.059),fur,label+'_Paw')
sphere('Tail base',(0,.55,.86),(.095,.24,.085),fur,'Tail');sphere('Tail tip',(0,.76,.92),(.07,.16,.07),cream,'Tail')
sphere('Soft collar',(0,-.3,1.035),(.32,.26,.057),collar,'Head');sphere('Round brass tag',(0,-.575,.99),(.072,.018,.077),gold,'Head')
# Subtle sculptural tufts make the silhouette soft without costly hair simulation.
for i in range(0):
 x=(i-3)*.095;sphere('Baby head tuft '+str(i),(x,-.28,1.72-abs(x)*.3),(.08,.085,.08),fur,'Head')
rig.animation_data_create();bpy.context.scene.render.fps=24
states=['Idle','Walking','Watching','Thinking','Warning','Talking','Happy','Sleeping','Sit','Stretch','Spin','Cuddle']
for state in states:
 action=bpy.data.actions.new(state);rig.animation_data.action=action
 for f in range(0,25,3):
  t=f/24*math.tau
  for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
  for side in ['L','R']:rig.pose.bones['Lid_'+side].scale.y=.06 if state=='Sleeping' or (f==12 and state=='Idle') else 1
  rig.pose.bones['Body'].location.z=.008*math.sin(t)
  rig.pose.bones['Head'].rotation_euler.y=.025*math.sin(t)
  rig.pose.bones['Tail'].rotation_euler.z=.28*math.sin(t*2)
  if state=='Walking':
   for i,label in enumerate(['Front_L','Front_R','Back_L','Back_R']):
    wave=math.sin(t+(math.pi if i in [1,2] else 0));rig.pose.bones[label].rotation_euler.x=.4*wave;rig.pose.bones[label+'_Paw'].rotation_euler.x=-.2*wave
   rig.pose.bones['Body'].location.z=.015*math.cos(t*2)
  if state in ['Watching','Thinking','Warning']:rig.pose.bones['Head'].rotation_euler.y={'Watching':.15,'Thinking':-.22,'Warning':.08}[state]
  if state=='Talking':rig.pose.bones['Jaw'].rotation_euler.x=.14*(.5+.5*math.sin(t*3))
  if state=='Happy':rig.pose.bones['Tail'].rotation_euler.z=.65*math.sin(t*3);rig.pose.bones['Body'].location.z=.04*(1-math.cos(t))
  if state=='Sleeping':rig.pose.bones['Head'].rotation_euler.x=.4;rig.pose.bones['Body'].location.z=-.14;rig.pose.bones['Tail'].rotation_euler.z=0
  if state=='Sit':
   for label in ['Back_L','Back_R']:rig.pose.bones[label].rotation_euler.x=-.6
   rig.pose.bones['Body'].rotation_euler.x=-.15
  if state=='Stretch':rig.pose.bones['Body'].rotation_euler.x=.3*(1-math.cos(t))/2;rig.pose.bones['Head'].rotation_euler.x=-.2*(1-math.cos(t))/2
  if state=='Spin':rig.pose.bones['Root'].rotation_euler.z=t
  if state=='Cuddle':rig.pose.bones['Head'].rotation_euler.y=.2*math.sin(t);rig.pose.bones['Ear_L'].rotation_euler.y=.15*math.sin(t)
  rig.pose.bones['Ear_L'].rotation_euler.x=.04*math.sin(t);rig.pose.bones['Ear_R'].rotation_euler.x=-.04*math.sin(t)
  for bone in rig.pose.bones:
   bone.keyframe_insert(data_path='rotation_euler',frame=f);bone.keyframe_insert(data_path='location',frame=f);bone.keyframe_insert(data_path='scale',frame=f)
 track=rig.animation_data.nla_tracks.new();track.name=state;track.strips.new(state,0,action);rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
bpy.ops.object.select_all(action='SELECT');bpy.ops.export_scene.gltf(filepath=str(root/'looma-baby.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True)
bpy.ops.wm.save_as_mainfile(filepath=str(root/'looma-baby.blend'))
# Render a clean preview of the model, not a photographic texture.
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.film_transparent=True;scene.render.resolution_x=600;scene.render.resolution_y=700;scene.render.resolution_percentage=100
bpy.ops.object.camera_add(location=(2,-4,2.1));cam=bpy.context.object;cam.rotation_euler=(Vector((0,-.1,.9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.25;scene.camera=cam
for loc,power,size in [((2,-3,4),400,4),((-3,-1,2),250,3),((0,3,3),400,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.image_settings.color_mode='RGBA';scene.render.filepath=str(root/'preview.png');bpy.ops.render.render(write_still=True)
scene.cycles.samples=8;scene.render.resolution_x=300;scene.render.resolution_y=350
for track in rig.animation_data.nla_tracks:
 if track.name!='Walking':continue
 track.mute=False
 for f in [0,6,12,18]:scene.frame_set(f);scene.render.filepath=str(root/f'walk-{f}.png');bpy.ops.render.render(write_still=True)
 track.mute=True
