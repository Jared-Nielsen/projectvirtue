import{I as K}from"./Icon-DaBH5SzS.js";import{s as L,i as n,c,b as M,m as Q,d as i,t as I,S as p,e as l,f as y,h as x}from"./web-Cgu1012X.js";import{u as U}from"./useId-hyi3NZPf.js";const X="_field_4e72y_1",Y="_label_4e72y_9",Z="_required_4e72y_17",ee="_controlWrap_4e72y_22",re="_error_4e72y_38",ae="_disabled_4e72y_46",te="_input_4e72y_51",ne="_addon_4e72y_67",se="_helper_4e72y_75",oe="_helperError_4e72y_81",t={field:X,label:Y,required:Z,controlWrap:ee,error:re,disabled:ae,input:te,addon:ne,helper:se,helperError:oe};var le=I("<span aria-hidden=true>*"),h=I("<span>"),de=I("<label><span><input>");function ie(R){const[r,z]=L(R,["type","label","helperText","errorText","invalid","required","leadingAddon","trailingAddon","class","id","disabled"]),G=U("input"),m=()=>r.id??G,T=()=>`${m()}-helper`,w=()=>`${m()}-error`,S=()=>r.invalid||!!r.errorText,J=()=>[t.controlWrap,S()?t.error:"",r.disabled?t.disabled:""].filter(Boolean).join(" ");return(()=>{var d=de(),u=d.firstChild,$=u.firstChild;return n(d,c(p,{get when(){return r.label},get children(){var e=h();return n(e,()=>r.label,null),n(e,c(p,{get when(){return r.required},get children(){var a=le();return i(()=>l(a,t.required)),a}}),null),i(()=>l(e,t.label)),e}}),u),n(u,c(p,{get when(){return r.leadingAddon},get children(){var e=h();return n(e,()=>r.leadingAddon),i(()=>l(e,t.addon)),e}}),$),M($,Q({get id(){return m()},get class(){return t.input},get type(){return r.type??"text"},get"aria-invalid"(){return S()?"true":void 0},get"aria-describedby"(){return y(()=>!!r.errorText)()?w():y(()=>!!r.helperText)()?T():void 0},get required(){return r.required},get disabled(){return r.disabled}},z),!1,!1),n(u,c(p,{get when(){return r.trailingAddon},get children(){var e=h();return n(e,()=>r.trailingAddon),i(()=>l(e,t.addon)),e}}),null),n(d,c(p,{get when(){return r.errorText},get children(){var e=h();return n(e,()=>r.errorText),i(a=>{var s=w(),o=`${t.helper} ${t.helperError}`;return s!==a.e&&x(e,"id",a.e=s),o!==a.t&&l(e,a.t=o),a},{e:void 0,t:void 0}),e}}),null),n(d,c(p,{get when(){return y(()=>!r.errorText)()&&r.helperText},get children(){var e=h();return n(e,()=>r.helperText),i(a=>{var s=T(),o=t.helper;return s!==a.e&&x(e,"id",a.e=s),o!==a.t&&l(e,a.t=o),a},{e:void 0,t:void 0}),e}}),null),i(e=>{var a=`${t.field}${r.class?` ${r.class}`:""}`,s=m(),o=J();return a!==e.e&&l(d,e.e=a),s!==e.t&&x(d,"for",e.t=s),o!==e.a&&l(u,e.a=o),e},{e:void 0,t:void 0,a:void 0}),d})()}const he={title:"Primitives/Input",component:ie,args:{label:"Character name",placeholder:"Iolo the Bard"}},g={},v={args:{helperText:"Visible to other adventurers in Britannia."}},_={args:{errorText:"Name is already taken.",value:"Iolo"}},b={args:{type:"search",label:"Find spell",placeholder:"Search the grimoire",leadingAddon:c(K,{name:"search"})}},f={args:{type:"password",label:"Password",placeholder:"Speak, friend"}};var A,q,W;g.parameters={...g.parameters,docs:{...(A=g.parameters)==null?void 0:A.docs,source:{originalSource:"{}",...(W=(q=g.parameters)==null?void 0:q.docs)==null?void 0:W.source}}};var P,E,C;v.parameters={...v.parameters,docs:{...(P=v.parameters)==null?void 0:P.docs,source:{originalSource:`{
  args: {
    helperText: 'Visible to other adventurers in Britannia.'
  }
}`,...(C=(E=v.parameters)==null?void 0:E.docs)==null?void 0:C.source}}};var k,B,N;_.parameters={..._.parameters,docs:{...(k=_.parameters)==null?void 0:k.docs,source:{originalSource:`{
  args: {
    errorText: 'Name is already taken.',
    value: 'Iolo'
  }
}`,...(N=(B=_.parameters)==null?void 0:B.docs)==null?void 0:N.source}}};var D,F,H;b.parameters={...b.parameters,docs:{...(D=b.parameters)==null?void 0:D.docs,source:{originalSource:`{
  args: {
    type: 'search',
    label: 'Find spell',
    placeholder: 'Search the grimoire',
    leadingAddon: <Icon name="search" />
  }
}`,...(H=(F=b.parameters)==null?void 0:F.docs)==null?void 0:H.source}}};var V,j,O;f.parameters={...f.parameters,docs:{...(V=f.parameters)==null?void 0:V.docs,source:{originalSource:`{
  args: {
    type: 'password',
    label: 'Password',
    placeholder: 'Speak, friend'
  }
}`,...(O=(j=f.parameters)==null?void 0:j.docs)==null?void 0:O.source}}};const me=["Default","WithHelperText","Invalid","SearchWithIcon","Password"];export{g as Default,_ as Invalid,f as Password,b as SearchWithIcon,v as WithHelperText,me as __namedExportsOrder,he as default};
