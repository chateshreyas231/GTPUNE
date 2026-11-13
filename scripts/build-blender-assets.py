"""Original reference-inspired assets. Blender 4.3+, no external addons.

blender -b --python scripts/build-blender-assets.py -- [--render]
Meters; cars face +Y, humans -Y. Keep loft controls in this source editable.
"""
import bpy, math, json, hashlib, sys, struct
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/pune-originals'
SOURCE = ROOT / 'assets/blender'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
REPORT = []

def linear(v):
    return v / 12.92 if v < .04045 else ((v + .055) / 1.055) ** 2.4

def mat(name, rgb, rough=.4, metal=0, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*[linear(c) for c in rgb], 1)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = m.diffuse_color
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if name == 'Paint':
        bs.inputs['Coat Weight'].default_value = .45
        bs.inputs['Coat Roughness'].default_value = .16
    if emission:
        bs.inputs['Emission Color'].default_value = m.diffuse_color
        bs.inputs['Emission Strength'].default_value = emission
    return m

def mesh(name, verts, faces, material, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    o = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(material)
    for p in data.polygons: p.use_smooth = smooth
    return o

def ellipsoid(name, pos, scale, material, segments=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=pos)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth = True
    return o

def box(name, pos, size, material, radius=.02):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if radius:
        b = o.modifiers.new('Formed edge radius', 'BEVEL'); b.width = radius; b.segments = 3
        o.modifiers.new('Panel normals', 'WEIGHTED_NORMAL')
    return o

def line(name, pts, radius, material, cyclic=False):
    c = bpy.data.curves.new(name, 'CURVE'); c.dimensions = '3D'
    c.resolution_u = 1; c.bevel_depth = radius; c.bevel_resolution = 2
    s = c.splines.new('POLY'); s.points.add(len(pts)-1)
    for p, co in zip(s.points, pts): p.co = (*co, 1)
    s.use_cyclic_u = cyclic
    o = bpy.data.objects.new(name, c); bpy.context.collection.objects.link(o)
    c.materials.append(material)
    return o

def tube(name, a, b, r1, r2, material, vertices=20):
    d = Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=d.length, location=(Vector(a)+Vector(b))/2)
    o = bpy.context.object; o.name = name
    o.rotation_euler = d.to_track_quat('Z','Y').to_euler()
    o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth = True
    return o

def loft(name, sections, material, count=24):
    # Horizontal elliptical cross sections (x, y, z, width radius, depth radius).
    v=[]; f=[]
    for x,y,z,w,d in sections:
        v.extend((x+w*math.cos(i*2*math.pi/count), y+d*math.sin(i*2*math.pi/count), z) for i in range(count))
    for j in range(len(sections)-1):
        for i in range(count):
            a=j*count+i; b=j*count+(i+1)%count
            f.append((a,b,b+count,a+count))
    f.extend([tuple(reversed(range(count))), tuple(range((len(sections)-1)*count,len(sections)*count))])
    return mesh(name,v,f,material)

def reset():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions): bpy.data.actions.remove(action)
    bpy.data.orphans_purge(do_recursive=True)
    bpy.context.preferences.filepaths.save_version = 0

def consolidate(exclude=()):
    # Merge static geometry by material, preserving four independent wheel pivots.
    groups={}
    for o in list(bpy.context.scene.objects):
        if o.type not in ('MESH','CURVE') or o.parent in exclude: continue
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
        if o.type=='CURVE': bpy.ops.object.convert(target='MESH')
        for mod in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        key = o.data.materials[0].name if o.data.materials else 'None'
        groups.setdefault(key,[]).append(o)
    for key,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects: o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join(); bpy.context.object.name='Surface_'+key

def save_native(name):
    # Preserve named panels, control cages, modifiers and rig before delivery merging.
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / (name+'.blend')), compress=True)

def save_export(name, kind, dimensions, clips=()):
    # Evaluate actual delivery geometry rather than estimating from control cages.
    deps = bpy.context.evaluated_depsgraph_get(); triangles=0; points=[]
    for o in bpy.context.scene.objects:
        if o.type=='MESH':
            m=o.evaluated_get(deps).to_mesh(); m.calc_loop_triangles()
            triangles += len(m.loop_triangles); o.evaluated_get(deps).to_mesh_clear()
            points.extend(o.matrix_world @ Vector(p) for p in o.bound_box)
    bpy.ops.export_scene.gltf(filepath=str(OUT / (name+'.glb')), export_format='GLB', export_animations=True,
        export_animation_mode='ACTIONS', export_force_sampling=True, export_frame_range=False,
        export_skins=True, export_yup=True, export_extras=True)
    p=OUT/(name+'.glb')
    raw=p.read_bytes();length=struct.unpack_from('<I',raw,12)[0];exported=json.loads(raw[20:20+length])
    native_triangles=triangles
    triangles=sum(exported['accessors'][primitive['indices']]['count']//3 for item in exported['meshes'] for primitive in item['primitives'])
    measured=[round(max(p[i] for p in points)-min(p[i] for p in points),4) for i in [0,2,1]]
    REPORT.append(dict(id=name,kind=kind,dimensionsMeters=measured,designEnvelopeMeters=dimensions,triangles=triangles,nativeTriangles=native_triangles,
        bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),animations=list(clips),
        source=f'assets/blender/{name}.blend',sourceSha256=hashlib.sha256((SOURCE/(name+'.blend')).read_bytes()).hexdigest(),file=f'/assets/pune-originals/{name}.glb'))

