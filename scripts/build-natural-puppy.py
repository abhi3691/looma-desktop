"""Original quadruped puppy: connected anatomical mesh, groom and exportable rig.

Run with Blender --background --factory-startup --python this.py -- OUTPUT.
No photographic planes, downloaded meshes, external textures or paid assets.
"""
import bpy, math, random, sys, json
from pathlib import Path
from mathutils import Vector
from mathutils.kdtree import KDTree
import numpy as np

OUT = Path(sys.argv[sys.argv.index('--')+1]).resolve()
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
rng = random.Random(381)

def mat(name, color, rough=.8, metallic=0):
    m=bpy.data.materials.new('MAT-'+name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=rough
    p.inputs['Metallic'].default_value=metallic
    return m

coat=mat('golden-undercoat',(.48,.29,.12),.94)
hairmat=mat('golden-strands',(.66,.44,.21),.85)
for m in (coat,hairmat):
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Sheen Weight'].default_value=.25
    attr=m.node_tree.nodes.new('ShaderNodeVertexColor'); attr.layer_name='CoatTint'
    m.node_tree.links.new(attr.outputs['Color'],p.inputs['Base Color'])
black=mat('nose-and-lips',(.015,.011,.009),.3)
nosemat=mat('warm-pebbled-nose',(.055,.023,.017),.43)
iris=mat('brown-iris',(.085,.032,.009),.2)
pupil=mat('pupils',(.003,.002,.002),.08)
pink=mat('tongue',(.48,.12,.14),.45)
leather=mat('collar-leather',(.12,.052,.021),.72)
brass=mat('brass-tag',(.7,.5,.2),.28,1)

# Small image normal map remains supported by the GLB exporter, unlike noise nodes.
n=256; yy,xx=np.mgrid[0:n,0:n]; h=np.sin(xx*1.43+np.sin(yy*.18)*1.1)*.25+np.sin(yy*1.71+xx*.13)*.08
gx=np.roll(h,-1,1)-np.roll(h,1,1); gy=np.roll(h,-1,0)-np.roll(h,1,0)
normal=np.stack((-gx*.3,-gy*.3,np.ones_like(h)),axis=2);normal/=np.linalg.norm(normal,axis=2)[:,:,None]
rgba=np.ones((n,n,4),dtype=np.float32);rgba[:,:,:3]=normal*.5+.5
image=bpy.data.images.new('Original fine coat normal',width=n,height=n)
image.colorspace_settings.name='Non-Color';image.pixels.foreach_set(rgba.ravel());image.pack()
for m in (coat,):
    nt=m.node_tree;tex=nt.nodes.new('ShaderNodeTexImage');tex.image=image
    norm=nt.nodes.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.3
    nt.links.new(tex.outputs['Color'],norm.inputs['Color']);nt.links.new(norm.outputs['Normal'],nt.nodes['Principled BSDF'].inputs['Normal'])

seeds=[];core=[]
def ellipsoid(name,center,scale,bone,material=coat,connected=True,rot=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=center)
    o=bpy.context.object;o.name='GEO-'+name;o.scale=scale
    if rot:o.rotation_euler=rot
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=True
    if connected: core.append(o);seeds.append((Vector(center),bone,scale))
    return o

# Natural skull and shoulder transitions. These are remeshed into ONE skin.
ellipsoid('ribcage',(0,.12,.57),(.25,.38,.28),'Body')
ellipsoid('belly',(0,.05,.41),(.225,.30,.22),'Body')
ellipsoid('pelvis',(0,.37,.51),(.245,.22,.26),'Body')
ellipsoid('shoulders',(0,-.15,.62),(.27,.22,.27),'Chest')
ellipsoid('neck',(0,-.25,.84),(.215,.205,.30),'Neck',rot=(.12,0,0))
ellipsoid('cranium',(0,-.32,1.07),(.31,.265,.285),'Head')
ellipsoid('cheek-L',(-.19,-.45,.97),(.14,.13,.175),'Head')
ellipsoid('cheek-R',(.19,-.45,.97),(.14,.13,.175),'Head')
ellipsoid('nasal-bridge',(0,-.53,1.02),(.145,.22,.12),'Head',rot=(-.10,0,0))
ellipsoid('muzzle-L',(-.075,-.66,.935),(.125,.13,.10),'Head')
ellipsoid('muzzle-R',(.075,-.66,.935),(.125,.13,.10),'Head')

spec={
 'Root':((0,0,0),(0,0,.2),None),
 'Body':((0,.30,.48),(0,0,.59),'Root'),
 'Chest':((0,0,.59),(0,-.19,.74),'Body'),
 'Neck':((0,-.19,.74),(0,-.29,.96),'Chest'),
 'Head':((0,-.29,.96),(0,-.39,1.19),'Neck'),
 'Jaw':((0,-.49,.93),(0,-.66,.86),'Head'),
 'Tail':((0,.50,.56),(0,.69,.60),'Body'),
 'TailTip':((0,.69,.60),(0,.90,.68),'Tail'),
}
for side,s in [('L',-1),('R',1)]:
    x=s*.18
    spec['Front_'+side]=((x,-.19,.65),(x,-.22,.32),'Chest')
    spec['FrontLower_'+side]=((x,-.22,.32),(x,-.28,.12),'Front_'+side)
    spec['FrontPaw_'+side]=((x,-.28,.12),(x,-.40,.07),'FrontLower_'+side)
    spec['Back_'+side]=((x,.38,.58),(x,.44,.32),'Body')
    spec['BackLower_'+side]=((x,.44,.32),(x,.29,.12),'Back_'+side)
    spec['BackPaw_'+side]=((x,.29,.12),(x,.17,.07),'BackLower_'+side)
    spec['Ear_'+side]=((s*.27,-.29,1.16),(s*.33,-.32,.98),'Head')
    spec['EarTip_'+side]=((s*.33,-.32,.98),(s*.35,-.38,.82),'Ear_'+side)
    spec['Eye_'+side]=((s*.15,-.545,1.085),(s*.15,-.60,1.085),'Head')
    spec['Blink_'+side]=((s*.15,-.57,1.12),(s*.15,-.58,1.075),'Head')
    ellipsoid('fore-shoulder-'+side,(x,-.19,.54),(.102,.125,.195),'Front_'+side)
    ellipsoid('foreleg-'+side,(x,-.23,.29),(.075,.077,.205),'FrontLower_'+side)
    ellipsoid('front-paw-'+side,(x,-.32,.095),(.097,.137,.082),'FrontPaw_'+side)
    ellipsoid('haunch-'+side,(x,.38,.46),(.135,.155,.22),'Back_'+side)
    ellipsoid('rear-hock-'+side,(x,.36,.22),(.073,.10,.14),'BackLower_'+side)
    ellipsoid('back-paw-'+side,(x,.245,.09),(.095,.13,.08),'BackPaw_'+side)
    for leg,y in [('Front',-.42),('Back',.145)]:
        for t in range(4):ellipsoid(leg+'-toe-'+side+str(t),(x+(t-1.5)*.035,y,.07),(.027,.055,.049),leg+'Paw_'+side)

# A voxel union and smoothing remove visible primitive seams before skinning.
bpy.ops.object.select_all(action='DESELECT')
for o in core:o.select_set(True)
bpy.context.view_layer.objects.active=core[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='GEO-continuous-puppy-skin'
rem=skin.modifiers.new('Connected organic sculpt','REMESH');rem.mode='VOXEL';rem.voxel_size=.014
bpy.ops.object.modifier_apply(modifier=rem.name)
smooth=skin.modifiers.new('Surface relaxation','SMOOTH');smooth.factor=.65;smooth.iterations=4
bpy.ops.object.modifier_apply(modifier=smooth.name)
skin.data.materials.clear();skin.data.materials.append(coat)
for p in skin.data.polygons:p.use_smooth=True

# Eye sockets create inset almond eyes instead of beads stuck onto the head.
for side,s in [('L',-1),('R',1)]:
    cutter=ellipsoid('socket-cutter-'+side,(s*.153,-.563,1.084),(.082,.085,.073),'Head',black,False)
    bpy.context.view_layer.objects.active=skin
    mod=skin.modifiers.new('Eye socket '+side,'BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
    bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)

skin.data.materials.clear();skin.data.materials.append(coat)
for poly in skin.data.polygons:poly.material_index=0
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);bpy.context.view_layer.objects.active=skin
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.015);bpy.ops.object.mode_set(mode='OBJECT')

bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='Looma_Natural_Puppy_Rig'
bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0])
for name,(head,tail,parent) in spec.items():
    b=rig.data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT');rig.show_in_front=True

def weights(point):
    # Four closest anatomical seed volumes, blended across their overlaps.
    scores={}
    for center,bone,scale in seeds:
        delta=point-center;d=sum((delta[i]/scale[i])**2 for i in range(3))
        w=math.exp(-min(d,40)*2.7)
        scores[bone]=scores.get(bone,0)+w
    pairs=sorted(scores.items(),key=lambda a:a[1],reverse=True)[:4]
    total=sum(w for _,w in pairs)
    return [(b,w/total) for b,w in pairs] if total else [('Body',1)]

def bind(o,fixed=None):
    groups={b:o.vertex_groups.new(name=b) for b in spec}
    for v in o.data.vertices:
        for b,w in ([(fixed,1)] if fixed else weights(v.co)):groups[b].add([v.index],w,'REPLACE')
    mod=o.modifiers.new('Puppy skeletal deformation','ARMATURE');mod.object=rig;o.parent=rig
    return o

def tint(o):
    attr=o.data.color_attributes.new(name='CoatTint',type='BYTE_COLOR',domain='POINT')
    for v in o.data.vertices:
        p=v.co
        light=.9+.07*math.sin(p.x*27+p.z*8)+.04*math.sin(p.y*21)
        # Cream-gold chin/chest and darker ear roots, with no white toy patch.
        creamness=max(0,1-abs(p.x)/.22)*max(0,1-abs(p.y+.57)/.26)*max(0,1-abs(p.z-.95)/.17)
        col=(.60+creamness*.12,.39+creamness*.13,.18+creamness*.11)
        attr.data[v.index].color=(*(c*light for c in col),1)

