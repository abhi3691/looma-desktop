import bpy
from pathlib import Path
out=Path('/Users/adviciya/Documents/Codex/2026-09-30/referenced-chatgpt-conversation-this-is-an/outputs/looma-open-dots/assets/user-golden')
bpy.ops.wm.open_mainfile(filepath=str(out/'looma-golden-rebuilt-surface.blend'))
def material(name,color,rough):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['IOR'].default_value=1.38;return m
iris=material('Warm brown eye iris',(.095,.032,.006),.19);pupil=material('Deep black pupil',(.001,.001,.001),.06)
for side,center in [('L',(-.034565,-.38965,.570862)),('R',(.063103,-.389893,.555649))]:
 for label,offset,scale,mat in [('Iris',(0,-.006,0),(.012,.009,.012),iris),('Pupil',(0,-.014,0),(.006,.002,.007),pupil)]:
  bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=20,location=tuple(a+b for a,b in zip(center,offset)));o=bpy.context.object;o.name='Looma_'+label+'_'+side;o.scale=scale;o.data.materials.append(mat)
  for f in o.data.polygons:f.use_smooth=True
scene=bpy.context.scene;scene.render.filepath=str(out/'detailed-eyes.png');scene.cycles.samples=64;bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'looma-golden-detailed.blend'))