SUPERCAR_SPECS = [
    dict(id='deccan-supercar',color=(.82,.025,.045),length=4.7,width=1.96,height=1.18,wb=2.7,cabin=.44,style='super'),
    dict(id='heritage-gt',color=(.72,.75,.78),length=4.3,width=1.72,height=1.25,wb=2.48,cabin=.37,style='classic'),
    dict(id='sahyadri-suv',color=(.48,.52,.46),length=4.75,width=1.92,height=1.72,wb=2.82,cabin=.76,style='suv'),
    dict(id='deccan-muscle',color=(.86,.035,.045),length=4.73,width=1.9,height=1.36,wb=2.72,cabin=.52,style='muscle'),
    dict(id='sunset-cabrio',color=(1,.65,.045),length=4.73,width=1.9,height=1.36,wb=2.72,cabin=.52,style='cabrio'),
]
NORMAL_CAR_SPECS = [
    dict(id='pune-electric',color=(.45,.49,.55),length=4.94,width=1.92,height=1.44,wb=2.94,style='electric',body_top=.94,rear=-1.63,front=1.12,roofrear=-.78,rooffront=.35,grille=.40,lamp=.77),
    dict(id='deccan-coupe',color=(.84,.85,.87),length=4.60,width=1.79,height=1.40,wb=2.75,style='silver-coupe',body_top=.94,rear=-1.25,front=.72,roofrear=-.54,rooffront=.10,grille=.59,lamp=.78),
    dict(id='pune-classic',color=(.48,.68,.69),length=4.05,width=1.64,height=1.53,wb=2.40,style='retro',body_top=.78,rear=-1.55,front=.88,roofrear=-.65,rooffront=.06,grille=.34,lamp=.74,radius=.32),
    dict(id='ghat-roadster',color=(.49,.50,.53),length=3.92,width=1.74,height=1.23,wb=2.31,style='roadster',body_top=.80,grille=.44,lamp=.65,radius=.31),
    dict(id='city-hatch',color=(.94,.64,.10),length=3.50,width=1.49,height=1.50,wb=2.34,style='hatch',body_top=.84,rear=-1.45,front=.82,roofrear=-1.04,rooffront=.17,grille=.37,lamp=.72,radius=.28),
]
CAR_SPECS = SUPERCAR_SPECS + NORMAL_CAR_SPECS

