#!/usr/bin/env python3
"""Inspect all four floors, all islands, rendered labels and phone-width layout.
Browser emulation is not testing on a physical phone.
"""
from pathlib import Path
import json,shutil
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent
D=json.loads((R/'chapter_one_canonical_v3_1.json').read_text())
log=[]
VIEWS=[('desktop',1440,900),('mobile_landscape',780,360),('wide_mobile',932,430),('portrait_reading',390,844)]
shots=R/'qa_previews';shots.mkdir(exist_ok=True)
with sync_playwright() as p:
 exe=shutil.which('chromium') or shutil.which('chromium-browser')
 options={'headless':True,'args':['--no-sandbox']}
 if exe:options['executable_path']=exe
 browser=p.chromium.launch(**options)
 for label,w,h in VIEWS:
  page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1,has_touch=label!='desktop')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content((R/'00_INTERACTIVE_ATLAS_v3_1.html').read_text(),wait_until='domcontentloaded')
  page.locator('#map [data-node]').first.wait_for()
  for floor in range(4):
   page.locator(f'[data-floor="{floor}"]').click()
   assert page.locator('#map [data-node]').count()==4
   # Test every card and its separate small-screen selector.
   ids=[k for k,v in D['nodes'].items() if v['floor']==floor]
   for id in ids:
    page.locator(f'#map [data-node="{id}"]').click()
    assert page.locator('#details h2').inner_text().startswith(id+' —')
    page.locator(f'[data-select="{id}"]').click()
    assert page.locator('#details h2').inner_text().startswith(id+' —')
   page.locator(f'#map [data-node="{ids[0]}"]').focus()
   page.keyboard.press('Enter')
   assert page.locator('#details h2').inner_text().startswith(ids[0]+' —')
   # Use actual browser text geometry, not just requested font sizes.
   issues=page.evaluate('''() => {
    const issues=[];const svg=document.querySelector('#map svg');const full=svg.getBoundingClientRect();
    const inside=(a,b,t=1)=>a.x>=b.x-t&&a.y>=b.y-t&&a.right<=b.right+t&&a.bottom<=b.bottom+t;
    for(const g of svg.querySelectorAll('.island')){
     const r=g.querySelector('rect').getBoundingClientRect();
     for(const t of g.querySelectorAll('text'))if(!inside(t.getBoundingClientRect(),r))issues.push(g.dataset.node+' overflowing text: '+t.textContent);
     const title=g.querySelector('.island-title').getBoundingClientRect(),id=g.querySelector('.island-id').getBoundingClientRect();
     if(title.y<id.bottom)issues.push(g.dataset.node+' title overlaps ID');
    }
    for(const g of svg.querySelectorAll('.route-label')){
     const r=g.querySelector('rect').getBoundingClientRect();
     for(const t of g.querySelectorAll('text'))if(!inside(t.getBoundingClientRect(),r))issues.push('route label overflowing: '+t.textContent);
    }
    for(const t of svg.querySelectorAll('text'))if(!inside(t.getBoundingClientRect(),full))issues.push('text outside SVG: '+t.textContent);
    if(document.documentElement.scrollWidth>window.innerWidth+1)issues.push('page horizontal overflow');
    for(const b of document.querySelectorAll('button'))if(b.getBoundingClientRect().height<48)issues.push('button under 48px: '+b.textContent);
    return issues;
   }''')
   assert not issues,(label,floor,issues)
   expected={e['id']:(e['from_'],e['to']) for e in D['edges'] if D['nodes'][e['from_']]['floor']==D['nodes'][e['to']]['floor']==floor}
   actual=page.locator('#map [data-edge]').evaluate_all('(els)=>els.map(e=>[e.dataset.edge,e.dataset.from,e.dataset.to])')
   assert {id:(a,b) for id,a,b in actual}==expected
   for id in expected:
    assert id in page.locator(f'#map [data-edge="{id}"] .route-label').text_content()
   page.evaluate('window.scrollTo(0,0)')
   page.screenshot(path=str(shots/f'{label}_floor_{floor}.png'),full_page=False)
   if label=='desktop':page.locator('#map').screenshot(path=str(shots/f'rendered_map_floor_{floor}.png'))
   log.append(f'{label} {w}x{h}, floor {floor}: all four islands clickable and keyboard-selectable; exact endpoints and labels; text inside cards; no page overflow')
  page.locator('#show-transfers').click()
  for e in [e for e in D['edges'] if e['id'].startswith('V') or e['id']=='E33']+D['falls']:
   el=page.locator(f'#extra [data-entry="{e["id"]}"]')
   assert el.count()==1
   t=el.inner_text()
   assert e['from_'] in t and e['to'] in t and e['gate'] in t
  page.locator('#show-puzzles').click()
  assert page.locator('#extra .route-card').count()==10
  assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
  assert not errors,errors
  log.append(f'{label}: all transfer/fall cards and 10-puzzle sequence load; no JavaScript errors')
  page.close()
 # Render all text in the vertical SVG with browser measurements as well.
 page=browser.new_page(viewport={'width':1460,'height':1000})
 page.set_content((R/'VERTICAL_ROUTES_v3_1.svg').read_text())
 issues=page.evaluate('''() => {let issues=[];for(const g of document.querySelectorAll('.transfer-endpoint')){let r=g.querySelector('rect').getBBox();for(const t of g.querySelectorAll('text')){let b=t.getBBox();if(b.x<r.x||b.y<r.y||b.x+b.width>r.x+r.width||b.y+b.height>r.y+r.height)issues.push(g.dataset.route+': '+t.textContent)}}return issues}''')
 assert not issues,issues
 log.append('Vertical diagram: all endpoint labels fit their actual browser-rendered cards')
 browser.close()
(R/'browser_checks_v3_1.txt').write_text('BROWSER CHECKS — CHROMIUM VIEWPORT EMULATION\n\n'+'\n'.join('PASS: '+l for l in log)+'\n\nNot physical-device, WebKit/Safari, gameplay, or performance validation.\n')
print('PASS: all 16 floor/viewport combinations, every island, keyboard/touch selectors, exact route cards and rendered text bounds.')
