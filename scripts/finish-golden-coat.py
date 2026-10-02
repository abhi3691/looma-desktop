"""Repair the supplied puppy's coat and bake a portable, locally sourced face texture.
Reference landmarks are measured in Blender metres and normalized photo coordinates.
No remote services; the supplied model and user-selected photo stay on this Mac.
"""
import bpy, bmesh, numpy as np, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];out=ROOT/'assets/user-golden'
bpy.ops.wm.open_mainfile(filepath=str(out/'looma-golden-rebuilt-surface.blend'))
body=bpy.data.objects['Looma-continuous-coat-surface']
# Work only on the generated puppy, retaining the untouched source in earlier files.
for o in list(bpy.data.objects):
 if o.type=='MESH' and o!=body:bpy.data.objects.remove(o,do_unlink=True)
bpy.context.view_layer.objects.active=body;bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
while body.particle_systems:bpy.ops.object.particle_system_remove()
# Relax only coat ridges. Preserve eyes, nose, collar, soles and silhouette landmarks.
g=body.vertex_groups.new(name='Coat ridge repair')
for v in body.data.vertices:
 p=v.co;w=1
 if p.y<-.33 and p.z>.4:w=.08
 if .345<p.z<.43 and -.31<p.y<-.10:w=0
 if p.z<.07:w=.08
 g.add([v.index],w,'REPLACE')
s=body.modifiers.new('Relax residual coat ridges','SMOOTH');s.factor=.7;s.iterations=35;s.vertex_group=g.name;bpy.ops.object.modifier_apply(modifier=s.name)
# Remove tiny disconnected scan scraps before reducing the main continuous surface.
bm=bmesh.new();bm.from_mesh(body.data);unseen=set(bm.verts);discard=[]
while unseen:
 seed=unseen.pop();component=[seed];stack=[seed]
 while stack:
  v=stack.pop()
  for e in v.link_edges:
   n=e.other_vert(v)
   if n in unseen:unseen.remove(n);stack.append(n);component.append(n)
 if len(component)<120:discard.extend(component)
if discard:bmesh.ops.delete(bm,geom=discard,context='VERTS')
bm.to_mesh(body.data);bm.free()
d=body.modifiers.new('Desktop body topology','DECIMATE');d.ratio=.23;bpy.ops.object.modifier_apply(modifier=d.name)
for p in body.data.polygons:p.use_smooth=True
mat=body.data.materials[0];nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF');old=next(n for n in nodes if n.type=='TEX_IMAGE')
im=old.image;w,h=im.size;pix=np.array(im.pixels[:],dtype=np.float32).reshape(h,w,4)
r,g,b=pix[:,:,0],pix[:,:,1],pix[:,:,2];neutral=(np.maximum.reduce([r,g,b])-np.minimum.reduce([r,g,b])<.18)&(r>.12)
luma=(r+g+b)/3
for i,f in enumerate([1.09,.73,.40]):pix[:,:,i][neutral]=np.minimum(1,luma[neutral]*f)
im.pixels.foreach_set(pix.ravel());im.update();im.filepath_raw=str(out/'coat-repaired-source.png');im.file_format='PNG';im.save();old.image=bpy.data.images.load(str(out/'coat-repaired-source.png'),check_existing=False);old.image.pack()
# Thin-plate landmark map: measured eyes, nose, mouth, crown and ear anchors.
# Values are (Blender X,Z) -> (reference U,V), with V measured from the bottom.
a=np.array([[-.034565,.570862],[.063103,.555649],[.02252,.5055],[-.00174,.44356],[0,.6478],[-.165,.54],[.185,.515],[-.10,.395],[.10,.395],[-.01,.335],[-.105,.055],[.11,.055],[0,.17],[-.18,.14],[.18,.14]],dtype=float)
b=np.array([[.308,.842],[.503,.834],[.365,.754],[.366,.691],[.396,.965],[.13,.826],[.717,.815],[.26,.628],[.54,.621],[.401,.518],[.24,.115],[.555,.075],[.41,.30],[.145,.22],[.755,.22]])
def kernel(d):return d*d*np.log(np.maximum(d,1e-9))
k=kernel(np.linalg.norm(a[:,None]-a[None,:],axis=2));P=np.c_[np.ones(len(a)),a];A=np.block([[k+np.eye(len(a))*1e-7,P],[P.T,np.zeros((3,3))]])
coeff=np.linalg.solve(A,np.r_[b,np.zeros((3,2))])
coords=np.array([[v.co.x,v.co.z] for v in body.data.vertices]);proj=kernel(np.linalg.norm(coords[:,None]-a[None,:],axis=2))@coeff[:len(a)]+np.c_[np.ones(len(coords)),coords]@coeff[len(a):]
uv=body.data.uv_layers.new(name='Portrait projection');weight=body.data.color_attributes.new(name='Portrait blend',type='FLOAT_COLOR',domain='POINT')
def smooth(lo,hi,v):
 t=max(0,min(1,(v-lo)/(hi-lo)));return t*t*(3-2*t)