def car(spec):
    reset()
    name=spec['id']; style=spec['style']; L=spec['length']; W=spec['width']; H=spec['height']
    paint=mat('Paint',spec['color'],.23,.7)
    dark=mat('Carbon',(.045,.052,.06),.47,.15)
    rubber=mat('Tire',(.065,.069,.075),.9)
    chrome=mat('Alloy',(.7,.73,.78),.23,.9)
    glass=mat('Glazing',(.12,.21,.25),.12,.45)
    light=mat('Headlights',(.87,.95,1),.2,.3,1.5)
    red=mat('Tailights',(.8,.025,.02),.23,.25,1.1)
    caliper=mat('Calipers',(.98,.67,.07),.35,.4)
    leather=mat('Leather',(.15,.12,.10),.8)
    seam=mat('Panel_seams',(.085,.08,.075),.6)
    opened=style in ('cabrio','roadster')
    R=spec.get('radius',.37 if style!='classic' else .33)
    if style=='suv': R=.40
    axles=[-spec['wb']/2,spec['wb']/2]
    # Section loft: crowned bonnet, hips, belt and wheel-arch aperture returns.
    count=65; v=[]; faces=[]
    for j in range(count):
        y=-L/2+L*j/(count-1); t=y/(L/2)
        taper = .78 if style=='retro' else .86 if style in ('roadster','hatch') else .83 if style=='classic' else .91 if style=='super' else .94
        width=W/2*(taper+(1-taper)*math.sin(math.pi*j/(count-1)))
        top=spec.get('body_top',(.81 if style=='super' else .86 if style=='classic' else 1.12 if style=='suv' else .92))
        top-=(.24 if style=='super' else .17 if style=='classic' else .10)*abs(t)**3
        if style=='super': top+=.10*math.exp(-((y+1.25)/.6)**2)
        arch=max([R+.035+math.sqrt(max(0,(R+.045)**2-(y-a)**2)) if abs(y-a)<R+.045 else .22 for a in axles])
        # A closed cross-section with the side sill raised around the wheel openings.
        zs=[.23,.25, max(.25,arch), max(top-.12,arch+.018),top,top+.035,top, max(top-.12,arch+.018),max(.25,arch),.25]
        xs=[0,-width*.76,-width*.99,-width,-width*.78,0,width*.78,width,width*.99,width*.76]
        v.extend((x,y,z) for x,z in zip(xs,zs))
    for j in range(count-1):
        for i in range(10):
            if opened and i in (4,5) and -.95 < -L/2+L*(j+.5)/(count-1) < .74:
                continue  # Open passenger compartment; the bonnet is not a cabin lid.
            a=j*10+i; b=j*10+(i+1)%10
            faces.append((a,b,b+10,a+10))
    faces.extend([tuple(reversed(range(10))),tuple(range((count-1)*10,count*10))])
    body=mesh('Crowned_body_with_arches',v,faces,paint)
    sub=body.modifiers.new('Body surface refinement','SUBSURF'); sub.levels=1
    # Window cage controls: rear glass, roof crown, windshield shoulder and rake.
    belt=spec.get('body_top',.88 if style!='suv' else 1.10)
    rear=spec.get('rear',-2.12 if style=='suv' else -1.25 if style=='classic' else -.98)
    front=spec.get('front',1.12 if style=='suv' else .22 if style=='classic' else .72)
    roofrear=spec.get('roofrear',-.56 if style!='suv' else -1.55)
    rooffront=spec.get('rooffront',.12 if style!='suv' else .40)
    roofW=W*(.35 if style!='suv' else .39)
    windowW=W*.425
    if not opened:
        verts=[(-windowW,rear,belt),(windowW,rear,belt),(-roofW,roofrear,H-.045),(roofW,roofrear,H-.045),
            (-roofW,rooffront,H-.025),(roofW,rooffront,H-.025),(-windowW,front,belt),(windowW,front,belt)]
        mesh('Four_glass_panels',verts,[(0,1,3,2),(0,2,4,6),(1,7,5,3),(4,5,7,6)],glass)
        roof=mesh('Roof_crown',[(-roofW,roofrear,H-.045),(roofW,roofrear,H-.045),(-roofW,rooffront,H-.025),(roofW,rooffront,H-.025),(0,(roofrear+rooffront)/2,H+.012)],[(0,1,4),(1,3,4),(3,2,4),(2,0,4)],dark if style in ('suv','super') else paint)
        b=roof.modifiers.new('Roof thickness','SOLIDIFY'); b.thickness=.025
        for sign in (-1,1):
            line('Pillar_and_window_seal',[(sign*windowW,rear,belt),(sign*roofW,roofrear,H-.045),(sign*roofW,rooffront,H-.025),(sign*windowW,front,belt)],.025,paint)
            line('Window_lower_seal',[(sign*windowW,rear,belt),(sign*windowW,front,belt)],.012,dark)
            if style in ('suv','hatch','electric'): line('B_pillar',[(sign*windowW,-.45,belt),(sign*roofW,-.45,H-.025)],.037,dark)
    else:
        mesh('Windshield',[(-windowW,.75,belt),(windowW,.75,belt),(-roofW,.25,H-.05),(roofW,.25,H-.05)],[(0,1,3,2)],glass)
        for s in (-1,1): line('Windshield_frame',[(s*windowW,.75,belt),(s*roofW,.25,H-.05)],.025,paint)
        line('Windshield_header',[(-roofW,.25,H-.05),(roofW,.25,H-.05)],.025,paint)
        box('Open_cabin_floor',(0,-.12,.58),(W*.74,1.66,.08),dark,.04)
    # Cabin, four sculpted seats and wheel visible in the convertible.
    for x in [-.39,.39]:
        for y in ([.05] if style in ('super','classic','roadster') else [-.52,.14]):
            seat_z = .48 if style=='roadster' else .54 if style=='super' else .60 if style=='classic' else .72
            if y < -.2: seat_z -= .15
            box('Seat_cushion',(x,y,seat_z),(.48,.44,.13),leather,.06)
            back=box('Seat_back',(x,y-.16,seat_z+.20),(.46,.13,.40),leather,.065); back.rotation_euler.x=-.15
            box('Head_rest',(x,y-.18,seat_z+.40),(.23,.13,.15),leather,.045)
    box('Dashboard',(0,.48,.92),(W*.72,.25,.16),dark,.04)
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=6,location=(.38,.25,1.04),major_radius=.14,minor_radius=.015,rotation=(math.pi/2-.45,0,0))
    bpy.context.object.name='Steering_wheel'; bpy.context.object.data.materials.append(dark)
    for s in [-1,1]:
        # Door shut line, sill, handle, side mirrors.
        side=W*.5+.008
        line('Door_shut_line',[(s*side,.65,.83),(s*side,.40,.39),(s*side,-.8,.38),(s*side,-1.02,.79)],.006,seam)
        line('Side_sill',[(s*W*.49,-1.12,.25),(s*W*.49,1.08,.25)],.034,dark)
        box('Door_handle',(s*(W*.496),-.43,.83),(.025,.19,.026),chrome,.009)
        tube('Mirror_stem',(s*windowW,.56,.94),(s*(W*.54),.56,1.0),.015,.017,dark)
        ellipsoid('Mirror_housing',(s*W*.55,.56,1.02),(.12,.12,.055),paint,16,8)
        box('Mirror_glass',(s*W*.55,.46,1.02),(.17,.014,.065),glass,.01)
    # Front/rear fascia with grilles, splitters, multiple light signatures and exhaust.
    grille_z=spec.get('grille',.39 if style=='super' else .70 if style=='suv' else .49)
    lamp_z=spec.get('lamp',.55 if style=='super' else .96 if style=='suv' else .73)
    box('Front_grille',(0,L/2+.007,grille_z),(W*.67,.035,.20 if style=='super' else .25),dark,.055)
    for x in ([] if style in ('electric','retro','hatch','roadster') else [-.48,-.32,-.16,0,.16,.32,.48]):
        box('Grille_slat',(x,L/2+.031,grille_z),(.018,.01,.14 if style=='super' else .19),chrome,.003)
    box('Front_splitter',(0,L/2-.02,.24),(W*.96,.19,.045),dark,.018)
    box('Rear_diffuser',(0,-L/2-.01,.30),(W*.83,.12,.16),dark,.02)
    for x in [-.47,-.23,0,.23,.47]: box('Diffuser_fin',(x,-L/2-.04,.28),(.018,.18,.12),dark,.004)
    for s in (-1,1):
        if style in ('classic','retro','hatch'):
            ellipsoid('Round_headlight',(s*W*.34,L/2+.015,lamp_z),(.13 if style!='hatch' else .145,.035,.12 if style!='hatch' else .10),light,24,12)
            ellipsoid('Round_tail_light',(s*.60,-L/2-.02,.64),(.065,.025,.065),red,20,10)
        elif style in ('electric','roadster','silver-coupe'):
            ellipsoid('Swept_headlight',(s*W*.33,L/2+.015,lamp_z),(W*.15,.027,.021 if style=='electric' else .046),light,24,10)
            box('Rear_LED',(s*W*.29,-L/2-.034,belt-.10),(W*.36,.023,.035),red,.01)
        else:
            box('Lamp_black_bezel',(s*W*.34,L/2+.018,lamp_z),(W*.25,.045,.07 if style=='super' else .12),dark,.025)
            for k in range(3):
                lamp=box('LED_signature',(s*(W*.25+k*.058),L/2+.046,lamp_z+.008),(.042 if style=='super' else .024,.018,.025 if style=='super' else .074),light,.007)
                if style in ('muscle','cabrio'): lamp.rotation_euler.y=-s*.25
            box('Rear_LED',(s*W*.29,-L/2-.034,.56 if style=='super' else .97 if style=='suv' else .78),(W*.37,.023,.035),red,.01)
        if style!='electric':tube('Exhaust_outlet',(s*.62,-L/2-.04,.35),(s*.62,-L/2-.16,.35),.05,.05,chrome)
    if style=='electric':
        box('Full_width_light_bar',(0,L/2+.04,lamp_z),(W*.79,.02,.016),light,.006)
        box('Closed_EV_nose',(0,L/2+.02,.61),(W*.65,.03,.17),paint,.04)
        for s in [-1,1]:box('Vertical_running_lamp',(s*W*.42,L/2+.03,.49),(.025,.018,.22),light,.008)
    if style in ('hatch','retro'):
        box('Rubber_front_bumper',(0,L/2+.065,.46),(W*.90,.10,.085),chrome if style=='retro' else dark,.03)
        box('Rear_bumper',(0,-L/2-.065,.44),(W*.88,.1,.085),chrome if style=='retro' else dark,.03)
    if style=='roadster':
        for s in [-1,1]:line('Headrest_roll_hoop',[(s*.39-.13,-.32,.86),(s*.39-.13,-.32,1.10),(s*.39+.13,-.32,1.10),(s*.39+.13,-.32,.86)],.022,dark)
    if style=='silver-coupe':
        for z in [.50,.59,.68]:box('Horizontal_grille_bar',(0,L/2+.04,z),(W*.57,.02,.014),chrome,.004)
    if style=='retro':
        # Distinct beetle-like full round roof, curved rear glass and pod fenders.
        for s in [-1,1]:
            for y in axles:
                verts=[];faces=[]
                for j in range(19):
                    a=j*math.pi/18
                    for x in [s*(W*.5-.21),s*(W*.5+.08)]:verts.append((x,y+(R+.09)*math.cos(a),R+(R+.09)*math.sin(a)))
                for j in range(18):faces.append((j*2,j*2+1,j*2+3,j*2+2))
                f=mesh('Rounded_wing',verts,faces,paint);mod=f.modifiers.new('Wing_skin','SOLIDIFY');mod.thickness=.018
        # Replace the angular cabin with a continuous crowned section shell.
        for o in list(bpy.context.scene.objects):
            if o.name.startswith(('Four_glass_panels','Roof_crown','Pillar_and_window','Window_lower')):bpy.data.objects.remove(o,do_unlink=True)
        stations=[(-1.6,.36,.85),(-1.38,.57,1.15),(-1.03,.64,1.42),(-.55,.66,1.53),(-.05,.65,1.48),(.42,.61,1.24),(.87,.57,.83)]
        verts=[];faces=[]
        for y,w,top in stations:
            for j in range(17):
                a=j*math.pi/16;verts.append((w*math.cos(a),y,belt+(top-belt)*math.sin(a)))
        for k in range(len(stations)-1):
            for j in range(16):a=k*17+j;faces.append((a,a+1,a+18,a+17))
        canopy=mesh('Rounded_steel_canopy',verts,faces,paint)
        # Glazed side openings seated just proud of the rounded upper shell.
        for s in [-1,1]:
            for y0,y1 in [(-1.23,-.53),(-.46,.28)]:
                pts=[(s*.654,y0,.92),(s*.67,y0,1.20),(s*.67,y1,1.29),(s*.654,y1,.92)]
                mesh('Classic_side_glazing',pts,[(0,1,2,3)] if s<0 else [(3,2,1,0)],glass)
                line('Chrome_window_surround',pts,.014,chrome,True)
        mesh('Classic_windscreen',[(-.52,.72,.95),(.52,.72,.95),(.50,.31,1.32),(-.50,.31,1.32)],[(0,1,2,3)],glass)
        mesh('Classic_rear_glass',[(-.43,-1.43,1.09),(-.46,-1.14,1.36),(.46,-1.14,1.36),(.43,-1.43,1.09)],[(0,1,2,3)],glass)
    if style=='super':
        box('Bonnet_carbon_insert',(0,1.6,.77),(W*.5,.52,.035),dark,.045)
        for s in [-1,1]:
            box('Air_intake',(s*W*.49,-.7,.65),(.025,.48,.16),dark,.035)
        box('Rear_spoiler',(0,-1.98,1.0),(W*.9,.20,.035),dark,.016)
        for x in [-.55,.55]:box('Spoiler_mount',(x,-1.98,.91),(.04,.08,.18),dark,.01)
    if style=='suv':
        box('Rear_roof_spoiler',(0,-1.48,H-.04),(W*.8,.28,.06),dark,.025)
        for s in [-1,1]: line('Roof_rail',[(s*W*.36,-1.35,H+.035),(s*W*.36,.5,H+.06)],.025,dark)
        line('Rear_wiper',[(0,-1.94,1.28),(.3,-1.92,1.3)],.012,dark)
    if style=='classic':
        ivory=mat('Race_roundel',(.94,.92,.85),.5)
        for s in [-1,1]:
            # Number and disk sit on the side door; typography is original, no badge.
            disk=tube('Race_roundel',(s*W*.501,-.15,.65),(s*W*.508,-.15,.65),.235,.235,ivory,48)
            bpy.ops.object.text_add(location=(s*W*.514,-.15,.65))
            text=bpy.context.object; text.name='Race_number_4'; text.data.body='4'; text.data.align_x='CENTER'; text.data.align_y='CENTER'; text.data.size=.36
            text.rotation_euler=(math.pi/2,0,s*math.pi/2); text.data.materials.append(dark)
            bpy.ops.object.convert(target='MESH')
        for x in [-.17,0,.17]: box('Bonnet_vent',(x,1.24,.87),(.07,.26,.012),dark,.012)
    # Each wheel is a pivot with local x axle; GLB preserves names for rolling.
    pivots=[]
    for side in [-1,1]:
        for axle,y in enumerate(axles):
            p=bpy.data.objects.new(f'wheel_{side}_{axle}',None); bpy.context.collection.objects.link(p); p.location=(side*(W/2-.04),y,R); pivots.append(p)
            parts=[]
            for label,major,minor,ma in [('Tire',R-.07,.075,rubber),('Rim_lip',R-.13,.017,chrome)]:
                bpy.ops.mesh.primitive_torus_add(major_segments=40,minor_segments=10,major_radius=major,minor_radius=minor,location=(0,0,0),rotation=(0,math.pi/2,0))
                o=bpy.context.object; o.name=label; o.data.materials.append(ma); parts.append(o)
                for f in o.data.polygons:f.use_smooth=True
            parts.append(tube('Brake_disc',(-.045,0,0),(.045,0,0),R*.64,R*.64,chrome,32))
            if style in ('retro','electric','hatch'):
                parts.append(ellipsoid('Wheel_cover',(side*.065,0,0),(.062,R*.71,R*.71),chrome,24,10))
            parts.append(tube('Hub',(-.11,0,0),(.11,0,0),.065,.065,dark,20))
            for spoke in range(10):
                a=spoke*math.tau/10
                parts.append(tube('Alloy_spoke',(side*.09,.07*math.sin(a),.07*math.cos(a)),(side*.09,(R-.13)*math.sin(a+.09),(R-.13)*math.cos(a+.09)),.016,.024,chrome,6))
            parts.append(box('Brake_caliper',(0,.17,.06),(.1,.10,.19),caliper,.02))
            # Join wheel parts by material to bound draw calls, then parent in local space.
            wheel_groups=[[o for o in parts if o.data.materials[0]==ma] for ma in [rubber,chrome,dark,caliper]]
            for selected in wheel_groups:
                bpy.ops.object.select_all(action='DESELECT')
                for o in selected:o.select_set(True)
                bpy.context.view_layer.objects.active=selected[0]
                for o in selected:
                    bpy.context.view_layer.objects.active=o
                    for mod in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
                bpy.context.view_layer.objects.active=selected[0]; bpy.ops.object.join()
                bpy.context.object.parent=p
    save_native(name)
    consolidate(exclude=pivots)
    save_export(name,'vehicle',[W,H+.08,L+.2])

