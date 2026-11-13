"""Original Pune-inspired residential shells. No source photo pixels or logos.
blender -b --python-exit-code 1 --python scripts/build-pune-houses.py -- --render
"""
import bpy, math, json, importlib.util, sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('pune_author',Path(__file__).with_name('build-blender-assets.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
HOUSE_SPECS=[
    ('timber-wada','timber',9,9,11.5),('green-wada','green',8,9,10.5),
    ('ornate-wada','ornate',9,9,12),('courtyard-wada','courtyard',13,13,10),
    ('basalt-blue-house','stone',7,8,7.6),('tiled-bungalow','tile',8,10,8.5),
    ('garden-bungalow','garden',9,11,7.2),('modern-villa','modern',9,11,8.6),
    ('brick-villa','brick',8,10,10.5),('weathered-house','weathered',7,8,7.4),
]

def house(item):
    name,style,W,D,H=item;a.reset()
    plaster=a.mat('Lime_plaster',(.72,.62,.43) if style in ('timber','tile') else (.68,.77,.49) if style=='green' else (.94,.82,.32) if style=='ornate' else (.63,.26,.20) if style=='courtyard' else (.85,.70,.58) if style=='garden' else (.89,.87,.80),.94)
    wood=a.mat('Timber',(.28,.17,.10),.85)
    blue=a.mat('Painted_joinery',(.13,.42,.62) if style in ('stone','weathered') else (.43,.62,.47) if style=='green' else (.72,.29,.14) if style=='ornate' else (.49,.30,.15),.8)
    stone=a.mat('Basalt',(.32,.34,.32),.97)
    trim=a.mat('Trim',(.89,.84,.70),.86)
    roof=a.mat('Roof_tiles',(.43,.25,.16),.93)
    glass=a.mat('Recessed_glazing',(.15,.22,.23),.3,.18)
    green=a.mat('Foliage',(.23,.40,.13),.95)
    brick=a.mat('Ochre_brick',(.73,.47,.22),.96)
    ground=a.mat('Stone_paving',(.48,.46,.40),.97)
    F=-D/2;back=D/2;floors=3 if style in ('timber','green','ornate','brick') else 2
    walltop=H-1.3 if style in ('timber','tile','stone','courtyard') else H-.45
    storey=walltop/floors
    a.box('Foundation',(0,0,.17),(W,D,.34),stone,.015)
    def panel(label,x,y,z,w,h,ma=plaster,d=.16):return a.box(label,(x,y,z),(w,d,h),ma,.012)
    def window(x,z,w=1.05,h=1.5,y=F-.025,shutters=True):
        panel('Window_recess',x,y,z,w,h,wood,.18)
        panel('Window_glass',x,y-.10,z,w-.16,h-.15,glass,.022)
        for xx in [x-w/2,x+w/2]:panel('Window_frame',xx,y-.13,z,.07,h+.12,blue,.08)
        for zz in [z-h/2,z+h/2]:panel('Window_frame',x,y-.13,zz,w+.13,.07,blue,.08)
        if shutters:
            for xx in [x-w*.27,x+w*.27]:
                panel('Wood_shutter',xx,y-.16,z,w*.40,h-.14,blue,.06)
                for dz in [-h*.27,h*.27]:panel('Shutter_raised_panel',xx,y-.20,z+dz,w*.29,h*.31,wood,.025)
        else:
            for dx in [-w*.24,0,w*.24]:panel('Glazing_mullion',x+dx,y-.13,z,.028,h-.1,trim,.04)
    def rail(y,z,width,height=.85,material=wood,x=0,jali=False):
        for dz in [0,height]:a.box('Balcony_rail',(x,y,z+dz),(width,.075,.07),material,.008)
        n=max(3,int(width/.22))
        for k in range(n+1):
            xx=x-width/2+width*k/n
            a.box('Turned_baluster',(xx,y,z+height/2),(.035,.045,height),material,.007)
            if jali and k<n:
                a.line('Jali_diamond',[(xx,y,z+.12),(xx+.11,y,z+.43),(xx,y,z+.72),(xx-.11,y,z+.43)],.012,trim,True)
    def tiled_roof(y0,y1,width,ridge,base):
        v=[(-width/2,y0,base),(width/2,y0,base),(0,y0,ridge),(-width/2,y1,base),(width/2,y1,base),(0,y1,ridge)]
        r=a.mesh('Mangalore_tiled_roof',v,[(0,3,5,2),(2,5,4,1),(0,2,1),(3,4,5)],roof,False)
        for y in [y0,y1]:a.line('Roof_fascia',[(-width/2,y,base),(0,y,ridge),(width/2,y,base)],.08,wood)
        for k in range(int((y1-y0)/.28)+1):
            y=y0+k*.28
            a.line('Tile_courses',[(-width/2,y,base+.025),(0,y,ridge+.025),(width/2,y,base+.025)],.027,roof)
    if style=='courtyard':
        court=W*.38
        inner=W/2-court
        for s in [-1,1]:a.box('Courtyard_wing',(s*(W/2-court/2),0,walltop/2),(court,D,walltop),plaster,.02)
        a.box('Back_wing',(0,back-D*.14,walltop/2),(W,D*.28,walltop),plaster,.02)
        for s in [-1,1]:
            for k in range(5):a.box('Inner_veranda_post',(s*(inner-.20),F+.5+k*(D-.9)/4,walltop/2),(.15,.15,walltop),wood,.015)
            for z in [storey,walltop-.25]:a.box('Courtyard_gallery',(s*(inner-.34),0,z),(.68,D,.18),wood,.01)
            for level in range(floors):
                for k in range(4):
                    y=F+1.2+k*(D-2.8)/4;z=level*storey+1.7
                    o=a.box('Courtyard_door_recess',(s*(inner-.03),y,z),(.10,1.1,2.15),wood,.02)
                    for yy in [y-.61,y+.61]:a.box('Lime_arch_jamb',(s*(inner-.10),yy,z),(.12,.09,2.35),trim,.01)
                    a.line('Cusped_arch',[(s*(inner-.13),y-.62,z+.86),(s*(inner-.13),y-.40,z+1.10),(s*(inner-.13),y,z+1.35),(s*(inner-.13),y+.40,z+1.10),(s*(inner-.13),y+.62,z+.86)],.05,trim)
            for k in range(3):window(-1.0+k,storey+1.6,.70,1.7,back-D*.28-.08,False)
        a.box('Courtyard_paving',(0,0,.23),(W*.36,D,.08),ground,.01)
        for side in [-1,1]:tiled_roof(F-.15,back+.15,W*.37,H,walltop)
        # Move the two independent roof halves over the corresponding wings.
        roof_objects=[o for o in bpy.context.scene.objects if o.name.startswith(('Mangalore','Roof_fascia','Tile_courses'))]
        for i,o in enumerate(roof_objects):o.location.x+=(-1 if i<len(roof_objects)/2 else 1)*W*.315
    else:
        # Modern houses have an open ground-floor porch; heritage has a deep gallery.
        modern=style in ('modern','garden','brick')
        mainD=D-1.0 if not modern else D-2.3
        a.box('Main_house_shell',(0,(D-mainD)/2,walltop/2),(W-.25,mainD,walltop),plaster,.025)
        frontwall=F+(D-mainD)
        if modern:
            a.box('Porch_slab',(0,F+1.15,storey),(W-.15,2.3,.22),plaster,.025)
            for x in [-W*.44,W*.44]:a.box('Porch_column',(x,F+.3,storey/2),(.24,.24,storey),plaster,.02)
            rail(F+.05,storey+.17,W-.5,.8,brick if style=='garden' else trim)
            for level in range(floors):
                for x in [-W*.27,W*.27]:window(x,(level+.52)*storey,1.75,1.7,frontwall-.03,False)
        else:
            for level in range(floors):
                z=level*storey
                a.box('Gallery_floor',(0,F+.45,z+.22),(W,1.1,.22),wood,.015)
                for k in range(5):
                    x=-W*.46+k*W*.23
                    a.box('Timber_post',(x,F+.03,z+storey/2),(.16,.16,storey),wood if style!='ornate' else blue,.015)
                    # Brackets meet the balcony beam instead of floating decorations.
                    for s in [-1,1]:a.line('Carved_bracket',[(x,F,z+storey-.8),(x+s*.36,F,z+storey-.20)],.045,wood)
                if level>0:rail(F-.05,z+.27,W-.4,.9,blue if style in ('green','ornate') else wood,jali=style in ('ornate','timber','green'))
                for x in [-W*.30,0,W*.30]:window(x,z+storey*.53,1.12,min(1.8,storey*.63),frontwall-.03)
                a.box('Floor_cornice',(0,F-.07,z+storey-.07),(W+.18,.24,.14),blue if style=='ornate' else wood,.02)
        # Main entrance and a plinth with two steps.
        panel('Door_frame',0,frontwall-.13,1.28,1.40,2.30,wood,.20)
        panel('Front_door',0,frontwall-.25,1.23,1.14,2.13,blue,.05)
        for x in [-.28,.28]:
            for z in [.57,1.15,1.75]:panel('Door_carved_panel',x,frontwall-.29,z,.42,.43,wood,.025)
        for step in range(2):a.box('Entrance_step',(0,F-.15+step*.28,.07+step*.08),(1.9,.7-step*.18,.14+step*.16),ground,.008)
        if style in ('timber','tile','stone'):
            tiled_roof(F-.30,back+.25,W+.5,H,walltop-.12)
            if style=='timber':
                for x in [-W*.27,W*.27]:
                    a.mesh('Dormer_gable',[(x-.85,F-.13,walltop-.05),(x+.85,F-.13,walltop-.05),(x,F-.13,H+.12)],[(0,1,2)],wood,False)
                    window(x,walltop+.35,.65,.75,F-.2,False)
        else:
            a.box('Flat_roof_slab',(0,0,walltop+.07),(W+.24,D+.20,.20),plaster,.02)
            rail(F-.08,walltop+.16,W,.30,trim)
        if style=='modern':
            for x in [-W*.42,W*.42]:a.box('Canopy_upright',(x,0,H-.45),(.12,.12,1.4),wood,.01)
            a.box('Solar_shade_canopy',(0,0,H),(W+.4,D*.82,.11),trim,.015)
            for k in range(12):a.box('Canopy_louver',(-W*.46+k*W*.084,0,H+.08),(.055,D*.84,.045),wood,.005)
            for x in [-W*.48,W*.48]:a.box('White_vertical_blade',(x,F+.7,H*.56),(.36,1.4,H*.8),plaster,.025)
        if style=='brick':
            # Stepped rounded brick screen around white recessed window bays.
            for row in range(int(H/.23)):
                z=.3+row*.23
                for col in range(int(W/.40)):
                    x=-W/2+.2+col*.4+(row%2)*.20
                    if abs(x)<W*.24 and ((1.6<z<3.1) or (6.0<z<7.5)):continue
                    if x>W*.28 and 3.5<z<5.6:continue
                    a.box('Brick_screen',(x,F-.15,z),(.375,.19,.20),brick,0)
        if style in ('stone','tile'):
            # Basalt wall with original staggered coursing, including side returns.
            for row in range(int(min(3.2,walltop)/.34)):
                for col in range(int(W/.65)):
                    x=-W/2+.32+col*.65+(row%2)*.20
                    if abs(x)<.85:continue
                    a.box('Basalt_block',(x,frontwall-.03,.3+row*.34),(.60,.13,.29),stone,0)
            if style=='stone':
                rail(F-.15,storey+.16,W*.56,.85,blue,jali=True)
                for x in [-W*.30,W*.30]:window(x,storey+1.45,1.08,1.6,frontwall-.18)
        if style=='weathered':
            # Original geometry patches express damaged limewash; no photo clippings.
            for i in range(45):
                x=math.sin(i*12.7)*W*.45;z=.4+(i*.83)%(walltop-.7)
                if abs(x)<.8 and z<2.6:continue
                panel('Weathered_plaster_patch',x,frontwall-.14,z,.18+(i%4)*.11,.13+(i%3)*.13,stone,.012)
        # Pots and shrubs stay inside the plot envelope.
        for x in [-W*.40,W*.40]:
            a.tube('Terracotta_pot',(x,F+.45,.2),(x,F+.45,.56),.23,.31,roof,16)
            a.ellipsoid('Shrub',(x,F+.45,.84),(.40,.35,.42),green,12,8)
    if style=='ornate':
        for x in [-W*.28,W*.28]:a.mesh('Ornate_gable',[(x-.9,F-.15,H-.25),(x+.9,F-.15,H-.25),(x,F-.15,H+.70)],[(0,1,2)],blue,False)
    a.save_native(name);a.consolidate();a.save_export(name,'building',[W,H,D])

def previews():
    a.reset();floor=a.mat('Neutral_ground',(.30,.31,.30),.98)
    a.box('Ground',(0,0,-.22),(80,60,.2),floor,0)
    for i,item in enumerate(HOUSE_SPECS):
        before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(a.OUT/(item[0]+'.glb')))
        group=bpy.data.objects.new(item[0],None);bpy.context.collection.objects.link(group)
        for o in list(bpy.data.objects):
            if o not in before and o!=group and o.parent is None:o.parent=group
        group.location=((i%5-2)*15,(i//5)*18-9,0)
    a.setup_camera((48,-64,43),(0,0,4),1600,950)
    bpy.ops.object.light_add(type='SUN',rotation=(.45,-.50,-.35));bpy.context.object.data.energy=2.5
    bpy.context.scene.camera.data.ortho_scale=83;bpy.context.scene.cycles.samples=20
    bpy.context.scene.render.filepath=str(a.SOURCE/'houses-preview.png');bpy.ops.render.render(write_still=True)

for item in HOUSE_SPECS:house(item)
(a.OUT/'houses-manifest.json').write_text(json.dumps(dict(version=1,license='CC0-1.0',author='GTPUNE contributors',generator='scripts/build-pune-houses.py',reference='Original interpretations of user supplied Pune residential architecture references; unseen sides and dimensions inferred; no source pixels, watermark, signage or named-location claims.',assets=a.REPORT),indent=2)+'\n')
if '--render' in sys.argv:previews()
print('PUNE_HOUSES_COMPLETE',len(a.REPORT))
