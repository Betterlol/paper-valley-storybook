"""Run with Blender 4.5+: blender -b --python scripts/build-station.py.
Editable named paper hinges are preserved in both .blend and .glb.
Coordinates in this script are expressed as Three.js Y-up coordinates.
"""
import bpy, math, pathlib
from mathutils import Vector
ROOT = pathlib.Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def v(p): return Vector((p[0], -p[2], p[1]))
def material(name, hexcolor):
    m=bpy.data.materials.new(name)
    m.diffuse_color=tuple((lambda s:s/12.92 if s<.04045 else ((s+.055)/1.055)**2.4)(int(hexcolor[i:i+2],16)/255) for i in (0,2,4))+(1,)
    # glTF reads the shader, not the viewport color, in Blender 5.x.
    # Blender 4.5 needs nodes enabled; 5.x creates them automatically.
    if not m.node_tree:
        m.use_nodes=True
    shader=next(node for node in m.node_tree.nodes if node.type=='BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value=m.diffuse_color
    shader.inputs['Metallic'].default_value=0
    shader.inputs['Roughness'].default_value=.4
    return m
M={k:material(k,c) for k,c in {'paper':'E5CFA3','edge':'C8B38B','timber':'8A7350','roof':'537B7B','roof_edge':'375E65','glass':'EBD6A2','dark':'655C4D','gold':'C6A26A','ivory':'F1E2BD'}.items()}
def parent(o,p):
    if p:
        bpy.context.view_layer.update(); world=o.matrix_world.copy();o.parent=p;o.matrix_world=world
    return o
root=bpy.data.objects.new('ValleyStation',None);bpy.context.collection.objects.link(root)
def hinge(name,point,p=root):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=v(point);bpy.context.view_layer.update();return parent(o,p)
def cube(name,point,dims,mat='paper',p=root,bevel=.006):
    bpy.ops.mesh.primitive_cube_add(size=1,location=v(point));o=bpy.context.object;o.name=name;o.dimensions=(dims[0],dims[2],dims[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(M[mat])
    if bevel:
        m=o.modifiers.new('Cardstock cut edge','BEVEL');m.width=bevel;m.segments=1
        o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
    return parent(o,p)
def beam(name,a,b,width,mat='timber',p=root):
    a,b=v(a),v(b);delta=b-a
    bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)/2);o=bpy.context.object;o.name=name;o.dimensions=(width,width,delta.length);o.rotation_mode='QUATERNION';o.rotation_quaternion=delta.to_track_quat('Z','Y');bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(M[mat]);return parent(o,p)
def panel(name,points,thickness,mat,p):
    # Flat polygon parallel to XY, extruded in the Three.js Z direction.
    n=len(points);verts=[v((x,y,z+d)) for d in (0,thickness) for x,y,z in points]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(M[mat]);return parent(o,p)
front=hinge('Hinge_Front',(0,.045,.50));back=hinge('Hinge_Back',(0,.075,-.50));left=hinge('Hinge_Left',(-1.33,.065,0));right=hinge('Hinge_Right',(1.33,.09,0))
cube('Foundation',(0,.025,-.12),(3.12,.06,2.12),'edge')
for z,p in [(.5,front),(-.5,back)]:
    face=1 if z>0 else -1
    cube('Wall_Cardstock',(0,.65,z),(2.66,1.20,.045),'paper',p)
    for x in [-1.26,-.46,.46,1.26]:cube('Timber_upright',(x,.65,z+face*.035),( .035,1.20,.025),'timber',p)
    for y in [.16,1.15]:cube('Timber_cross',(0,y,z+face*.035),(2.66,.035,.025),'timber',p)
    for x in [-.96,-.62,.62,.96]:
        cube('Recessed_window',(x,.76,z+face*.032),(.265,.43,.025),'dark',p)
        cube('Warm_glazing',(x,.76,z+face*.05),(.218,.375,.018),'glass',p)
        cube('Window_mullion',(x,.76,z+face*.066),(.018,.38,.016),'timber',p)
        cube('Window_transom',(x,.77,z+face*.066),(.22,.018,.016),'timber',p)
        cube('Paper_sill',(x,.515,z+face*.06),(.31,.045,.08),'ivory',p)
    cube('Door_frame',(0,.44,z+face*.032),(.47,.74,.035),'dark',p)
    for x in [-.105,.105]:
        cube('Door_glass',(x,.53,z+face*.056),(.16,.31,.012),'glass',p)
        cube('Door_panel',(x,.23,z+face*.056),(.16,.18,.012),'timber',p)
    cube('Door_handle',(.055,.36,z+face*.072),(.025,.09,.025),'gold',p)
for x,p in [(-1.33,left),(1.33,right)]:
    cube('End_wall',(x,.66,0),(.045,1.18,1.0),'paper',p)
    # Gable faces, authored as thin cardstock wedges.
    pts=[(x-.02,1.25,-.5),(x-.02,1.65,0),(x-.02,1.25,.5)]
    # Explicit geometry for X-normal triangle.
    verts=[v((xx+dx,y,z)) for dx in (0,.04) for xx,y,z in pts]
    me=bpy.data.meshes.new('End_gable');me.from_pydata(verts,[],[(2,1,0),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)]);me.update();o=bpy.data.objects.new('End_gable',me);bpy.context.collection.objects.link(o);o.data.materials.append(M['paper']);parent(o,p)
