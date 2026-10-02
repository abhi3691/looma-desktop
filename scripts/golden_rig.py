"""Measured joint anchors and skinning for the supplied seated golden puppy."""
import bpy, math
from mathutils import Vector

def build_rig(mesh):
 spec={'Root':((0,0,0),(0,0,.1),None),'Body':((0,.12,.23),(0,-.08,.32),'Root'),'Chest':((0,-.08,.32),(0,-.20,.40),'Body'),'Head':((0,-.20,.40),(0,-.30,.58),'Chest'),'Jaw':((0,-.33,.46),(0,-.43,.43),'Head'),'Tail':((0,.25,.08),(0,.39,.04),'Body'),'TailTip':((0,.39,.04),(0,.49,.035),'Tail')}
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
  if p.y<-.375 and .405<p.z<.457:names=['Jaw','Head']
  elif p.y>.26 and p.z<.11:names=['Tail','TailTip','Body']
  elif p.z>.40:names=['Head','Chest']+(['Ear_L' if p.x<0 else 'Ear_R'] if abs(p.x)>.12 and p.y<-.14 else [])
  elif p.z<.24 and abs(p.x)>.05:
   leg='Front' if p.y<-.10 else 'Back';side='L' if p.x<0 else 'R';names=[leg+'_'+side,leg+'Lower_'+side,leg+'Paw_'+side,'Chest' if leg=='Front' else 'Body']
  else:names=['Body','Chest','Head']
  values=[]
  for n in names:
   a,b,_=spec[n];a=Vector(a);b=Vector(b);d=b-a;t=max(0,min(1,(p-a).dot(d)/d.length_squared));dist=(p-(a+d*t)).length
   values.append((n,math.exp(-min(50,(dist/.065)**2))))
  values=sorted(values,key=lambda pair:pair[1],reverse=True)[:4]
  total=sum(w for _,w in values) or 1
  return [(n,w/total) for n,w in values]
 def bind(obj,assign):
  groups={n:obj.vertex_groups.new(name=n) for n in spec}
  for index,ws in enumerate(assign):
   for name,w in ws:groups[name].add([index],w,'REPLACE')
  mod=obj.modifiers.new('Articulated puppy deformation','ARMATURE');mod.object=rig;mod.use_deform_preserve_volume=True;obj.parent=rig
 bind(mesh,[weights(v.co) for v in mesh.data.vertices])
 return rig, spec, weights, bind
