import{c as t,m as h,s as G,i as l,d as _,t as u,e as v,S,f as N,h as f,g as O}from"./web-Cgu1012X.js";const R="_bar_itui1_1",j="_barLabel_itui1_10",q="_barTrack_itui1_19",z="_barFill_itui1_30",I="_health_itui1_36",J="_mana_itui1_41",K="_stat_itui1_46",Q="_value_itui1_51",W="_minimap_itui1_63",o={bar:R,barLabel:j,barTrack:q,barFill:z,health:I,mana:J,stat:K,value:Q,minimap:W};var Y=u("<span><span></span><span>/"),Z=u("<span>/"),aa=u("<div><div role=progressbar aria-valuemin=0><div>"),ea=u("<div role=img>");function $(e){const[r]=G(e,["label","value","max","showValue","class","fillVariant","ariaLabel"]),i=()=>r.max??100,m=()=>Math.max(0,Math.min(100,r.value/i()*100));return(()=>{var n=aa(),s=n.firstChild,M=s.firstChild;return l(n,t(S,{get when(){return r.label},get children(){var a=Y(),d=a.firstChild,c=d.nextSibling,b=c.firstChild;return l(d,()=>r.label),l(c,()=>r.value,b),l(c,i,null),_(()=>v(a,o.barLabel)),a}}),s),l(s,t(S,{get when(){return N(()=>!r.label)()&&(r.showValue??!0)},get children(){var a=Z(),d=a.firstChild;return l(a,()=>r.value,d),l(a,i,null),_(()=>v(a,o.value)),a}}),null),_(a=>{var d=`${o.bar}${r.class?` ${r.class}`:""}`,c=o.barTrack,b=r.ariaLabel,P=r.value,H=i(),L=`${o.barFill} ${o[r.fillVariant]}`,k=`${m()}%`;return d!==a.e&&v(n,a.e=d),c!==a.t&&v(s,a.t=c),b!==a.a&&f(s,"aria-label",a.a=b),P!==a.o&&f(s,"aria-valuenow",a.o=P),H!==a.i&&f(s,"aria-valuemax",a.i=H),L!==a.n&&v(M,a.n=L),k!==a.s&&O(M,"width",a.s=k),a},{e:void 0,t:void 0,a:void 0,o:void 0,i:void 0,n:void 0,s:void 0}),n})()}function y(e){return t($,h(e,{fillVariant:"health",ariaLabel:"Health"}))}function X(e){return t($,h(e,{fillVariant:"mana",ariaLabel:"Mana"}))}function ra(e){const[r,i]=G(e,["ariaLabel"]);return t($,h(i,{fillVariant:"stat",get ariaLabel(){return r.ariaLabel??"Stat"}}))}function A(e){return(()=>{var r=ea();return _(i=>{var m=`${o.minimap}${e.class?` ${e.class}`:""}`,n=e.label??"Minimap";return m!==i.e&&v(r,i.e=m),n!==i.t&&f(r,"aria-label",i.t=n),i},{e:void 0,t:void 0}),r})()}var la=u("<div style=display:flex;flex-direction:column;gap:12px;padding:24px;background:var(--br-dungeon-700);border-radius:8px>"),ia=u("<div style=padding:24px;background:var(--br-dungeon-700)>"),ta=u('<div style="display:flex;gap:32px;padding:32px;background:radial-gradient(ellipse at top, var(--br-dungeon-500), var(--br-dungeon-700));border-radius:12px;align-items:flex-end"><div style=display:flex;flex-direction:column;gap:8px>');const sa={title:"HUD/HUD primitives",component:y},p={render:()=>(()=>{var e=la();return l(e,t(y,{label:"HP",value:72,max:100}),null),l(e,t(X,{label:"MP",value:45,max:80}),null),l(e,t(ra,{label:"XP",value:320,max:1e3}),null),e})()},g={render:()=>(()=>{var e=ia();return l(e,t(A,{})),e})()},x={render:()=>(()=>{var e=ta(),r=e.firstChild;return l(r,t(y,{label:"HP",value:72}),null),l(r,t(X,{label:"MP",value:45,max:80}),null),l(e,t(A,{}),null),e})()};var w,B,C;p.parameters={...p.parameters,docs:{...(w=p.parameters)==null?void 0:w.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    'flex-direction': 'column',
    gap: '12px',
    padding: '24px',
    background: 'var(--br-dungeon-700)',
    'border-radius': '8px'
  }}>
      <HealthBar label="HP" value={72} max={100} />
      <ManaBar label="MP" value={45} max={80} />
      <StatGauge label="XP" value={320} max={1000} />
    </div>
}`,...(C=(B=p.parameters)==null?void 0:B.docs)==null?void 0:C.source}}};var V,F,D;g.parameters={...g.parameters,docs:{...(V=g.parameters)==null?void 0:V.docs,source:{originalSource:`{
  render: () => <div style={{
    padding: '24px',
    background: 'var(--br-dungeon-700)'
  }}>
      <MinimapPlaceholder />
    </div>
}`,...(D=(F=g.parameters)==null?void 0:F.docs)==null?void 0:D.source}}};var T,U,E;x.parameters={...x.parameters,docs:{...(T=x.parameters)==null?void 0:T.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    gap: '32px',
    padding: '32px',
    background: 'radial-gradient(ellipse at top, var(--br-dungeon-500), var(--br-dungeon-700))',
    'border-radius': '12px',
    'align-items': 'flex-end'
  }}>
      <div style={{
      display: 'flex',
      'flex-direction': 'column',
      gap: '8px'
    }}>
        <HealthBar label="HP" value={72} />
        <ManaBar label="MP" value={45} max={80} />
      </div>
      <MinimapPlaceholder />
    </div>
}`,...(E=(U=x.parameters)==null?void 0:U.docs)==null?void 0:E.source}}};const da=["Bars","Minimap","FullHUD"];export{p as Bars,x as FullHUD,g as Minimap,da as __namedExportsOrder,sa as default};