for v in body.data.vertices:
 q=v.co;n=v.normal;value=smooth(.405,.455,q.z)*smooth(-.15,.45,-n.y)*smooth(-.26,-.34,q.y)
 # Front-face projection fades out before the ear sides and rear crown.
 value*=1-smooth(.13,.19,abs(q.x))
 weight.data[v.index].color=(value,value,value,1)
for loop in body.data.loops:uv.data[loop.index].uv=proj[loop.vertex_index]
photo=bpy.data.images.load(str(ROOT/'public/looma-golden.png'));photo.pack()
tex=nodes.new('ShaderNodeTexImage');tex.image=photo;tex.extension='EXTEND';uvn=nodes.new('ShaderNodeUVMap');uvn.uv_map=uv.name;links.new(uvn.outputs['UV'],tex.inputs['Vector'])
# Preserve original atlas coordinates, since the new UV layer is now active.
oldUV=nodes.new('ShaderNodeUVMap');oldUV.uv_map=body.data.uv_layers[0].name;links.new(oldUV.outputs['UV'],old.inputs['Vector'])
attr=nodes.new('ShaderNodeVertexColor');attr.layer_name=weight.name;mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MIX';links.new(attr.outputs['Color'],mix.inputs[0]);links.new(old.outputs['Color'],mix.inputs[1]);links.new(tex.outputs['Color'],mix.inputs[2]);links.new(mix.outputs['Color'],p.inputs['Base Color'])
# Preserve full face detail: use the portrait UV directly on front-facing polygons.
# A second standard Principled material keeps the complete body atlas around the sides.
front=bpy.data.materials.new('Portrait detail on real geometry');front.use_nodes=True
fp=front.node_tree.nodes.get('Principled BSDF');ft=front.node_tree.nodes.new('ShaderNodeTexImage');ft.image=photo
fu=front.node_tree.nodes.new('ShaderNodeUVMap');fu.uv_map=uv.name
front.node_tree.links.new(fu.outputs['UV'],ft.inputs['Vector']);front.node_tree.links.new(ft.outputs['Color'],fp.inputs['Base Color'])
fp.inputs['Roughness'].default_value=.82;fp.inputs['Sheen Weight'].default_value=.20
body.data.materials.append(front)
pw,ph=photo.size;rgba=np.array(photo.pixels[:],dtype=np.float32).reshape(ph,pw,4)
for f in body.data.polygons:
 c=f.center
 safe=True
 for vi in f.vertices:
  u,v=proj[vi]
  if not (0<=u<1 and 0<=v<1) or rgba[min(ph-1,max(0,int(v*ph))),min(pw-1,max(0,int(u*pw))),3]<.98:safe=False
 f.material_index=1 if ((c.y<-.265 and c.z>.395) or (c.y<-.12 and c.z>.59) or (c.y<-.135 and c.z<=.395) or (c.y<-.1 and c.z<.11)) and c.z>.045 and safe else 0
for n in list(nodes):
 if n not in [p,old,oldUV] and n.type!='OUTPUT_MATERIAL':nodes.remove(n)
links.new(oldUV.outputs['UV'],old.inputs['Vector']);links.new(old.outputs['Color'],p.inputs['Base Color'])
p.inputs['Roughness'].default_value=.82;p.inputs['Sheen Weight'].default_value=.25;p.inputs['Specular IOR Level'].default_value=.23
body.data.uv_layers.active_index=0
scene=bpy.context.scene;scene.cycles.samples=32;scene.render.resolution_x=650;scene.render.resolution_y=750
focus=Vector((0,-.08,.32));scene.camera.location=Vector((.25,-2.5,.52));scene.camera.rotation_euler=(focus-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=.83
scene.render.filepath=str(out/'portable-coat-review.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'looma-golden-portable-coat.blend'))
(out/'coat-report.json').write_text(json.dumps({'vertices':len(body.data.vertices),'texture':'embedded original atlas plus portrait detail','projection':'UV-baked local reference on front face, original texture around body','remaining':'Side coat detail remains limited by supplied geometry'},indent=2))