def human(name, female=False, young=False, costume='casual'):
    reset()
    skin=mat('Skin',(.70,.48,.33),.58)
    bs=skin.node_tree.nodes.get('Principled BSDF'); bs.inputs['Subsurface Weight'].default_value=.08
    cloth=mat('Shirt',(.20,.35,.43) if female else (.78,.73,.61) if not young else (.51,.18,.21),.94)
    pants=mat('Pants',(.10,.14,.20),.9)
    hair=mat('Hair',(.065,.046,.035),.72)
    white=mat('Eye_white',(.78,.75,.69),.36)
    iris=mat('Iris',(.12,.075,.035),.3)
    pupil=mat('Pupil',(.012,.009,.007),.3)
    lips=mat('Lips',(.43,.23,.19),.64)
    shoes=mat('Shoes',(.10,.075,.055),.72)
    buttons=mat('Buttons',(.43,.43,.39),.5)
    khaki=costume in ('police','policewoman')
    if khaki:
        cloth.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*[linear(c) for c in (.70,.59,.40)],1)
        pants.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*[linear(c) for c in (.66,.55,.37)],1)
    if costume in ('dress','sari','casual-woman'):
        rgb=(.88,.86,.76) if costume=='dress' else (.65,.10,.30) if costume=='sari' else (.10,.10,.13)
        cloth.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*[linear(c) for c in rgb],1)
        if costume=='casual-woman':pants.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=skin.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value
    if costume=='traditional':
        cloth.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*[linear(c) for c in (.76,.08,.07)],1)
        pants.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.70,.69,.61,1)
    objects=[]; bindings={}
    def bind(o,weights):
        objects.append(o); bindings[o.name]=weights; return o
    def rigid(o,bone):return bind(o,[(bone,1)])
    # Natural 7.4-head proportions, gently tapered clothing rather than primitive limbs.
    torso=loft('Tailored_shirt',[(0,0,.68 if costume=='traditional' else .80 if female else .89,.17 if female else .155,.10),(0,0,.96,.17,.108),(0,0,1.08,.145 if female else .155,.10),(0,0,1.23,.175 if female else .19,.116),(0,0,1.35,.218 if not female else .195,.108),(0,0,1.395,.14,.09),(0,0,1.43,.075,.067)],cloth,32)
    bind(torso,'torso')
    rigid(loft('Neck',[(0,0,1.38,.057,.052),(0,.005,1.49,.052,.05)],skin,24),'Head')
    # Head is an anatomical section cage: jaw, chin, cheek, brow and cranial vault.
    head=loft('Face_and_cranium',[(0,-.012,1.465,.032,.042),(0,-.012,1.49,.060,.063),(0,0,1.53,.081,.078),(0,0,1.58,.089,.084),(0,.005,1.63,.087,.081),(0,.012,1.68,.077,.070),(0,.013,1.713,.052,.047),(0,.013,1.725,.012,.012)],skin,32)
    sub=head.modifiers.new('Facial_surface','SUBSURF'); sub.levels=1
    rigid(head,'Head')
    for s in [-1,1]:
        rigid(ellipsoid('Ear',(s*.091,.006,1.586),(.017,.014,.033),skin),'Head')
        rigid(line('Ear_helix',[(s*.101,.001,1.612),(s*.108,-.006,1.6),(s*.106,-.009,1.58),(s*.098,-.006,1.568)],.003,lips),'Head')
        rigid(ellipsoid('Eye_socket',(s*.033,-.064,1.611),(.023,.009,.014),skin),'Head')
        rigid(ellipsoid('Eye_white',(s*.033,-.074,1.611),(.014,.004,.006),white),'Head')
        rigid(ellipsoid('Iris',(s*.033,-.077,1.611),(.0047,.0015,.0047),iris,16,8),'Head')
        rigid(ellipsoid('Pupil',(s*.033,-.0785,1.611),(.0022,.001,.0028),pupil,12,8),'Head')
        rigid(line('Upper_eyelid',[(s*.018,-.073,1.611),(s*.03,-.078,1.617),(s*.048,-.070,1.612)],.0024,skin),'Head')
        rigid(line('Lower_eyelid',[(s*.018,-.073,1.611),(s*.032,-.077,1.605),(s*.048,-.070,1.612)],.0018,skin),'Head')
        rigid(line('Eyebrow',[(s*.014,-.075,1.635),(s*.033,-.08,1.639),(s*.054,-.068,1.633)],.0035,hair),'Head')
    rigid(ellipsoid('Nose_bridge',(0,-.077,1.594),(.011,.014,.028),skin),'Head')
    rigid(ellipsoid('Nose_tip',(0,-.093,1.574),(.015,.015,.012),skin),'Head')
    for s in [-1,1]:
        rigid(ellipsoid('Nostril_wing',(s*.012,-.088,1.571),(.009,.009,.007),skin,16,10),'Head')
        rigid(ellipsoid('Nostril',(s*.009,-.096,1.567),(.003,.002,.002),lips,12,8),'Head')
    rigid(line('Upper_lip',[(-.027,-.075,1.544),(-.012,-.082,1.549),(0,-.084,1.547),(.012,-.082,1.549),(.027,-.075,1.544)],.0038,lips),'Head')
    rigid(line('Lower_lip',[(-.025,-.075,1.543),(0,-.083,1.538),(.025,-.075,1.543)],.0042,lips),'Head')
    # Hair cap occupies the upper/back cranium; open front reveals the face.
    hv=[]; hf=[]; n=32
    for j in range(9):
        for i in range(n):
            a=i*math.tau/n
            # Front hairline is higher than the back hairline.
            end=1.12 if math.sin(a)<-.25 else 1.85
            theta=.035+(end-.035)*j/8
            hv.append((.091*math.sin(theta)*math.cos(a),.012+.085*math.sin(theta)*math.sin(a),1.62+.113*math.cos(theta)))
    for j in range(8):
        for i in range(n):a=j*n+i;b=j*n+(i+1)%n;hf.append((a,b,b+n,a+n))
    rigid(mesh('Hair_cap',hv,hf,hair),'Head')
    if female:
        rigid(ellipsoid('Tied_hair_bun',(0,.102,1.65),(.052,.045,.053),hair),'Head')
        bindi=mat('Bindi',(.57,.035,.025),.65)
        rigid(ellipsoid('Bindi',(0,-.077,1.645),(.003,.0015,.004),bindi,12,8),'Head')
    # Shirt collar, button placket, cuffs, hem and seam details.
    for s in [-1,1]:
        rigid(mesh('Collar',[(s*.01,-.07,1.424),(s*.07,-.087,1.412),(s*.064,-.112,1.357),(s*.012,-.112,1.386)],[(0,1,2,3)],cloth),'Chest')
    rigid(line('Button_placket',[(0,-.111,.96),(0,-.119,1.34)],.005,cloth),'Chest')
    for z in [.99,1.07,1.15,1.23,1.31]: rigid(ellipsoid('Button',(0,-.123,z),(.004,.002,.004),buttons,12,6),'Chest')
    # Clothing families follow the same deforming rig; original patterns, no photo textures.
    if costume!='casual':
        gold=mat('Garment_trim',(.89,.64,.13),.45,.3)
        accent=mat('Costume_accent',(.09,.43,.17) if costume=='sari' else (.88,.86,.76) if costume=='dress' else (.95,.35,.025) if costume=='worker' else (.16,.13,.12),.85)
        if costume in ('sari','dress','casual-woman'):
            skirt_bottom=.12 if costume in ('sari','dress') else .71
            skirt=loft('Draped_garment',[(0,0,skirt_bottom,.23 if costume!='casual-woman' else .21,.145),(0,0,.55 if skirt_bottom<.3 else .77,.21,.14),(0,0,.88,.215,.15),(0,0,1.00,.205,.14)],accent,32)
            bind(skirt,'drape')
            if costume=='sari':
                pallu=mesh('Sari_pallu',[(-.17,-.12,.88),(.15,-.13,1.35),(.09,-.14,1.39),(-.20,-.14,.90)],[(0,1,2,3)],gold);bind(pallu,'torso')
                for i in range(8):bind(line('Sari_pleat',[(-.12+i*.035,-.146,.16),(-.11+i*.031,-.145,.85)],.006,gold),'drape')
                for s in [-1,1]:rigid(ellipsoid('Gold_earring',(s*.10,-.007,1.555),(.007,.005,.011),gold,12,8),'Head')
            elif costume=='dress':
                flower=mat('Printed_flowers',(.59,.13,.25),.9)
                for i in range(42):
                    z=.2+(i*.113)%1.17;x=math.sin(i*7.7)*(.16 if z>.95 else .20)
                    o=mesh('Original_floral_print',[(x,-.15,z+.014),(x+.014,-.151,z),(x,-.15,z-.014),(x-.014,-.151,z)],[(0,1,2,3)],flower)
                    bind(o,'torso' if z>.93 else 'drape')
        if costume in ('traditional','police','policewoman'):
            if costume=='traditional':
                rigid(ellipsoid('Maharashtrian_pheta',(0,.012,1.738),(.105,.088,.064),cloth,24,12),'Head')
                rigid(line('Pheta_fold',[(-.09,-.055,1.75),(.0,-.084,1.78),(.09,-.04,1.76)],.012,gold),'Head')
                rigid(box('Pheta_tail',(-.075,.045,1.68),(.05,.025,.18),cloth,.01),'Head')
            else:
                cap=mat('Police_cap',(.12,.16,.23),.8)
                rigid(ellipsoid('Peaked_cap',(0,.008,1.745),(.103,.086,.045),cap),'Head')
                rigid(ellipsoid('Cap_peak',(0,-.086,1.713),(.085,.052,.010),cap),'Head')
                rigid(line('Cap_band',[(-.089,-.03,1.724),(0,-.082,1.724),(.089,-.03,1.724)],.010,gold),'Head')
                for s in [-1,1]:
                    rigid(box('Uniform_pocket',(s*.085,-.119,1.25),(.065,.016,.077),cloth,.006),'Chest')
                    rigid(box('Epaulette',(s*.16,0,1.382),(.07,.065,.015),gold,.004),'Chest')
                rigid(box('Duty_belt',(0,0,.94),(.34,.23,.036),accent,.012),'Hips')
                rigid(box('Belt_buckle',(0,-.122,.94),(.042,.014,.033),gold,.003),'Hips')
                rigid(tube('Lathi',(.32,.05,.76),(.33,.05,.23),.012,.012,hair,12),'Hand_R')
            if not female:
                for s in [-1,1]:rigid(line('Moustache',[(0,-.091,1.556),(s*.018,-.084,1.553),(s*.03,-.076,1.559)],.004,hair),'Head')
        if costume=='worker':
            rigid(ellipsoid('Safety_helmet',(0,.01,1.74),(.108,.097,.065),gold,24,12),'Head')
            rigid(ellipsoid('Helmet_brim',(0,-.014,1.705),(.125,.123,.010),gold,24,8),'Head')
            vest=loft('High_visibility_vest',[(0,0,.97,.18,.118),(0,0,1.15,.18,.127),(0,0,1.34,.216,.122)],accent,24);bind(vest,'torso')
            for s in [-1,1]:rigid(box('Reflective_shoulder_strip',(s*.105,-.132,1.19),(.032,.015,.28),gold,.003),'Chest')
            rigid(box('Reflective_waist_strip',(0,-.132,1.035),(.34,.015,.028),gold,.003),'Hips')
        if costume=='casual-jacket':
            for s in [-1,1]:rigid(box('Open_jacket_lapel',(s*.09,-.126,1.21),(.08,.025,.31),accent,.018),'Chest')
    bones=[('Hips',(0,0,.88),(0,0,1.04),None),('Chest',(0,0,1.04),(0,0,1.39),'Hips'),('Head',(0,0,1.39),(0,0,1.72),'Chest')]
    for s,suffix in [(-1,'L'),(1,'R')]:
        hip=(s*.095,0,.93); knee=(s*.098,-.012,.52); ankle=(s*.10,0,.09)
        shoulder=(s*.19,0,1.35); elbow=(s*.255,0,1.085); wrist=(s*.29,-.01,.85)
        bones += [(f'Thigh_{suffix}',hip,knee,'Hips'),(f'Shin_{suffix}',knee,ankle,f'Thigh_{suffix}'),(f'Foot_{suffix}',ankle,(s*.10,-.15,.06),f'Shin_{suffix}'),(f'Arm_{suffix}',shoulder,elbow,'Chest'),(f'Forearm_{suffix}',elbow,wrist,f'Arm_{suffix}'),(f'Hand_{suffix}',wrist,(s*.30,-.01,.73),f'Forearm_{suffix}')]
        leg=loft('Trouser_'+suffix,[(s*.10,0,.10,.052,.055),(s*.10,0,.22,.059,.062),(s*.098,-.012,.46,.068,.072),(s*.098,-.015,.53,.071,.074),(s*.095,0,.72,.082,.088),(s*.09,0,.95,.09,.097)],pants)
        bind(leg,('leg',suffix))
        arm=loft('Sleeve_'+suffix,[(s*.267,0,1.02,.048,.049),(s*.255,0,1.11,.058,.058),(s*.23,0,1.23,.064,.066),(s*.185,0,1.34,.065,.07)],cloth)
        bind(arm,('arm',suffix))
        forearm=loft('Forearm_'+suffix,[(s*.29,-.01,.84,.033,.027),(s*.28,-.005,.93,.041,.039),(s*.264,0,1.04,.047,.045)],skin)
        rigid(forearm,f'Forearm_{suffix}')
        rigid(ellipsoid('Palm_'+suffix,(s*.295,-.008,.805),(.038,.022,.055),skin),f'Hand_{suffix}')
        for i in range(4):
            x=s*(.272+i*.015); end=.706+abs(i-1.5)*.009
            rigid(tube('Finger_'+suffix,(x,-.011,.79),(x,-.015,end),.008,.006,skin,10),f'Hand_{suffix}')
            rigid(ellipsoid('Knuckle_'+suffix,(x,-.027,.781),(.008,.004,.012),skin,12,8),f'Hand_{suffix}')
        rigid(tube('Thumb_'+suffix,(s*.27,-.01,.825),(s*.25,-.025,.775),.012,.009,skin,12),f'Hand_{suffix}')
        rigid(ellipsoid('Shoe_'+suffix,(s*.10,-.052,.062),(.065,.135,.058),shoes),f'Foot_{suffix}')
        rigid(line('Sole_'+suffix,[(s*.10+.05,-.13,.027),(s*.10+.056,.03,.027),(s*.10-.056,.03,.027),(s*.10-.05,-.13,.027)],.008,shoes,True),f'Foot_{suffix}')
    # Convert/apply then assign smooth weights before merging material sections.
    for o in objects:
        spec=bindings[o.name]
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        if o.type=='CURVE':bpy.ops.object.convert(target='MESH')
        for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        def weight(vertex,bone,value):
            vg=o.vertex_groups.get(bone) or o.vertex_groups.new(name=bone);vg.add([vertex],value,'REPLACE')
        for vert in o.data.vertices:
            z=vert.co.z
            if spec=='drape':
                t=max(0,min(1,(z-.70)/.25));side='L' if vert.co.x<0 else 'R'
                weight(vert.index,'Hips',t);weight(vert.index,'Thigh_'+side,1-t)
            elif spec=='torso':
                t=max(0,min(1,(z-1.00)/.20)); weight(vert.index,'Hips',1-t);weight(vert.index,'Chest',t)
            elif isinstance(spec,tuple) and spec[0] in ('leg','arm'):
                part,suffix=spec; pivot=.52 if part=='leg' else 1.085
                upper=f'Thigh_{suffix}' if part=='leg' else f'Arm_{suffix}'
                lower=f'Shin_{suffix}' if part=='leg' else f'Forearm_{suffix}'
                t=max(0,min(1,(z-pivot+.065)/.13));weight(vert.index,upper,t);weight(vert.index,lower,1-t)
            else:
                for bone,value in spec:weight(vert.index,bone,value)
    bpy.ops.object.armature_add(enter_editmode=True)
    rig=bpy.context.object;rig.name='Pune_rig'; rig.data.edit_bones.remove(rig.data.edit_bones[0])
    for name_,head,tail,parent in bones:
        b=rig.data.edit_bones.new(name_);b.head=head;b.tail=tail
        if parent:b.parent=rig.data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH':
            mod=o.modifiers.new('Pune_skeletal_deformation','ARMATURE');mod.object=rig;o.parent=rig
    bpy.context.scene.render.fps=24
    clips=['Idle','Walk','Run','Punch_Left','Punch_Right','Sword_Slash']
    for clip in clips:
        action=bpy.data.actions.new(clip);action.use_fake_user=True
        if not rig.animation_data:rig.animation_data_create()
        rig.animation_data.action=action
        frames=25 if clip in ('Walk','Run') else 33 if clip=='Idle' else 17
        for frame in range(1,frames+1,2):
            t=(frame-1)/(frames-1);wave=math.sin(t*math.tau)
            for b in rig.pose.bones:b.rotation_mode='XYZ';b.rotation_euler=(0,0,0);b.location=(0,0,0)
            if clip in ('Walk','Run'):
                amp=.43 if clip=='Walk' else .72
                for s,suffix in [(-1,'L'),(1,'R')]:
                    phase=wave*s
                    rig.pose.bones[f'Thigh_{suffix}'].rotation_euler.x=phase*amp
                    rig.pose.bones[f'Shin_{suffix}'].rotation_euler.x=-max(0,-phase)*(.6 if clip=='Walk' else 1.12)
                    rig.pose.bones[f'Foot_{suffix}'].rotation_euler.x=-phase*.13
                    rig.pose.bones[f'Arm_{suffix}'].rotation_euler.x=-phase*amp*.8
                    rig.pose.bones[f'Forearm_{suffix}'].rotation_euler.x=.12 if clip=='Walk' else .7
                rig.pose.bones['Hips'].location.z=abs(wave)*(.018 if clip=='Walk' else .035)
            elif clip=='Idle':rig.pose.bones['Chest'].rotation_euler.x=wave*.018
            else:
                side='L' if clip=='Punch_Left' else 'R';strength=math.sin(t*math.pi)**2
                rig.pose.bones[f'Arm_{side}'].rotation_euler.x=-1.5*strength
                rig.pose.bones[f'Forearm_{side}'].rotation_euler.x=-.18*strength
                rig.pose.bones['Chest'].rotation_euler.z=(.22 if side=='L' else -.22)*strength
                if clip=='Sword_Slash':rig.pose.bones['Arm_R'].rotation_euler.y=-.8*strength
            for b in rig.pose.bones:
                b.keyframe_insert('rotation_euler',frame=frame,group=b.name)
                if b.name=='Hips':b.keyframe_insert('location',frame=frame,group=b.name)
    rig.animation_data.action=None
    for b in rig.pose.bones:b.rotation_euler=(0,0,0);b.location=(0,0,0)
    bpy.context.scene.frame_set(1)
    save_native(name)
    # Export fewer draw calls while retaining the separately editable source parts.
    consolidate()
    for o in bpy.context.scene.objects:
        if o.type=='MESH':
            mod=o.modifiers.new('Pune_skeletal_deformation','ARMATURE');mod.object=rig;o.parent=rig
    save_export(name,'animated-human',[.68,1.74,.33],clips)

