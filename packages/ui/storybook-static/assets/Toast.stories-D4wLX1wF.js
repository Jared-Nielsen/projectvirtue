import{j as S,c as a,i as n,F as I,S as T,d as w,e as d,h as E,P as A,l as D,t as m}from"./web-Cgu1012X.js";import{B as _}from"./Button-DBpNMQzl.js";import{I as P}from"./Icon-DaBH5SzS.js";const F="_stack_9v7z3_1",H="_toast_9v7z3_13",N="_success_9v7z3_29",Q="_error_9v7z3_32",V="_warning_9v7z3_35",W="_info_9v7z3_38",Y="_title_9v7z3_42",j="_body_9v7z3_47",O="_close_9v7z3_52",c={stack:F,toast:H,"br-toast-in":"_br-toast-in_9v7z3_1",success:N,error:Q,warning:V,info:W,title:Y,body:j,close:O},[R,y]=S([]);let C=0;function x(e){y(t=>t.filter(o=>o.id!==e))}function u(e,t,o={}){C+=1;const i=C,s=o.duration??4e3,l={id:i,body:t,variant:e,duration:s,...o.title!==void 0?{title:o.title}:{}};return y(r=>[...r,l]),s>0&&typeof window<"u"&&window.setTimeout(()=>x(i),s),i}const v={success:(e,t)=>u("success",e,t),error:(e,t)=>u("error",e,t),warning:(e,t)=>u("warning",e,t),info:(e,t)=>u("info",e,t),show:(e,t)=>u("default",e,t),dismiss:x},q=R;var G=m("<div role=region aria-label=Notifications aria-live=polite>"),J=m("<div>"),K=m('<div><div><div></div></div><button type=button aria-label="Dismiss notification">');function z(){return a(A,{get children(){var e=G();return n(e,a(I,{get each(){return q()},children:t=>(()=>{var o=K(),i=o.firstChild,s=i.firstChild,l=i.nextSibling;return n(i,a(T,{get when(){return t.title},get children(){var r=J();return n(r,()=>t.title),w(()=>d(r,c.title)),r}}),s),n(s,()=>t.body),l.$$click=()=>v.dismiss(t.id),n(l,a(P,{name:"x"})),w(r=>{var p=`${c.toast}${t.variant!=="default"?` ${c[t.variant]}`:""}`,h=t.variant==="error"?"alert":"status",g=c.body,k=c.close;return p!==r.e&&d(o,r.e=p),h!==r.t&&E(o,"role",r.t=h),g!==r.a&&d(s,r.a=g),k!==r.o&&d(l,r.o=k),r},{e:void 0,t:void 0,a:void 0,o:void 0}),o})()})),w(()=>d(e,c.stack)),e}})}D(["click"]);var L=m("<div><div style=display:flex;gap:8px;flex-wrap:wrap>");const Z={title:"Primitives/Toast",component:z},f={render:()=>(()=>{var e=L(),t=e.firstChild;return n(e,a(z,{}),t),n(t,a(_,{onClick:()=>v.success("Quest completed: The Broken Crown"),children:"Success"}),null),n(t,a(_,{variant:"secondary",onClick:()=>v.info("A merchant has new wares"),children:"Info"}),null),n(t,a(_,{variant:"secondary",onClick:()=>v.warning("You are encumbered.",{title:"Heavy load"}),children:"Warning"}),null),n(t,a(_,{variant:"destructive",onClick:()=>v.error("Connection to Britannia lost."),children:"Error"}),null),e})()};var b,$,B;f.parameters={...f.parameters,docs:{...(b=f.parameters)==null?void 0:b.docs,source:{originalSource:`{
  render: () => <div>
      <ToastViewport />
      <div style={{
      display: 'flex',
      gap: '8px',
      'flex-wrap': 'wrap'
    }}>
        <Button onClick={() => toast.success('Quest completed: The Broken Crown')}>Success</Button>
        <Button variant="secondary" onClick={() => toast.info('A merchant has new wares')}>
          Info
        </Button>
        <Button variant="secondary" onClick={() => toast.warning('You are encumbered.', {
        title: 'Heavy load'
      })}>
          Warning
        </Button>
        <Button variant="destructive" onClick={() => toast.error('Connection to Britannia lost.')}>
          Error
        </Button>
      </div>
    </div>
}`,...(B=($=f.parameters)==null?void 0:$.docs)==null?void 0:B.source}}};const tt=["Default"];export{f as Default,tt as __namedExportsOrder,Z as default};