bind(skin);tint(skin)
extras=[];groom_sources=[skin]
def piece(name,center,scale,bone,material,rot=None,groom=False):
    o=ellipsoid(name,center,scale,bone,material,False,rot);bind(o,bone);extras.append(o)
    if material==coat:tint(o)
    if groom:groom_sources.append(o)
    return o

for side,s in [('L',-1),('R',1)]:
    # Teardrop pinnae rather than cylinders: broad top, soft taper, forward curl.
    ear=ellipsoid('floppy-pinna-'+side,(s*.325,-.30,.99),(.105,.09,.22),'Ear_'+side,coat,False,(0,s*-.14,0))
    for v in ear.data.vertices:
        z=v.co.z;v.co.x+=s*.035*max(0,(1.1-z)/.3);v.co.y-=.045*max(0,(1.02-z)/.2)
    groups={b:ear.vertex_groups.new(name=b) for b in ['Ear_'+side,'EarTip_'+side]}
    for v in ear.data.vertices:
        w=min(1,max(0,(1.025-v.co.z)/.16));groups['Ear_'+side].add([v.index],1-w,'REPLACE');groups['EarTip_'+side].add([v.index],w,'REPLACE')
    mod=ear.modifiers.new('Ear flex','ARMATURE');mod.object=rig;ear.parent=rig;tint(ear);groom_sources.append(ear)
    piece('dark-eye-rim-'+side,(s*.153,-.559,1.083),(.074,.062,.065),'Head',black)
    piece('eye-'+side,(s*.153,-.579,1.094),(.064,.060,.055),'Eye_'+side,iris)
    piece('pupil-'+side,(s*.153,-.633,1.097),(.029,.009,.035),'Eye_'+side,pupil)
    # Curved upper lids move down to close eyes without flattening eyeballs.
    piece('upper-lid-'+side,(s*.153,-.518,1.157),(.071,.018,.006),'Blink_'+side,coat,groom=False)
# Soft pads beneath all four articulated paws.
for side,sign in [('L',-1),('R',1)]:
    for leg,y in [('Front',-.32),('Back',.245)]:
        piece(leg+'-pad-'+side,(sign*.18,y,.027),(.058,.073,.016),leg+'Paw_'+side,nosemat)
        for digit in range(4):
            piece(leg+'-toe-pad-'+side+str(digit),(sign*.18+(digit-1.5)*.035,y-.09,.026),(.017,.025,.010),leg+'Paw_'+side,nosemat)
