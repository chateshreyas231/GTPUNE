"""Original local wardrobe variants with skinned accessories and six animations."""
import bpy, json, importlib.util, sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('pune_author',Path(__file__).with_name('build-blender-assets.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
CAST=[('traditional-man',False,'traditional'),('nauvari-woman',True,'sari'),('printed-dress',True,'dress'),('casual-jacket',False,'casual-jacket'),('casual-woman',True,'casual-woman'),('construction-worker',False,'worker'),('police-officer',False,'police'),('policewoman',True,'policewoman')]
for name,female,costume in CAST:a.human(name,female=female,costume=costume)
(a.OUT/'wardrobe-manifest.json').write_text(json.dumps(dict(version=1,license='CC0-1.0',author='GTPUNE contributors',generator='scripts/build-pune-wardrobe.py',reference='Original fictional adult characters based on supplied clothing/role references. No actor likenesses, police crests, source photo pixels or watermark textures.',assets=a.REPORT),indent=2)+'\n')
if '--render' in sys.argv:
    a.reset();floor=a.mat('Studio_floor',(.24,.25,.26),.95);a.box('Floor',(0,0,-.08),(16,10,.1),floor,0)
    for i,(name,_,_) in enumerate(CAST):
        before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(a.OUT/(name+'.glb')))
        group=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(group)
        for o in list(bpy.data.objects):
            if o not in before and o!=group and o.parent is None:o.parent=group
        group.location=((i-3.5)*.85,0,0)
    a.setup_camera((1,-9,2.8),(0,0,.90),1600,650);bpy.context.scene.camera.data.ortho_scale=7.2
    bpy.context.scene.render.filepath=str(a.SOURCE/'wardrobe-preview.png');bpy.ops.render.render(write_still=True)
print('PUNE_WARDROBE_COMPLETE',len(a.REPORT))
