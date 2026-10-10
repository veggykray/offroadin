/* Phase 1 correction: structural variety for overhead play. Native Forge. */
'use strict';
(function(AS){
 const A=AS.ArchP1,M=AS.Models=AS.Models||{},Q=A.Kit,T=Math.PI*2;
 A.assets=[];A.PALETTES=Q.defaults;const B=Q.block,E=Q.ellipse,L=Q.layer;
 const ACCESS={p1_h01:[8,30,0],p1_h02:[-8,31,0],p1_h03:[0,97,0],p1_h_cottage:[-3,11,0],p1_h_longhouse:[23,25,0],p1_h_townhouse:[0,24,0],p1_h_inn:[0,30,0],p1_h_workshop:[5,28,0],p1_h_warehouse:[0,19,0],p1_h_stable:[14,30,0],p1_h_chapel:[0,43,0],p1_h_guard:[-6,17,0],
  p1_e01:[-13,31,0],p1_e02:[3,30,14],p1_e03:[0,87,0],p1_e_crescent:[-20,12,0],p1_e_longcrescent:[-20,30,0],p1_e_petals:[-3,36,0],p1_e_treehouse:[20,26,0],p1_e_hall:[-3,42,0],p1_e_shrine:[0,27,0],p1_e_archive:[14,29,0],p1_e_garden:[0,32,0],
  p1_d01:[0,85,0],p1_d02:[0,32,0],p1_d03:[0,57,0],p1_d_greathall:[0,62,0],p1_d_octhome:[0,20,0],p1_d_lhome:[-13,28,0],p1_d_townhouse:[0,25,0],p1_d_workshop:[0,38,0],p1_d_guild:[4,56,0],p1_d_crusher:[0,36,0],p1_d_mine:[15,34,0],p1_d_store:[0,34,0]};
 for(const n of ['polyPrism','oct','hip','vault','arch','carved','stoneHall','crescent','elfSpire','hall','roof','face','leafRoom','tower','wall','support','ore']){const fn=Q[n];Q[n]=function(K,...args){if(K?.parts){K._modules=K._modules||[];if(!K._modules.includes(n))K._modules.push(n);}return fn(K,...args);};}
 function add(id,code,name,family,r,h,size,roles,build,dirs=1){
  const m={id,designId:code,name,family,r,h,dirs,anims:1,size,roles,source:'src/models.js',moduleSource:'src/modules.js',revision:3,accessPoint:ACCESS[id]||null};A.assets.push(m);
  if(M[id])throw Error('Asset ID collision '+id);
  M[id]=(pal,opt={})=>{const K={family,p:Q.palette(family,pal),parts:[],roofs:[],contacts:[],solids:[],sockets:[]};build(K,opt);if(m.accessPoint)K.sockets.push({id:'site_access',position:m.accessPoint,normal:[0,1,0]});const out=Q.finish(K,r,h);out._arch.sockets=K.sockets;out._arch.modules=K._modules||[];out._arch.assetId=id;return out;};
 }
 function flag(K,x,y,z,opt){const col=AS.Data?.pal?.[opt.owner]?.k||K.p.k;K.parts.push(L(c=>{Q.stroke3(c,[[x,y,z],[x,y,z+10]],K.p.d,.9);Q.paintPoly(c,[[x,y,z+10],[x+8,y,z+8],[x+7,y,z+4],[x,y,z+4]],col,K.p.d);},[x,y]));}
 function chimney(K,x,y,z,h=15,w=5){const p=K.p;Q.oct(K,x,y,w,w,z,h,p.a,p.b,.1);K.parts.push(B(x,y,w+2,w+2,z+h,2,p.d,p.b,[x,y]));}
 function rail(K,pts,z,col=K.p.s){K.parts.push(L(c=>{Q.stroke3(c,pts.map(p=>[...p,z]),col,1.1);for(const p of pts)Q.stroke3(c,[[...p,z-4],[...p,z]],col,.8);},pts[Math.floor(pts.length/2)]));}
 function steps(K,x,y,w,d,h,n=6){for(let i=0;i<n;i++){const yy=y-d/2+d/n*(i+.5),dd=d/n+.3,hh=h*(n-i)/n;K.parts.push(B(x,yy,w,dd,0,hh,K.p.a,K.p.b,[x,yy]));if(K.family==='dwarf')Q.masonry(K,[[x-w/2,yy-dd/2],[x+w/2,yy-dd/2],[x+w/2,yy+dd/2],[x-w/2,yy+dd/2]],0,hh,K.p.a,K.p.b,[x,yy]);}K.contacts.push([x-w/2,y+d/2,0],[x+w/2,y+d/2,0]);}
 function guardian(K,x,y,h=37){const p=K.p;Q.oct(K,x,y,19,17,0,7,p.d,p.b);Q.oct(K,x,y,13,11,7,3,p.a,p.b);
  Q.polyPrism(K,[[x-7,y-5],[x+7,y-5],[x+9,y+4],[x+4,y+6],[x-4,y+6],[x-9,y+4]],10,h*.43,p.a,p.b,[x,y]);Q.oct(K,x,y,15,12,10+h*.43,h*.14,p.a,p.b);Q.oct(K,x,y,9,9,10+h*.57,h*.22,p.a,p.b);
  Q.polyPrism(K,[[x-7,y-4],[x,y-6],[x+7,y-4],[x+4,y+5],[x-4,y+5]],10+h*.79,4,p.a,p.b,[x,y]);
  K.parts.push(L(c=>{Q.stroke3(c,[[x-9,y+2,13],[x-9,y+2,10+h*.6]],p.b,3);Q.paintPoly(c,[[x-15,y+2,10+h*.59],[x-3,y+2,10+h*.59],[x-3,y+2,10+h*.72],[x-15,y+2,10+h*.72]],p.b,p.a);Q.paintPoly(c,[[x-5,y+5,11+h*.7],[x+5,y+5,11+h*.7],[x,y+6,11+h*.5]],Q.shade(p.a,-.18),p.b);},[x,y+5]));Q.support(K,x,y,19,17,h+15);
 }
 function dwarfTower(K,x,y,w,d,h){const p=K.p;Q.oct(K,x,y,w+5,d+5,0,6,p.d,p.b);Q.oct(K,x,y,w,d,6,h-10,p.a,p.b);Q.oct(K,x,y,w+7,d+7,h-4,4,p.a,p.b);
  K.parts.push({z0:h,z1:h+5,side:p.a,top:p.b,at:[x,y],shape(c){for(const [dx,dy] of [[-1,-1],[-1,1],[1,-1],[1,1]])c.rect(x+dx*w*.36-3,y+dy*d*.36-3,6,6);}});Q.carved(K,x,y+d/2+.1,w,h-5);Q.support(K,x,y,w+5,d+5,h+5);K.roofs.push({type:'hip',x,y,w:w+7,d:d+7});
 }
 function dwarfGable(K,x,y,w,d,h,rise,porch=true){const p=K.p;
  Q.oct(K,x,y,w+4,d+4,0,3,p.d,p.b,.08);Q.oct(K,x,y,w,d,3,h-3,Q.mix(p.a,p.b,.13),p.b,.07);Q.support(K,x,y,w,d,h+rise);Q.roof(K,x,y,w+3,d+3,h,rise,'y');
  // Stone end-gables rise in actual steps, framing a charcoal slate roof.
  for(const yy of [y-d/2+.5,y+d/2-.5])for(let i=-3;i<=3;i++){const ww=w/7,hh=h+rise*(1-Math.abs(i)/3.7);Q.oct(K,x+i*ww,yy,ww+.25,3.7,h-3,hh-h+4,p.a,p.b,.04);}
  for(const s of [-1,1])Q.oct(K,x+s*(w/2-2),y+d*.31,6.5,8,0,h+2,p.a,p.b,.1);
  Q.face(K,x,y+d/2+.12,w*.87,3,h-4,[x,y+d/2],true,false);
  if(porch)Q.arch(K,x,y+d/2+1.5,Math.min(13,w*.35),5,0,h*.42,h*.29,3.4);
  K.parts.push(L(c=>{for(const s of [-1,1]){const xx=x+s*w*.3,yy=y+d/2+.2;Q.paintPoly(c,[[xx-2,yy,7],[xx+2,yy,7],[xx+2,yy,12],[xx-2,yy,12]],Q.mix(p.g,'#d58a32',.28),p.d);Q.stroke3(c,[[xx,yy,7],[xx,yy,12]],p.d,.65);}},[x,y+d/2]));
 }
 function dwarfFlat(K,x,y,w,d,h,roof=5){const p=K.p;Q.oct(K,x,y,w+4,d+4,0,3,p.d,p.b,.08);Q.oct(K,x,y,w,d,3,h-3,Q.mix(p.a,p.b,.12),p.b,.08);Q.oct(K,x,y,w+3,d+3,h,3,p.a,p.b,.09);Q.oct(K,x,y,w-6,d-6,h+3,roof,Q.mix(p.t,p.a,.3),Q.mix(p.t,p.b,.18),.06);Q.face(K,x,y+d/2+.1,w,3,h-3,[x,y+d/2]);Q.support(K,x,y,w,d,h+3+roof);K.roofs.push({type:'stepped_slab',x,y,w:w+3,d:d+3});}
 // DWARVES: carved masonry, real arch openings, visible structural load paths.
 add('p1_d01','D01','Kingdom gate and guardian approach','dwarf',143,154,[240,166,151],['mountain_portal_landmark'],K=>{
  const p=K.p;Q.polyPrism(K,[[-105,-44],[-84,-57],[84,-57],[105,-44],[96,-20],[-96,-20]],0,99,p.a,p.b,[0,-39],-2);
  for(const s of [-1,1]){Q.oct(K,s*72,-3,51,58,0,11,p.d,p.b);Q.oct(K,s*72,-7,44,45,11,77,p.a,p.b);Q.oct(K,s*72,-10,38,39,88,15,p.a,p.b);Q.oct(K,s*72,-13,30,31,103,13,p.a,p.b);Q.oct(K,s*72,-16,20,23,116,10,p.a,p.b);Q.carved(K,s*72,15,37,80,10);Q.polyPrism(K,[[s*112,-32],[s*95,-36],[s*93,33],[s*112,28]],0,49,p.a,p.b,[s*101,4]);guardian(K,s*64,57,40);}
  K.parts.push(B(0,-23,61,2,0,79,p.d,p.d,[0,-23]));K.parts.push(L(c=>{Q.paintPoly(c,[[-23,-21,0],[23,-21,0],[23,-21,53],[18,-21,66],[0,-21,76],[-18,-21,66],[-23,-21,53]],'#755233',p.b);for(const s of [-1,1])Q.stroke3(c,[[s*20,-21,5],[s*20,-21,51],[s*14,-21,63],[s*3,-21,70]],p.g,1.6);Q.stroke3(c,[[0,-21,0],[0,-21,73]],p.d,1.5);},[0,-21]));
  K.parts.push(L(c=>{for(const s of [-1,1])for(const zz of [8,27,46]){const xx=s*11;Q.paintPoly(c,[[xx-8,-20.9,zz],[xx+8,-20.9,zz],[xx+8,-20.9,zz+14],[xx-8,-20.9,zz+14]],'#594632','#ba9355');Q.paintPoly(c,[[xx,-20.85,zz+4],[xx+3,-20.85,zz+7],[xx,-20.85,zz+10],[xx-3,-20.85,zz+7]],'#b49255',p.d);}},[0,-21]));
  Q.arch(K,0,0,54,29,0,53,30,12);Q.arch(K,0,12,58,9,0,54,33,5,Q.mix(p.a,p.b,.18));Q.polyPrism(K,[[-47,-28],[47,-28],[39,19],[-39,19]],92,9,p.a,p.b,[0,-1]);Q.oct(K,0,-5,69,37,101,13,p.a,p.b);Q.oct(K,0,-8,53,31,114,11,p.a,p.b);Q.polyPrism(K,[[-32,-22],[32,-22],[0,19]],125,13,p.a,p.b,[0,-8]);Q.oct(K,0,-9,17,17,138,8,p.a,p.b);Q.oct(K,0,-9,10,10,146,5,p.a,p.b);Q.carved(K,0,18,68,25,95);steps(K,0,57,91,55,7,9);
  K.sockets.push({id:'cliff_collar',position:[0,-57,0],normal:[0,-1,0]},{id:'passage',position:[0,17,0],clearWidth:54},{id:'approach',position:[0,85,0],normal:[0,1,0]});
 },4);
 add('p1_d02','D02','Stepped gable mason dwelling','dwarf',37,36,[52,60,34],['dwelling'],K=>{dwarfGable(K,0,-3,35,46,16,16);dwarfFlat(K,-22,8,11,23,11,3);steps(K,0,26,16,11,3,4);chimney(K,12,-10,20,12,5);});
 add('p1_d03','D03','Three furnace forge complex','dwarf',87,78,[144,120,76],['forge','industrial_landmark'],K=>{
  const p=K.p;dwarfGable(K,0,-21,76,58,26,20);dwarfFlat(K,-51,15,25,36,18,4);for(const [x,y,z,h] of [[-28,-37,36,38],[25,-30,36,32],[51,-2,0,49]]){Q.oct(K,x,y,16,18,z,h-6,p.a,p.b);Q.oct(K,x,y,20,22,z+h-6,6,p.d,p.b);K.parts.push(B(x,y,11,13,z+h-.3,.2,p.d,p.d,[x,y]));Q.carved(K,x,y+9,14,h-9,z);}
  Q.oct(K,35,19,29,32,0,9,p.d,p.b);Q.oct(K,35,19,25,26,9,18,p.a,p.b);Q.vault(K,35,19,27,28,27,11,'y');K.parts.push(L(c=>{Q.paintPoly(c,[[28,32,4],[42,32,4],[42,32,18],[28,32,18]],'#ce7432',p.d);Q.stroke3(c,[[29,32,10],[41,32,10]],p.g,2.5);},[35,32]));for(const x of [-17,8]){Q.oct(K,x,32,15,16,0,5,p.a,p.b);Q.ore(K,x,32);}K.parts.push(L(c=>{Q.stroke3(c,[[-58,42,0],[-58,42,30],[-24,42,30],[-32,42,0]],p.w,3);Q.stroke3(c,[[-58,42,15],[-37,42,30]],p.w,2);Q.stroke3(c,[[-26,42,30],[-26,42,14]],p.d,.8);},[-46,42]));K.sockets.push({id:'ore_yard',position:[0,54,0]});
 });
 add('p1_d_greathall','D04','Great vaulted assembly hall','dwarf',76,90,[120,106,88],['assembly_hall','civic_landmark'],K=>{
  const p=K.p;Q.stoneHall(K,0,-15,77,72,37,34);for(const s of [-1,1]){Q.stoneHall(K,s*48,-12,17,66,15,10);dwarfTower(K,s*44,-23,19,22,53);Q.oct(K,s*28,40,9,13,0,33);}
  Q.stoneHall(K,0,25,42,25,24,17,'x');K.parts.push(B(0,40,27,2,3,28,p.d,p.d,[0,40]));Q.arch(K,0,44,27,11,0,16,15,6);
  K.parts.push(L(c=>{Q.stroke3(c,[[0,45,4],[0,45,27]],p.g,1.1);for(const x of [-11,11])Q.stroke3(c,[[x,45,5],[x,45,20],[x*.6,45,28]],p.b,.9);Q.stroke3(c,[[0,-51,72],[0,15,72]],p.g,2.2);},[0,44]));
  steps(K,0,52,82,17,5,6);Q.oct(K,0,-21,12,20,71,10);Q.oct(K,0,-21,7,15,81,6);
 });
 add('p1_d_octhome','D05','Octagonal slate hearth house','dwarf',31,37,[50,47,35],['dwelling'],K=>{const p=K.p;Q.oct(K,0,-3,43,37,0,5,p.d,p.b);Q.oct(K,0,-3,38,33,5,17);Q.oct(K,0,-3,43,38,22,3);K.parts.push({z0:25,z1:33,side:p.t,top:Q.mix(p.t,p.b,.17),at:[0,-3],shape(c,t){const f=1-t*.65,vs=[];for(let i=0;i<8;i++){const a=(i+.5)*T/8;vs.push([Math.cos(a)*22*f,-3+Math.sin(a)*20*f]);}Q.polygon(c,vs);}});K.parts.push(L(c=>{for(let i=0;i<8;i++){const a=(i+.5)*T/8;Q.stroke3(c,[[Math.cos(a)*22,-3+Math.sin(a)*20,25],[Math.cos(a)*7.7,-3+Math.sin(a)*7,33]],Q.mix(p.b,p.t,.3),.8);}},[0,-3]));Q.arch(K,0,15,10,5,0,8,6,3);Q.face(K,0,13.5,32,5,14,[0,13]);Q.support(K,0,-3,43,37,33);chimney(K,-9,-7,28,5,4);K.roofs.push({type:'circle',x:0,y:-3,r:22});});
 add('p1_d_lhome','D06','Gable and terrace family court','dwarf',40,38,[67,55,36],['dwelling','small_court'],K=>{dwarfGable(K,-14,-5,26,42,17,16);dwarfFlat(K,15,-16,28,22,16,5);steps(K,-13,23,17,8,3,4);Q.oct(K,22,-18,10,12,24,3,K.p.a,K.p.b);});
 add('p1_d_townhouse','D07','Tiered guild residence','dwarf',33,60,[46,52,58],['residence'],K=>{dwarfGable(K,0,-2,37,36,30,16);Q.oct(K,0,-11,25,25,44,5);Q.hip(K,0,-11,27,27,49,9,.05);Q.oct(K,-17,6,8,13,0,35);Q.oct(K,17,6,8,13,0,35);});
 add('p1_d_workshop','D08','Terraced stonecutter workshop','dwarf',48,42,[82,70,40],['workshop'],K=>{const p=K.p;dwarfFlat(K,-8,-10,43,42,20,6);dwarfGable(K,29,-4,20,32,12,10);for(const x of [-24,8])Q.oct(K,x,-8,8,27,23,9,p.a,p.b,.08);Q.oct(K,-8,-12,18,15,29,6,p.a,p.b,.1);steps(K,-8,17,44,11,3,4);for(const [x,y] of [[-21,28],[0,31],[25,23]]){Q.oct(K,x,y,13,13,0,8);Q.carved(K,x,y+6.6,12,7);}K.sockets.push({id:'workyard',position:[0,37,0]});});
 add('p1_d_guild','D09','Engineers guild and archive','dwarf',69,91,[112,99,89],['guild_hall','civic_landmark'],K=>{dwarfGable(K,-21,-4,37,63,27,24);Q.stoneHall(K,27,-12,33,43,22,20);dwarfTower(K,4,18,36,31,59);Q.oct(K,4,18,30,27,64,6);Q.hip(K,4,18,34,31,70,17,.05);Q.arch(K,4,37,20,9,0,15,12,5);steps(K,4,48,43,14,4,5);});
 add('p1_d_crusher','D10','Ore washer and crusher mill','dwarf',60,53,[100,84,51],['ore_processing'],K=>{const p=K.p;Q.stoneHall(K,-16,-12,48,45,21,20);Q.stoneHall(K,28,-21,22,23,14,11,'x');K.parts.push(L(c=>{const vs=[];for(let i=0;i<=24;i++){const t=i*T/24;vs.push([35+Math.cos(t)*13,6,19+Math.sin(t)*13]);}Q.stroke3(c,vs,p.w,3);for(let i=0;i<8;i++){const t=i*T/8;Q.stroke3(c,[[35,6,19],[35+Math.cos(t)*12,6,19+Math.sin(t)*12]],p.b,1.2);}Q.stroke3(c,[[-38,28,3],[13,28,3]],p.w,4);},[22,6]));Q.oct(K,0,25,55,16,0,5,p.a,p.d);Q.ore(K,-32,22);Q.support(K,35,6,29,8,34);});
 add('p1_d_mine','D11','Mine head and counterweight lift','dwarf',45,81,[75,67,79],['mining_structure'],K=>{const p=K.p;Q.stoneHall(K,-20,-4,26,35,18,17);Q.oct(K,15,-3,29,28,0,7);for(const x of [5,25])Q.oct(K,x,-3,7,9,7,49);Q.oct(K,15,-3,38,20,56,9);Q.hip(K,15,-3,40,24,65,12,.18);K.parts.push(L(c=>{Q.stroke3(c,[[15,-3,61],[15,27,61],[15,27,8]],p.w,3);Q.stroke3(c,[[15,-3,40],[15,27,61]],p.w,2);Q.paintPoly(c,[[9,27,8],[22,27,8],[22,27,18],[9,27,18]],p.a,p.b);},[15,27]));Q.support(K,15,-3,35,30,77);});
 add('p1_d_store','D12','Ore vault and loading arcade','dwarf',43,40,[74,63,38],['storage'],K=>{Q.stoneHall(K,0,-7,58,38,18,17,'x');for(const x of [-19,0,19])Q.arch(K,x,18,12,8,0,8,6,3);Q.ore(K,-16,25);Q.ore(K,16,25);});
 add('p1_d_bastion','D-M06','Octagonal watch bastion','dwarf',32,73,[49,49,71],['defensive_tower'],K=>{dwarfTower(K,0,0,40,40,65);Q.oct(K,0,0,17,17,65,5);Q.carved(K,0,20.2,38,48,6);});
 add('p1_d_terrace','D-M02','Block built retaining buttress bay','dwarf',28,27,[46,20,25],['retaining_edge'],K=>{const p=K.p;K.coarseMasonry=true;Q.polyPrism(K,[[-22,-7.5],[22,-7.5],[22,1.5],[-22,1.5]],0,20,p.a,p.b);for(const x of [-17,17])Q.oct(K,x,3,9,18,0,22);Q.polyPrism(K,[[-23,-9],[23,-9],[23,3],[-23,3]],20,3,p.a,p.b);Q.carved(K,0,2,23,18);K.contacts.push([-22,-7,0],[22,-7,0]);},16);
 add('p1_d_stairs','D-M11','Broad ceremonial stair','dwarf',41,18,[63,46,16],['stairway'],K=>{steps(K,0,0,52,42,14,10);for(const x of [-28,28])K.parts.push(B(x,0,5,44,0,16,K.p.a,K.p.b));},4);
 add('p1_d_stairs_low','D-M14','Portal landing stair','dwarf',41,13,[63,46,11],['stairway'],K=>{steps(K,0,0,52,42,9,7);for(const x of [-28,28])K.parts.push(B(x,0,5,44,0,11,K.p.a,K.p.b));},4);
 add('p1_d_guardian','D-M12','Hammer guardian monument','dwarf',20,55,[34,28,53],['monument'],K=>guardian(K,0,0,38));
 add('p1_d_ore','D-M10','Ore carts and stone loading bay','dwarf',26,16,[43,39,14],['storage','ore_loading'],K=>{Q.oct(K,0,0,42,35,0,2,K.p.a,K.p.b);Q.ore(K,-10,-2);Q.ore(K,10,-2);for(const x of [-12,12]){K.parts.push(B(x,8,13,13,2,8,K.p.w,K.p.d));Q.ore(K,x,8);}});
 function crag(K,x,y,w,d,h,lean=8){const p=K.p,hh=h*.73;
  // A fractured irregular polyhedron, sampled through Forge's existing
  // horizontal shape contract. Unequal corner heights create broad slanted
  // top faces; neighbouring shards create local ledges, never concentric tiers.
  const footprint=[[-.5,-.24],[-.28,-.49],[.12,-.46],[.34,-.32],[.48,-.13],[.42,.3],[.1,.48],[-.18,.4],[-.4,.28]],heights=[.68,.86,1,.88,.65,.57,.75,.72,.63];
  const bottom=footprint.map(([a,b])=>[x+a*w,y+b*d,0]),top=footprint.map(([a,b],i)=>[x+a*w*(.77+(i%3)*.045)+lean*.28,y+b*d*(.7+(i%2)*.08)-d*.025,hh*heights[i]]),centre=[x+lean*.21,y-d*.045,hh*.83];
  const edges=[];for(let i=0;i<bottom.length;i++){const j=(i+1)%bottom.length;edges.push([bottom[i],bottom[j]],[bottom[i],top[i]],[top[i],top[j]],[top[i],centre]);}
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  function slice(z){const points=[];for(const [a,b] of edges){if(z<Math.min(a[2],b[2])-.001||z>Math.max(a[2],b[2])+.001)continue;if(Math.abs(b[2]-a[2])<.001){points.push(a.slice(0,2),b.slice(0,2));continue;}const t=(z-a[2])/(b[2]-a[2]);points.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);const low=[],high=[];for(const a of points){while(low.length>1&&cross(low.at(-2),low.at(-1),a)<=0)low.pop();low.push(a);}for(let i=points.length-1;i>=0;i--){const a=points[i];while(high.length>1&&cross(high.at(-2),high.at(-1),a)<=0)high.pop();high.push(a);}low.pop();high.pop();return low.concat(high);
  }
  K.parts.push({z0:0,z1:hh,side:Q.shade(p.a,-.04),top:Q.mix(p.a,p.b,.2),at:[x,y],bevel:false,shape(c,t){const vs=slice(Math.min(.997,t)*hh);if(vs.length>2)Q.polygon(c,vs);}});
  K.parts.push(L(c=>{
    const tr=c.getTransform(),a=Math.atan2(tr.b,tr.a),view=[Math.sin(a),Math.cos(a)];
    for(let i=0;i<bottom.length;i++){
      const j=(i+1)%bottom.length,dx=bottom[j][0]-bottom[i][0],dy=bottom[j][1]-bottom[i][1],len=Math.hypot(dx,dy);
      if((dy*view[0]-dx*view[1])/len>.02)Q.paintPoly(c,[bottom[i],bottom[j],top[j],top[i]],Q.shade(p.a,[-.15,-.09,.02,-.11,-.2,-.04,.025,.09,-.065][i]),Q.shade(p.a,-.22));
    }
    for(let i=0;i<top.length;i++){const j=(i+1)%top.length;Q.paintPoly(c,[top[i],top[j],centre],Q.mix(p.a,p.b,.11+(i%4)*.035));}
    Q.stroke3(c,[top[5],[x+w*.13,y+d*.12,hh*.37],[x+w*.2,y+d*.28,hh*.09]],Q.shade(p.a,-.26),1.25);
    Q.stroke3(c,[top[8],[x-w*.21,y+d*.22,hh*.35],[x-w*.28,y+d*.27,hh*.04]],Q.shade(p.a,-.18),1);
  },[x,y]));
 }
 add('p1_d_rock','D-S01','Fractured mountain shoulder','dwarf',94,101,[155,101,99],['scenery_cliff'],K=>{crag(K,-19,-8,112,82,133,15);crag(K,38,11,70,64,73,-7);crag(K,-48,23,52,44,38,2);});
 add('p1_d_rock_spur','D-S02','Shelved quarry spur','dwarf',94,88,[159,99,87],['scenery_cliff'],K=>{crag(K,21,-7,114,78,115,-21);crag(K,-43,12,68,61,58,9);});
 add('p1_d_rock_ridge','D-S03','Broken ridge and ledge','dwarf',91,112,[150,95,110],['scenery_cliff'],K=>{crag(K,-31,-5,84,73,147,13);crag(K,36,-1,69,76,103,-14);crag(K,0,26,96,33,37,4);});
 // ALDERMERE: rooflines and trade buildings carry the established red palette.
 function humanHall(K,x,y,w,d,h,rise,axis='y') {
  const base=K.p,tint=w>50?.05:w<20?-.055:.015;K.p=Object.assign({},base,{t:Q.shade(base.t,tint)});Q.hall(K,x,y,w,d,h,rise,axis,true);K.p=base;
  if(axis==='y')K.parts.push(L(c=>{Q.stroke3(c,[[x-w*.46,y+d/2+.5,h+1],[x,y+d/2+.5,h+rise-1],[x+w*.46,y+d/2+.5,h+1]],base.s,.9);Q.stroke3(c,[[x,y+d/2+.5,h+1],[x,y+d/2+.5,h+rise-2]],base.w,1.1);},[x,y+d/2]));
 }
 function dormer(K,x,y,z,w=9){const p=K.p;K.parts.push(B(x,y,w,7,z,5,p.s,p.b,[x,y]));Q.face(K,x,y+3.6,w,z,5,[x,y]);Q.roof(K,x,y,w+2,9,z+5,4,'y',[x,y]);}
 function awning(K,x,y,w,d,z){const p=K.p;for(const xx of [x-w/2+1,x+w/2-1])K.parts.push(B(xx,y+d/2,1.3,1.3,0,z,p.w,p.w,[x,y+d/2]));
  K.parts.push(B(x,y,w,d,z,.6,p.s,p.s,[x,y]));K.parts.push(L(c=>{for(let i=0;i<7;i++){const l=x-w/2+i*w/7,r=l+w/7,col=i%2?Q.mix(p.t,p.s,.12):p.s;Q.paintPoly(c,[[l,y-d/2,z+2],[r,y-d/2,z+2],[r,y+d/2,z],[l,y+d/2,z]],col);Q.paintPoly(c,[[l,y+d/2,z],[r,y+d/2,z],[r,y+d/2,z-2],[l,y+d/2,z-2]],Q.shade(col,-.12));}Q.stroke3(c,[[x-w/2,y+d/2,z],[x+w/2,y+d/2,z]],p.w,.55);},[x,y+d/2]));}
 function hMasonry(K,x,y,w,z,h){const p=K.p;K.parts.push(L(c=>{if(c.getTransform().a<0)return;for(let row=0;row<Math.floor(h/7);row++){const zz=z+row*7;Q.stroke3(c,[[x-w/2,y,zz],[x+w/2,y,zz]],Q.mix(p.a,p.d,.19),.6);for(let xx=x-w/2+6+(row%2)*6;xx<x+w/2-2;xx+=12)Q.stroke3(c,[[xx,y,zz],[xx,y,Math.min(z+h,zz+7)]],Q.mix(p.a,p.d,.19),.55);}for(const side of [-1,1])for(let row=0;row<h/7;row++){const xx=x+side*(w/2-2),zz=z+row*7;Q.paintPoly(c,[[xx-2,y+.1,zz+.7],[xx+2,y+.1,zz+.7],[xx+2,y+.1,Math.min(z+h,zz+6.2)],[xx-2,y+.1,Math.min(z+h,zz+6.2)]],Q.mix(p.b,p.a,.15));}},[x,y]));}
 function hBanner(K,x,y,z,w,h){const p=K.p;K.parts.push(L(c=>{Q.stroke3(c,[[x-w*.7,y,z],[x+w*.7,y,z]],p.w,1.4);Q.paintPoly(c,[[x-w/2,y,z-.7],[x+w/2,y,z-.7],[x+w/2,y,z-h+3],[x,y,z-h],[x-w/2,y,z-h+3]],p.k,p.d);Q.paintPoly(c,[[x-w*.27,y,z-h*.35],[x-w*.2,y,z-h*.59],[x+w*.2,y,z-h*.59],[x+w*.27,y,z-h*.35],[x+w*.08,y,z-h*.44],[x,y,z-h*.28],[x-w*.08,y,z-h*.44]],p.k2);},[x,y]));}
 function hBarrel(K,x,y,z=0,r=3,h=7){const p=K.p;K.parts.push({z0:z,z1:z+h,side:p.w,top:Q.mix(p.w,p.b,.55),at:[x,y],shape(c,t){c.ellipse(x,y,r*(.8+.2*Math.sin(Math.PI*t)),r*.8,0,0,T);}});K.parts.push(L(c=>{for(const zz of [z+1.5,z+h-1.5]){const pts=[];for(let j=0;j<=12;j++){const a=j*T/12;pts.push([x+Math.cos(a)*r*.97,y+Math.sin(a)*r*.8,zz]);}Q.stroke3(c,pts,p.d,.7);}Q.stroke3(c,[[x-r*.7,y,z+h+.1],[x+r*.7,y,z+h+.1]],p.w,.6);},[x,y]));}
 function hCrate(K,x,y,z=0,w=6,d=6,h=6){const p=K.p;K.parts.push(B(x,y,w,d,z,h,p.w,Q.mix(p.w,p.b,.5),[x,y]));K.parts.push(L(c=>{Q.stroke3(c,[[x-w/2,y-d/2,z+h],[x+w/2,y+d/2,z+h]],p.w,.7);Q.stroke3(c,[[x-w/2,y+d/2,z],[x+w/2,y+d/2,z+h]],p.b,.7);},[x,y]));}
 function hCart(K,x,y){const p=K.p;K.parts.push(B(x,y,13,17,3,2,p.w,p.b),B(x-6,y,1.3,17,5,4,p.w,p.b),B(x+6,y,1.3,17,5,4,p.w,p.b),B(x,y-8,13,1.3,5,4,p.w,p.b));for(const side of [-1,1]){K.parts.push(E(x+side*8,y,1.5,4,1,6,p.d,p.a));K.parts.push(L(c=>{Q.stroke3(c,[[x+side*8,y-3.5,7.1],[x+side*8,y+3.5,7.1]],p.b,.55);Q.stroke3(c,[[x+side*4,y+8,4],[x+side*4,y+15,2]],p.w,1.2);},[x+side*8,y]));}hCrate(K,x-2,y-3,5,7,8,6);hBarrel(K,x+2,y+4,5,2.5,5);}
 add('p1_h01','H01','Jettied merchant courtyard house','human',43,53,[71,64,51],['merchant_house','residence'],K=>{
  humanHall(K,3,-18,45,20,27,16,'x');humanHall(K,-23,8,17,39,22,16);humanHall(K,25,14,15,23,18,13);dormer(K,6,-10,33,10);chimney(K,-7,-19,35,14,5);awning(K,8,24,22,9,10);
  hBarrel(K,-6,17,0,3,7);hCrate(K,19,24,0,5,5,5);K.parts.push(B(-23,20,17,6,12,1.3,K.p.w,K.p.s));rail(K,[[-30,23],[-15,23]],17,K.p.w);
  K.parts.push(L(c=>{Q.stroke3(c,[[-30,14,17],[-12,14,17]],K.p.w,2);Q.stroke3(c,[[-29,13,12],[-29,13,17]],K.p.w,1);},[-22,14]));K.sockets.push({id:'door',position:[8,30,0]},{id:'court',position:[4,8,0]});
 });
 add('p1_h02','H02','Market loggia and clock guildhall','human',63,81,[109,91,79],['market','guild_hall','civic_landmark'],(K,opt)=>{
  const p=K.p;humanHall(K,-9,-10,76,41,28,21,'x');humanHall(K,29,-24,26,30,31,18);Q.tower(K,-38,-18,12,55,20);flag(K,-38,-18,72,opt);
  for(const x of [-38,-23,-8,7,22]){K.parts.push(B(x,21,3,8,0,12,p.w,p.w));}Q.roof(K,-8,21,77,14,12,5,'x');dormer(K,-12,-1,36,12);
  hMasonry(K,-38,-5.7,17,3,37);hBanner(K,31,-8,27,9,17);dormer(K,16,-1,36,10);for(const x of [-29,7]){awning(K,x,27,15,10,9);hCrate(K,x,29,0,10,5,4);}hBarrel(K,40,14,0,3.5,8);hBarrel(K,46,17,0,3,7);
  K.parts.push(L(c=>{Q.paintPoly(c,[[-44,-5,44],[-32,-5,44],[-32,-5,53],[-44,-5,53]],p.b,p.d);Q.stroke3(c,[[-38,-5,48],[-38,-5,52]],p.d,.9);Q.stroke3(c,[[-38,-5,48],[-34,-5,48]],p.d,.9);},[-38,-5]));
  K.sockets.push({id:'market_front',position:[-8,31,0]});
 });
 add('p1_h03','H03','Royal fortress and inhabited bailey','human',157,137,[274,214,135],['castle_landmark'],(K,opt)=>{
  const p=K.p;Q.polyPrism(K,[[-128,-94],[104,-94],[132,-44],[128,92],[-128,92]],0,4,p.a,p.b,[0,0],-7);
  // Donjon at the highest rear corner, a lower great hall and service court.
  Q.oct(K,-43,-41,67,63,4,71,p.a,p.b,.09);Q.oct(K,-43,-41,74,70,75,5,p.a,p.b,.1);Q.hip(K,-43,-41,76,72,80,32,.18);
  Q.face(K,-43,-8,57,12,62,[-43,-8],true,false);Q.arch(K,-43,-5,17,7,4,12,9,4);
  hMasonry(K,-43,-8.4,63,6,68);for(const x of [-70,-16]){Q.polyPrism(K,[[x-4,-13],[x+4,-13],[x+3,0],[x-3,0]],4,22,p.a,p.b,[x,-4]);K.parts.push(B(x,-7,7,9,26,29,p.a,p.b,[x,-4]),B(x,-7,9,11,55,3,p.a,p.b,[x,-4]));}hBanner(K,-60,-7.8,40,8,22);hBanner(K,-25,-7.8,40,8,22);
  Q.oct(K,-43,-41,16,19,110,10,p.a,p.b,.09);Q.roof(K,-43,-41,21,24,120,9,'y');dormer(K,-58,-18,85,12);dormer(K,-29,-18,85,12);
  K.parts.push(L(c=>{for(const x of [-61,-43,-25]){Q.paintPoly(c,[[x-3,-8,43],[x+3,-8,43],[x+3,-8,57],[x,-8,61],[x-3,-8,57]],p.d,p.b);Q.stroke3(c,[[x,-8,44],[x,-8,58]],p.g,.7);}for(const zz of [28,65])Q.stroke3(c,[[-73,-8,zz],[-13,-8,zz]],p.b,1.8);},[-43,-8]));
  for(const x of [-70,-15])Q.tower(K,x,-64,9,110,x===-70?23:17);
  Q.hall(K,38,-42,66,43,43,24,'x',false);Q.tower(K,72,-34,10,64,20);chimney(K,24,-48,52,17,7);
  humanHall(K,-88,31,28,47,20,15);humanHall(K,91,32,29,40,26,17);
  Q.wall(K,0,-91,226,9,35);Q.wall(K,-121,-1,8,174,31);Q.wall(K,121,-2,8,162,33);
  Q.wall(K,-79,85,79,10,28);Q.wall(K,75,85,85,10,28);
  for(const [x,y,shaft,cap] of [[-115,-86,69,22],[101,-87,65,21],[-115,77,48,18],[116,77,56,20]])Q.tower(K,x,y,13,shaft,cap);
  for(const x of [-25,25])Q.tower(K,x,81,11,43,19);Q.arch(K,0,82,28,20,0,18,10,6);Q.roof(K,0,82,37,24,35,13,'x');
  hBanner(K,-25,92.1,37,9,20);hBanner(K,25,92.1,37,9,20);hMasonry(K,-71,90.2,62,3,24);hMasonry(K,70,90.2,66,3,24);hMasonry(K,38,-19.9,63,4,35);
  K.parts.push(L(c=>{for(const x of [20,38,56])Q.paintPoly(c,[[x-3,-18.8,22],[x+3,-18.8,22],[x+3,-18.8,34],[x,-18.8,37],[x-3,-18.8,34]],p.d,p.b);Q.paintPoly(c,[[11,8,4],[40,8,4],[40,28,4],[11,28,4]],Q.mix(p.a,p.b,.28));Q.stroke3(c,[[14,11,4.2],[37,11,4.2],[37,25,4.2],[14,25,4.2],[14,11,4.2]],p.b,1.2);},[30,28]));
  hBarrel(K,77,52,4,3.3,8);hCrate(K,91,59,4,8,8,7);hCrate(K,102,59,4,7,7,5);
  steps(K,-43,11,29,25,4,5);flag(K,-43,-41,121,opt);flag(K,70,-40,81,opt);
  K.sockets.push({id:'gate',position:[0,97,0],clearWidth:28},{id:'west_wall',position:[-128,35,0]},{id:'east_wall',position:[128,35,0]});
 });
 add('p1_h_cottage','H04','Crooked cottage and lean-to','human',25,31,[39,39,29],['cottage'],K=>{const p=K.p;K.parts.push(B(-3,-3,25,24,0,12,p.s,p.b));Q.hip(K,-3,-3,29,28,12,15,.32);Q.face(K,-3,9,25,1,11,[-3,9],true,true);humanHall(K,14,7,10,18,8,6);chimney(K,-10,-4,16,11,4);Q.support(K,-3,-3,25,24,27);K.parts.push(B(-10,10,7,2.5,3,2,p.w,'#648444'));hBarrel(K,-13,14,0,2.5,5);});
 add('p1_h_longhouse','H05','Hearth longhouse and kitchen wing','human',37,36,[65,47,34],['large_home'],K=>{humanHall(K,-3,-5,49,25,15,15,'x');humanHall(K,23,12,13,22,11,10);dormer(K,-12,2,21,8);chimney(K,5,-5,21,11,5);});
 add('p1_h_townhouse','H06','Tall gabled street house','human',26,57,[39,41,55],['townhouse'],K=>{const p=K.p;K.parts.push(B(0,0,22,26,0,20,p.a,p.b),B(0,-1,28,29,20,14,p.s,p.b));Q.face(K,0,13,22,2,17,[0,13],true,true);Q.face(K,0,13.6,28,21,12,[0,14],true,true);Q.roof(K,0,-1,33,34,34,19,'y');chimney(K,-10,-8,38,14,4);Q.support(K,0,0,28,29,53);awning(K,0,18,21,8,10);K.parts.push(B(0,15,12,5,21,9,p.s,p.b));Q.roof(K,0,15,14,8,30,5,'x');Q.face(K,0,17.6,12,22,7,[0,17.6],true,true);K.parts.push(L(c=>Q.stroke3(c,[[-13,16,35],[0,16,50],[13,16,35]],p.s,1.2),[0,16]));});
 add('p1_h_inn','H07','Three wing coaching inn','human',55,63,[94,83,61],['inn'],K=>{const p=K.p;humanHall(K,0,-24,63,25,28,17,'x');humanHall(K,-30,8,23,42,25,17);humanHall(K,31,5,20,38,20,15);Q.tower(K,25,-27,7,40,19);dormer(K,-8,-15,34,10);chimney(K,-24,-24,32,16,5);awning(K,0,2,30,10,12);
  K.parts.push(B(-30,27,23,6,17,1.5,p.w,p.b));rail(K,[[-40,30],[-20,30]],22,p.w);for(const x of [-10,10]){K.parts.push(E(x,16,4.5,3.2,0,5,p.w,p.b),B(x,21,9,2,0,3,p.w,p.w));}hBarrel(K,19,21,0,3,7);hBarrel(K,25,24,0,2.8,6);
  K.parts.push(L(c=>{Q.stroke3(c,[[38,21,0],[38,21,25],[25,21,25]],p.w,1.6);Q.paintPoly(c,[[28,21,23],[37,21,23],[37,21,13],[28,21,13]],p.k,p.k2);Q.paintPoly(c,[[30,21,19],[35,21,19],[34,21,16],[31,21,16]],p.k2);Q.stroke3(c,[[31,21,19],[31,21,22]],p.k2,.9);},[34,21]));K.sockets.push({id:'court',position:[0,28,0]});});
 add('p1_h_workshop','H08','Smithy and paired workshop roofs','human',40,40,[66,58,38],['workshop'],K=>{const p=K.p;humanHall(K,-12,-5,25,36,16,13);humanHall(K,15,-10,24,26,12,11);chimney(K,-20,-14,19,16,7);awning(K,5,20,30,12,9);K.parts.push(B(-18,21,8,8,0,5,p.a,p.b));Q.polyPrism(K,[[-23,18],[-14,18],[-10,20],[-14,22],[-23,22]],5,3,p.d,p.a,[-18,21]);hCrate(K,28,11,0,7,9,7);K.parts.push(L(c=>{Q.paintPoly(c,[[-17,13.4,2],[-7,13.4,2],[-7,13.4,10],[-17,13.4,10]],p.d);Q.paintPoly(c,[[-15,13.5,3],[-9,13.5,3],[-11,13.5,7],[-13,13.5,8]],'#d27d35');Q.stroke3(c,[[23,22,1],[23,22,13],[29,22,13]],p.w,1.4);},[10,22]));});
 add('p1_h_warehouse','H09','Gambrel warehouse and hoist','human',47,54,[82,61,52],['warehouse'],K=>{const p=K.p;humanHall(K,0,-4,67,36,23,14,'x');Q.hip(K,0,-4,71,41,23,18,.68);dormer(K,0,6,34,13);K.parts.push(L(c=>{Q.paintPoly(c,[[-7,14,1],[7,14,1],[7,14,17],[-7,14,17]],p.w,p.d);Q.stroke3(c,[[0,14,17],[0,24,30],[0,14,30]],p.w,1.8);Q.stroke3(c,[[0,24,29],[0,24,12]],p.d,.6);},[0,20]));chimney(K,24,-12,27,21,6);hCrate(K,-23,20,0,9,9,7);hCrate(K,-15,20,0,7,8,9);hBarrel(K,24,22,0,4,9);hBarrel(K,32,20,0,3.3,7);});
 add('p1_h_stable','H10','L-shaped stable and carriage shed','human',46,36,[80,64,34],['stable'],K=>{const p=K.p;humanHall(K,0,-13,67,23,13,13,'x');humanHall(K,-25,13,18,29,11,10);awning(K,14,5,33,13,9);rail(K,[[-5,17],[28,17],[28,29],[-5,29]],5,p.w);K.parts.push(B(30,-7,9,10,0,5,p.w,'#c4a66b'));for(const x of [-8,8,23])K.parts.push(L(c=>{Q.paintPoly(c,[[x-4,-1,1],[x+4,-1,1],[x+4,-1,10],[x-4,-1,10]],p.d);Q.stroke3(c,[[x-4,-.8,4],[x+4,-.8,4]],p.w,1.6);},[x,-1]));K.parts.push(B(1,24,7,7,0,4,'#a78951','#d1b879'));hBarrel(K,35,7,0,3,6);});
 add('p1_h_chapel','H11','Cross nave chapel and bell spire','human',47,90,[78,77,88],['chapel','landmark'],K=>{const base=K.p;K.p=Object.assign({},base,{a:Q.mix(base.a,base.b,.34)});const p=K.p;Q.hall(K,0,-4,28,58,27,24,'y');Q.hall(K,0,2,63,20,19,17,'x');Q.tower(K,0,27,9,59,27);Q.arch(K,0,37,10,5,0,10,8,3);
  for(const x of [-15,15])for(const y of [-24,-10,17]){K.parts.push(B(x,y,5,7,0,18,p.a,p.b));Q.hip(K,x,y,6,8,18,5,.15);}hMasonry(K,0,12.1,62,2,15);hMasonry(K,0,36.1,15,3,25);
  K.parts.push(L(c=>{const pts=[];for(let i=0;i<16;i++){const a=i*T/16;pts.push([Math.cos(a)*5.5,36.4,39+Math.sin(a)*5.5]);}Q.paintPoly(c,pts,'#884a35',p.b);for(let i=0;i<8;i++){const a=i*T/8;Q.stroke3(c,[[0,36.5,39],[Math.cos(a)*5,36.5,39+Math.sin(a)*5]],p.b,.65);}for(const x of [-2.8,2.8])Q.paintPoly(c,[[x-1.2,35.6,49],[x+1.2,35.6,49],[x+1.2,35.6,54],[x,35.6,56],[x-1.2,35.6,54]],p.d,p.b);Q.stroke3(c,[[0,27,83],[0,27,88]],p.b,1.3);Q.stroke3(c,[[-3,27,86],[3,27,86]],p.b,1.3);},[0,36.4]));K.p=base;});
 add('p1_h_guard','H12','Gate guardhouse and watch stair','human',32,55,[53,50,53],['guardhouse'],K=>{Q.hall(K,-6,-3,32,31,20,13,'y');Q.tower(K,17,-8,8,38,13);Q.wall(K,-6,12,32,5,15);hMasonry(K,-6,14.6,31,1,13);hBanner(K,17,.1,32,7,14);hBarrel(K,-22,18,0,2.5,6);});
 add('p1_h_wall','H-M08','Stone curtain and wall walk','human',26,29,[42,10,27],['defensive_wall'],K=>{Q.wall(K,0,0,42,9,25);K.parts.push(B(0,1,42,5,22,1,K.p.d,K.p.a));hMasonry(K,0,4.6,41,1,20);K.sockets.push({id:'west',position:[-21,0,0]},{id:'east',position:[21,0,0]});},16);
 add('p1_h_gate','H-M10','Twin tower arched gatehouse','human',49,66,[87,40,64],['town_gate'],K=>{for(const x of [-29,29]){Q.tower(K,x,0,13,41,21);hMasonry(K,x,13.1,17,3,35);hBanner(K,x,13.2,32,8,17);}Q.arch(K,0,0,31,22,0,16,11,6);Q.roof(K,0,0,43,25,34,13,'x');K.parts.push(L(c=>{Q.stroke3(c,[[-14,10.5,22],[14,10.5,22]],K.p.d,1.2);for(const x of [-10,-5,0,5,10])Q.stroke3(c,[[x,10.5,22],[x,10.5,27]],K.p.d,.85);},[0,11]));K.sockets.push({id:'passage',position:[0,18,0],clearWidth:31});},4);
 add('p1_h_tower','H-M09','Wall tower and watch gallery','human',24,68,[39,39,66],['wall_tower'],K=>{Q.oct(K,0,0,35,35,31,5,K.p.a,K.p.b);const gallery=K.parts.pop();Q.tower(K,0,0,15,45,20);K.parts.splice(2,0,gallery);});
 add('p1_h_stall','H-M12','Paired market booths','human',24,16,[40,25,14],['market_stall'],K=>{const p=K.p;awning(K,-10,-2,16,13,10);awning(K,10,-2,16,13,10);K.parts.push(B(-10,7,14,6,0,4,p.w,p.b),B(10,7,14,6,0,4,p.w,p.b));for(const [x,col] of [[-14,'#8d9a49'],[-9,'#cc9e4b'],[-4,'#a84d36'],[6,'#bda982'],[11,'#899773'],[16,'#b56348']])K.parts.push(B(x,7,3.6,4,4,1.6,p.w,col));hCrate(K,-18,8,0,4,5,5);});
 add('p1_h_well','H-M13','Roofed communal well','human',12,23,[19,19,21],['public_well'],K=>{K.parts.push(E(0,0,6,6,0,5,K.p.a,K.p.d));for(const x of [-7,7])K.parts.push(B(x,0,2,2,0,13,K.p.w,K.p.w));Q.roof(K,0,0,18,16,13,7,'y');});
 add('p1_h_trade','H-M14','Loaded handcart and merchant barrels','human',21,18,[34,28,16],['trade_loading'],K=>{hCart(K,-5,-3);hBarrel(K,11,-7,0,3.5,9);hBarrel(K,12,2,0,3.2,7);hCrate(K,10,10,0,8,7,6);});
 add('p1_h_garden','H-S01','Kitchen garden and open wicket fence','human',28,8,[42,32,6],['kitchen_garden','scenery'],K=>{const p=K.p;K.parts.push(B(0,0,40,29,0,.3,p.w,'#877249'));for(const x of [-12,0,12]){K.parts.push(B(x,-1,8,21,.3,.7,p.w,'#634c35'));for(const y of [-8,-1,6]){K.parts.push(E(x,y,2.5,2,.9,1.8,'#547141','#91a56b'));K.parts.push(E(x+1,y-.4,1.4,1.3,2.3,.6,'#759258','#a9b985'));}}rail(K,[[-20,14],[-20,-15],[20,-15],[20,14]],5,p.w);rail(K,[[-20,14],[-6,14]],5,p.w);rail(K,[[6,14],[20,14]],5,p.w);for(const [x,y] of [[-20,-15],[20,-15],[-20,14],[20,14],[-6,14],[6,14]])K.parts.push(B(x,y,1.6,1.6,0,6,p.w,p.b));});
 // SYLVARA: broad rounded crowns, ivory drums and inhabited living boughs.
 // These forms follow the approved rounded game vocabulary, not needle spires.
 function elvenDome(K,x,y,w,d,z,rise,at=[x,y]){const p=K.p;
  K.parts.push({z0:z,z1:z+rise,side:Q.shade(p.t,-.1),top:Q.mix(p.t,p.b,.16),at,bevel:false,shape(c,t){const f=Math.sqrt(Math.max(.003,1-t*t));c.ellipse(x,y,w*f/2,d*f/2,0,0,T);}});
  K.parts.push(L(c=>{for(const a of [-Math.PI*.78,-Math.PI*.24,Math.PI*.25,Math.PI*.76]){const vs=[];for(let i=0;i<=12;i++){const t=i/12,f=Math.sqrt(Math.max(0,1-t*t));vs.push([x+Math.cos(a)*w*f/2,y+Math.sin(a)*d*f/2,z+rise*t]);}Q.stroke3(c,vs,Q.mix(p.t,p.s,.38),.8);}Q.stroke3(c,[[x,y,z+rise-.5],[x,y,z+rise+3]],p.s,1.4);},at));
  K.roofs.push({type:'rounded_leaf_dome',x,y,w,d,z,rise});
 }
 function groveRoom(K,x,y,w,d,z,wall,rise,cap=true){const p=K.p,a=[x,y];
  K._modules=K._modules||[];if(!K._modules.includes('roundedGroveRoom'))K._modules.push('roundedGroveRoom');
  K.parts.push(E(x,y,w*.52,d*.52,z,2,p.a,p.s,a),E(x,y,w/2,d/2,z+2,wall-2,p.b,p.s,a));
  K.parts.push(E(x,y,w*.53,d*.53,z+wall-1,2,p.a,p.s,a));
  if(cap)elvenDome(K,x,y,w+4,d+4,z+wall+1,rise,a);
  K.parts.push(L(c=>{const yy=y+d*.46;Q.paintPoly(c,[[x-3,yy,z+2],[x+3,yy,z+2],[x+3,yy,z+9],[x,yy,z+12],[x-3,yy,z+9]],p.d,p.s);for(const s of [-1,1]){const xx=x+s*w*.28,wy=y+d*.38;Q.paintPoly(c,[[xx-1.1,wy,z+wall*.43],[xx+1.1,wy,z+wall*.43],[xx+1.1,wy,z+wall*.7],[xx,wy,z+wall*.76],[xx-1.1,wy,z+wall*.7]],Q.mix(p.g,p.b,.62),p.a);}Q.stroke3(c,[[x-w*.43,y+d*.25,z+3],[x-w*.43,y+d*.25,z+wall-2]],p.s,1);Q.stroke3(c,[[x+w*.43,y+d*.25,z+3],[x+w*.43,y+d*.25,z+wall-2]],p.s,1);},a));
  if(z<=4)K.contacts.push([x,y,0]);K.solids.push({type:'ellipse',x,y,rx:w/2,ry:d/2,z0:z,z1:z+wall+rise+4});
 }
 function living(K,x,y,h,r=5){const p=K.p,crown=r*2.8;
  K.parts.push({z0:0,z1:h-4,side:p.w,top:Q.mix(p.w,p.s,.25),at:[x,y],shape(c,t){const rr=r*(1-t*.6);c.ellipse(x+Math.sin(t*3)*r*.5,y-t*4,rr,rr*.82,0,0,T);}});
  for(const s of [-1,1])K.parts.push({z0:h*.24,z1:h*.76,side:Q.mix(p.w,p.b,.12),top:p.w,at:[x,y],shape(c,t){const rr=r*(.72-t*.48);c.ellipse(x+s*(r*.4+Math.sin(t*Math.PI/2)*r*2.5),y-3-t*5,rr,rr*.8,0,0,T);}});
  K.parts.push(L(c=>{for(const s of [-1,1])Q.stroke3(c,[[x+s*r*1.9,y+4,1],[x+s*r*.6,y+2,7],[x,y,h*.38]],Q.mix(p.w,p.b,.22),r*.62);},[x,y+3]));
  K.parts.push({z0:Math.max(3,h-20),z1:h+3,side:'#376f55',top:'#79a373',at:[x,y-7],shape(c,t){const f=Math.sqrt(Math.max(.009,1-(2*t-1)**2));for(const [dx,dy,rr] of [[-.58,0,.66],[.53,-.11,.65],[0,-.52,.72],[-.24,.36,.61],[.42,.39,.52]]){c.moveTo(x+dx*crown+rr*crown*f,y-7+dy*crown);c.ellipse(x+dx*crown,y-7+dy*crown,rr*crown*f,rr*crown*f*.82,0,0,T);}}});
  K.parts.push(L(c=>{for(let i=0;i<11;i++){const a=i*2.4,rr=crown*(.18+.53*(i%4)/3),xx=x+Math.cos(a)*rr,yy=y-7+Math.sin(a)*rr*.6;Q.paintPoly(c,[[xx-1.7,yy,h-3],[xx,yy-1.6,h-1],[xx+1.7,yy,h-3],[xx,yy+1.4,h-4]],'#89ad79');}},[x,y-7]));
  K.contacts.push([x,y,0]);K.solids.push({type:'circle',x,y,r,z0:0,z1:h});
 }
 function leafDeck(K,x,y,w,d,z){K.parts.push({z0:z,z1:z+2,side:K.p.w,top:Q.mix(K.p.s,K.p.w,.2),at:[x,y],rank:-4,shape(c){Q.leaf(c,x,y,w,d);}});rail(K,[[x-w*.3,y+d*.27],[x,y+d*.47],[x+w*.3,y+d*.27]],z+5);}
 function arcTrim(K,x,y,rx,ry,z,a0=0,a1=Math.PI){const vs=[];for(let i=0;i<=24;i++){const a=a0+(a1-a0)*i/24;vs.push([x+Math.cos(a)*rx,y+Math.sin(a)*ry,z]);}K.parts.push(L(c=>Q.stroke3(c,vs,K.p.s,1.5),[x,y+ry]));}
 function groveBalcony(K,x,y,rx,ry,z){const p=K.p,ix=Math.max(1,rx-3.2),iy=Math.max(1,ry-3.2);
  // A balcony is a narrow ring around its shaft, not a filled disc in front
  // of it. Separate the halves so the room occludes the far half correctly.
  for(const front of [false,true]){const a0=front?0:Math.PI,a1=a0+Math.PI;
   K.parts.push({z0:z,z1:z+2,side:p.a,top:p.s,at:[x,y+(front?1:-1)*ry*.5],shape(c){c.moveTo(x+Math.cos(a0)*rx,y+Math.sin(a0)*ry);c.ellipse(x,y,rx,ry,0,a0,a1);c.lineTo(x+Math.cos(a1)*ix,y+Math.sin(a1)*iy);c.ellipse(x,y,ix,iy,0,a1,a0,true);c.closePath();}});
  }
  arcTrim(K,x,y,rx,ry,z+6,.05,Math.PI-.05);K.parts.push(L(c=>{for(const a of [.2,.7,1.25,1.9,2.5,2.95]){const xx=x+Math.cos(a)*rx,yy=y+Math.sin(a)*ry;Q.stroke3(c,[[xx,yy,z+2],[xx,yy,z+6]],p.s,.9);}},[x,y+ry]));
 }
 add('p1_e01','E01','Split crown hearth around a living tree','elf',40,53,[63,67,51],['woodland_dwelling'],K=>{
  living(K,-6,-11,45,5);groveRoom(K,13,-7,29,34,0,17,16);groveRoom(K,-16,14,22,26,0,11,12);groveBalcony(K,-7,4,23,20,2);arcTrim(K,-7,4,23,20,7,.15,2.3);
 });
 add('p1_e02','E02','Forked branch lodge and bridge deck','elf',46,71,[82,70,69],['elevated_lodge','bridge_node'],K=>{
  living(K,1,-13,62,5);leafDeck(K,0,8,74,49,14);groveRoom(K,-14,-12,27,24,16,17,15);groveRoom(K,20,-12,19,18,16,11,10);
  K.parts.push(L(c=>{for(const s of [-1,1]){Q.stroke3(c,[[1,-4,6],[s*13,3,11],[s*28,6,14]],K.p.w,4.6);Q.stroke3(c,[[s*15,3,11],[s*22,-7,16]],Q.mix(K.p.w,K.p.b,.16),3);}},[0,5]));
  K.sockets.push({id:'west_deck',position:[-35,8,14]},{id:'east_deck',position:[35,8,14]});
 });
 add('p1_e03','E03','Three crowns and the ancient living council court','elf',129,139,[218,198,137],['council_landmark'],(K,opt)=>{
  const p=K.p;K.parts.push(E(0,4,93,80,0,6,p.a,p.b,[0,4],-6));
  // Three broad crowns form an open horseshoe; the lower court stays visible.
  groveRoom(K,-5,-46,65,58,6,84,35);groveBalcony(K,-5,-46,36,32,51);
  groveRoom(K,-63,-4,48,54,6,48,28);groveRoom(K,61,-5,51,57,6,58,30);
  groveBalcony(K,-63,-4,27,30,25);groveBalcony(K,61,-5,29,32,30);
  living(K,0,13,72,10);groveBalcony(K,0,15,33,27,6);
  // Low inhabited wings and a front arcade frame the tree without covering it.
  groveRoom(K,-48,36,27,33,6,17,14);groveRoom(K,48,36,28,35,6,22,16);
  for(const x of [-37,-18,18,37])K.parts.push(E(x,55,2.6,3.5,6,19,p.b,p.s));
  Q.arch(K,0,55,29,7,6,9,10,2.4,p.b);arcTrim(K,0,30,54,30,28,.13,Math.PI-.13);
  K.parts.push(L(c=>{for(const s of [-1,1])Q.paintPoly(c,[[s*34,57,13],[s*38,57,18],[s*34,57,23],[s*30,57,18]],Q.mix(p.g,p.b,.7),p.s);},[0,57]));
  steps(K,0,73,45,25,6,6);arcTrim(K,0,4,92,78,8,0,Math.PI*.86);flag(K,-5,-46,123,opt);
  K.sockets.push({id:'court',position:[0,83,0]},{id:'approach',position:[0,87,0],clearWidth:40});
 });
 add('p1_e_crescent','E04','Low moss garden hearth and open porch','elf',31,36,[54,47,34],['dwelling'],K=>{groveRoom(K,6,-4,32,30,0,10,13);leafDeck(K,-16,3,24,26,2);K.parts.push(E(-20,-5,2,2,0,13,K.p.w,K.p.w));elvenDome(K,-14,-1,24,18,13,6);arcTrim(K,-11,2,15,16,4,.15,Math.PI);});
 add('p1_e_longcrescent','E05','Long weaving house with layered rounded eaves','elf',39,48,[61,69,46],['weaving_house','dwelling'],K=>{groveRoom(K,8,-9,35,50,0,20,18);groveRoom(K,-16,15,23,27,0,11,11);groveBalcony(K,8,-9,20,27,12);K.parts.push(L(c=>{for(const x of [-21,-13])Q.stroke3(c,[[x,25,1],[x,25,8]],K.p.w,1.2);Q.stroke3(c,[[-23,25,6],[-11,25,6]],K.p.s,2.2);},[-16,25]));});
 add('p1_e_petals','E06','Three unequal rounded family chambers','elf',40,57,[66,63,55],['family_house'],K=>{groveRoom(K,-16,-8,28,35,0,24,19);groveRoom(K,15,-1,26,32,0,14,13);groveRoom(K,-3,20,23,27,0,9,10);groveBalcony(K,-16,-8,16,20,15);});
 add('p1_e_treehouse','E07','Two level elder tree dwelling','elf',42,85,[70,66,83],['tree_integrated_home'],K=>{
  living(K,-2,-5,78,7);leafDeck(K,2,10,64,50,15);groveRoom(K,17,8,26,30,17,12,12);leafDeck(K,-11,-7,43,35,40);groveRoom(K,-16,-10,24,27,42,15,14);
  K.parts.push(L(c=>{Q.stroke3(c,[[20,24,0],[14,21,7],[3,15,15],[-7,7,40]],K.p.w,4);Q.stroke3(c,[[20,24,2],[14,21,9],[3,15,17],[-7,7,42]],K.p.s,1.1);},[4,20]));
 });
 add('p1_e_hall','E08','Broad three-lobed communal song hall','elf',58,69,[97,95,67],['communal_hall'],K=>{groveRoom(K,2,-13,61,56,0,27,25);groveRoom(K,-32,13,26,34,0,13,15);groveRoom(K,27,22,29,33,0,17,15);Q.arch(K,-3,32,24,6,0,10,8,2.5,K.p.b);elvenDome(K,-3,24,37,22,24,8);arcTrim(K,0,9,45,35,3);K.parts.push(L(c=>{for(const x of [-14,-3,8])Q.stroke3(c,[[x,10,30],[x,10,42]],K.p.s,1.2);},[-3,10]));});
 add('p1_e_shrine','E09','Open moon pool and woodland shrine','elf',32,55,[49,52,53],['woodland_shrine'],K=>{const p=K.p;K.parts.push(E(0,0,22,22,0,3,p.a,p.b),E(0,6,11,8,3,.5,p.s,'#5b9f98'));
  for(const x of [-15,15]){K.parts.push(E(x,-5,3,3,3,26,p.b,p.s));elvenDome(K,x,-5,11,10,29,9);}
  Q.arch(K,0,-4,25,5,3,15,12,2.2,p.b);arcTrim(K,0,0,21,21,6,.15,Math.PI-.15);living(K,0,-15,45,4);K.parts.push(E(0,6,2,2,3,5,p.b,p.g));
 });
 add('p1_e_archive','E10','Tiered round archive and reading bower','elf',35,104,[58,59,102],['archive','landmark'],K=>{groveRoom(K,-6,-8,31,32,0,66,25);groveBalcony(K,-6,-8,20,21,29);groveBalcony(K,-6,-8,19,20,53);groveRoom(K,14,10,25,30,0,16,16);K.parts.push(L(c=>{for(const s of [-1,1])Q.stroke3(c,[[s*6-6,6,39],[s*6-6,6,49]],K.p.s,1.1);},[-6,6]));});
 add('p1_e_garden','E11','Open reading pergola and garden court','elf',44,43,[76,72,41],['garden','sheltered_court'],K=>{const p=K.p;groveRoom(K,-21,-13,24,33,0,12,17);for(const x of [15,28])K.parts.push(E(x,-15,1.7,2,0,14,p.w,p.w));elvenDome(K,22,-15,26,25,14,8);arcTrim(K,0,0,32,27,3,0,Math.PI*.85);for(const [x,y] of [[-15,11],[15,8],[0,25]])K.parts.push(E(x,y,7,5,0,2,p.a,'#789652'));K.parts.push(E(0,0,6,8,0,2,p.b,'#548d88'));});
 add('p1_e_bridge','E-M08','Woven bough bridge with curved ivory rails','elf',31,23,[48,13,21],['visual_bridge'],K=>{
  const p=K.p;K.parts.push({z0:14,z1:17,side:p.w,top:p.s,shape(c){c.rect(-24,-5,48,10);}});
  for(const side of [-1,1]){const vs=[],bough=[];for(let i=0;i<=16;i++){const x=-24+i*3;vs.push([x,side*5,18+3*Math.sin(i*Math.PI/16)]);bough.push([x,side*4,14-4*Math.sin(i*Math.PI/16)]);}K.parts.push(L(c=>{Q.stroke3(c,bough,p.w,2);Q.stroke3(c,vs,p.s,1.3);for(const x of [-18,-9,0,9,18]){const q=(x+24)/48;Q.stroke3(c,[[x,side*5,16],[x,side*5,18+3*Math.sin(q*Math.PI)]],p.s,.75);}},[0,side*5]));}
  K.contacts.push([-24,0,0],[24,0,0]);K.sockets.push({id:'west_deck',position:[-24,0,14]},{id:'east_deck',position:[24,0,14]});
 },4);
 add('p1_e_rootgate','E-M03','Living root gate and rounded leaf crest','elf',47,53,[82,29,51],['woodland_gate'],K=>{living(K,-25,0,38,4);living(K,25,0,32,4);Q.arch(K,0,0,39,8,0,19,17,3,K.p.b);elvenDome(K,-5,0,28,18,39,9);K.sockets.push({id:'passage',position:[0,12,0],clearWidth:36});},4);
 add('p1_e_platform','E-M07','Split branch gathering platform','elf',32,22,[55,49,20],['platform'],K=>{living(K,-11,-9,18,3);living(K,12,-7,16,3);leafDeck(K,0,0,51,44,12);});
 // CULTURES
 (AS.Gallery=AS.Gallery||[]).push(...['human','elf','dwarf'].map(f=>({group:'Phase 1 '+f,bg:f==='dwarf'?'neutral':f,items:A.assets.filter(a=>a.family===f).map(a=>({name:a.designId+' '+a.name,gen:a.id,pal:Q.defaults[f],dirs:a.dirs,anims:1}))})));
})(window.AS=window.AS||{});