piece('lower-jaw',(0,-.62,.866),(.12,.14,.048),'Jaw',coat,groom=True)
piece('mouth-cavity',(0,-.685,.887),(.11,.071,.031),'Head',black)
piece('tongue',(0,-.723,.868),(.052,.068,.018),'Jaw',pink)
nose=piece('triangular-nose',(0,-.763,.981),(.069,.044,.047),'Head',nosemat)
for vertex in nose.data.vertices:
    if vertex.co.z<.981:vertex.co.x*=.78
for side,s in [('L',-1),('R',1)]:piece('nostril-'+side,(s*.041,-.79,.983),(.020,.012,.012),'Head',pupil)

def curve_mesh(name,points,radius,material,bone):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.resolution_u=8;curve.bevel_depth=radius;curve.bevel_resolution=2
    sp=curve.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
    for v,p in zip(sp.bezier_points,points):v.co=p;v.handle_left_type='AUTO';v.handle_right_type='AUTO'
    o=bpy.data.objects.new('GEO-'+name,curve);bpy.context.collection.objects.link(o);o.data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');return bind(bpy.context.object,bone)

curve_mesh('tail',[(0,.48,.56),(.03,.66,.60),(.04,.81,.68),(.02,.91,.70)],.046,coat,'Tail')
tail=bpy.context.object;tint(tail);groom_sources.append(tail)
for v in tail.data.vertices:
    # Smooth two-segment tail weights.
    w=min(1,max(0,(v.co.y-.64)/.18));tail.vertex_groups['Tail'].add([v.index],1-w,'REPLACE');tail.vertex_groups['TailTip'].add([v.index],w,'REPLACE')
for s in [-1,1]:
    curve_mesh('lip-'+str(s),[(0,-.792,.94),(s*.015,-.784,.909),(s*.065,-.764,.901),(s*.104,-.715,.915)],.0035,black,'Head')
    for i in range(5):
        start=(s*(.076+i*.007),-.755+i*.009,.942-i*.007)
        curve_mesh('whisker-'+str(s)+'-'+str(i),[start,(s*(.14+i*.008),-.79,.94-i*.006),(s*(.23+i*.013),-.785,.938-i*.014)],.00045,coat,'Head')

# Collar and tag are actual 3D meshes, separate from the fur and head.
bpy.ops.mesh.primitive_torus_add(major_radius=.203,minor_radius=.018,major_segments=48,minor_segments=8,location=(0,-.235,.833))
collar=bpy.context.object;collar.name='GEO-leather-collar';collar.scale=(1,1,.75)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);collar.data.materials.append(leather);bind(collar,'Neck')
piece('brass-L-tag',(0,-.452,.79),(.035,.009,.042),'Neck',brass)

print('Grooming connected anatomy',flush=True)
# Genuine tapered hair ribbons. Root positions come from the finished skin,
# each ribbon inherits its own skin weights: no rigid photo or fur overlay.
vertices=[];faces=[];colors=[];gweights=[]
for source in groom_sources:
    mesh=source.data;mesh.calc_loop_triangles();triangles=list(mesh.loop_triangles)
    areas=[t.area for t in triangles];total=sum(areas)
    count=min(15000,max(800,int(total*11500)))
    chosen=rng.choices(triangles,weights=areas,k=count)
    for tri in chosen:
        a,b,c=[mesh.vertices[i] for i in tri.vertices]
        u=rng.random();v=rng.random()
        if u+v>1:u=1-u;v=1-v
        point=a.co*(1-u-v)+b.co*u+c.co*v
        normal=(a.normal*(1-u-v)+b.normal*u+c.normal*v).normalized()
        # Mask eyes, nose and lip margins so fine strands do not cover the face.
        if source==skin and point.y<-.51 and point.z>.90:
            if abs(abs(point.x)-.153)<.09 and abs(point.z-1.084)<.065:continue
            if abs(point.x)<.10 and point.y<-.715 and point.z>.935:continue
        if 'pinna' in source.name:guide=Vector((0,-.12,-1));length=rng.uniform(.035,.06)
        elif source==skin and point.z>.95:
            guide=Vector((point.x*.6,-.4,-.25 if point.z<1.12 else .15));length=rng.uniform(.005,.010) if point.y<-.52 else rng.uniform(.012,.025)
        elif point.z<.28:guide=Vector((0,-.2,-1));length=rng.uniform(.012,.022)
        else:guide=Vector((point.x*.6,.25,-.75));length=rng.uniform(.022,.044)
        tangent=guide-normal*guide.dot(normal)
        if tangent.length<.05:tangent=normal.cross(Vector((1,0,0)))
        tangent.normalize();direction=(normal*.4+tangent*.8).normalized()
        side=direction.cross(normal)
        if side.length<.05:side=normal.cross(Vector((0,1,0)))
        side.normalize();width=rng.uniform(.00022,.00042)
        ws=weights(point) if source==skin else [(source.vertex_groups[g.group].name,g.weight) for g in a.groups]
        ws=sorted(ws,key=lambda item:item[1],reverse=True)[:4]
        base=rng.uniform(.85,1.12);col=(.57*base,.34*base,.13*base)
        start=len(vertices)
        for j in range(3):
            t=j/2;p=point+direction*length*t+normal*length*.16*math.sin(t*math.pi)
            for sign in [-1,1]:
                vertices.append(p+side*width*(1-t*.95)*sign);gweights.append(ws);colors.append((*(min(1,x*(.87+.15*t)) for x in col),1))
        for j in range(2):
            k=start+j*2;faces.extend([(k,k+1,k+2),(k+1,k+3,k+2)])
