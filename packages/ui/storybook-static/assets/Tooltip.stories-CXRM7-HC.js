import{s as I,j as x,i as n,c as a,d as $,t as u,h as g,e as O,S as k,l as A}from"./web-Cgu1012X.js";import{B as J}from"./Button-DBpNMQzl.js";import{I as L}from"./IconButton-pDiTQvLW.js";import{u as P}from"./useId-hyi3NZPf.js";import"./Icon-DaBH5SzS.js";const C="_wrap_mutn3_1",N="_bubble_mutn3_6",R="_visible_mutn3_27",c={wrap:C,bubble:N,visible:R};var q=u("<span role=tooltip>"),z=u("<span>");function d(r){const[o]=I(r,["label","children","delay","class"]),[p,m]=x(!1),b=P("tt");let i;const v=()=>{clearTimeout(i),i=setTimeout(()=>m(!0),o.delay??80)},f=()=>{clearTimeout(i),m(!1)};return(()=>{var t=z();return t.$$focusout=f,t.$$focusin=v,t.addEventListener("mouseleave",f),t.addEventListener("mouseenter",v),n(t,()=>o.children,null),n(t,a(k,{when:!0,get children(){var e=q();return g(e,"id",b),n(e,()=>o.label),$(()=>O(e,`${c.bubble} ${p()?c.visible:""}`)),e}}),null),$(e=>{var h=`${c.wrap}${o.class?` ${o.class}`:""}`,_=p()?b:void 0;return h!==e.e&&O(t,e.e=h),_!==e.t&&g(t,"aria-describedby",e.t=_),e},{e:void 0,t:void 0}),t})()}A(["focusin","focusout"]);var j=u("<div style=padding:40px>");const M={title:"Primitives/Tooltip",component:d,args:{label:"Open the journal (J)"}},s={render:()=>(()=>{var r=j();return n(r,a(d,{label:"Strike the foe (Enter)",get children(){return a(J,{children:"Attack"})}})),r})()},l={render:()=>(()=>{var r=j();return n(r,a(d,{label:"Open the journal (J)",get children(){return a(L,{icon:"scroll",label:"Open journal"})}})),r})()};var B,T,w;s.parameters={...s.parameters,docs:{...(B=s.parameters)==null?void 0:B.docs,source:{originalSource:`{
  render: () => <div style={{
    padding: '40px'
  }}>
      <Tooltip label="Strike the foe (Enter)">
        <Button>Attack</Button>
      </Tooltip>
    </div>
}`,...(w=(T=s.parameters)==null?void 0:T.docs)==null?void 0:w.source}}};var y,E,S;l.parameters={...l.parameters,docs:{...(y=l.parameters)==null?void 0:y.docs,source:{originalSource:`{
  render: () => <div style={{
    padding: '40px'
  }}>
      <Tooltip label="Open the journal (J)">
        <IconButton icon="scroll" label="Open journal" />
      </Tooltip>
    </div>
}`,...(S=(E=l.parameters)==null?void 0:E.docs)==null?void 0:S.source}}};const Q=["OnButton","OnIconButton"];export{s as OnButton,l as OnIconButton,Q as __namedExportsOrder,M as default};
