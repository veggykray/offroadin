/* Dragon Wars Phase 1. Reusable source geometry for the existing Sprite Forge.
 * No gameplay imports. Uses the same parts, palette, lighting and outline contract.
 * Projection overlays follow the convention used by existing human models;
 * rotated overlays inverse-project height so z remains screen-up at every heading. */
'use strict';
(function(AS){
  const A=AS.ArchP1=AS.ArchP1||{},C=AS.U.C,S=AS.Shapes,T=Math.PI*2;
  const hex=c=>'#'+C.hex(c).map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
  const shade=(c,k)=>hex(C.shade(c,k)),mix=(a,b,t)=>hex(C.mix(a,b,t));
  const defaults={human:{a:'#8a7f74',b:'#d2c7b4',t:'#b0482c',g:'#ffcf6a',d:'#3e3028',k:'#b8262a',k2:'#e8b84a',w:'#5a3a24',s:'#e6dac0'},elf:{a:'#97a690',b:'#efe9d6',t:'#2f8a6a',g:'#7affd8',d:'#2e3d30',k:'#23794a',k2:'#e3eaa8',w:'#6a5236',s:'#cfe0c0'},dwarf:{a:'#6a6660',b:'#b8b0a0',t:'#4a4e56',g:'#ffb050',d:'#2a2622',k:'#9a3a2a',k2:'#e0b050',w:'#5a4030',s:'#a49c8c'}};
  function palette(f,p){const q=Object.assign({},defaults[f]);for(const k in q)if(p&&typeof p[k]==='string')q[k]=p[k];return q;}
  function polygon(c,v){c.moveTo(v[0][0],v[0][1]);for(let i=1;i<v.length;i++)c.lineTo(v[i][0],v[i][1]);c.closePath();}
  function leaf(c,x,y,w,d,f=1){c.moveTo(x,y-d*f/2);c.bezierCurveTo(x+w*f/2,y-d*f*.4,x+w*f*.62,y+d*f*.25,x,y+d*f/2);c.bezierCurveTo(x-w*f*.62,y+d*f*.25,x-w*f/2,y-d*f*.4,x,y-d*f/2);c.closePath();}
  const angle=c=>{const t=c.getTransform();return Math.atan2(t.b,t.a);};
  const project=(v,a)=>[v[0]-Math.sin(a)*v[2],v[1]-Math.cos(a)*v[2]];
  function paintPoly(c,v,col,stroke){const a=angle(c);c.beginPath();polygon(c,v.map(p=>project(p,a)));c.fillStyle=col;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=.45;c.stroke();}}
  function stroke3(c,vs,col,width=1){const a=angle(c);c.beginPath();vs.forEach((p,i)=>{const q=project(p,a);if(i)c.lineTo(...q);else c.moveTo(...q);});c.strokeStyle=col;c.lineWidth=width;c.stroke();}
  function layer(fn,at,rank=0){return{z0:0,z1:0,side:'#000000',top:'#000000',flat:true,bevel:false,at,rank,shape(){},detail(c){c.save();fn(c);c.restore();}};}
  function block(x,y,w,d,z,h,side,top,at,rank=0){return{z0:z,z1:z+h,side,top,at:at||[x,y],rank,shape(c){c.rect(x-w/2,y-d/2,w,d);}};}
  function ellipse(x,y,rx,ry,z,h,side,top,at,rank=0){return{z0:z,z1:z+h,side,top,at:at||[x,y],rank,shape(c){c.ellipse(x,y,rx,ry,0,0,T);}};}
  function groupSort(parts){const original=new Map(parts.map((p,i)=>[p,i]));const all=[{z0:0,z1:0,flat:true,shape(c){const a=angle(c),ca=Math.cos(a),sa=Math.sin(a);const order=all.slice(1).map(p=>({p,i:original.get(p),rank:p.rank||0,depth:(p.at?.[0]||0)*sa+(p.at?.[1]||0)*ca}));order.sort((a,b)=>a.rank-b.rank||a.depth-b.depth||a.i-b.i);for(let i=0;i<order.length;i++)all[i+1]=order[i].p;}}].concat(parts);return all;}
  function roof(K,x,y,w,d,z,rise,axis='x',at){
    const p=K.p,anchor=at||[x,y];
    K.parts.push({z0:z,z1:z+rise,side:shade(p.t,-.12),top:p.t,bevel:false,ao:.08,at:anchor,shape(c,t){const f=Math.max(.012,1-t);c.rect(x-w/2*(axis==='y'?f:1),y-d/2*(axis==='x'?f:1),w*(axis==='y'?f:1),d*(axis==='x'?f:1));}});
    const a=[x-w/2,y-d/2,z],b=[x+w/2,y-d/2,z],cc=[x+w/2,y+d/2,z],dd=[x-w/2,y+d/2,z];
    const rr=axis==='x'?[[x-w/2,y,z+rise],[x+w/2,y,z+rise]]:[[x,y-d/2,z+rise],[x,y+d/2,z+rise]];
    const faces=axis==='x'?[[a,b,rr[1],rr[0]],[rr[0],rr[1],cc,dd]]:[[a,rr[0],rr[1],dd],[rr[0],b,cc,rr[1]]];
    K.parts.push(layer(c=>{
      const heading=angle(c),view=[Math.sin(heading),Math.cos(heading)];
      const dirs=axis==='x'?[[0,-1],[0,1]]:[[-1,0],[1,0]];
      const order=[0,1].sort((i,j)=>(dirs[i][0]*view[0]+dirs[i][1]*view[1])-(dirs[j][0]*view[0]+dirs[j][1]*view[1]));
      for(const i of order){const nx=dirs[i][0]*Math.cos(heading)-dirs[i][1]*Math.sin(heading),ny=dirs[i][0]*Math.sin(heading)+dirs[i][1]*Math.cos(heading);paintPoly(c,faces[i],shade(p.t,Math.max(-.24,Math.min(.18,-nx*.16-ny*.12))),shade(p.d,-.1));}
      stroke3(c,rr,shade(p.t,.25),.75);
      // Broad tiled courses follow the existing game roofs; no per-tile parts.
      for(const t of [.15,.3,.45,.6,.75,.9]){
        if(axis==='x')stroke3(c,[[x-w/2,y+d/2*(1-t),z+rise*t],[x+w/2,y+d/2*(1-t),z+rise*t]],'rgba(40,18,12,.18)',.32);
        else stroke3(c,[[x+w/2*(1-t),y-d/2,z+rise*t],[x+w/2*(1-t),y+d/2,z+rise*t]],'rgba(40,18,12,.18)',.32);
      }
      for(let j=0;j<4;j++){
        const t=.16+j*.19,tt=t+.16;
        for(let i=0;i<5;i++){
          const u=(i+.3+(j%2)*.4)/5;
          if(axis==='x')stroke3(c,[[x-w/2+w*u,y+d/2*(1-t),z+rise*t],[x-w/2+w*u,y+d/2*(1-tt),z+rise*tt]],'rgba(45,23,15,.14)',.25);
          else stroke3(c,[[x+w/2*(1-t),y-d/2+d*u,z+rise*t],[x+w/2*(1-tt),y-d/2+d*u,z+rise*tt]],'rgba(45,23,15,.14)',.25);
        }
      }
      if(K.family==='dwarf'){
        // Fitted slate courses read as broad panels at flight distance.
        for(const s of [-1,1])for(let row=0;row<5;row++){
          const lo=row/5,hi=(row+1)/5,n=Math.max(3,Math.round((axis==='y'?d:w)/11));
          const pt=(u,t)=>axis==='y'?[x+s*w/2*(1-t),y-d/2+d*u,z+rise*t]:[x-w/2+w*u,y+s*d/2*(1-t),z+rise*t];
          for(let j=0;j<n;j++)paintPoly(c,[pt(j/n,lo),pt((j+1)/n,lo),pt((j+1)/n,hi),pt(j/n,hi)],shade(p.t,(s<0?.1:-.07)+((j+row*3)%4-1.5)*.035),mix(p.d,p.t,.3));
        }
        stroke3(c,rr,mix(p.b,p.g,.13),2.2);
      }
    },anchor));
    K.roofs.push({type:'gable',x,y,w,d,z,rise,axis});
  }
  function face(K,x,y,w,z,h,at,windows=true,timber=false){const p=K.p;K.parts.push(layer(c=>{
    const a=angle(c);if(Math.cos(a)<.05)return;
    if(timber){for(const xx of [x-w/2+1,x,x+w/2-1])stroke3(c,[[xx,y,z],[xx,y,z+h]],p.w,1.1);stroke3(c,[[x-w/2,y,z+h*.5],[x+w/2,y,z+h*.5]],p.w,1);
      for(const s of [-1,1])stroke3(c,[[x+s*w*.47,y,z+h*.54],[x+s*w*.28,y,z+h*.95]],p.w,.75);
    }
    const dw=Math.min(5,w*.2),dh=Math.min(7,h*.7);
    paintPoly(c,[[x-dw/2,y+.06,z],[x+dw/2,y+.06,z],[x+dw/2,y+.06,z+dh],[x-dw/2,y+.06,z+dh]],p.d,p.w);
    if(windows)for(const xx of [x-w*.3,x+w*.3]){
      paintPoly(c,[[xx-1.3,y+.07,z+h*.36],[xx+1.3,y+.07,z+h*.36],[xx+1.3,y+.07,z+h*.36+3],[xx-1.3,y+.07,z+h*.36+3]],mix(p.g,p.b,.35),p.d);
      stroke3(c,[[xx,y+.09,z+h*.36],[xx,y+.09,z+h*.36+3]],p.w,.5);
    }
  },at||[x,y]));}
  function hall(K,x,y,w,d,height,rise,axis='x',timber=false){const p=K.p,at=[x,y];
    K.parts.push(block(x,y,w+2,d+2,0,2,p.d,p.a,at));
    K.parts.push(block(x,y,w,d,2,height-2,timber?p.s:p.a,p.b,at));face(K,x,y+d/2,w,2,height-2,at,true,timber);
    roof(K,x,y,w+3,d+3,height,rise,axis,at);
    K.contacts.push([x-w/2,y-d/2,0],[x+w/2,y-d/2,0],[x+w/2,y+d/2,0],[x-w/2,y+d/2,0]);
    K.solids.push({type:'box',x,y,w,d,z0:0,z1:height+rise});
  }
  function tower(K,x,y,r,shaft,cap,at){const p=K.p,a=at||[x,y];
    K.parts.push(ellipse(x,y,r+1,r+1,0,2,p.d,p.a,a),ellipse(x,y,r,r,2,shaft-2,p.a,p.b,a));
    K.parts.push({z0:shaft,z1:shaft+cap,side:shade(p.t,-.15),top:p.t,at:a,shape(c,t){c.arc(x,y,(r+1.6)*Math.max(.035,1-t),0,T);}});
    face(K,x,y+r,2*r,4,shaft-6,a,true,false);
    K.roofs.push({type:'circle',x,y,r:r+1.6});K.contacts.push([x,y,0]);K.solids.push({type:'circle',x,y,r,z0:0,z1:shaft+cap});
  }
  function leafRoom(K,x,y,w,d,z,wall,rise,at){const p=K.p,a=at||[x,y];
    K.parts.push({z0:z,z1:z+wall,side:p.b,top:mix(p.b,'#ffffff',.12),at:a,shape(c){leaf(c,x,y,w,d);}});
    face(K,x,y+d*.35,w*.65,z,wall,a,true,false);
    K.parts.push({z0:z+wall,z1:z+wall+rise,side:shade(p.t,-.15),top:mix(p.t,p.b,.12),ao:.1,at:a,shape(c,t){leaf(c,x,y,w+4,d+4,Math.sqrt(Math.max(.002,1-t*t)));}});
    K.parts.push(layer(c=>{
      for(const phi of [-.72,0,.72]){const vs=[];for(let i=0;i<=16;i++){const t=i/16,f=Math.sqrt(Math.max(0,1-t*t));vs.push([x+Math.sin(phi)*(w+4)*.4*f,y+Math.cos(phi)*(d+4)*.47*f,z+wall+rise*t]);}stroke3(c,vs,mix(p.t,p.s,.3),.45);}
      // Thin ivory door surround repeats the established Sylvaran trim.
      const yy=y+d*.35;stroke3(c,[[x-2.6,yy,z],[x-2.6,yy,z+7.8],[x+2.6,yy,z+7.8],[x+2.6,yy,z]],p.s,.6);
    },a));
    K.roofs.push({type:'leaf',x,y,w:w+4,d:d+4});if(z<=4)K.contacts.push([x,y,0]);K.solids.push({type:'ellipse',x,y,rx:w*.48,ry:d*.48,z0:z,z1:z+wall+rise});
  }
  function trunk(K,x,y,height,root=3,crown=false){const p=K.p,at=[x,y];
    K.contacts.push([x,y,0]);K.solids.push({type:'circle',x,y,r:root,z0:0,z1:height});
    K.parts.push(ellipse(x,y,root,root,0,height,p.w,mix(p.w,p.s,.3),at));
    K.parts.push(layer(c=>{for(const side of [-1,1])stroke3(c,[[x,y,height*.7],[x+side*6,y-2,height*.94]],mix(p.w,p.s,.35),2.7);},at));
    if(crown)K.parts.push({z0:height-8,z1:height+8,side:'#2d6555',top:'#659c7d',at,shape(c,t){const f=Math.sqrt(Math.max(.015,1-(2*t-1)**2));for(const [dx,dy,r] of [[-5,0,7],[5,-2,6],[0,4,6]]){c.moveTo(x+dx+r*f,y+dy);c.arc(x+dx,y+dy,r*f,0,T);}}});
  }
  function yard(K,x,y,w,d){const p=K.p;K.parts.push(block(x,y,w,d,0,.45,mix(p.a,p.b,.25),mix(p.a,p.b,.25),[x,y],-8));for(const dx of [-w/2,w/2])for(const dy of [-d/2,d/2])K.contacts.push([x+dx,y+dy,0]);}
  function wall(K,x,y,length,thick,height){const p=K.p,at=[x,y];K.parts.push(block(x,y,length,thick,0,height,p.a,p.b,at));
    K.parts.push({z0:height,z1:height+2.5,side:p.a,top:p.b,at,shape(c){const alongY=thick>length*2,span=alongY?thick:length,n=Math.max(2,Math.round(span/7));for(let i=0;i<n;i++)if(alongY)c.rect(x-length/2,y-thick/2+i*thick/n,length,thick/n*.55);else c.rect(x-length/2+i*length/n,y-thick/2,length/n*.55,thick);}});K.solids.push({type:'box',x,y,w:length,d:thick,z0:0,z1:height+2.5});K.contacts.push([x-length/2,y,0],[x+length/2,y,0]);}
  function ore(K,x,y){const p=K.p;K.parts.push({z0:0,z1:5,side:p.d,top:mix(p.a,p.b,.3),at:[x,y],shape(c,t){for(let i=0;i<4;i++)c.rect(x-6+i*3,y-3,3*(1-t*.4),6*(1-t*.3));}});K.parts.push(block(x,y+4,16,2,0,4,p.w,mix(p.w,p.b,.2)));}
  function finish(K,r,h){return{r,h,style:'unit',bevel:.8,parts:groupSort(K.parts),_arch:{roofs:K.roofs,contacts:K.contacts,solids:K.solids}};}
  // Structural additions for the correction: these alter footprints and massing,
  // rather than applying a different colour to the old barracks / leaf rooms.
  // Dwarven stone is assembled, not a smooth extrusion. One overlay per mass
  // paints broad fitted stones on exposed faces and the overhead slab surface.
  // Courses remain 6–9 world units high: visible at the actual play camera.
  function masonry(K,vs,z,h,side,top,at=[0,0],rank=0,cap=true){
    if(K.family!=='dwarf'||h<2)return;
    const p=K.p,course=Math.max(5,Math.min(9,h/Math.max(1,Math.round(h/7)))),dark=mix(p.d,p.a,.35);
    if(K.coarseMasonry){
      // Small multi-heading wall bays use broad inset joints only. Keeping
      // overlay strokes away from the extrusion silhouette also avoids
      // platform-dependent edge antialiasing from stacked clipped polygons.
      K.parts.push(layer(c=>{const a=angle(c),view=[Math.sin(a),Math.cos(a)];
        for(let e=0;e<vs.length;e++){
          const v=vs[e],q=vs[(e+1)%vs.length],dx=q[0]-v[0],dy=q[1]-v[1],len=Math.hypot(dx,dy);
          if(len<5||(dy*view[0]-dx*view[1])/len<.1)continue;
          const inset=Math.min(.18,1.2/len),pt=(u,zz)=>[v[0]+dx*u,v[1]+dy*u,zz];
          for(let zz=z+7;zz<z+h-1;zz+=7)stroke3(c,[pt(inset,zz),pt(1-inset,zz)],dark,.8);
          if(len>14)for(let row=0,zz=z+1;zz<z+h-2;zz+=7,row++){
            const u=row%2?.35:.65;stroke3(c,[pt(u,zz),pt(u,Math.min(z+h-1,zz+5))],dark,.75);
          }
        }
      },at,rank));return;
    }
    K.parts.push(layer(c=>{
      const a=angle(c),view=[Math.sin(a),Math.cos(a)];
      for(let e=0;e<vs.length;e++){
        const v=vs[e],q=vs[(e+1)%vs.length],dx=q[0]-v[0],dy=q[1]-v[1],len=Math.hypot(dx,dy);
        if(len<3||(dy*view[0]-dx*view[1])/len<.015)continue;
        const nx=dy/len,ny=-dx/len,light=-.12*(nx*Math.cos(a)-ny*Math.sin(a))-.14*(nx*Math.sin(a)+ny*Math.cos(a));
        const base=shade(mix(side,p.b,.13),light);
        for(let row=0,zz=z;zz<z+h-.05;row++,zz+=course){
          const high=Math.min(z+h,zz+course),bw=Math.max(8,Math.min(17,len/Math.max(1,Math.round(len/14))));
          for(let s=-(row%2)*bw*.48,ix=0;s<len;ix++,s+=bw){
            const u=Math.max(0,s)/len,t=Math.min(len,s+bw)/len;if(t<=u)continue;
            const col=shade(base,((row*3+ix*5+e*2)%7-3)*.018);
            paintPoly(c,[[v[0]+dx*u,v[1]+dy*u,zz],[v[0]+dx*t,v[1]+dy*t,zz],[v[0]+dx*t,v[1]+dy*t,high],[v[0]+dx*u,v[1]+dy*u,high]],col,dark);
            stroke3(c,[[v[0]+dx*u,v[1]+dy*u,high-.45],[v[0]+dx*t,v[1]+dy*t,high-.45]],shade(col,.16),.45);
          }
        }
      }
      if(cap){
        c.save();c.beginPath();polygon(c,vs.map(v=>project([...v,z+h],a)));c.clip();
        const xs=vs.map(v=>v[0]),ys=vs.map(v=>v[1]),minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys),cw=Math.max(8,Math.min(18,(maxx-minx)/3)),ch=Math.max(6,Math.min(14,(maxy-miny)/3));
        for(let yy=miny,row=0;yy<maxy;yy+=ch,row++)for(let xx=minx-cw*(row%2)*.5,ix=0;xx<maxx;xx+=cw,ix++){
          const col=shade(mix(top,p.s,.12),((row*5+ix*3)%7-3)*.023);
          paintPoly(c,[[xx,yy,z+h],[xx+cw,yy,z+h],[xx+cw,yy+ch,z+h],[xx,yy+ch,z+h]],col,dark);
        }c.restore();
      }
    },at,rank));
  }
  function polyPrism(K,vs,z,h,side,top,at=[0,0],rank=0){K.parts.push({z0:z,z1:z+h,side,top,at,rank,shape(c){polygon(c,vs);}});masonry(K,vs,z,h,side,top,at,rank);}
  function oct(K,x,y,w,d,z,h,col=K.p.a,cap=K.p.b,cut=.22){
    const a=w/2,b=d/2,vs=[[x-a+cut*w,y-b],[x+a-cut*w,y-b],[x+a,y-b+cut*d],[x+a,y+b-cut*d],[x+a-cut*w,y+b],[x-a+cut*w,y+b],[x-a,y+b-cut*d],[x-a,y-b+cut*d]];
    polyPrism(K,vs,z,h,col,cap,[x,y]);return vs;
  }
  function support(K,x,y,w,d,h){K.contacts.push([x-w/2,y-d/2,0],[x+w/2,y+d/2,0]);K.solids.push({type:'box',x,y,w,d,z0:0,z1:h});}
  function hip(K,x,y,w,d,z,rise,ridge=.3){const p=K.p;
    K.parts.push({z0:z,z1:z+rise,side:shade(p.t,-.1),top:p.t,bevel:false,at:[x,y],shape(c,t){const f=1-t; c.rect(x-w/2*f,y-d/2*(f+ridge*t),w*f,d*(f+ridge*t));}});
    K.parts.push(layer(c=>{stroke3(c,[[x,y-d*ridge/2,z+rise],[x,y+d*ridge/2,z+rise]],shade(p.t,.28),1);for(const s of [-1,1])stroke3(c,[[x+s*w/2,y+d/2,z],[x,y+d*ridge/2,z+rise]],shade(p.t,.2),.7);},[x,y]));
    K.roofs.push({type:'hip',x,y,w,d,z,rise});
  }
  function vault(K,x,y,w,d,z,rise,axis='y',stone=true){const p=K.p;
    K.parts.push({z0:z,z1:z+rise,side:stone?mix(p.a,p.b,.24):shade(p.t,-.12),top:stone?p.b:p.t,bevel:false,at:[x,y],shape(c,t){const f=Math.sqrt(Math.max(.002,1-t*t));c.rect(x-w/2*(axis==='y'?f:1),y-d/2*(axis==='x'?f:1),w*(axis==='y'?f:1),d*(axis==='x'?f:1));}});
    K.parts.push(layer(c=>{const col=stone?shade(p.b,-.2):mix(p.t,p.b,.25);for(const q of [-.3,0,.3]){const vs=[];for(let i=0;i<=20;i++){const t=i/20*Math.PI,uu=Math.cos(t),zz=Math.sin(t);vs.push(axis==='y'?[x+w/2*uu,y+q*d,z+rise*zz]:[x+q*w,y+d/2*uu,z+rise*zz]);}stroke3(c,vs,col,stone?1.2:.55);}stroke3(c,axis==='y'?[[x,y-d/2,z+rise],[x,y+d/2,z+rise]]:[[x-w/2,y,z+rise],[x+w/2,y,z+rise]],stone?p.b:shade(p.t,.25),1.3);},[x,y]));
    if(K.family==='dwarf'){
      // Large curved roof slabs, stepped joints and raised transverse stone ribs.
      // Blue-grey infill and warm limestone ribs separate roof from wall.
      const span=axis==='y'?d:w,bays=Math.max(3,Math.round(span/13)),across=8;
      const pt=(t,v,dz=0)=>axis==='y'?[x+Math.cos(t)*w/2,y+v,z+Math.sin(t)*rise+dz]:[x+v,y+Math.cos(t)*d/2,z+Math.sin(t)*rise+dz];
      K.parts.push(layer(c=>{
        for(let j=0;j<bays;j++)for(let i=0;i<across;i++){
          const t0=i*Math.PI/across,t1=(i+1)*Math.PI/across,v0=-span/2+j*span/bays,v1=v0+span/bays;
          paintPoly(c,[pt(t0,v0),pt(t1,v0),pt(t1,v1),pt(t0,v1)],shade(mix(p.t,p.a,.38),.19*Math.sin(t0+.2)+((i+j*2)%3-1)*.035),mix(p.d,p.a,.15));
        }
        for(let j=0;j<=bays;j++){
          const v=-span/2+j*span/bays,vs=[];for(let i=0;i<=20;i++)vs.push(pt(i*Math.PI/20,v,.45));
          stroke3(c,vs,mix(p.b,p.s,.12),2.2);stroke3(c,vs,shade(p.b,.12),.55);
        }
        stroke3(c,[pt(Math.PI/2,-span/2,.6),pt(Math.PI/2,span/2,.6)],mix(p.b,p.g,.12),2.3);
      },[x,y]));
    }
    K.roofs.push({type:'vault',x,y,w,d,z,rise,axis});
  }
  function arch(K,x,y,w,d,z,spring,rise,thick=4,col=K.p.a){const p=K.p;
    K.parts.push({z0:z,z1:z+spring+rise+thick,side:col,top:p.b,at:[x,y],shape(c,t){const zz=t*(spring+rise+thick),hw=w/2;
      const hole=zz<=spring?hw:zz<spring+rise?hw*Math.sqrt(Math.max(0,1-((zz-spring)/rise)**2)):0;
      c.rect(x-hw-thick,y-d/2,hw+thick-hole,d);c.rect(x+hole,y-d/2,hw+thick-hole,d);}});
    // Actual block-shaped faces with a proud keystone; retain smooth native
    // shading in the extrusion and simple broad joints in the visible facade.
    K.parts.push(layer(c=>{const a=angle(c);if(Math.cos(a)<0)return;
      if(K.family==='dwarf'){
        const yy=y+d/2+.03,n=w>30?11:7;
        for(let i=0;i<n;i++){
          const a0=i*Math.PI/n+.008,a1=(i+1)*Math.PI/n-.008,outer=thick+(i===Math.floor(n/2)?1:0),v=[];
          for(let j=0;j<=4;j++){const t=a0+(a1-a0)*j/4;v.push([x+Math.cos(t)*w/2,yy,z+spring+Math.sin(t)*rise]);}
          for(let j=4;j>=0;j--){const t=a0+(a1-a0)*j/4;v.push([x+Math.cos(t)*(w/2+outer),yy,z+spring+Math.sin(t)*(rise+outer)]);}
          paintPoly(c,v,shade(mix(p.b,col,.24),(i%3-1)*.04),mix(p.d,p.a,.25));
        }
        for(const s of [-1,1])for(let zz=0,row=0;zz<spring;zz+=7,row++){
          const top=Math.min(spring,zz+7),lo=x+s*w/2,hi=x+s*(w/2+thick);
          paintPoly(c,[[lo,yy,z+zz],[hi,yy,z+zz],[hi,yy,z+top],[lo,yy,z+top]],shade(mix(p.b,col,.34),(row%3-1)*.04),mix(p.d,p.a,.25));
        }
      }else for(let i=0;i<=8;i++){const phi=i*Math.PI/8;stroke3(c,[[x+Math.cos(phi)*w/2,y+d/2,z+spring+Math.sin(phi)*rise],[x+Math.cos(phi)*(w/2+thick),y+d/2,z+spring+Math.sin(phi)*(rise+thick)]],shade(p.a,-.23),.7);}
    },[x,y]));
    K.contacts.push([x-w/2-thick/2,y,0],[x+w/2+thick/2,y,0]);
    for(const s of [-1,1])K.solids.push({type:'box',x:x+s*(w/2+thick/2),y,w:thick,d,z0:z,z1:z+spring+rise+thick});
  }
  function carved(K,x,y,w,h,z=0){const p=K.p;K.parts.push(layer(c=>{if(Math.cos(angle(c))<0)return;
    for(const s of [-1,1])stroke3(c,[[x+s*w*.42,y,z+2],[x+s*w*.42,y,z+h-3],[x+s*w*.28,y,z+h-3],[x+s*w*.28,y,z+h*.58]],p.b,1.5);
    paintPoly(c,[[x,y,z+h*.34],[x+w*.14,y,z+h*.5],[x,y,z+h*.66],[x-w*.14,y,z+h*.5]],mix(p.b,p.t,.2),shade(p.a,-.15));
  },[x,y]));}
  function stoneHall(K,x,y,w,d,wallH,rise,axis='y'){
    const p=K.p;oct(K,x,y,w+5,d+5,0,3,p.d,p.b,.08);oct(K,x,y,w,d,3,wallH-3,p.a,p.b,.09);support(K,x,y,w,d,wallH+rise);
    vault(K,x,y,w+3,d+3,wallH,rise,axis,true);
    for(const sx of [-1,1])for(const yy of [-d*.32,d*.32]){oct(K,x+sx*(w/2-2),y+yy,7,10,0,wallH+4,p.a,p.b,.2);}
    arch(K,x,y+d/2+1,Math.min(14,w*.28),5,1,wallH*.44,wallH*.3,3);face(K,x,y+d/2+.1,w*.8,3,wallH-4,[x,y+d/2],true,false);
    carved(K,x,y+d/2+.2,w,wallH);K.sockets.push({id:'door',position:[x,y+d/2+4,0],normal:[0,1,0]});
  }
  function crescentPath(c,x,y,w,d,f=1,flip=1){
    c.moveTo(x-w*.48*f,y-d*.42*f);c.bezierCurveTo(x+w*.52*f,y-d*.75*f,x+w*.69*f,y+d*.66*f,x-w*.48*f,y+d*.42*f);
    c.bezierCurveTo(x+w*.15*f*flip,y+d*.18*f,x+w*.12*f*flip,y-d*.18*f,x-w*.48*f,y-d*.42*f);c.closePath();
  }
  function crescent(K,x,y,w,d,z,wallH,rise){const p=K.p;
    K.parts.push({z0:z,z1:z+wallH,side:p.b,top:p.s,at:[x,y],shape(c){crescentPath(c,x,y,w,d);}});
    K.parts.push({z0:z+wallH,z1:z+wallH+rise,side:p.t,top:mix(p.t,p.b,.15),at:[x,y],shape(c,t){crescentPath(c,x,y,w+4,d+4,Math.sqrt(Math.max(.008,1-t*t)));}});
    K.parts.push(layer(c=>{stroke3(c,[[x-w*.46,y-d*.4,z+wallH],[x+w*.13,y,z+wallH+rise],[x-w*.46,y+d*.4,z+wallH]],mix(p.t,p.b,.35),1);},[x,y]));
    K.roofs.push({type:'crescent',x,y,w:w+4,d:d+4});K.contacts.push([x,y,0]);K.solids.push({type:'box',x:x+w*.16,y,w:w*.52,d:d*.68,z0:z,z1:z+wallH+rise});
    face(K,x+w*.05,y+d*.37,w*.5,z,wallH,[x,y]);
  }
  function elfSpire(K,x,y,r,h,cap){const p=K.p;
    K.parts.push({z0:0,z1:h,side:p.b,top:p.s,at:[x,y],shape(c,t){const rr=r*(1-.18*Math.sin(t*Math.PI));c.ellipse(x,y,rr,rr*.8,0,0,T);}});
    K.parts.push({z0:h,z1:h+cap,side:p.t,top:mix(p.t,p.b,.18),at:[x,y],shape(c,t){leaf(c,x,y,r*2.5,r*2.1,Math.max(.012,(1-t)**.6));}});
    K.parts.push(layer(c=>{for(const s of [-1,1])stroke3(c,[[x+s*r*.7,y+r*.55,5],[x+s*r*.65,y+r*.5,h],[x,y,h+cap]],p.s,1.1);},[x,y]));
    face(K,x,y+r*.8,r*1.8,3,h-5,[x,y]);K.roofs.push({type:'leaf',x,y,w:r*2.5,d:r*2.1});K.contacts.push([x,y,0]);K.solids.push({type:'ellipse',x,y,rx:r,ry:r*.8,z0:0,z1:h+cap});
  }
  A.Kit={palette,defaults,shade,mix,polygon,leaf,project,paintPoly,stroke3,layer,block,ellipse,roof,face,hall,tower,leafRoom,trunk,yard,wall,ore,finish,polyPrism,oct,support,hip,vault,arch,carved,stoneHall,crescentPath,crescent,elfSpire,masonry};
})(window.AS=window.AS||{});