hair=bpy.data.meshes.new('Groomed golden strands');hair.from_pydata(vertices,[],faces);hair.update()
o=bpy.data.objects.new('GEO-skinned-fine-golden-groom',hair);bpy.context.collection.objects.link(o);hair.materials.append(hairmat)
attribute=hair.color_attributes.new(name='CoatTint',type='BYTE_COLOR',domain='POINT')
for i,col in enumerate(colors):attribute.data[i].color=col
groups={b:o.vertex_groups.new(name=b) for b in spec}
for i,ws in enumerate(gweights):
    for bone,w in ws:
        if bone in groups:groups[bone].add([i],w,'REPLACE')
mod=o.modifiers.new('Fur follows every joint','ARMATURE');mod.object=rig;o.parent=rig
for p in hair.polygons:p.use_smooth=True
print('Hair ribbons:',len(vertices)//6,'triangles:',len(faces),flush=True)

# Bake a fine, directional coat into real PBR textures on the entire surface.
# This survives GLB export; the preview does not rely on render-only noise.
coat_objects=[obj for obj in bpy.context.scene.objects if obj.type=='MESH' and obj!=o and len(obj.data.materials)==1 and obj.data.materials[0]==coat]
bpy.ops.object.select_all(action='DESELECT')
for obj in coat_objects:obj.select_set(True)
bpy.context.view_layer.objects.active=skin;bpy.ops.object.join();skin=bpy.context.object;skin.name='GEO-UV-connected-golden-coat'
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.007);bpy.ops.object.mode_set(mode='OBJECT')
nt=coat.node_tree;bsdf=nt.nodes['Principled BSDF']
for link in list(nt.links):
    if link.to_node==bsdf and link.to_socket.name=='Normal':nt.links.remove(link)
coords=nt.nodes.new('ShaderNodeTexCoord');mapping=nt.nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(1,1,5)
noise=nt.nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=180;noise.inputs['Detail'].default_value=2
bump=nt.nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.43;bump.inputs['Distance'].default_value=.004
nt.links.new(coords.outputs['Generated'],mapping.inputs[0]);nt.links.new(mapping.outputs[0],noise.inputs['Vector']);nt.links.new(noise.outputs['Fac'],bump.inputs['Height']);nt.links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
color=nt.nodes.new('ShaderNodeMixRGB');color.blend_type='MULTIPLY';color.inputs[0].default_value=.25
attr=next(node for node in nt.nodes if node.type=='VERTEX_COLOR');nt.links.new(attr.outputs['Color'],color.inputs[1]);nt.links.new(noise.outputs['Fac'],color.inputs[2]);nt.links.new(color.outputs['Color'],bsdf.inputs['Base Color'])
bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=4
maps={}
for label,kind in [('coat-color','DIFFUSE'),('coat-normal','NORMAL')]:
    target=bpy.data.images.new(label,1024,1024,alpha=False)
    if kind=='NORMAL':target.colorspace_settings.name='Non-Color'
    node=nt.nodes.new('ShaderNodeTexImage');node.image=target;nt.nodes.active=node
    for ob in bpy.context.selected_objects:ob.select_set(False)
    skin.select_set(True);bpy.context.view_layer.objects.active=skin
    kwargs={'pass_filter':{'COLOR'}} if kind=='DIFFUSE' else {}
    bpy.ops.object.bake(type=kind,margin=8,**kwargs)
    target.filepath_raw=str(OUT/(label+'.png'));target.file_format='PNG';target.save();target.pack();maps[label]=(target,node)