# Roof hinges are children of walls: roof folds against wall before wall lies down.
roof_front=hinge('Hinge_RoofFront',(0,1.25,.64),front)
roof_back=hinge('Hinge_RoofBack',(0,1.25,-.64),back)
for side,p in [(1,roof_front),(-1,roof_back)]:
    # Make a thin sloping panel with explicit vertices; geometry includes its open pitch.
    pts=[(-1.48,1.25,side*.64),(1.48,1.25,side*.64),(1.48,1.67,0),(-1.48,1.67,0)]
    n=4;verts=[v((x,y+d,z)) for d in (0,.045) for x,y,z in pts]
    me=bpy.data.meshes.new('Roof_sheet');me.from_pydata(verts,[],[(3,2,1,0),(4,5,6,7)]+[(i,(i+1)%4,(i+1)%4+4,i+4) for i in range(4)]);me.update();o=bpy.data.objects.new('Roof_sheet',me);bpy.context.collection.objects.link(o);o.data.materials.append(M['roof']);parent(o,p)
    for i in range(16):
        x=-1.46+i*2.92/15;beam('Scored_roof_seam',(x,1.296,side*.64),(x,1.715,0),.009,'roof_edge',p)
    for j in range(1,5):
        t=j/5;beam('Roof_tile_line',(-1.48,1.296+.42*t,side*.64*(1-t)),(1.48,1.296+.42*t,side*.64*(1-t)),.007,'roof_edge',p)
    beam('Eave_cut_edge',(-1.51,1.25,side*.65),(1.51,1.25,side*.65),.045,'roof_edge',p)
# A gabled central clock panel folds with the front facade.
panel('Clock_gable',[(-.46,1.15,.565),(0,1.86,.565),(.46,1.15,.565)],.035,'paper',front)
beam('Gable_fascia',(-.49,1.15,.62),(0,1.89,.62),.04,'roof_edge',front);beam('Gable_fascia',(0,1.89,.62),(.49,1.15,.62),.04,'roof_edge',front)
for name,r,depth,z,mat in [('Clock_rim',.137,.035,.625,'dark'),('Clock_face',.114,.012,.65,'ivory')]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=depth,location=v((0,1.49,z)),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=name;o.data.materials.append(M[mat]);parent(o,front)
beam('Clock_hour',(0,1.49,.665),(0,1.56,.665),.012,'dark',front);beam('Clock_minute',(0,1.49,.665),(.07,1.49,.665),.012,'dark',front)
canopy=hinge('Hinge_Canopy',(0,1.00,-.52),back)
cube('Canopy_sheet',(0,1.,-.91),(2.98,.045,.78),'roof',canopy)
for i in range(13):beam('Canopy_score',(-1.45+i*2.9/12,1.028,-.54),(-1.45+i*2.9/12,1.028,-1.29),.008,'roof_edge',canopy)
# Posts collapse about their own ground hinges before canopy and facade fold.
for i,x in enumerate([-1.30,-.65,.65,1.30]):
    p=hinge(f'Hinge_Post_{i}',(x,.08,-1.22));cube('Canopy_post',(x,.54,-1.22),(.045,.92,.045),'timber',p)
    bracket=hinge(f'Hinge_Bracket_{i}',(x,.78,-1.22),p)
    beam('Canopy_bracket',(x,.78,-1.22),(x,1.,-1.0),.025,'timber',bracket)
# Visible glue tabs reinforce the pop-up construction at the feet of each facade.
for x in [-1.0,-.35,.35,1.0]:
    cube('Glue_tab',(x,.075,.58),(.19,.018,.16),'ivory',front)
# Keep a clean, editable Blender source with named hinge empties.
ROOT.joinpath('assets-source').mkdir(exist_ok=True); ROOT.joinpath('dist/assets').mkdir(exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets-source/station.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'dist/assets/station.glb'),export_format='GLB',export_apply=True,export_yup=True,export_animations=False)
print('STATION_EXPORT_OK',len(bpy.data.objects))
