"""Blender photo-based puppet: transparent texture, deformable mesh, eight states.
Run blender -b --python this.py -- SOURCE.png OUTPUT_DIRECTORY
This is a 2.5D photographic puppet, not a sculpted fur model.
"""
import bpy, math, sys
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:]; source,out=Path(args[0]).resolve(),Path(args[1]).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.device='CPU'
scene.render.resolution_x=384;scene.render.resolution_y=512;scene.render.resolution_percentage=100
scene.render.film_transparent=True;scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
scene.view_settings.view_transform='Standard';scene.render.fps=6
image=bpy.data.images.load(str(source));image.pack()
ratio=image.size[0]/image.size[1];nx,ny=24,32;verts=[];faces=[]
for y in range(ny+1):
 for x in range(nx+1):verts.append(((x/nx-.5)*2*ratio,0,y/ny*2))
for y in range(ny):
 for x in range(nx):
  i=y*(nx+1)+x;faces.append((i,i+1,i+nx+2,i+nx+1))
mesh=bpy.data.meshes.new('Photo puppet deformable mesh');mesh.from_pydata(verts,[],faces);mesh.update()
pet=bpy.data.objects.new('Looma photographic puppy',mesh);scene.collection.objects.link(pet)
uv=mesh.uv_layers.new(name='Photo UV')
for poly in mesh.polygons:
 for i in poly.loop_indices:
  co=mesh.vertices[mesh.loops[i].vertex_index].co;uv.data[i].uv=((co.x/(2*ratio)+.5),co.z/2)
mat=bpy.data.materials.new('Photographic fur with alpha');mat.use_nodes=True;nodes=mat.node_tree.nodes;nodes.clear()
tex=nodes.new('ShaderNodeTexImage');tex.image=image
em=nodes.new('ShaderNodeEmission');transparent=nodes.new('ShaderNodeBsdfTransparent');mix=nodes.new('ShaderNodeMixShader');output=nodes.new('ShaderNodeOutputMaterial')
links=mat.node_tree.links;links.new(tex.outputs['Color'],em.inputs['Color']);links.new(tex.outputs['Alpha'],mix.inputs[0]);links.new(transparent.outputs[0],mix.inputs[1]);links.new(em.outputs[0],mix.inputs[2]);links.new(mix.outputs[0],output.inputs['Surface']);pet.data.materials.append(mat)
bpy.ops.object.camera_add(location=(0,-5,1));cam=bpy.context.object;cam.rotation_euler=(math.pi/2,0,0);cam.data.type='ORTHO';cam.data.ortho_scale=2.12;scene.camera=cam
states=['idle','walking','watching','thinking','warning','talking','happy','sleeping']
base=[v.co.copy() for v in mesh.vertices]
for si,state in enumerate(states):
 for frame in range(6):
  t=frame/6*math.tau
  for v,b in zip(mesh.vertices,base):
   v.co=b.copy();head=max(0,min(1,(b.z-1.05)/.45));breath=.007*math.sin(t)
   angle={'watching':.045,'thinking':-.055,'warning':.035,'talking':.012*math.sin(t),'happy':.035*math.sin(t),'sleeping':-.075}.get(state,0)
   v.co.x+=head*angle*(b.z-1.2);v.co.z+=b.z*breath
   if state=='happy':v.co.z+=.025*(1-math.cos(t))
   if state=='walking':v.co.x+=.028*math.sin(t);v.co.z+=.014*abs(math.sin(t))
   if state=='talking':v.co.z+=head*.009*math.sin(t*2)
   if state=='sleeping':v.co.z*=.96
  scene.frame_set(si*6+frame+1);scene.render.filepath=str(out/f'{state}-{frame}.png');bpy.ops.render.render(write_still=True)
# Preserve editable photo, mesh and state metadata together in the project.
pet['animation_states']=','.join(states);pet['asset_type']='photographic 2.5D puppet';bpy.ops.wm.save_as_mainfile(filepath=str(out/'looma-realistic.blend'))
