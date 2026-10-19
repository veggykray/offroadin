#!/usr/bin/env python3
"""Rebuild the V3.1 documents, SVG/PNG maps and offline atlas from local JSON.
Requires Python 3, Pillow and CairoSVG. No older release or external service is used.
"""
from pathlib import Path
import pathlib, json, textwrap, html, math, hashlib
from xml.sax.saxutils import escape
import cairosvg
from PIL import Image, ImageFont
ROOT = Path(__file__).resolve().parent
n=json.loads((ROOT/'chapter_one_canonical_v3_1.json').read_text(encoding='utf-8'))
flags=n['flags']; circuits=n['circuits']; puzzles=n['puzzles']
(ROOT/'puzzle_sequences_v3_1.json').write_text(json.dumps(puzzles,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
# Reference docs — derived from canonical data instead of independent contradictory copies.
def wrap(s,indent='    ',width=93):
 return '\n'.join(textwrap.wrap(str(s),width=width,initial_indent=indent,subsequent_indent=indent,break_long_words=False))

h='''THE ELSEWHERE — CHAPTER ONE: THE RIVERS ABOVE\nVERSION 3.1 · DOCUMENTATION AND DIAGRAM CORRECTIONS (NOT YET A CODEX IMPLEMENTATION PROMPT)\n\nStatus: revised pre-production specification. Locations and transport are schematic; vertical links and stage logic have been checked, but in-engine fluid/AI playtests remain essential.\nTarget: 60–90 minutes first-time play, ~78 minutes central route including 3-minute portal opening, plus optional content.\nCamera and controls: touch-first isometric game, landscape mobile and desktop tap/click.\nParty: physically natural black shaggy large dog, real-looking black-and-white cat; White = small scared pale companion, non-playable.\nCore: distinct floors, moving liquids, different roles in an inhabited world, stealth consequences and recovery falls.\n'''
world=[h,'\nPART ONE — THE FOUR-FLOOR WORLD ATLAS\n',
 'The map coordinate grid repeats on every floor: (0,0) northwest, (2,2) southeast. Coordinates are SCHEMATIC island centroids; each island contains internal routes and subplatforms. Same X,Y across floors denotes vertical alignment. Sloping/moving transport explicitly identified.\n']
for floor,label in [(0,'THE VERGE'),(1,'CANAL SETTLEMENTS'),(2,'WORKING HEIGHTS'),(3,'UPPER REACHES')]:
 world.append('\n'+'='*68+f'\nFLOOR {floor} — {label}\n'+'='*68+'\n')
 for nid,node in n['nodes'].items():
  if node['floor']!=floor:continue
  world.extend([f'\n{nid} — {node["name"]} (grid {tuple(node["grid_xy"])})\n',wrap(node['kind'],''), '\n', '  World: '+node['visual']+'\n','  Residents: '+node['inhabitants']+'\n','  Play: '+node['interaction']+'\n'])
world.append('\nPART TWO — ALL ROUTES (E=horizontal/within-floor, V=vertical/ferry)\n')
for e in n['edges']:
 world.append(f'{e["id"]}: {e["from_"]} {"<->" if e["direction"]=="two-way" else "->"} {e["to"]} | {e["kind"]} | {e["who"]} | prerequisite {e["gate"]}\n')
 world.append(wrap(e['notes'])+'\n')
world.append('\nPART THREE — SAFE FALLS (all one way)\n')
for f in n['falls']:world.append(f'{f["id"]}: {f["from_"]} -> {f["to"]} | earliest {f["gate"]} | {f["notes"]}\n')
world.append('\nPART FOUR — WORLD MATERIALS AND INHABITANTS\n')
world.append('Common physical substances: modular pitted cellular basalt, milky porcelain, flexible glass reeds, copper rims, glowing cyan/magenta/amber liquids. Functional houses, fisheries, schools, workshops, baths and civic buildings SHOULD NOT be interchangeable ruined towers.\n')
world.append('Visual contract: '+n['visual_contract']+'\n')
for k,v in n['glossary'].items():world.append(f'{k}: {v}\n')
world.append('\nGEOGRAPHIC CONSISTENCY: all true lifts (V02 V03 V06 V08) have aligned shaft centroids; V04 is a marked descending gutter, V05 and V07 are mobile transports, E33 is a short local rise. F01 F02 F03 F04 align exactly; F05 is a deliberate offset fenced chute. No silent slanted vertical waterfalls.\n')
(ROOT/'01_WORLD_ATLAS_v3_1.txt').write_text(''.join(world))

walk=[h,'\nSTORY PROMISE\nIn a quiet ordinary garden, frightened White bursts through a tear and flees back; dog chases and cat follows out of curiosity. The portal closes. The animals learn to protect White despite understanding nothing about his people. The gate above might return them home. Over one inhabited vertical chapter they discover that the world is functioning, prejudices are inconsistent, and help can arrive from unlikely residents. White initially refuses the first loud magenta lift, but enters the last one voluntarily when the animals have earned his trust. Mystery of why Collectors seek White continues in later chapters.\n\n',f'CORE TIMING: {sum(p["minutes"] for p in puzzles)} minutes including the opening. Optional secrets +5 to +12 minutes, first-time pace intended 60–90 minutes; playtest will override estimates.\n']
for p in puzzles:
 walk.append('\n'+'='*70+f'\n{p["id"]} — {p["title"].upper()} ({p["minutes"]} MIN TARGET)\n'+'='*70+'\n')
 walk.append('Location chain: '+' -> '.join(p['islands'])+'\n')
 walk.append('Start: '+p['opening_state']+'\n')
 walk.append('Primary challenge: '+p['primary_challenge']+'\n')
 walk.append('\nORDERED INTERACTIONS (these are the SINGLE canonical solution definitions):\n')
 for i,s in enumerate(p['ordered_solution'],1):walk.append(wrap(f'{i}. {s}',indent='  ')+'\n')
 walk.append('Progress flags in order: '+', '.join(p['awards'])+'\n')
 walk.append('Recovery: '+p['failure_recovery']+'\n')
 walk.append('\nUNIQUE MASTERY OBJECTIVES:\n')
 for s in p['mastery']:walk.append('  - '+s+'\n')
walk.append('\nOPTIONAL SIDE ROUTES\n')
for s in n['optional']:walk.append(f'{s["id"]} {s["name"]} @ {s["node"]}: {s["mechanic"]} Reward: {s["reward"]}. Available: {s["available"]}.\n')
walk.append('\nENDING NOTE: White does not give a speech; his willingness to enter the final lift mirrors his refusal in P2. The portal briefly resembles home and then changes; emotional payoff without removing the mystery.\n')
(ROOT/'02_CHAPTER_WALKTHROUGH_v3_1.txt').write_text(''.join(walk))

mech=[h,'\nSYSTEMS CONTRACT AND IMPLEMENTATION SAFETY\n\nPROGRESSION: A mechanism flag (e.g. P1_LATCH_OPEN) opens the route needed to finish that puzzle; a completion flag (P1_RESCUED) is awarded afterward. Completion of EARLIER puzzles may open LATER routes (P6_FAVOUR -> E22/E23/E25; P8_ESCORTED -> V07/V08). Never gate the route needed to EARN a completion flag on that same completion flag.\n\nONE CANONICAL PUZZLE SOURCE: 02_CHAPTER_WALKTHROUGH_v3_1.txt generated from chapter_one_canonical_v3_1.json. Do not copy complete puzzle solutions into this document; use puzzle ids.\n\n']
mech.append('WORLD FLAGS: all are latched achievements or protective reservations unless specifically identified as locally reversible valve states.\n')
for k,v in flags.items():mech.append(f'  {k}: {v}\n')
mech.append('\nLIQUID CIRCUITS\n')
for c in circuits:mech.append(f'{c["id"]} [{c["colour"]}] {c["source"]}->{c["receiver"]}; control {c["control"]}; flag {c["flag"]}. {c["rule"]}\n')
mech.append('\nTRANSPORT GEOMETRY\n')
for k,v in n['transport_geometry'].items():mech.append(f'  {k}: {v}\n')
mech.append('\nCHARACTER, ENEMY, AND TOUCH RULES\n')
for k,v in n['state_rules'].items():mech.append(f'  {k}: {v}\n')
mech.append('\nMOBILE CONTRACT\n')
for k,v in n['controls'].items():mech.append(f'  {k}: {v}\n')
mech.append('''\nFUNCTIONAL LIQUID SEMANTICS\n- Cyan structure: convert supplied flow to solid path only at a dedicated receiver; safety locks retain route after escort.\n- Magenta motion: pressure tier (weak cat, upgraded all), moving mechanisms, and reversing/ascending columns. Visually show incoming and outgoing channels.\n- Amber energy: power gates, lures, horns and ferries. Check-valve in Dye Market isolates permanent reserved P9 source from local conversion preview.\n- Transform/split: local and visibly reversible. Required: convert once to open gate. Optional mastery: use bypass split to preserve kitchen coolant.\n- Rule clarity: never permit a dynamic flow to dry out a necessary return route when the operating control becomes inaccessible.\n\nENEMY CLARITY\nWatchers: lantern staff, small, reactive; Collectors: larger and active White-capturers. Civilian archivists, Flowkeepers and artisans are not enemies. White is unusually feared by most guards, not by every species. Watchers and Collectors do not attack dog or cat gratuitously. Dog can bark as one contextual distraction, nudge or block briefly, but no combat. Cats hide/climb/observe and can lure by interacting with props; no inventory of magical cat powers.\n\nWHITE COMPANION AI\nStates FOLLOW, WAIT_IN_SHELTER, REFUSE_UNSAFE, PANIC_HIDE, FLEE_TO_COVER, CONFINED, REASSURED. Dog defaults as attachment; White does not teleport or instantly cross unsafe floors. He follows cat only when dog is unavailable and safe path is trivial, otherwise waits. After P2 reassurance a confidence memory is stored; at P10 he chooses lift after dog first proves it safe, with no required reassurance tap.\n\nFALL RECOVERY\nF01 1B->0C, regain floor via 0B/0D/V02. F02 2A->1A, return via 1B/1D/V05. F03 2D->1D, return via V05 and market E24. F04 3B->2B, return via V08 (cat) or E23/V07 (dog) as enabled. F05 3D->2D, return via V06/E31/E32. Fall animations safe and readable, optional recovery secret; never generic respawn at another island.\n\nQUALITY GATES BEFORE CODEX BUILDS LEVELS\n1. JSON parse/reference/flags unique; no unreachable gate-to-completion circular dependencies.\n2. Exact actor-specific progression and character separation route traces per each puzzle.\n3. At earliest valid point for each fall, both animals have a path from landing to fall source with current latches.\n4. Permanent amber reserve survives repeated local converter toggling; core routes stay usable.\n5. Model White escort as same-path dog + fear condition; capture/rescue annex access from both positions.\n6. Test all user-reversible valve modes in small design-critical components; runtime exhaustive model needed for full AI+flow simulation.\n7. Check tap target >= 48 CSS pixels in 780x360 and 932x430 landscape; pinch/pan and split-camera focus.\n8. Verify gameplay from actual 3D greybox and cross-check lengths; the topological validation here is not evidence that guard AI, runtime collision or lighting works.\n9. Unit-test node/edge/circuit identifiers and maintain one canonical source for all docs and maps.\n10. Test low-end mobile power savings, high contrast mode, animal silhouettes and sustained frame rate.\n''')
(ROOT/'03_MECHANICAL_BLUEPRINT_v3_1.txt').write_text(''.join(mech))


# The SVG exported to PNG is also embedded unchanged in the interactive atlas.
# Route coordinates and labels have one layout definition, not two renderers.
COL={'bg':'#171C2E','panel':'#242B41','muted':'#AFBCD2','ink':'#F5F3FA','line':'#B7C9D6','cat':'#CFB3F5','cyan':'#70D9E6','pink':'#F593D3','amber':'#EFC58D','fall':'#F29E96'}
FT={0:'The Verge',1:'Canal Settlements',2:'Working Heights',3:'Upper Reaches'}
W,H=1460,1050
NW,NH=300,132
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONTB='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
if not Path(FONT).exists():
    import subprocess
    FONT=subprocess.check_output(['fc-match','-f','%{file}','DejaVu Sans']).decode()
    FONTB=subprocess.check_output(['fc-match','-f','%{file}','DejaVu Sans:style=Bold']).decode()

def xpos(id):
    a,b=n['nodes'][id]['grid_xy'];return (210+510*a,220+280*b)

def rect(id):
    x,y=xpos(id);return [x-NW/2,y-NH/2,NW,NH]

def ex(s):return escape(str(s))

def txt(x,y,s,size=18,fill=None,weight='normal',anchor='start',cls='',limit=None):
    extra=''
    if limit is not None:
        f=ImageFont.truetype(FONTB if weight=='bold' else FONT,size)
        length=f.getlength(str(s))
        if length>limit:extra=f' textLength="{limit}" lengthAdjust="spacingAndGlyphs"'
    return f'<text class="{cls}" x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{fill or COL["ink"]}"{extra}>{ex(s)}</text>'

def lines(s,width,size=16,weight='normal'):
    f=ImageFont.truetype(FONTB if weight=='bold' else FONT,size)
    out=[];cur=''
    for w in s.split():
        test=(cur+' '+w).strip()
        if cur and f.getlength(test)>width:out.append(cur);cur=w
        else:cur=test
    if cur:out.append(cur)
    return out

def defs():
    return '''<defs><marker id="arrow" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="14" markerHeight="14" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M1 1 L11 6 L1 11 Z" fill="context-stroke"/></marker></defs>'''

# Arrow triangles are drawn explicitly instead of relying on font glyphs or
# context-stroke marker support in PNG exporters.
def arrow_tip(tip,previous,color,size=14):
    dx=tip[0]-previous[0];dy=tip[1]-previous[1];mag=math.hypot(dx,dy)
    ux,uy=dx/mag,dy/mag
    bx,by=tip[0]-size*ux,tip[1]-size*uy
    a=(bx-size*.47*uy,by+size*.47*ux);b=(bx+size*.47*uy,by-size*.47*ux)
    return f'<polygon class="arrowhead" points="{tip[0]},{tip[1]} {a[0]},{a[1]} {b[0]},{b[1]}" fill="{color}"/>'

def route_color(e):
    if e['id'].startswith('F'):return COL['fall']
    if e['who']=='cat':return COL['cat']
    k=e['kind']
    if 'cyan' in k:return COL['cyan']
    if any(s in k for s in ('magenta','upward','upflow')):return COL['pink']
    if any(s in k for s in ('ferry','gondola','amber')):return COL['amber']
    return COL['line']

def symbol(e):return '→' if e['direction']=='one-way' else '↔'

# Explicit perimeter-to-perimeter polylines. No edge starts at a node centre.
LAY={
'E01':([[360,220],[570,220]],[465,220]),
'E02':([[720,286],[720,434]],[823,360]),
'E03':([[870,500],[1080,500],[1230,350],[1230,286]],[1090,547]),
'E04':([[1080,220],[870,220]],[975,220]),
'E11':([[720,434],[720,390],[1230,390],[1230,286]],[810,390]),
'E12':([[570,500],[360,500]],[465,500]),
'E13':([[1080,220],[1000,220],[1000,334],[210,334],[210,434]],[465,334]),
'E14':([[1270,286],[1270,434]],[1370,360]),
'E21':([[720,434],[720,286]],[823,360]),
'E22':([[570,500],[360,500]],[465,500]),
'E23':([[210,434],[210,220],[570,220]],[400,220]),
'E24':([[870,220],[1230,220],[1230,434]],[1020,220]),
'E25':([[210,566],[210,650],[1230,650],[1230,566]],[720,650]),
'E31':([[1080,500],[360,500]],[720,500]),
'E32':([[210,566],[210,780],[570,780]],[400,780]),
'E33':([[870,780],[1080,780]],[975,780]),
'E34':([[360,530],[440,530],[440,630],[1230,630],[1230,714]],[800,630])}
# E31 is defined in canonical order 3A -> 3B; two-way arrows show both directions.
layout_report={'format':'Diagram geometry for independent checks; not game collision geometry','floors':{},'vertical_rows':[]}

def line_parts(e,pts,label_at,prefix=''):
    c=route_color(e);d='M'+' L'.join(f'{x},{y}' for x,y in pts)
    dash=' stroke-dasharray="10 7"' if e['who']=='cat' or e['id'].startswith('F') else ''
    out=[f'<g class="route-group" data-edge="{e["id"]}" data-from="{e["from_"]}" data-to="{e["to"]}" data-direction="{e["direction"]}">',
      f'<path class="route-path" d="{d}" fill="none" stroke="{c}" stroke-width="4" stroke-linejoin="round"{dash}/>']
    out.append(arrow_tip(pts[-1],pts[-2],c))
    if e['direction']=='two-way':out.append(arrow_tip(pts[0],pts[1],c))
    if label_at:
        x,y=label_at
        first=e['id']+(' · CAT' if e['who']=='cat' else '')
        out.extend([f'<g class="route-label"><rect x="{x-85}" y="{y-25}" width="170" height="50" rx="9" fill="{COL["bg"]}" stroke="{c}" stroke-width="1.5"/>',
           txt(x,y-4,first,17,c,'bold','middle',cls='edge-id'),
           txt(x,y+16,f'{e["from_"]} {symbol(e)} {e["to"]}',15,COL['ink'],'normal','middle',cls='endpoint-label'),'</g>'])
    out.append('</g>');return out

def floor_svg(floor):
    out=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="Floor {floor} route map">',defs(),
      f'<rect width="{W}" height="{H}" rx="20" fill="{COL["bg"]}"/>',
      '<g font-family="DejaVu Sans,Arial,sans-serif">',
      txt(56,53,f'FLOOR {floor}  /  {FT[floor].upper()}',30,weight='bold'),
      txt(56,85,'V3.1 · schematic plan coordinates · arrowheads show direction · every line names both endpoints',17,COL['muted'])]
    for a in range(3):
        out.append(txt(210+510*a,122,f'GRID X = {a}',13,COL['muted'],anchor='middle'))
    for y in (220,500,780):
        out.append(f'<line x1="40" x2="1420" y1="{y}" y2="{y}" stroke="#344058" stroke-dasharray="2 10" opacity=".45"/>')
    current=[e for e in n['edges'] if n['nodes'][e['from_']]['floor']==floor and n['nodes'][e['to']]['floor']==floor]
    nr={id:rect(id) for id,v in n['nodes'].items() if v['floor']==floor}
    er={}
    for e in current:
        pts,lp=LAY[e['id']]
        out.extend(line_parts(e,pts,lp))
        er[e['id']]={'from':e['from_'],'to':e['to'],'direction':e['direction'],'points':pts,'label_rect':[lp[0]-85,lp[1]-25,170,50],'arrowheads':2 if e['direction']=='two-way' else 1}
    for id,v in n['nodes'].items():
        if v['floor']!=floor:continue
        x,y=xpos(id);rx,ry,rw,rh=nr[id]
        out.append(f'<g class="island" data-node="{id}" role="button" tabindex="0" aria-label="{ex(id+" "+v["name"])}"><rect class="island-card" x="{rx}" y="{ry}" width="{rw}" height="{rh}" rx="12" stroke="#7181A1" stroke-width="2" fill="{COL["panel"]}"/>')
        out.append(txt(rx+18,ry+26,id,20,COL['pink'],'bold',cls='island-id'))
        out.append(txt(rx+rw-16,ry+25,f'({v["grid_xy"][0]}, {v["grid_xy"][1]})',13,COL['muted'],anchor='end'))
        out.append(txt(rx+18,ry+54,v['name'],20,weight='bold',cls='island-title',limit=rw-36))
        sub=lines(v['kind'],rw-36,14)
        assert len(sub)<=2,(id,sub)
        for i,l in enumerate(sub):out.append(txt(rx+18,ry+79+19*i,l,14,COL['muted'],cls='island-subtitle'))
        out.append(txt(rx+18,ry+119,'Select island for routes and inhabitants',12,COL['muted'],cls='tap-hint'))
        out.append('</g>')
    out.extend([f'<line x1="56" x2="1404" y1="897" y2="897" stroke="#42516D"/>',
      txt(56,930,'READING THIS MAP',16,COL['pink'],'bold'),
      txt(56,959,'Solid = shared route    /    Dashed = cat-only passage    /    Arrows end at the actual destination card',16,COL['muted']),
      txt(56,988,'A line crossing is never an island or a junction. Off-floor transport is listed in the connection diagram and atlas.',16,COL['muted']),
      txt(56,1017,'This is a design schematic, not finished game artwork or metre-level navigation geometry.',14,COL['muted']),'</g></svg>'])
    layout_report['floors'][str(floor)]={'nodes':nr,'routes':er,'width':W,'height':H}
    return ''.join(out)

svgs={}
for f in range(4):
    s=floor_svg(f);svgs[f]=s
    (ROOT/f'FLOOR_{f}_v3_1.svg').write_text(s,encoding='utf-8')
    cairosvg.svg2png(bytestring=s.encode(),write_to=str(ROOT/f'FLOOR_{f}_v3_1.png'))

# Exact-endpoint transfer register: one route per row. This intentionally replaces
# the misleading pseudo-perspective projection. Actual XY positions remain in the
# four unchanged floor plans and in the coordinate tags on each endpoint.
rows=[e for e in n['edges'] if e['id'].startswith('V')]+[next(e for e in n['edges'] if e['id']=='E33')]+n['falls']
RH=148; VH=230+len(rows)*RH+70
vr=[f'<svg xmlns="http://www.w3.org/2000/svg" width="1460" height="{VH}" viewBox="0 0 1460 {VH}" role="img" aria-label="Exact vertical transport and fall endpoints">',f'<rect width="1460" height="{VH}" fill="{COL["bg"]}"/>','<g font-family="DejaVu Sans,Arial,sans-serif">',
 txt(56,57,'VERTICAL TRANSPORT & FALLS',32,weight='bold'),
 txt(56,91,'V3.1 · exact endpoints, one connection per row · not a spatial projection',19,COL['muted']),
 txt(56,124,'Floor tags give height; coordinate tags locate each island on its floor map. Repeated names are the same island.',16,COL['muted']),
 txt(56,157,'Two arrowheads = reversible. One arrowhead = one-way travel. E33 is the final local rise within Floor 3.',16,COL['muted'])]
labels={'V02':'ALIGNED LIFT · weak / strong','V03':'ALIGNED LIFT · cat only','V04':'SLOPING GUTTER · cat only','V05':'TRAVELLING FERRY','V06':'ALIGNED LIFT · whole party','V07':'DIAGONAL GONDOLA','V08':'ALIGNED SERVICE LIFT · cat only','E33':'LOCAL MAGENTA UPFLOW','F01':'STRAIGHT SAFE FALL','F02':'STRAIGHT SAFE FALL','F03':'STRAIGHT SAFE FALL','F04':'STRAIGHT SAFE FALL','F05':'OFFSET SAFETY CHUTE'}
for i,e in enumerate(rows):
    y=241+i*RH;c=route_color(e)
    vr.extend([f'<rect x="40" y="{y-57}" width="1380" height="128" rx="14" fill="{COL["panel"]}"/>',txt(63,y+4,e['id'],21,c,'bold')])
    pts=[[480,y],[990,y]]
    vr.extend(line_parts(e,pts,None))
    vr.append(txt(735,y-24,labels[e['id']],15,c,'bold','middle'))
    vr.append(txt(735,y+25,f'{e["from_"]} {symbol(e)} {e["to"]}',19,weight='bold',anchor='middle'))
    vr.append(txt(735,y+48,f'Gate: {e["gate"]}',12,COL['muted'],anchor='middle',limit=480))
    for nid,left in [(e['from_'],135),(e['to'],990)]:
        v=n['nodes'][nid];rx,ry,rw,rh=left,y-43,345,86
        vr.append(f'<g class="transfer-endpoint" data-route="{e["id"]}" data-node="{nid}"><rect x="{rx}" y="{ry}" width="{rw}" height="{rh}" rx="10" stroke="{c}" stroke-width="1.5" fill="{COL["bg"]}"/>')
        vr.append(txt(rx+15,ry+25,f'{nid}  /  FLOOR {v["floor"]}',17,c,'bold',cls='endpoint-id'))
        vr.append(txt(rx+15,ry+49,v['name'],18,weight='bold',limit=rw-30,cls='endpoint-title'))
        vr.append(txt(rx+15,ry+71,f'Plan position ({v["grid_xy"][0]}, {v["grid_xy"][1]})',13,COL['muted']))
        vr.append('</g>')
    layout_report['vertical_rows'].append({'id':e['id'],'from':e['from_'],'to':e['to'],'direction':e['direction'],'points':pts,'source_rect':[135,y-43,345,86],'target_rect':[990,y-43,345,86],'row_bounds':[40,y-57,1380,128],'arrowheads':2 if e['direction']=='two-way' else 1})
vr.extend([txt(56,VH-47,'Geography is unchanged. Node boxes are separated by route so no line can end on an unrelated island.',16,COL['muted']),'</g></svg>'])
vertical=''.join(vr)
(ROOT/'VERTICAL_ROUTES_v3_1.svg').write_text(vertical,encoding='utf-8')
cairosvg.svg2png(bytestring=vertical.encode(),write_to=str(ROOT/'VERTICAL_ROUTES_v3_1.png'))
(ROOT/'diagram_geometry_v3_1.json').write_text(json.dumps(layout_report,indent=2)+'\n')

# Readable overview: no new drawing implementation.
over=Image.new('RGB',(1460,1050),COL['bg'])
for f in range(4):
    im=Image.open(ROOT/f'FLOOR_{f}_v3_1.png').convert('RGB').resize((730,525),Image.Resampling.LANCZOS)
    over.paste(im,((f%2)*730,(f//2)*525))
over.save(ROOT/'ALL_FLOORS_OVERVIEW_v3_1.png')

# Offline atlas. The four SVG strings below are byte-identical to the map files.
html_template='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>The Elsewhere · Chapter One · V3.1</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#171c2e;color:#f5f3fa;font-family:Arial,sans-serif;line-height:1.5}header{max-width:1600px;margin:auto;padding:22px 24px 8px}h1{font-size:24px;margin:0}header p{margin:6px 0;color:#afbdd2}main{max-width:1600px;margin:auto;padding:16px 24px;display:grid;grid-template-columns:minmax(0,1.65fr) minmax(300px,1fr);gap:20px}section{min-width:0}button{min-height:48px;padding:10px 15px;background:#242b41;border:1px solid #7181a1;border-radius:9px;color:inherit;font:inherit;cursor:pointer}button[aria-pressed=true]{border-color:#f593d3;background:#49364e}button:focus-visible,.island:focus-visible{outline:3px solid #70d9e6;outline-offset:3px}.controls{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.controls button{flex:1}.map-wrap{width:100%;background:#171c2e;border-radius:12px;border:1px solid #42516d}.map-wrap svg{display:block;width:100%;height:auto}.island{cursor:pointer}.island:hover .island-card,.island.selected .island-card{stroke:#f593d3;stroke-width:4}.map-wrap text{pointer-events:none}#details{border:1px solid #42516d;background:#20273b;border-radius:12px;padding:20px;overflow-wrap:anywhere}h2{font-size:22px;margin-top:0}h3{font-size:17px;color:#f593d3;margin:19px 0 7px}.route-card{padding:11px 0;border-bottom:1px solid #42516d}.small{color:#afbdd2;font-size:14px}.badge{display:inline-block;background:#343b51;border-radius:8px;padding:5px 10px;margin-right:6px}.node-selector{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.node-selector button{text-align:left}.full{grid-column:1/-1}#extra{margin:12px 0}#extra:empty{display:none}.register{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.register .route-card{background:#242b41;padding:16px;border:1px solid #42516d;border-radius:10px}.section-intro{color:#afbdd2}.quiet{margin:9px 0 0;color:#afbdd2;font-size:13px}a{color:#70d9e6}
@media(max-width:1050px){main{display:block;padding:12px 16px}header{padding:16px}#details{margin-top:18px}h1{font-size:21px}.register{grid-template-columns:1fr}.map-wrap{margin-top:6px}}
@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
</style></head><body><header><h1>The Elsewhere — The Rivers Above</h1><p>Chapter One · V3.1 documentation repair · core gameplay and geography unchanged.</p></header><main><section><div class="controls" id="floors"></div><div id="map" class="map-wrap"></div><div id="node-selector" class="node-selector" aria-label="Choose an island"></div><p class="quiet">The diagram matches the exported PNG/SVG exactly. The large buttons also select islands on small screens. All route endpoints and prerequisites appear below.</p></section><section id="details" aria-live="polite"></section><section class="full"><div class="controls"><button id="show-transfers">Transport &amp; falls</button><button id="show-puzzles">Chapter sequence</button></div><div id="extra"></div><p class="small">Design-level atlas only. No runtime collision, follower behaviour, fluid simulation or real-device performance has been tested here.</p></section></main>
<script>
const data=__DATA__;
const floorSVG=__SVGS__;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sym=e=>e.direction==='one-way'?'→':'↔';
let floor=0,selected='0A';
function entry(e){return `<div class="route-card" data-entry="${e.id}"><strong>${esc(e.id)} · ${esc(e.from_)} ${sym(e)} ${esc(e.to)}</strong><br>${esc(e.kind)} · ${esc(e.who)}<br><span class="small">Required: ${esc(e.gate)}<br>${esc(e.notes)}</span></div>`}
function details(){let v=data.nodes[selected];$('#details').innerHTML=`<h2>${esc(v.id)} — ${esc(v.name)}</h2><span class="badge">Floor ${v.floor}</span><span class="badge">Grid ${v.grid_xy.join(', ')}</span><h3>World</h3><p>${esc(v.visual)}</p><h3>Inhabitants</h3><p>${esc(v.inhabitants)}</p><h3>Gameplay</h3><p>${esc(v.interaction)}</p><h3>Route endpoints</h3>`+data.edges.filter(e=>e.from_===selected||e.to===selected).map(entry).join('')+'<h3>Falls</h3>'+ (data.falls.filter(e=>e.from_===selected||e.to===selected).map(entry).join('')||'<p class="small">No designated fall endpoint here.</p>')+'<h3>Chapter beats</h3>'+data.puzzles.filter(p=>p.islands.includes(selected)).map(p=>`<div class="route-card"><strong>${esc(p.id)} — ${esc(p.title)}</strong><br><span class="small">${esc(p.primary_challenge)}</span></div>`).join('')}
function choose(id){selected=id;$('#map').querySelectorAll('[data-node]').forEach(el=>el.classList.toggle('selected',el.dataset.node===selected));$('#node-selector').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.select===selected));details()}
function render(){document.querySelectorAll('[data-floor]').forEach(b=>b.setAttribute('aria-pressed',Number(b.dataset.floor)===floor));$('#map').innerHTML=floorSVG[floor];$('#map').querySelectorAll('[data-node]').forEach(el=>{el.onclick=()=>choose(el.dataset.node);el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(el.dataset.node)}}});$('#node-selector').innerHTML=Object.values(data.nodes).filter(v=>v.floor===floor).map(v=>`<button data-select="${v.id}" aria-pressed="false">${esc(v.id)} — ${esc(v.name)}</button>`).join('');$('#node-selector').querySelectorAll('button').forEach(b=>b.onclick=()=>choose(b.dataset.select));choose(selected)}
for(let f=0;f<4;f++){let b=document.createElement('button');b.textContent='Floor '+f;b.dataset.floor=f;b.onclick=()=>{floor=f;selected=Object.values(data.nodes).find(v=>v.floor===f).id;render()};$('#floors').appendChild(b)}
$('#show-transfers').onclick=()=>{const routes=data.edges.filter(e=>e.id.startsWith('V')||e.id==='E33');$('#extra').innerHTML='<h2>Exact transport endpoints</h2><p class="section-intro">One connection per card. Floor tags specify height; the four floor maps specify position. No perspective projection is used.</p><div class="register">'+routes.map(e=>entry(e).replace('<br>'+esc(e.kind),`<br>Floor ${data.nodes[e.from_].floor} ${sym(e)} Floor ${data.nodes[e.to].floor}<br>`+esc(e.kind))).join('')+'</div><h3>Safe falls — one-way only</h3><div class="register">'+data.falls.map(entry).join('')+'</div>'};
$('#show-puzzles').onclick=()=>{$('#extra').innerHTML='<h2>Chapter sequence</h2>'+data.puzzles.map(p=>`<div class="route-card"><strong>${esc(p.id)} — ${esc(p.title)}</strong> · ${p.minutes} minute design estimate<br>${esc(p.primary_challenge)}</div>`).join('')};
render();
</script></body></html>'''
payload=json.dumps(n,ensure_ascii=False).replace('</','<\\/')
svgpayload=json.dumps(svgs,ensure_ascii=False).replace('</','<\\/')
atlas=html_template.replace('__DATA__',payload).replace('__SVGS__',svgpayload)
(ROOT/'00_INTERACTIVE_ATLAS_v3_1.html').write_text(atlas,encoding='utf-8')

readme='''THE ELSEWHERE — CHAPTER ONE — V3.1
DOCUMENTATION & DIAGRAM REPAIR / GAME DESIGN FROZEN

This package supersedes V3. The island coordinates, route endpoints, route gates,
actor restrictions, fall destinations, puzzle order and 78-minute design estimate
are unchanged. This is not a new expansion or a new mechanics pass.

START HERE
  00_INTERACTIVE_ATLAS_v3_1.html — offline, self-contained island and route atlas.
  VERTICAL_ROUTES_v3_1.png — explicit source/destination diagrams, one per route.
  FLOOR_0_v3_1.png ... FLOOR_3_v3_1.png — corrected labelled floor maps.
  ALL_FLOORS_OVERVIEW_v3_1.png — compact overview, not the full reading resolution.
  01_WORLD_ATLAS_v3_1.txt — islands, route definitions and inhabitants.
  02_CHAPTER_WALKTHROUGH_v3_1.txt — puzzle solutions and optional objectives.
  03_MECHANICAL_BLUEPRINT_v3_1.txt — rules, circuits, state and mobile requirements.
  05_CORRECTIONS_v3_1.txt — issue-by-issue repair record and scope.
  06_QA_REPORT_v3_1.txt — checks run on THIS package and their limitations.

REBUILD / VERIFY (Python 3)
  python rebuild_v3_1.py
  python validate_design_v3_1.py
  python validate_diagrams_v3_1.py
  python test_atlas_browser_v3_1.py

Rebuild uses only the corrected canonical JSON beside the script; it does not
load V1 or V2 files. Rebuild dependencies: Pillow and CairoSVG. Diagram tests
also use Shapely. Browser tests use Playwright and an installed Chromium.
No external website or font download is used by the atlas.

CANONICAL SOURCE
  chapter_one_canonical_v3_1.json
  puzzle_sequences_v3_1.json is a generated view, not another editable authority.
  SVG files are shared by the PNG exporter and the interactive atlas.
  diagram_geometry_v3_1.json exposes line/label/card geometry for inspection.

STATUS
Static design and rendered-diagram checks are not an exhaustive gameplay proof.
P1–P4 still need a greybox playtest; exact navigation geometry, guardian behaviour,
White's following and fear states, dynamic liquids and mobile performance remain
runtime work. No new core mechanics are requested in this correction.
'''
(ROOT/'README_START_HERE_v3_1.txt').write_text(readme,encoding='utf-8')
print('Rebuilt documents, five diagrams, overview and offline atlas from corrected JSON.')
