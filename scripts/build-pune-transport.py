"""Original reference-inspired public and police transport, modeled in Blender."""
import bpy, math, json, importlib.util, sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('pune_author',Path(__file__).with_name('build-blender-assets.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
SPECS=[('city-green-bus','city',11.2,2.45,3.20),('state-red-coach','coach',11.4,2.45,3.40),('state-red-bus','state',10.4,2.45,3.10),('police-transport','police-bus',8.5,2.35,3.05),('police-patrol-suv','suv',4.65,1.88,1.9),('police-classic-jeep','jeep',4.2,1.78,1.98)]

def transport(item):
    name,style,L,W,H=item;police=style.startswith('police') or style in ('suv','jeep')
    if style in ('suv','jeep'):
        a.car(dict(id=name,color=(.92,.93,.92),length=L,width=W,height=H,wb=2.7,style='suv'))
        a.REPORT.pop()
        bpy.ops.wm.open_mainfile(filepath=str(a.SOURCE/(name+'.blend')))
    else:a.reset()
    paint=next((m for m in bpy.data.materials if m.name=='Paint'),None) or a.mat('Paint',(.16,.74,.10) if style=='city' else (.73,.035,.025) if not police else (.15,.20,.26),.38,.25)
    dark=a.mat('Bus_rubber',(.045,.05,.055),.82)
    chrome=a.mat('Bus_alloy',(.6,.63,.67),.3,.7)
    glass=a.mat('Bus_glass',(.13,.21,.24),.18,.25)
    white=a.mat('Lettering',(.92,.92,.85),.7)
    red=a.mat('Red_livery',(.82,.025,.025),.45)
    yellow=a.mat('Yellow_livery',(.99,.73,.07),.5)
    blue=a.mat('Blue_livery',(.08,.32,.68),.4)
    lamp=a.mat('Bus_headlamp',(.86,.94,1),.2,.2,1.5)
    tail=a.mat('Bus_tail',(.88,.035,.025),.3,.2,1)
    wood=a.mat('Seat_fabric',(.18,.25,.28),.95)
    if style not in ('suv','jeep'):
        # Flat-sided bus assembly has rounded formed corners, raised roof, wheel wells.
        a.box('Bus_chassis',(0,0,.48),(W-.16,L-.28,.33),dark,.08)
        a.box('Lower_bus_body',(0,0,1.05),(W,L,1.0),paint,.12)
        a.box('Upper_bus_shell',(0,0,2.30),(W-.06,L-.04,1.52),paint,.14)
        a.box('Crowned_bus_roof',(0,0,H-.14),(W-.04,L-.12,.25),paint,.11)
        # The glazing overlays actual panel openings as a simplified opaque game shell.
        a.box('Front_windshield',(0,L/2+.012,2.35),(W-.23,.035,1.15),glass,.11)
        a.box('Rear_windshield',(0,-L/2-.018,2.35),(W-.30,.035,1.0),glass,.08)
        a.box('Driver_divider',(W*.18,L/2+.04,2.32),(.035,.025,1.10),dark,.005)
        for side in [-1,1]:
            for k in range(8):
                y=-L/2+.75+k*(L-2.2)/7
                a.box('Passenger_window',(side*(W/2+.01),y,2.27),(.035,.85,.96),glass,.035)
                a.box('Window_lower_rail',(side*(W/2+.035),y,1.91),(.022,.84,.025),chrome,.003)
                if style in ('state','police-bus'):
                    for z in [2.08,2.32,2.56]:a.box('Protective_window_bar',(side*(W/2+.045),y,z),(.02,.86,.022),dark,.003)
            # Three open door step treads meet the kerb-side entry.
            if side==-1:
                a.box('Entry_door',(side*(W/2+.035),L*.31,1.63),(.04,.83,2.12),glass,.035)
                for k in range(3):a.box('Door_step',(side*(W/2-.22),L*.31,.38+k*.18),(.48,.80,.09),yellow,.015)
            for row in range(6):
                for x in [-.77,.77]:a.box('Passenger_seat',(x,-L/2+1.5+row*1.22,1.36),(.55,.52,.65),wood,.07)
            for z,ma in [(1.28,yellow),(1.16,blue),(1.03,red)] if police else [(1.27,yellow)]:
                a.box('Side_route_stripe',(side*(W/2+.03),0,z),(.025,L-.18,.10),ma,.004)
        a.box('Front_grille',(0,L/2+.045,.93),(W*.57,.06,.42),dark,.045)
        for z in [.80,.91,1.02]:a.box('Grille_bar',(0,L/2+.082,z),(W*.55,.02,.022),chrome,.004)
        for s in [-1,1]:
            for x in [W*.35,W*.43]:a.ellipsoid('Bus_headlight',(s*x,L/2+.06,.82),(.075,.025,.075),lamp,16,8)
            a.box('Rear_lamp',(s*W*.41,-L/2-.045,1.02),(.10,.035,.28),tail,.025)
            a.line('Mirror_arm',[(s*W*.48,L/2-.15,2.80),(s*W*.64,L/2+.16,2.82),(s*W*.64,L/2+.16,2.42)],.025,dark)
            a.box('Bus_mirror',(s*W*.64,L/2+.17,2.44),(.13,.08,.33),dark,.035)
        a.box('Route_display',(0,L/2+.035,H-.44),(W*.80,.035,.25),dark,.02)
        # Original route lettering, no transport agency crest or manufacturer mark.
        bpy.ops.object.text_add(location=(0,L/2+.06,H-.44));t=bpy.context.object;t.name='Route_lettering';t.data.body='POLICE TRANSPORT' if police else 'FC ROAD - KOTHRUD' if style=='city' else 'PUNE - STATE EXPRESS';t.data.align_x='CENTER';t.data.align_y='CENTER';t.data.size=.105;t.rotation_euler=(math.pi/2,0,math.pi);t.data.materials.append(white);bpy.ops.object.convert(target='MESH')
        if style=='state':
            for s in [-1,1]:a.line('Roof_luggage_rail',[(s*.93,-L*.37,H+.05),(s*.93,L*.37,H+.05)],.035,chrome)
        # Four independently spinning wheel pivots, actual wheelbase for each bus.
        for side in [-1,1]:
            for i,y in enumerate([-L*.31,L*.29]):
                p=bpy.data.objects.new(f'wheel_{side}_{i}',None);bpy.context.collection.objects.link(p);p.location=(side*(W*.48),y,.50)
                bpy.ops.mesh.primitive_torus_add(major_radius=.39,minor_radius=.12,major_segments=32,minor_segments=10,rotation=(0,math.pi/2,0));o=bpy.context.object;o.name='Bus_tire';o.data.materials.append(dark);o.parent=p
                o=a.tube('Bus_rim',(-.13,0,0),(.13,0,0),.29,.29,chrome,32);o.parent=p
                for k in range(8):
                    angle=k*math.tau/8;o=a.ellipsoid('Rim_hole',(side*.135,.20*math.sin(angle),.20*math.cos(angle)),(.008,.038,.038),dark,12,6);o.parent=p
    else:
        for side in [-1,1]:
            for z,ma in [(1.07,yellow),(.98,blue),(.89,red)]:a.box('Police_side_band',(side*(W/2+.016),0,z),(.025,L*.86,.07),ma,.004)
            # A plain public-service label; actors/crests/logos are not copied.
            bpy.ops.object.text_add(location=(side*(W/2+.033),-.08,.70));t=bpy.context.object;t.name='Police_lettering';t.data.body='POLICE';t.data.size=.15;t.data.align_x='CENTER';t.data.align_y='CENTER';t.rotation_euler=(math.pi/2,0,side*math.pi/2);t.data.materials.append(blue);bpy.ops.object.convert(target='MESH')
    if police:
        for side,ma in [(-1,red),(1,blue)]:
            p=bpy.data.objects.new('Beacon_mount',None);bpy.context.collection.objects.link(p)
            o=a.box('beacon_red' if side<0 else 'beacon_blue',(side*.28,.35,H+.09),(.42,.23,.14),ma,.025);o.parent=p
    pivots=[o for o in bpy.context.scene.objects if o.type=='EMPTY']
    a.save_native(name);a.consolidate(exclude=pivots);a.save_export(name,'vehicle',[W,H,L])

for item in SPECS:transport(item)
(a.OUT/'transport-manifest.json').write_text(json.dumps(dict(version=1,license='CC0-1.0',author='GTPUNE contributors',generator='scripts/build-pune-transport.py',reference='Original interpretations of user supplied bus and police vehicle photographs. Unseen geometry and dimensions inferred; no copied pixels, watermarks, crests or manufacturer logos.',assets=a.REPORT),indent=2)+'\n')
if '--render' in sys.argv:
    # Group by large bus and SUV scales to keep each silhouette inspectable.
    for items,prefix in [(SPECS[:4],'buses'),(SPECS[4:],'police-vehicles')]:
        a.reset();floor=a.mat('Studio_floor',(.25,.27,.29),.9);a.box('Floor',(0,0,-.12),(70,40,.1),floor,0)
        for i,item in enumerate(items):
            before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(a.OUT/(item[0]+'.glb')))
            group=bpy.data.objects.new(item[0],None);bpy.context.collection.objects.link(group)
            for o in list(bpy.data.objects):
                if o not in before and o!=group and o.parent is None:o.parent=group
            group.location=((i-(len(items)-1)/2)*7,0,0)
        a.setup_camera((18,22,16),(0,0,1),1500,900);bpy.context.scene.camera.data.ortho_scale=35 if len(items)>2 else 18
        bpy.context.scene.render.filepath=str(a.SOURCE/(prefix+'-preview.png'));bpy.ops.render.render(write_still=True)
print('PUNE_TRANSPORT_COMPLETE',len(a.REPORT))
