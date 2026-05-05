import{s as k,b as x,m as N,i as n,c as s,d as p,t as m,S as P,e as c,h as D,F as E}from"./web-Cgu1012X.js";import{u as F}from"./useId-hyi3NZPf.js";const H="_group_gwake_1",A="_legend_gwake_9",I="_field_gwake_17",O="_input_gwake_27",T="_dot_gwake_35",o={group:H,legend:A,field:I,input:O,dot:T};var j=m("<span>"),q=m("<label><input type=radio><span aria-hidden=true>"),z=m("<legend>"),B=m("<fieldset>");function R(g){const[e,t]=k(g,["label","class","id"]),a=F("radio"),u=()=>e.id??a;return(()=>{var r=q(),v=r.firstChild,G=v.nextSibling;return x(v,N({get id(){return u()},get class(){return o.input}},t),!1,!1),n(r,s(P,{get when(){return e.label},get children(){var l=j();return n(l,()=>e.label),l}}),null),p(l=>{var b=`${o.field}${e.class?` ${e.class}`:""}`,f=u(),_=o.dot;return b!==l.e&&c(r,l.e=b),f!==l.t&&D(r,"for",l.t=f),_!==l.a&&c(G,l.a=_),l},{e:void 0,t:void 0,a:void 0}),r})()}function J(g){const[e]=k(g,["name","label","options","value","onChange","class"]);return(()=>{var t=B();return n(t,s(P,{get when(){return e.label},get children(){var a=z();return n(a,()=>e.label),p(()=>c(a,o.legend)),a}}),null),n(t,s(E,{get each(){return e.options},children:a=>s(R,{get name(){return e.name},get value(){return a.value},get label(){return a.label},get disabled(){return a.disabled},get checked(){return e.value===a.value},onChange:u=>{var r;return(r=e.onChange)==null?void 0:r.call(e,u.currentTarget.value)}})}),null),p(()=>c(t,`${o.group}${e.class?` ${e.class}`:""}`)),t})()}const M={title:"Primitives/Radio",component:R},d={args:{name:"difficulty",label:"Casual",value:"casual"}},i={render:()=>s(J,{name:"difficulty",label:"Difficulty",value:"normal",options:[{value:"casual",label:"Casual"},{value:"normal",label:"Normal"},{value:"hardcore",label:"Hardcore"},{value:"permadeath",label:"Permadeath",disabled:!0}]})};var h,$,C;d.parameters={...d.parameters,docs:{...(h=d.parameters)==null?void 0:h.docs,source:{originalSource:`{
  args: {
    name: 'difficulty',
    label: 'Casual',
    value: 'casual'
  }
}`,...(C=($=d.parameters)==null?void 0:$.docs)==null?void 0:C.source}}};var w,y,S;i.parameters={...i.parameters,docs:{...(w=i.parameters)==null?void 0:w.docs,source:{originalSource:`{
  render: () => <RadioGroup name="difficulty" label="Difficulty" value="normal" options={[{
    value: 'casual',
    label: 'Casual'
  }, {
    value: 'normal',
    label: 'Normal'
  }, {
    value: 'hardcore',
    label: 'Hardcore'
  }, {
    value: 'permadeath',
    label: 'Permadeath',
    disabled: true
  }]} />
}`,...(S=(y=i.parameters)==null?void 0:y.docs)==null?void 0:S.source}}};const Q=["Single","Group"];export{i as Group,d as Single,Q as __namedExportsOrder,M as default};