def studio_preview(specs=None, prefix="vehicles", people=True):
    reset()
    floor=mat('Studio_floor',(.22,.24,.27),.8)
    box('Floor',(0,0,-.16),(32,27,.2),floor,0)
    groups=[]
    for i,spec in enumerate(specs or SUPERCAR_SPECS):
        # Import the full GLB for faithful delivery-material inspection.
        before=set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(OUT/(spec['id']+'.glb')))
        imported=[o for o in bpy.data.objects if o not in before]
        group=bpy.data.objects.new(spec['id'],None);bpy.context.collection.objects.link(group)
        for o in imported:
            if o.parent is None:o.parent=group
        group.location=((i%3-1)*6,(i//3)*6-3,0)
        group.rotation_euler.z=-.3
        groups.append(group)
    setup_camera((12,17,15),(0,0,0),1050,760)
    bpy.context.scene.render.filepath=str(SOURCE/f'{prefix}-preview.png');bpy.ops.render.render(write_still=True)
    # Matching neutral orthographic silhouettes expose rake/proportion errors.
    scene=bpy.context.scene
    scene.render.resolution_x=1600;scene.render.resolution_y=500
    scene.cycles.samples=16;scene.camera.data.ortho_scale=28
    for view,pos,target in [('front',(0,12,.85),(0,0,.85)),('side',(12,0,.85),(0,0,.85)),('top',(0,0,20),(0,0,0))]:
        for i,g in enumerate(groups):
            g.rotation_euler.z=0
            g.location=(0,(i-2)*5.4,0) if view=='side' else ((i-2)*5.4,0,0)
        scene.camera.location=pos
        scene.camera.rotation_euler=(Vector(target)-scene.camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(SOURCE/f'{prefix}-{view}.png');bpy.ops.render.render(write_still=True)
    if not people:return
    reset()
    for i,name in enumerate(['pune-woman','pune-man','pune-young-adult']):
        before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
        group=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(group)
        for o in bpy.data.objects:
            if o not in before and o != group and o.parent is None:o.parent=group
        group.location.x=(i-1)*.85
    floor=mat('Studio_floor',(.28,.30,.32),.85);box('Floor',(0,0,-.04),(8,8,.05),floor,0)
    setup_camera((3,-6,2.5),(0,0,.93),1050,820)
    bpy.context.scene.render.filepath=str(SOURCE/'people-preview.png');bpy.ops.render.render(write_still=True)

def setup_camera(pos,target,w,h):
    scene=bpy.context.scene
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False
    scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.resolution_percentage=100
    scene.world.color=(.28,.28,.28)
    for loc,power,size in [((1,-4,8),1800,7),((-6,2,5),1300,6),((5,4,6),2000,5)]:
        bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size
        o.rotation_euler=(Vector((0,0,.4))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=pos);camera=bpy.context.object
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=18 if w==1050 and h==760 else 3.2
    scene.camera=camera
    scene.view_settings.view_transform='AgX'

def main():
    normal_only = '--normal-only' in sys.argv
    if '--preview-only' not in sys.argv:
        preserved=[]
        if normal_only:
            existing=json.loads((OUT/'manifest.json').read_text())
            normal_ids={s['id'] for s in NORMAL_CAR_SPECS}
            preserved=[a for a in existing['assets'] if a['id'] not in normal_ids]
        for spec in (NORMAL_CAR_SPECS if normal_only else CAR_SPECS):car(spec)
        if not normal_only:
            human('pune-woman',female=True)
            human('pune-man')
            human('pune-young-adult',young=True)
        (OUT/'manifest.json').write_text(json.dumps(dict(version=1,author='GTPUNE contributors',license='CC0-1.0',
            generator='scripts/build-blender-assets.py',blender=bpy.app.version_string,
            reference='User supplied ten vehicle photographs; original approximate designs; hidden views inferred. No logos or source pixels included.',
            assets=preserved+REPORT),indent=2)+'\n')
    if '--render' in sys.argv:
        if not normal_only:studio_preview()
        studio_preview(NORMAL_CAR_SPECS,'normal-vehicles',people=False)
    print('PUNE_ASSETS_COMPLETE',json.dumps(REPORT))

if __name__ == '__main__':main()
