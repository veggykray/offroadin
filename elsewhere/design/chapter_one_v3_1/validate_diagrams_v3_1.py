#!/usr/bin/env python3
"""Check drawn endpoints, obstruction, labels and render-source consistency.
These are diagram tests, not game geometry or exhaustive simulation tests.
"""
from pathlib import Path
import json, xml.etree.ElementTree as ET, re
from shapely.geometry import box,Point,LineString
R=Path(__file__).resolve().parent
D=json.loads((R/'chapter_one_canonical_v3_1.json').read_text())
G=json.loads((R/'diagram_geometry_v3_1.json').read_text())
N=D['nodes'];E={e['id']:e for e in D['edges']+D['falls']}
log=[]
def require(x,msg):
 if not x:raise AssertionError(msg)
 log.append(msg)
def polygon(r):x,y,w,h=r;return box(x,y,x+w,y+h)
for floor,g in G['floors'].items():
 nr={k:polygon(r) for k,r in g['nodes'].items()}
 edges=g['routes'];lr={k:polygon(e['label_rect']) for k,e in edges.items()}
 require(set(nr)=={k for k,v in N.items() if v['floor']==int(floor)},f'Floor {floor}: exact island membership')
 require(set(edges)=={k for k,e in E.items() if not k.startswith('F') and N[e['from_']]['floor']==N[e['to']]['floor']==int(floor)},f'Floor {floor}: exact same-floor route membership')
 for a,ra in nr.items():
  for b,rb in nr.items():
   if a<b:require(not ra.intersects(rb),f'Floor {floor}: separate island cards {a}, {b}')
 for k,e in edges.items():
  orig=E[k];ls=LineString(e['points'])
  require((e['from'],e['to'],e['direction'])==(orig['from_'],orig['to'],orig['direction']),f'{k}: drawn identity matches canonical route')
  require(nr[e['from']].boundary.distance(Point(e['points'][0]))<.001,f'{k}: source ends on {e["from"]} card boundary')
  require(nr[e['to']].boundary.distance(Point(e['points'][-1]))<.001,f'{k}: destination ends on {e["to"]} card boundary')
  for node,r in nr.items():
   require(not ls.intersects(r.buffer(-.1)),f'{k}: route never crosses inside {node}')
   require(not lr[k].intersects(r),f'{k}: label does not overlap island {node}')
  for other,r in lr.items():
   if other!=k:
    require(not lr[k].intersects(r),f'{k}: label separate from {other}')
    require(not ls.intersects(r),f'{k}: line does not run through {other} label')
  require(e['arrowheads']==(1 if e['direction']=='one-way' else 2),f'{k}: correct number of explicit arrowheads')
  require(box(0,0,g['width'],g['height']).contains(lr[k]),f'{k}: label fits canvas')
 svg=ET.fromstring((R/f'FLOOR_{floor}_v3_1.svg').read_text())
 drawn={el.attrib['data-edge']:el for el in svg.iter() if 'data-edge' in el.attrib}
 require(set(drawn)==set(edges),f'Floor {floor}: actual SVG has every canonical route once')
 for k,el in drawn.items():
  require(el.attrib['data-from']==E[k]['from_'] and el.attrib['data-to']==E[k]['to'],f'{k}: exported SVG retains exact endpoints')
  labels=[x for x in el.iter() if x.attrib.get('class')=='edge-id']
  require(len(labels)==1 and k in labels[0].text,f'{k}: exported SVG label visible, explicit and unique')
  arrows=[x for x in el.iter() if x.attrib.get('class')=='arrowhead']
  require(len(arrows)==edges[k]['arrowheads'],f'{k}: exported arrow polygons exist')
# Transfer register checks isolate each route, making the v3 wrong-box errors impossible.
seen=set();previous=None
for row in G['vertical_rows']:
 k=row['id'];orig=E[k];seen.add(k)
 require((row['from'],row['to'],row['direction'])==(orig['from_'],orig['to'],orig['direction']),f'{k}: transfer row has canonical endpoints and direction')
 source,target=polygon(row['source_rect']),polygon(row['target_rect'])
 require(not source.intersects(target),f'{k}: transfer endpoint cards separate')
 require(source.boundary.distance(Point(row['points'][0]))<.001 and target.boundary.distance(Point(row['points'][-1]))<.001,f'{k}: transfer line reaches exact endpoint card boundaries')
 rr=polygon(row['row_bounds'])
 require(rr.contains(source) and rr.contains(target),f'{k}: both cards inside route row')
 if previous:require(not previous.intersects(rr),f'{k}: route row does not overlap preceding route')
 previous=rr
require(seen=={e['id'] for e in D['edges'] if e['id'].startswith('V') or e['id']=='E33'}|{f['id'] for f in D['falls']},'Transfer register covers all seven off-floor transfers, the local final rise and five falls')
# The HTML uses the very same exported SVG strings; no second routing algorithm.
h=(R/'00_INTERACTIVE_ATLAS_v3_1.html').read_text()
raw=re.search(r'const floorSVG=(.*?);\nconst \$',h,re.S).group(1)
svgs=json.loads(raw)
for f in range(4):require(svgs[str(f)]==(R/f'FLOOR_{f}_v3_1.svg').read_text(),f'Floor {f}: offline atlas embeds byte-identical exported SVG')
require(json.loads(re.search(r'const data=(.*?);\nconst floorSVG=',h,re.S).group(1))==D,'Atlas embedded data identical to canonical JSON')
require(json.loads((R/'puzzle_sequences_v3_1.json').read_text())==D['puzzles'],'Puzzle-only JSON is the same generated view')
# Reported textual defects have explicit regression checks.
P={p['id']:p for p in D['puzzles']}
require('Watchers' in P['P8']['ordered_solution'][0] and 'Collector' in P['P8']['ordered_solution'][3],'P8 Watchers and supervising Collector named separately')
require('silently aims' in P['P10']['ordered_solution'][1] and 'stays on patrol' in P['P10']['ordered_solution'][1],'P10 aiming causes no earlier diversion')
require('single bark' in P['P10']['ordered_solution'][2],'P10 has one activation bark')
require(not D['sound_sequence']['aim']['emits_sound'] and not D['sound_sequence']['aim']['starts_lift'] and not D['sound_sequence']['aim']['diverts_collector'],'P10 silent aiming state explicit in data')
require(D['sound_sequence']['bark']['diversions_per_successful_activation']==1,'P10 bark yields one successful diversion')
require('no loose glass fragments' in P['P9']['ordered_solution'][0],'P9 no longer asks player to collect unused fragments')
require('no new inter-island route' in next(s for s in D['optional'] if s['id']=='S3')['reward'],'S3 reward explicitly a local rest nook, not an unmapped shortcut')
for file in ['01_WORLD_ATLAS_v3_1.txt','02_CHAPTER_WALKTHROUGH_v3_1.txt','03_MECHANICAL_BLUEPRINT_v3_1.txt']:
 t=(R/file).read_text();require('VERSION 3.1' in t and 'VERSION 2' not in t,f'{file}: correct document version')
require('Guardians' not in (R/'03_MECHANICAL_BLUEPRINT_v3_1.txt').read_text(),'Mechanical blueprint uses defined Watcher/Collector terms')
(R/'diagram_checks_v3_1.txt').write_text('DIAGRAM-SPECIFIC CHECKS\n\n'+'\n'.join('PASS: '+x for x in log)+'\n\nScope: drawn static geometry and file consistency only. Actual text rendering is checked separately in the browser.\n')
print('PASS: endpoint boundaries, line/card/label separation, SVG identity and listed text regressions.')
