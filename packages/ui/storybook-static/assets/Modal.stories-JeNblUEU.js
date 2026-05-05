import{s as x,n as L,c as t,a as I,P as M,i as o,S as m,h as O,d as v,e as s,p as P,l as F,t as u,j as E}from"./web-Cgu1012X.js";import{B as f}from"./Button-DBpNMQzl.js";import{u as Y}from"./useEscape-CG0jdldW.js";import{u as j}from"./useId-hyi3NZPf.js";import{F as A}from"./FocusTrap-DX2h6xH4.js";import{I as N}from"./Icon-DaBH5SzS.js";const R="_overlay_is737_1",q="_dialog_is737_13",z="_header_is737_27",G="_title_is737_40",H="_close_is737_45",J="_body_is737_59",K="_footer_is737_65",c={overlay:R,dialog:q,header:z,title:G,close:H,body:J,footer:K};var Q=u("<span>"),U=u("<button type=button aria-label=Close>"),C=u("<div>"),V=u("<div role=dialog aria-modal=true><div>"),W=u("<p style=margin:0>");function _(r){const[e]=x(r,["open","onClose","title","hideClose","footer","children","dismissOnOverlay"]),l=j("modal-title");return Y(()=>e.onClose(),()=>e.open),L(()=>{if(!(typeof document>"u")&&e.open){const d=document.body.style.overflow;document.body.style.overflow="hidden",I(()=>{document.body.style.overflow=d})}}),t(m,{get when(){return e.open},get children(){return t(M,{get children(){var d=C();return d.$$click=i=>{(e.dismissOnOverlay??!0)&&i.target===i.currentTarget&&e.onClose()},o(d,t(A,{get children(){var i=V(),p=i.firstChild;return o(i,t(m,{get when(){return e.title||!e.hideClose},get children(){var n=C();return o(n,t(m,{get when(){return e.title},get children(){var a=Q();return O(a,"id",l),o(a,()=>e.title),v(()=>s(a,c.title)),a}}),null),o(n,t(m,{get when(){return!e.hideClose},get children(){var a=U();return P(a,"click",e.onClose,!0),o(a,t(N,{name:"x"})),v(()=>s(a,c.close)),a}}),null),v(()=>s(n,c.header)),n}}),p),o(p,()=>e.children),o(i,t(m,{get when(){return e.footer},get children(){var n=C();return o(n,()=>e.footer),v(()=>s(n,c.footer)),n}}),null),v(n=>{var a=c.dialog,b=e.title?l:void 0,y=c.body;return a!==n.e&&s(i,n.e=a),b!==n.t&&O(i,"aria-labelledby",n.t=b),y!==n.a&&s(p,n.a=y),n},{e:void 0,t:void 0,a:void 0}),i}})),v(()=>s(d,c.overlay)),d}})}})}function X(r){return t(_,{get open(){return r.open},get onClose(){return r.onCancel},get title(){return r.title??"Confirm"},get footer(){return[t(f,{variant:"ghost",get onClick(){return r.onCancel},get children(){return r.cancelLabel??"Cancel"}}),t(f,{get variant(){return r.destructive?"destructive":"primary"},get onClick(){return r.onConfirm},get children(){return r.confirmLabel??"Confirm"}})]},get children(){var e=W();return o(e,()=>r.message),e}})}F(["click"]);var Z=u("<p>You have unsaved changes to your character. Save them before exiting?"),T=u("<div>");const le={title:"Primitives/Modal",component:_},h={render:()=>{const[r,e]=E(!1);return(()=>{var l=T();return o(l,t(f,{onClick:()=>e(!0),children:"Open modal"}),null),o(l,t(_,{get open(){return r()},onClose:()=>e(!1),title:"Save before leaving?",get footer(){return[t(f,{variant:"ghost",onClick:()=>e(!1),children:"Discard"}),t(f,{onClick:()=>e(!1),children:"Save"})]},get children(){return Z()}}),null),l})()}},g={render:()=>{const[r,e]=E(!1);return(()=>{var l=T();return o(l,t(f,{variant:"destructive",onClick:()=>e(!0),children:"Delete character"}),null),o(l,t(X,{get open(){return r()},title:"Delete character?",message:"This action cannot be undone. The character will be lost forever.",confirmLabel:"Delete",destructive:!0,onCancel:()=>e(!1),onConfirm:()=>e(!1)}),null),l})()}};var $,k,S;h.parameters={...h.parameters,docs:{...($=h.parameters)==null?void 0:$.docs,source:{originalSource:`{
  render: () => {
    const [open, setOpen] = createSignal(false);
    return <div>
        <Button onClick={() => setOpen(true)}>Open modal</Button>
        <Modal open={open()} onClose={() => setOpen(false)} title="Save before leaving?" footer={<>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Discard
              </Button>
              <Button onClick={() => setOpen(false)}>Save</Button>
            </>}>
          <p>You have unsaved changes to your character. Save them before exiting?</p>
        </Modal>
      </div>;
  }
}`,...(S=(k=h.parameters)==null?void 0:k.docs)==null?void 0:S.source}}};var w,D,B;g.parameters={...g.parameters,docs:{...(w=g.parameters)==null?void 0:w.docs,source:{originalSource:`{
  render: () => {
    const [open, setOpen] = createSignal(false);
    return <div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete character
        </Button>
        <Confirm open={open()} title="Delete character?" message="This action cannot be undone. The character will be lost forever." confirmLabel="Delete" destructive onCancel={() => setOpen(false)} onConfirm={() => setOpen(false)} />
      </div>;
  }
}`,...(B=(D=g.parameters)==null?void 0:D.docs)==null?void 0:B.source}}};const ie=["Default","ConfirmDestructive"];export{g as ConfirmDestructive,h as Default,ie as __namedExportsOrder,le as default};
