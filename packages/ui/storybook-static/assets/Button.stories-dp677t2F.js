import{i as a,c as e,t as c}from"./web-Cgu1012X.js";import{I as d}from"./Icon-DaBH5SzS.js";import{B as t}from"./Button-DBpNMQzl.js";var $=c("<div style=display:flex;gap:12px;flex-wrap:wrap>"),P=c("<div style=display:flex;gap:12px;align-items:center>"),C=c("<div style=display:flex;gap:12px>");const A={title:"Primitives/Button",component:t,args:{children:"Continue"},argTypes:{variant:{control:"select",options:["primary","secondary","destructive","ghost","icon"]},size:{control:"select",options:["sm","md","lg"]},loading:{control:"boolean"},disabled:{control:"boolean"}}},n={args:{variant:"primary"}},o={render:()=>(()=>{var r=$();return a(r,e(t,{variant:"primary",children:"Primary"}),null),a(r,e(t,{variant:"secondary",children:"Secondary"}),null),a(r,e(t,{variant:"destructive",children:"Destructive"}),null),a(r,e(t,{variant:"ghost",children:"Ghost"}),null),r})()},s={render:()=>(()=>{var r=P();return a(r,e(t,{size:"sm",children:"Small"}),null),a(r,e(t,{size:"md",children:"Medium"}),null),a(r,e(t,{size:"lg",children:"Large"}),null),r})()},i={render:()=>(()=>{var r=C();return a(r,e(t,{get leadingIcon(){return e(d,{name:"sword"})},children:"Attack"}),null),a(r,e(t,{variant:"secondary",get trailingIcon(){return e(d,{name:"chevron-right"})},children:"Continue"}),null),r})()},l={args:{loading:!0}};var u,p,m;n.parameters={...n.parameters,docs:{...(u=n.parameters)==null?void 0:u.docs,source:{originalSource:`{
  args: {
    variant: 'primary'
  }
}`,...(m=(p=n.parameters)==null?void 0:p.docs)==null?void 0:m.source}}};var g,v,y;o.parameters={...o.parameters,docs:{...(g=o.parameters)==null?void 0:g.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    gap: '12px',
    'flex-wrap': 'wrap'
  }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
}`,...(y=(v=o.parameters)==null?void 0:v.docs)==null?void 0:y.source}}};var h,B,x;s.parameters={...s.parameters,docs:{...(h=s.parameters)==null?void 0:h.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    gap: '12px',
    'align-items': 'center'
  }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
}`,...(x=(B=s.parameters)==null?void 0:B.docs)==null?void 0:x.source}}};var f,S,I;i.parameters={...i.parameters,docs:{...(f=i.parameters)==null?void 0:f.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    gap: '12px'
  }}>
      <Button leadingIcon={<Icon name="sword" />}>Attack</Button>
      <Button variant="secondary" trailingIcon={<Icon name="chevron-right" />}>
        Continue
      </Button>
    </div>
}`,...(I=(S=i.parameters)==null?void 0:S.docs)==null?void 0:I.source}}};var z,_,w;l.parameters={...l.parameters,docs:{...(z=l.parameters)==null?void 0:z.docs,source:{originalSource:`{
  args: {
    loading: true
  }
}`,...(w=(_=l.parameters)==null?void 0:_.docs)==null?void 0:w.source}}};const D=["Primary","Variants","Sizes","WithIcons","Loading"];export{l as Loading,n as Primary,s as Sizes,o as Variants,i as WithIcons,D as __namedExportsOrder,A as default};
