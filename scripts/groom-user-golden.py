import bpy
from pathlib import Path
out=Path('/Users/adviciya/Documents/Codex/2026-09-30/referenced-chatgpt-conversation-this-is-an/outputs/looma-open-dots/assets/user-golden')
bpy.ops.wm.open_mainfile(filepath=str(out/'looma-golden-rigged.blend'))
body=next(o for o in bpy.context.scene.objects if o.type=='MESH' and 'tripo' in o.name)
group=body.vertex_groups.new(name='Fine_coat_density')
for v in body.data.vertices:
 p=v.co
 # Keep eyes, nostrils, mouth, collar and soles exposed.
 w=1.0
 if p.y<-.31 and p.z>.37:w=.08
 if .34<p.z<.41 and -.28<p.y<-.12:w=0
 if p.z<.04:w=.2
 group.add([v.index],w,'REPLACE')
bpy.context.view_layer.objects.active=body;bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
# Soften scanned plate-like tufts under a dense groom without remeshing UVs.
mod=body.modifiers.new('Soften coarse coat ridges','SMOOTH');mod.factor=.65;mod.iterations=50;mod.vertex_group=group.name
bpy.ops.object.particle_system_add();system=body.particle_systems[-1];groom=system.settings;groom.type='HAIR';groom.count=3500;groom.hair_length=.025;groom.hair_step=4
system.vertex_group_density=group.name;groom.child_type='INTERPOLATED';groom.child_percent=12;groom.rendered_child_count=65;groom.root_radius=.00018;groom.tip_radius=.00002;groom.radius_scale=1;groom.clump_factor=.10;groom.roughness_1=.0015
furmat=bpy.data.materials.new('Golden fine strand look');furmat.use_nodes=True
shader=furmat.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(.42,.23,.075,1);shader.inputs['Roughness'].default_value=.62;shader.inputs['Sheen Weight'].default_value=.35
body.data.materials.append(furmat);groom.material=len(body.data.materials)
scene=bpy.context.scene;scene.cycles.samples=64;scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.filepath=str(out/'groom-review.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'looma-golden-groom-review.blend'))
