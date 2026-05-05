import{s as W,b,m as B,i as r,c as n,d as c,t as a,S as f,e as p,p as T,l as F}from"./web-Cgu1012X.js";import{B as _}from"./Button-DBpNMQzl.js";import{I as k}from"./Icon-DaBH5SzS.js";const A="_frame_1f3ma_1",D="_title_1f3ma_24",E="_titleText_1f3ma_39",I="_close_1f3ma_44",O="_body_1f3ma_61",s={frame:A,title:D,titleText:E,close:I,body:O};var S=a("<span>"),P=a("<button type=button aria-label=Close>"),R=a("<div>"),L=a("<div><div>");function h(l){const[e,w]=W(l,["title","onClose","class","children"]);return(()=>{var o=L(),u=o.firstChild;return b(o,B({get class(){return`${s.frame}${e.class?` ${e.class}`:""}`}},w),!1,!0),r(o,n(f,{get when(){return e.title||e.onClose},get children(){var i=R();return r(i,n(f,{get when(){return e.title},get children(){var t=S();return r(t,()=>e.title),c(()=>p(t,s.titleText)),t}}),null),r(i,n(f,{get when(){return e.onClose},get children(){var t=P();return T(t,"click",e.onClose,!0),r(t,n(k,{name:"x"})),c(()=>p(t,s.close)),t}}),null),c(()=>p(i,s.title)),i}}),u),r(u,()=>e.children),c(()=>p(u,s.body)),o})()}F(["click"]);var N=a("<p>Configure your audio, video, and input preferences."),j=a("<div style=display:flex;gap:8px;margin-top:12px>"),q=a('<p style=font-style:italic>"Where light is kept in courage, and faith is forged in sacrifice, there shall the Dawn endure."'),z=a("<p>— The Canticle of Ilmara");const K={title:"Primitives/WindowFrame",component:h,args:{title:"Options"}},d={render:()=>n(h,{title:"Options",get children(){return[N(),(()=>{var l=j();return r(l,n(_,{variant:"ghost",children:"Reset"}),null),r(l,n(_,{children:"Apply"}),null),l})()]}})},m={render:()=>n(h,{title:"Ancient Text",onClose:()=>alert("close"),get children(){return[q(),z()]}})};var g,$,v;d.parameters={...d.parameters,docs:{...(g=d.parameters)==null?void 0:g.docs,source:{originalSource:`{
  render: () => <WindowFrame title="Options">
      <p>Configure your audio, video, and input preferences.</p>
      <div style={{
      display: 'flex',
      gap: '8px',
      'margin-top': '12px'
    }}>
        <Button variant="ghost">Reset</Button>
        <Button>Apply</Button>
      </div>
    </WindowFrame>
}`,...(v=($=d.parameters)==null?void 0:$.docs)==null?void 0:v.source}}};var y,x,C;m.parameters={...m.parameters,docs:{...(y=m.parameters)==null?void 0:y.docs,source:{originalSource:`{
  render: () => <WindowFrame title="Ancient Text" onClose={() => alert('close')}>
      <p style={{
      'font-style': 'italic'
    }}>
        "Where light is kept in courage, and faith is forged in sacrifice, there shall the Dawn
        endure."
      </p>
      <p>— The Canticle of Ilmara</p>
    </WindowFrame>
}`,...(C=(x=m.parameters)==null?void 0:x.docs)==null?void 0:C.source}}};const M=["Default","WithCloseButton"];export{d as Default,m as WithCloseButton,M as __namedExportsOrder,K as default};
