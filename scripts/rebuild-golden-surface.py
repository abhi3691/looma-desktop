import bpy,bmesh,math,json
from pathlib import Path
from mathutils import Vector
out=Path('/Users/adviciya/Documents/Codex/2026-09-30/referenced-chatgpt-conversation-this-is-an/outputs/looma-open-dots/assets/user-golden')
bpy.ops.wm.open_mainfile(filepath=str(out/'looma-golden-refined.blend'))
source=next(o for o in bpy.context.scene.objects if o.type=='MESH');source.name='REFERENCE-original-textured-puppy'
bpy.context.view_layer.objects.active=source;bpy.ops.object.select_all(action='DESELECT');source.select_set(True);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
body=source.copy();body.data=source.data.copy();bpy.context.collection.objects.link(body);body.name='Looma-continuous-coat-surface'
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(body.data);bm.free()
rem=body.modifiers.new('Continuous coat reconstruction','REMESH');rem.mode='VOXEL';rem.voxel_size=.0035;bpy.ops.object.modifier_apply(modifier=rem.name)
sm=body.modifiers.new('Remove plate-like fur','SMOOTH');sm.factor=.6;sm.iterations=12;bpy.ops.object.modifier_apply(modifier=sm.name)
for f in body.data.polygons:f.use_smooth=True
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.012);bpy.ops.object.mode_set(mode='OBJECT')
mat=bpy.data.materials.new('Reprojected natural golden coat');mat.use_nodes=True;shader=mat.node_tree.nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.85;shader.inputs['Sheen Weight'].default_value=.25
body.data.materials.clear();body.data.materials.append(mat)
image=bpy.data.images.new('Rebuilt_coat_color',2048,2048);node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;mat.node_tree.nodes.active=node
bpy.ops.object.select_all(action='DESELECT');source.select_set(True);body.select_set(True);bpy.context.view_layer.objects.active=body
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=8;scene.render.bake.use_selected_to_active=True;scene.render.bake.cage_extrusion=.025;scene.render.bake.max_ray_distance=.07
bpy.ops.object.bake(type='DIFFUSE',pass_filter={'COLOR'},margin=12)
image.filepath_raw=str(out/'rebuilt-coat-color.png');image.file_format='PNG';image.save();image.pack();mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
source.hide_render=True;source.hide_viewport=True
# Native fine groom on a continuous, texture-reprojected surface.
g=body.vertex_groups.new(name='Coat-only')
for v in body.data.vertices:
 p=v.co;w=1
 if p.y<-.33 and p.z>.37:w=0
 if .34<p.z<.42 and -.29<p.y<-.1:w=0
 if p.z<.045:w=.1
 g.add([v.index],w,'REPLACE')
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body;bpy.ops.object.particle_system_add();system=body.particle_systems[-1];settings=system.settings;settings.type='HAIR';settings.count=6000;settings.hair_length=.022;settings.hair_step=4;settings.child_type='INTERPOLATED';settings.child_percent=8;settings.rendered_child_count=45;settings.root_radius=.00012;settings.tip_radius=.000015;settings.radius_scale=1;settings.clump_factor=.08;settings.roughness_1=.001;system.vertex_group_density=g.name
scene.render.bake.use_selected_to_active=False;scene.cycles.samples=48;scene.render.resolution_x=800;scene.render.resolution_y=900;scene.camera.data.ortho_scale=1.2;scene.render.filepath=str(out/'rebuilt-surface.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'looma-golden-rebuilt-surface.blend'))
(out/'surface-report.json').write_text(json.dumps({'continuous_vertices':len(body.data.vertices),'texture_reprojected':True,'native_fur':True,'reference_hidden':True,'status':'geometry candidate; eye refinement and export pending'},indent=2))
