"""Read-only native reopen/deformation validation in a fresh Blender process."""
import bpy, json, math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
assets=[]
for filename in ['manifest.json','houses-manifest.json','transport-manifest.json','wardrobe-manifest.json']:
    assets.extend(json.loads((root/'public/assets/pune-originals'/filename).read_text())['assets'])
report=[]
for asset in assets:
    bpy.ops.wm.open_mainfile(filepath=str(root/asset['source']))
    objects=list(bpy.context.scene.objects)
    meshes=[o for o in objects if o.type=='MESH']
    assert all(math.isfinite(c) for o in meshes for v in o.data.vertices for c in v.co)
    if asset['kind']=='vehicle':
        assert len([o for o in objects if o.name.startswith('wheel_')])==4
        assert bpy.data.objects.get('Crowned_body_with_arches') or bpy.data.objects.get('Lower_bus_body')
        assert len(meshes)>30  # Semantic panels survive in the editable source.
    elif asset['kind']=='building':
        assert len(meshes)>25
    else:
        rig=next(o for o in objects if o.type=='ARMATURE')
        assert len(rig.data.bones)==15
        assert sorted(a.name for a in bpy.data.actions)==sorted(asset['animations'])
        assert len(meshes)>30
        assert all(any(m.type=='ARMATURE' for m in o.modifiers) for o in meshes)
        # Compare actual evaluated vertex locations with an attack applied.
        rig.animation_data.action=bpy.data.actions['Punch_Right']
        deps=bpy.context.evaluated_depsgraph_get()
        hand=next(o for o in meshes if o.name.startswith('Palm_R'))
        def centroid(frame):
            bpy.context.scene.frame_set(frame);deps.update()
            evaluated=hand.evaluated_get(deps);m=evaluated.to_mesh()
            values=[hand.matrix_world@v.co for v in m.vertices]
            center=tuple(sum(p[i] for p in values)/len(values) for i in range(3))
            evaluated.to_mesh_clear();return center
        start,end=centroid(1),centroid(9)
        displacement=math.dist(start,end)
        assert displacement>.12,(asset['id'],displacement)
    report.append(dict(id=asset['id'],reopened=True,editableMeshParts=len(meshes)))
print('PUNE_NATIVE_VALIDATION',json.dumps(report))
