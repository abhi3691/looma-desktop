import bpy,sys,json,math
from pathlib import Path
from mathutils import Vector
out=Path(sys.argv[sys.argv.index('--')+1]).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(out/'original.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=(lo+hi)/2;size=hi-lo
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=48;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.film_transparent=True
scene.world.color=(.12,.12,.12);scene.view_settings.view_transform='AgX'
# glTF imports Y up into Blender Z up. Keep the original geometry and textures intact.
span=max(size);focus=center
bpy.ops.object.camera_add(location=center+Vector((span*1.0,-span*2.6,span*.65)));camera=bpy.context.object;camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=span*1.05;scene.camera=camera
for offset,power in [((1,-2,3),300),((-2,-1,1.5),140),((0,2,2.5),220)]:
 bpy.ops.object.light_add(type='AREA',location=center+Vector(offset)*span);light=bpy.context.object;light.data.energy=power*span*span;light.data.shape='DISK';light.data.size=span*2;light.rotation_euler=(focus-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(out/'before.png');bpy.ops.render.render(write_still=True)
for obj in meshes:
 for face in obj.data.polygons:face.use_smooth=True
 for mat in obj.data.materials:
  if not mat or not mat.use_nodes:continue
  for node in mat.node_tree.nodes:
   if node.type=='BSDF_PRINCIPLED':
    # Suppress the metallic/specular coat without destroying baked detail maps.
    for link in list(mat.node_tree.links):
     if link.to_node==node and link.to_socket.name=='Metallic':mat.node_tree.links.remove(link)
    node.inputs['Metallic'].default_value=0;node.inputs['IOR'].default_value=1.45
    node.inputs['Sheen Weight'].default_value=.22;node.inputs['Sheen Roughness'].default_value=.7
    node.inputs['Specular IOR Level'].default_value=.27
    if not node.inputs['Roughness'].is_linked:node.inputs['Roughness'].default_value=.8
   if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.55
# Export only original puppy objects, excluding studio lights/camera.
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:obj.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.export_scene.gltf(filepath=str(out/'looma-golden-refined.glb'),export_format='GLB',use_selection=True)
scene.render.filepath=str(out/'refined.png');bpy.ops.render.render(write_still=True)
for name,offset in [('front',(0,-3,.2)),('side',(3,0,.2)),('back',(0,3,.2))]:
 camera.location=center+Vector(offset)*span;camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
camera.location=center+Vector((span*1,-span*2.6,span*.65));camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler()
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'looma-golden-refined.blend'))
(out/'report.json').write_text(json.dumps({'meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'rigged':False,'changes':['smooth normals','non-metallic coat','soft sheen','controlled highlights','studio lighting'],'original_geometry_preserved':True},indent=2))
