import{s as P,b as y,m as E,i as n,c as b,d as A,t as w,S as N,e as h,h as O}from"./web-Cgu1012X.js";import{u as R}from"./useId-hyi3NZPf.js";import{I as j}from"./Icon-DaBH5SzS.js";const q="_field_10hzi_1",B="_input_10hzi_12",F="_box_10hzi_20",c={field:q,input:B,box:F};var G=w("<span>"),H=w("<label><input type=checkbox><span aria-hidden=true>");function J(D){const[r,z]=P(D,["label","class","id"]),I=R("cbx"),i=()=>r.id??I;return(()=>{var s=H(),l=s.firstChild,d=l.nextSibling;return y(l,E({get id(){return i()},get class(){return c.input}},z),!1,!1),n(d,b(j,{name:"check"})),n(s,b(N,{get when(){return r.label},get children(){var e=G();return n(e,()=>r.label),e}}),null),A(e=>{var u=`${c.field}${r.class?` ${r.class}`:""}`,m=i(),p=c.box;return u!==e.e&&h(s,e.e=u),m!==e.t&&O(s,"for",e.t=m),p!==e.a&&h(d,e.a=p),e},{e:void 0,t:void 0,a:void 0}),s})()}const Q={title:"Primitives/Checkbox",component:J,args:{label:"Show damage numbers"}},a={},t={args:{checked:!0}},o={args:{disabled:!0}};var f,g,_;a.parameters={...a.parameters,docs:{...(f=a.parameters)==null?void 0:f.docs,source:{originalSource:"{}",...(_=(g=a.parameters)==null?void 0:g.docs)==null?void 0:_.source}}};var v,x,k;t.parameters={...t.parameters,docs:{...(v=t.parameters)==null?void 0:v.docs,source:{originalSource:`{
  args: {
    checked: true
  }
}`,...(k=(x=t.parameters)==null?void 0:x.docs)==null?void 0:k.source}}};var S,C,$;o.parameters={...o.parameters,docs:{...(S=o.parameters)==null?void 0:S.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...($=(C=o.parameters)==null?void 0:C.docs)==null?void 0:$.source}}};const T=["Default","Checked","Disabled"];export{t as Checked,a as Default,o as Disabled,T as __namedExportsOrder,Q as default};