for link in list(nt.links):
    if link.to_node==bsdf and link.to_socket.name in ['Base Color','Normal']:nt.links.remove(link)
nt.links.new(maps['coat-color'][1].outputs['Color'],bsdf.inputs['Base Color'])
normal_node=nt.nodes.new('ShaderNodeNormalMap');normal_node.inputs['Strength'].default_value=.6
nt.links.new(maps['coat-normal'][1].outputs['Color'],normal_node.inputs['Color']);nt.links.new(normal_node.outputs['Normal'],bsdf.inputs['Normal'])
# Keep a useful skin colour fallback if a viewer does not implement normal maps.


scene=bpy.context.scene;scene.render.fps=24;scene.frame_start=0;scene.frame_end=48
rig.animation_data_create()
states=['Idle','Walking','Watching','Thinking','Warning','Talking','Happy','Sleeping','Sit','Stretch','Spin','Cuddle']
for state in states:
    action=bpy.data.actions.new(state);rig.animation_data.action=action
    for f in range(0,49,3):
        t=f/48*math.tau
        for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
        rig.pose.bones['Chest'].scale.x=1+.009*math.sin(t)
        rig.pose.bones['Head'].rotation_euler.y=.018*math.sin(t)
        rig.pose.bones['Tail'].rotation_euler.z=.15*math.sin(t*2)
        rig.pose.bones['TailTip'].rotation_euler.z=.17*math.sin(t*2-.5)
        for side in ['L','R']:
            blink=1 if state=='Sleeping' else max(0,1-abs(f-27)/3) if state in ['Idle','Watching'] else 0
            rig.pose.bones['Blink_'+side].location.y=.079*blink
            rig.pose.bones['EarTip_'+side].rotation_euler.x=.035*math.sin(t-.5)
        if state=='Walking':
            for i,label in enumerate(['Front_L','Front_R','Back_L','Back_R']):
                wave=math.sin(t*2+(math.pi if i in [1,2] else 0));leg,side=label.split('_')
                rig.pose.bones[label].rotation_euler.x=.32*wave
                rig.pose.bones[leg+'Lower_'+side].rotation_euler.x=-.43*max(0,wave)
                rig.pose.bones[leg+'Paw_'+side].rotation_euler.x=-.14*wave
            rig.pose.bones['Root'].location.z=.009*math.cos(t*4)
            rig.pose.bones['Chest'].rotation_euler.z=.018*math.sin(t*2)
        if state in ['Watching','Thinking','Warning']:
            rig.pose.bones['Head'].rotation_euler.y={'Watching':.08,'Thinking':-.16,'Warning':.04}[state]
            if state=='Warning':rig.pose.bones['Ear_L'].rotation_euler.z=.15;rig.pose.bones['Ear_R'].rotation_euler.z=-.15
        if state=='Talking':rig.pose.bones['Jaw'].rotation_euler.x=.08*(.5+.5*math.sin(t*5))
        if state=='Happy':rig.pose.bones['Tail'].rotation_euler.z=.48*math.sin(t*4);rig.pose.bones['TailTip'].rotation_euler.z=.35*math.sin(t*4-.4)
        if state in ['Sit','Sleeping']:
            rig.pose.bones['Body'].rotation_euler.x=-.30;rig.pose.bones['Root'].location.z=-.055
            for side in ['L','R']:rig.pose.bones['Back_'+side].rotation_euler.x=-.65;rig.pose.bones['BackLower_'+side].rotation_euler.x=.75
            if state=='Sleeping':rig.pose.bones['Neck'].rotation_euler.x=.28;rig.pose.bones['Head'].rotation_euler.x=.18;rig.pose.bones['Tail'].rotation_euler.z=0
        if state=='Stretch':
            stretch=(1-math.cos(t))/2;rig.pose.bones['Chest'].rotation_euler.x=.24*stretch;rig.pose.bones['Head'].rotation_euler.x=-.16*stretch
        if state=='Spin':rig.pose.bones['Root'].rotation_euler.z=t
        if state=='Cuddle':rig.pose.bones['Head'].rotation_euler.y=.15*math.sin(t);rig.pose.bones['Ear_L'].rotation_euler.y=.10*math.sin(t)
        for b in rig.pose.bones:
            for path in ['location','rotation_euler','scale']:b.keyframe_insert(data_path=path,frame=f)
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for key in fc.keyframe_points:key.handle_left_type='AUTO_CLAMPED';key.handle_right_type='AUTO_CLAMPED'
    track=rig.animation_data.nla_tracks.new();track.name=state;track.strips.new(state,0,action);rig.animation_data.action=None
