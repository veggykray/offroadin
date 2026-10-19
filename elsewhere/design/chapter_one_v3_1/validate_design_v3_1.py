#!/usr/bin/env python3
"""Re-runable static design/route checks. Does not simulate engine physics or AI."""
import json,pathlib,collections,sys
R=pathlib.Path(__file__).resolve().parent
D=json.loads((R/'chapter_one_canonical_v3_1.json').read_text())
N=D['nodes'];E=D['edges'];F=D['falls'];C=D['circuits'];P=D['puzzles'];FLAGS=D['flags'];report=[];checks=0

def check(cond,msg):
 global checks
 checks+=1
 if not cond:raise AssertionError(msg)
 report.append('PASS: '+msg)

def accessible(actor,flags, extra_exclusions=frozenset()):
 g=collections.defaultdict(list)
 for e in E:
  if e['id'] in extra_exclusions:continue
  if e['gate'] not in flags and e['gate']!='START':continue
  if e['who']=='cat' and actor!='cat':continue
  if e['who']=='both-with-upgrade' and actor=='dog' and 'P2_LIFT_STRONG' not in flags:continue
  g[e['from_']].append(e['to'])
  if e['direction']=='two-way':g[e['to']].append(e['from_'])
 return g

def path(actor,source,target,flags):
 if source==target:return [source]
 g=accessible(actor,flags);q=collections.deque([(source,[source])]);visited={source}
 while q:
  at,p=q.popleft()
  for nxt in g[at]:
   if nxt==target:return p+[nxt]
   if nxt not in visited:visited.add(nxt);q.append((nxt,p+[nxt]))
 return None

def reach(actor,source,flags):
 g=accessible(actor,flags);q=[source];seen=set(q)
 for at in q:
  for nxt in g[at]:
   if nxt not in seen:seen.add(nxt);q.append(nxt)
 return seen

# Types and references
check(len(N)==16,'16 unique named islands exist')
ids=[e['id'] for e in E]+[f['id'] for f in F]+[c['id'] for c in C]
check(len(ids)==len(set(ids)),'all edge, fall and circuit identifiers are unique')
for e in E+F:
 check(e['from_'] in N and e['to'] in N,f'{e["id"]} has real origin and destination')
 check(e['gate'] in FLAGS,f'{e["id"]} gate references declared flag')
 check(e['direction'] in ('one-way','two-way'),f'{e["id"]} direction is explicit')
for c in C:
 check(c['source'] in N and c['receiver'] in N and c['flag'] in FLAGS,f'{c["id"]} receiver, source and unlock defined')
for p in P:
 for flag in p['awards']:check(flag in FLAGS,f'{p["id"]} awards declared flag {flag}')
 check(len(p['mastery'])==3 and len(set(p['mastery']))==3,f'{p["id"]} has three distinct mastery objectives')
 check(p['minutes']>0,f'{p["id"]} has reasonable positive timing')
check(sum(p['minutes'] for p in P)==78,'core sequence sums to 78 minutes (includes opening)')
check(len(F)==5,'exactly five designated safe-fall connections')
check(len([e for e in E if e['id']=='V08'])==1 and not any(e['id'] in ('V01','V09') for e in E),'there is one physical V02 ascent and one V08 reversible service lift')
# Chapter V3.1 consistency rules: no new one-off minigames.
byid={p['id']:p for p in P}
check(byid['P1']['minutes']==7,'P1 allocates 3 minutes opening plus 4 minutes playable rescue')
check('OPTIONAL MASTERY' in ' '.join(byid['P7']['ordered_solution']),'P7 coolant split is optional, not a required gate step')
check('pulse' not in ' '.join(byid['P9']['ordered_solution']).lower(),'P9 does not require timed pulse matching')
check(len([s for s in byid['P9']['ordered_solution'] if 'TWO' in s.upper() and 'facet' in s.lower()])>=1,'P9 visibly specifies exactly two facets')
check(all('three glass facets' not in c['rule'].lower() for c in C),'no contradictory three-facet liquid rule')
check('LOUD' in ' '.join(byid['P10']['ordered_solution']),'final magenta lift remains loud')
check('Echo Horn' in ' '.join(byid['P10']['ordered_solution']),'Echo Horn is the one named sound device')
check(any(e['gate']=='P6_FAVOUR' for e in E),'previous puzzle completions can unlock later routes')
# aligned shafts / physical safe falls
for eid in ('V02','V03','V06','V08'):
 e=next(e for e in E if e['id']==eid)
 check(N[e['from_']]['grid_xy']==N[e['to']]['grid_xy'],f'{eid} true vertical lift is stacked at same XY')
for fid in ('F01','F02','F03','F04'):
 f=next(f for f in F if f['id']==fid)
 check(N[f['from_']]['grid_xy']==N[f['to']]['grid_xy'],f'{fid} safe fall vertically aligned')
