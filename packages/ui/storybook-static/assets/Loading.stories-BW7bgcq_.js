import{i as n,c as a,t as l,d as L,e as z,g as u}from"./web-Cgu1012X.js";import{I as B}from"./Icon-DaBH5SzS.js";const C="_spinner_q4lmv_1",E="_skeleton_q4lmv_6",O={spinner:C,skeleton:E};var F=l("<span>"),I=l("<span aria-hidden=true>"),P=l("<div role=status aria-live=polite style=display:flex;align-items:center;justify-content:center;gap:var(--br-space-2);padding:var(--br-space-6);color:var(--br-text-muted);font-family:var(--br-font-ui)><span>");function m(e){return(()=>{var r=F();return n(r,a(B,{name:"spinner",spin:!0,get size(){return e.size??24},get label(){return e.label??"Loading"}})),L(()=>z(r,`${O.spinner}${e.class?` ${e.class}`:""}`)),r})()}function s(e){const r=()=>{switch(e.rounded??"md"){case"sm":return"var(--br-radius-sm)";case"lg":return"var(--br-radius-lg)";case"full":return"var(--br-radius-full)";default:return"var(--br-radius-md)"}};return(()=>{var i=I();return L(t=>{var g=`${O.skeleton}${e.class?` ${e.class}`:""}`,h=typeof e.width=="number"?`${e.width}px`:e.width??"100%",v=typeof e.height=="number"?`${e.height}px`:e.height??"1em",p=r();return g!==t.e&&z(i,t.e=g),h!==t.t&&u(i,"width",t.t=h),v!==t.a&&u(i,"height",t.a=v),p!==t.o&&u(i,"border-radius",t.o=p),t},{e:void 0,t:void 0,a:void 0,o:void 0}),i})()}function q(e){return(()=>{var r=P(),i=r.firstChild;return n(r,a(m,{}),i),n(i,()=>e.label??"Loading…"),r})()}var T=l("<div style=display:flex;gap:16px;align-items:center>"),j=l("<div style=display:flex;flex-direction:column;gap:8px;width:320px>");const A={title:"Primitives/Loading",component:q},o={render:()=>(()=>{var e=T();return n(e,a(m,{}),null),n(e,a(m,{size:36}),null),e})()},d={render:()=>a(q,{label:"Travelling to Britain…"})},c={render:()=>(()=>{var e=j();return n(e,a(s,{height:28,width:"60%"}),null),n(e,a(s,{height:14}),null),n(e,a(s,{height:14}),null),n(e,a(s,{height:14,width:"80%"}),null),e})()};var f,y,x;o.parameters={...o.parameters,docs:{...(f=o.parameters)==null?void 0:f.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    gap: '16px',
    'align-items': 'center'
  }}>
      <Spinner />
      <Spinner size={36} />
    </div>
}`,...(x=(y=o.parameters)==null?void 0:y.docs)==null?void 0:x.source}}};var S,$,b;d.parameters={...d.parameters,docs:{...(S=d.parameters)==null?void 0:S.docs,source:{originalSource:`{
  render: () => <Loading label="Travelling to Britain…" />
}`,...(b=($=d.parameters)==null?void 0:$.docs)==null?void 0:b.source}}};var _,k,w;c.parameters={...c.parameters,docs:{...(_=c.parameters)==null?void 0:_.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    'flex-direction': 'column',
    gap: '8px',
    width: '320px'
  }}>
      <Skeleton height={28} width="60%" />
      <Skeleton height={14} />
      <Skeleton height={14} />
      <Skeleton height={14} width="80%" />
    </div>
}`,...(w=(k=c.parameters)==null?void 0:k.docs)==null?void 0:w.source}}};const D=["SpinnerOnly","FullLoading","SkeletonStack"];export{d as FullLoading,c as SkeletonStack,o as SpinnerOnly,D as __namedExportsOrder,A as default};