for track in rig.animation_data.nla_tracks:track.mute=True
for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0);b.scale=(1,1,1)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'looma-natural.glb'),export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_yup=True)

# Dense Blender beauty groom. The GLB retains the lighter skinned ribbon groom.
# This native hair system is explicitly a Blender-only detail layer.
bpy.ops.object.select_all(action='DESELECT');skin.select_set(True);bpy.context.view_layer.objects.active=skin
try:
    bpy.ops.object.particle_system_add()
    groom=skin.particle_systems[-1].settings;groom.type='HAIR';groom.count=4500;groom.hair_length=.019;groom.hair_step=3
    groom.child_type='INTERPOLATED';groom.child_percent=8;groom.rendered_child_count=28
    groom.root_radius=.00055;groom.tip_radius=.00008;groom.radius_scale=1
    groom.clump_factor=.12;groom.roughness_1=.003
except Exception as exc:
    print('Native detail groom unavailable:',str(exc),flush=True)
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.film_transparent=True
scene.render.resolution_x=600;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.world.color=(.18,.18,.18)
bpy.ops.object.camera_add(location=(1.8,-4.5,1.8));cam=bpy.context.object
cam.rotation_euler=(Vector((0,-.06,.70))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.8;scene.camera=cam
for loc,power,size in [((1,-3,4),300,3),((-3,-2,2),170,3),((0,2,3),250,2)]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.data.energy=power;light.data.size=size
    light.rotation_euler=(Vector((0,0,.8))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'looma-natural.blend'))
sit_track=next(x for x in rig.animation_data.nla_tracks if x.name=='Sit');sit_track.mute=False;scene.frame_set(0)
scene.render.image_settings.color_mode='RGBA';scene.render.filepath=str(OUT/'preview.png');bpy.ops.render.render(write_still=True)
scene.cycles.samples=8;scene.render.resolution_x=300;scene.render.resolution_y=350
for label,position in [('front',(0,-4.5,1.25)),('side',(4,-.1,1.15)),('back',(0,4.5,1.25))]:
    cam.location=position;cam.rotation_euler=(Vector((0,-.06,.70))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/(label+'.png'));bpy.ops.render.render(write_still=True)
cam.location=(1.8,-4.5,1.8);cam.rotation_euler=(Vector((0,-.06,.70))-cam.location).to_track_quat('-Z','Y').to_euler()
sit_track.mute=True
for state in ['Walking','Talking','Sleeping','Happy']:
    track=next(x for x in rig.animation_data.nla_tracks if x.name==state);track.mute=False
    for f in ([0,6,12,18] if state=='Walking' else [12]):
        scene.frame_set(f);scene.render.filepath=str(OUT/f'{state.lower()}-{f}.png');bpy.ops.render.render(write_still=True)
    track.mute=True
stats={'original_custom_mesh':True,'photo_planes':0,'bones':len(spec),'clips':states,'skin_vertices':len(skin.data.vertices),'hair_strands':len(vertices)//6,'glb_bytes':(OUT/'looma-natural.glb').stat().st_size,'status':'candidate; visual review required'}
(OUT/'model-report.json').write_text(json.dumps(stats,indent=2))
print(json.dumps(stats),flush=True)
