import{s as j,j as A,i as l,c as i,b as O,m as R,d as m,t as v,e as u,h as T,S as _,F as q,f as z,l as B}from"./web-Cgu1012X.js";import{u as G}from"./useId-hyi3NZPf.js";const H="_field_1p8sb_1",J="_row_1p8sb_9",K="_label_1p8sb_15",L="_value_1p8sb_23",U="_input_1p8sb_31",X="_marks_1p8sb_87",s={field:H,row:J,label:K,value:L,input:U,marks:X};var Y=v("<label>"),S=v("<span>"),Z=v("<div aria-hidden=true>"),ee=v("<div><div><input type=range>");function ae(P){const[a,D]=j(P,["label","value","defaultValue","min","max","step","marks","showValue","onValueChange","class","id"]),I=G("slider"),f=()=>a.id??I,g=()=>a.min??0,h=()=>a.max??100,[Q,W]=A(a.value??a.defaultValue??g()),b=()=>a.value??Q();return(()=>{var n=ee(),o=n.firstChild,k=o.firstChild;return l(n,i(_,{get when(){return a.label},get children(){var e=Y();return l(e,()=>a.label),m(r=>{var t=s.label,w=f();return t!==r.e&&u(e,r.e=t),w!==r.t&&T(e,"for",r.t=w),r},{e:void 0,t:void 0}),e}}),o),k.$$input=e=>{var t;const r=Number(e.currentTarget.value);W(r),(t=a.onValueChange)==null||t.call(a,r)},O(k,R({get id(){return f()},get class(){return s.input},get min(){return g()},get max(){return h()},get step(){return a.step??1},get value(){return b()},get"aria-valuenow"(){return b()},get"aria-valuemin"(){return g()},get"aria-valuemax"(){return h()}},D),!1,!1),l(o,i(_,{get when(){return a.showValue??!0},get children(){var e=S();return l(e,b),m(()=>u(e,s.value)),e}}),null),l(n,i(_,{get when(){return z(()=>!!a.marks)()&&a.marks.length>0},get children(){var e=Z();return l(e,i(q,{get each(){return a.marks},children:r=>(()=>{var t=S();return l(t,()=>r.label),t})()})),m(()=>u(e,s.marks)),e}}),null),m(e=>{var r=`${s.field}${a.class?` ${a.class}`:""}`,t=s.row;return r!==e.e&&u(n,e.e=r),t!==e.t&&u(o,e.t=t),e},{e:void 0,t:void 0}),n})()}B(["input"]);const le={title:"Primitives/Slider",component:ae,args:{label:"Master volume",defaultValue:75,min:0,max:100}},c={},d={args:{label:"Mouse sensitivity",defaultValue:50,marks:[{value:0,label:"Slow"},{value:50,label:"Normal"},{value:100,label:"Fast"}]}},p={args:{label:"Quality",defaultValue:2,min:1,max:5,step:1}};var $,x,V;c.parameters={...c.parameters,docs:{...($=c.parameters)==null?void 0:$.docs,source:{originalSource:"{}",...(V=(x=c.parameters)==null?void 0:x.docs)==null?void 0:V.source}}};var y,C,M;d.parameters={...d.parameters,docs:{...(y=d.parameters)==null?void 0:y.docs,source:{originalSource:`{
  args: {
    label: 'Mouse sensitivity',
    defaultValue: 50,
    marks: [{
      value: 0,
      label: 'Slow'
    }, {
      value: 50,
      label: 'Normal'
    }, {
      value: 100,
      label: 'Fast'
    }]
  }
}`,...(M=(C=d.parameters)==null?void 0:C.docs)==null?void 0:M.source}}};var F,N,E;p.parameters={...p.parameters,docs:{...(F=p.parameters)==null?void 0:F.docs,source:{originalSource:`{
  args: {
    label: 'Quality',
    defaultValue: 2,
    min: 1,
    max: 5,
    step: 1
  }
}`,...(E=(N=p.parameters)==null?void 0:N.docs)==null?void 0:E.source}}};const se=["Default","WithMarks","Stepped"];export{c as Default,p as Stepped,d as WithMarks,se as __namedExportsOrder,le as default};
