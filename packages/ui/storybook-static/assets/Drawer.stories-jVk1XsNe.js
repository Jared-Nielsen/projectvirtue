import{s as P,n as j,c as o,a as x,P as L,p as y,d as c,e as u,i as s,S as p,h as b,l as N,t as i,j as B}from"./web-Cgu1012X.js";import{B as D}from"./Button-DBpNMQzl.js";import{u as R}from"./useEscape-CG0jdldW.js";import{u as q}from"./useId-hyi3NZPf.js";import{F}from"./FocusTrap-DX2h6xH4.js";import{I as J}from"./Icon-DaBH5SzS.js";const A="_overlay_16ulb_1",T="_panel_16ulb_9",z="_right_16ulb_25",G="_left_16ulb_28",H="_header_16ulb_34",K="_title_16ulb_46",M="_close_16ulb_51",Q="_body_16ulb_65",a={overlay:A,panel:T,right:z,left:G,header:H,title:K,close:M,body:Q};var C=i("<div>"),U=i("<span>"),V=i("<button type=button aria-label=Close>"),W=i("<aside role=dialog aria-modal=true><div>");function f(d){const[e]=P(d,["open","onClose","side","title","hideClose","children"]),l=q("drawer-title");return R(()=>e.onClose(),()=>e.open),j(()=>{if(!(typeof document>"u")&&e.open){const n=document.body.style.overflow;document.body.style.overflow="hidden",x(()=>{document.body.style.overflow=n})}}),o(p,{get when(){return e.open},get children(){return o(L,{get children(){return[(()=>{var n=C();return y(n,"click",e.onClose,!0),c(()=>u(n,a.overlay)),n})(),o(F,{get children(){var n=W(),_=n.firstChild;return s(n,o(p,{get when(){return e.title||!e.hideClose},get children(){var t=C();return s(t,o(p,{get when(){return e.title},get children(){var r=U();return b(r,"id",l),s(r,()=>e.title),c(()=>u(r,a.title)),r}}),null),s(t,o(p,{get when(){return!e.hideClose},get children(){var r=V();return y(r,"click",e.onClose,!0),s(r,o(J,{name:"x"})),c(()=>u(r,a.close)),r}}),null),c(()=>u(t,a.header)),t}}),_),s(_,()=>e.children),c(t=>{var r=`${a.panel} ${e.side==="left"?a.left:a.right}`,h=e.title?l:void 0,g=a.body;return r!==t.e&&u(n,t.e=r),h!==t.t&&b(n,"aria-labelledby",t.t=h),g!==t.a&&u(_,t.a=g),t},{e:void 0,t:void 0,a:void 0}),n}})]}})}})}N(["click"]);var X=i("<p>Items in your bag appear here."),E=i("<div>"),Y=i("<p>Notes, lore, and quests.");const le={title:"Primitives/Drawer",component:f},m={render:()=>{const[d,e]=B(!1);return(()=>{var l=E();return s(l,o(D,{onClick:()=>e(!0),children:"Open inventory"}),null),s(l,o(f,{get open(){return d()},onClose:()=>e(!1),title:"Inventory",get children(){return X()}}),null),l})()}},v={render:()=>{const[d,e]=B(!1);return(()=>{var l=E();return s(l,o(D,{onClick:()=>e(!0),children:"Open journal"}),null),s(l,o(f,{get open(){return d()},onClose:()=>e(!1),side:"left",title:"Journal",get children(){return Y()}}),null),l})()}};var $,w,O;m.parameters={...m.parameters,docs:{...($=m.parameters)==null?void 0:$.docs,source:{originalSource:`{
  render: () => {
    const [open, setOpen] = createSignal(false);
    return <div>
        <Button onClick={() => setOpen(true)}>Open inventory</Button>
        <Drawer open={open()} onClose={() => setOpen(false)} title="Inventory">
          <p>Items in your bag appear here.</p>
        </Drawer>
      </div>;
  }
}`,...(O=(w=m.parameters)==null?void 0:w.docs)==null?void 0:O.source}}};var I,k,S;v.parameters={...v.parameters,docs:{...(I=v.parameters)==null?void 0:I.docs,source:{originalSource:`{
  render: () => {
    const [open, setOpen] = createSignal(false);
    return <div>
        <Button onClick={() => setOpen(true)}>Open journal</Button>
        <Drawer open={open()} onClose={() => setOpen(false)} side="left" title="Journal">
          <p>Notes, lore, and quests.</p>
        </Drawer>
      </div>;
  }
}`,...(S=(k=v.parameters)==null?void 0:k.docs)==null?void 0:S.source}}};const se=["Right","Left"];export{v as Left,m as Right,se as __namedExportsOrder,le as default};