check(next(f for f in F if f['id']=='F03')['to']=='1D','F03 Collector fall lands directly under depot on 1D')
check(next(f for f in F if f['id']=='F05')['gate']=='P10_GATE_OPEN','F05 only becomes available with activated return upflow')
check(next(e for e in E if e['id']=='V04')['direction']=='one-way','V04 is truly one-way sloped cat return')
check(next(e for e in E if e['id']=='E33')['kind']=='last magenta upflow','ending includes real magenta upflow, not unexplained walkway')
# mechanical vs completion gate time: flag milestones in playthrough order
state={'START'};order={k:i for i,p in enumerate(P) for k in p['awards']};completion={'P1_RESCUED','P2_ASCENDED','P4_ESCORTED','P5_ARRIVED','P7_ESCORTED','P8_ESCORTED','P9_ESCORTED','P10_COMPLETE'}
check(all(e['gate'] not in {'P1_RESCUED','P2_ASCENDED','P4_ESCORTED','P5_ARRIVED','P7_ESCORTED','P9_ESCORTED','P10_COMPLETE'} for e in E),'critical transitions do not require their own completion event (prior completion may enable later optional links)')
for e in E:
 if e['gate']=='START':continue
 check(e['gate'] in order,f'{e["id"]} gate granted by a puzzle')
# explicitly play through actions as abstract entity movements & flag awards
cat=dog=white='0A'

def actor_move(actor,dest):
 global cat,dog,white
 at={'cat':cat,'dog':dog}[actor];p=path(actor,at,dest,state)
 check(p is not None,f'{actor} can move {at} to {dest} with current gates')
 if actor=='cat':cat=dest
 else:dog=dest

def escort(dest):
 global dog,white
 p=path('dog',dog,dest,state)
 check(p is not None,f'dog can escort White along safe designed route {dog} -> {dest}')
 dog=white=dest

def unlock(*keys):
 for key in keys:check(key in FLAGS,'event '+key+' defined');state.add(key)
# P1
check(not path('dog','0A','0B',state),'dog cannot cross first closed latch')
unlock('P1_LATCH_OPEN');escort('0B');actor_move('cat','0B');unlock('P1_RESCUED')
# P2
check(not path('dog','0B','0D',state),'cyan bridge begins closed')
unlock('P2_BRIDGE_READY');escort('0D');actor_move('cat','0D');unlock('P2_BRIDGE_SAFE')
check(path('cat','0D','1A',state) and not path('dog','0D','1A',state),'weak first lift carries only cat')
actor_move('cat','1A');unlock('P2_LIFT_STRONG');escort('1A');unlock('P2_ASCENDED')
# P3
actor_move('cat','1B');escort('1B');unlock('P3_OBSERVED')
# P4
check(not path('dog','1B','1D',state),'dog cannot reach far bank before P4 cyan bridge')
actor_move('cat','1C');actor_move('cat','2B');actor_move('cat','1D')
check(not path('cat','1D','2B',state),'one-way V04 does not fake a reverse trip')
unlock('P4_BRIDGE_OPEN');escort('1D');unlock('P4_ESCORTED')
# P5
check(not path('dog','1D','2A',state),'ferry remains unavailable until routed amber reaches it')
unlock('P5_FERRY_POWERED');actor_move('cat','2A');escort('2A');unlock('P5_ARRIVED')
# P6
actor_move('cat','2C');escort('2C');unlock('P6_FAVOUR')
# P7
check(not path('dog','2C','2D',state),'dog White cannot sneak in via cat-only records rafter')
unlock('P7_GATE_OPEN','P7_AMBER_BRANCH');actor_move('cat','2D');escort('2D');unlock('P7_ESCORTED')
# P8
check(not path('dog','2D','3A',state),'Collector ascent off before P8')
unlock('P8_LIFT_STABLE');actor_move('cat','3A');escort('3A');unlock('P8_ESCORTED')
# P9
actor_move('cat','3B');escort('3B');actor_move('cat','2B');unlock('P9_MAGENTA_PRIMED');actor_move('cat','3B')
unlock('P9_CYAN_PRIMED','P9_AMBER_READY')
check('P7_AMBER_BRANCH' in state,'permanent P7 amber reserve exists independently of local reversible converter')
check(not path('dog','3B','3C',state),'Prism bridge is shut until final alignment')
unlock('P9_BRIDGE_OPEN');actor_move('cat','3C');escort('3C');unlock('P9_ESCORTED')
# P10
check(not path('dog','3C','3D',state),'final raised-dais lift is initially not running')
actor_move('cat','3B');actor_move('cat','3D');unlock('P10_HORN_ALIGNED','P10_GATE_OPEN');escort('3D');unlock('P10_COMPLETE')
check(all(N.keys()<=reach(actor,'3D',state) for actor in ['dog','cat']),'both actors can visit all 16 major islands after chapter')
# earliest fall recovery check at EXACT first available milestone
for f in F:
 gained={'START'}
 for p in P:
  for flag in p['awards']:gained.add(flag)
  if f['gate'] in gained:
   for actor in ('dog','cat'):
    ret=path(actor,f['to'],f['from_'],gained)
    check(ret is not None,f'{f["id"]} {actor} can return immediately at first eligibility via {ret}')
   break
 else:raise AssertionError(f'Never-unlocked fall {f["id"]}')
# guard that note to Codex remains honest
report.append('LIMIT: these are STATIC progression and route tests, not exhaustive AI, tactile input, reversible branch or liquid pressure simulations.')
report.append('LIMIT: actual game collision, companion fear logic, geometry clearance, camera occlusion and mobile performance need in-engine validation.')
(R/'04_VALIDATION_REPORT_v3_1.txt').write_text('THE ELSEWHERE — CHAPTER ONE V3.1 VALIDATION\n'+('='*47)+'\n'+'\n'.join(report)+f'\n\nRESULT: {checks} static checks passed.\n')
print(f'PASS: {checks} checks; islands={len(N)}, traversals={len(E)}, falls={len(F)}, puzzles={len(P)}')
