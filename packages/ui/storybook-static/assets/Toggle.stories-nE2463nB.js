import{s as E,b as T,m as A,i as b,c as I,d as M,t as C,S as N,e as n,h as O}from"./web-Cgu1012X.js";import{u as R}from"./useId-hyi3NZPf.js";const j="_toggle_mvymq_1",z="_input_mvymq_12",B="_track_mvymq_20",F="_thumb_mvymq_31",r={toggle:j,input:z,track:B,thumb:F};var G=C("<span>"),H=C("<label><input type=checkbox role=switch><span><span>");function J(q){const[t,x]=E(q,["label","class","id"]),D=R("toggle"),l=()=>t.id??D;return(()=>{var s=H(),i=s.firstChild,u=i.nextSibling,P=u.firstChild;return T(i,A({get id(){return l()},get class(){return r.input}},x),!1,!1),b(s,I(N,{get when(){return t.label},get children(){var e=G();return b(e,()=>t.label),e}}),null),M(e=>{var d=`${r.toggle}${t.class?` ${t.class}`:""}`,m=l(),g=r.track,p=r.thumb;return d!==e.e&&n(s,e.e=d),m!==e.t&&O(s,"for",e.t=m),g!==e.a&&n(u,e.a=g),p!==e.o&&n(P,e.o=p),e},{e:void 0,t:void 0,a:void 0,o:void 0}),s})()}const Q={title:"Primitives/Toggle",component:J,args:{label:"Mute when unfocused"}},a={},o={args:{checked:!0}},c={args:{disabled:!0}};var h,v,_;a.parameters={...a.parameters,docs:{...(h=a.parameters)==null?void 0:h.docs,source:{originalSource:"{}",...(_=(v=a.parameters)==null?void 0:v.docs)==null?void 0:_.source}}};var f,k,y;o.parameters={...o.parameters,docs:{...(f=o.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    checked: true
  }
}`,...(y=(k=o.parameters)==null?void 0:k.docs)==null?void 0:y.source}}};var S,$,w;c.parameters={...c.parameters,docs:{...(S=c.parameters)==null?void 0:S.docs,source:{originalSource:`{
  args: {
    disabled: true
  }
}`,...(w=($=c.parameters)==null?void 0:$.docs)==null?void 0:w.source}}};const U=["Default","Checked","Disabled"];export{o as Checked,a as Default,c as Disabled,U as __namedExportsOrder,Q as default};
