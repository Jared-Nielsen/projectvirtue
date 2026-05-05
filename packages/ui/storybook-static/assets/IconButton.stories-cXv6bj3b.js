import{i as r,c as l,t as g}from"./web-Cgu1012X.js";import{I as a}from"./IconButton-pDiTQvLW.js";import"./Button-DBpNMQzl.js";import"./Icon-DaBH5SzS.js";var h=g("<div style=display:flex;gap:8px>"),x=g("<div style=display:flex;gap:8px;align-items:center>");const B={title:"Primitives/IconButton",component:a,args:{icon:"x",label:"Close"}},t={},n={render:()=>(()=>{var e=h();return r(e,l(a,{variant:"primary",icon:"sword",label:"Attack"}),null),r(e,l(a,{variant:"secondary",icon:"shield",label:"Defend"}),null),r(e,l(a,{variant:"destructive",icon:"x",label:"Discard"}),null),r(e,l(a,{variant:"icon",icon:"scroll",label:"Open journal"}),null),e})()},s={render:()=>(()=>{var e=x();return r(e,l(a,{size:"sm",icon:"search",label:"Search small"}),null),r(e,l(a,{size:"md",icon:"search",label:"Search medium"}),null),r(e,l(a,{size:"lg",icon:"search",label:"Search large"}),null),e})()};var o,c,i;t.parameters={...t.parameters,docs:{...(o=t.parameters)==null?void 0:o.docs,source:{originalSource:"{}",...(i=(c=t.parameters)==null?void 0:c.docs)==null?void 0:i.source}}};var d,m,p;n.parameters={...n.parameters,docs:{...(d=n.parameters)==null?void 0:d.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    gap: '8px'
  }}>
      <IconButton variant="primary" icon="sword" label="Attack" />
      <IconButton variant="secondary" icon="shield" label="Defend" />
      <IconButton variant="destructive" icon="x" label="Discard" />
      <IconButton variant="icon" icon="scroll" label="Open journal" />
    </div>
}`,...(p=(m=n.parameters)==null?void 0:m.docs)==null?void 0:p.source}}};var u,v,b;s.parameters={...s.parameters,docs:{...(u=s.parameters)==null?void 0:u.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'flex',
    gap: '8px',
    'align-items': 'center'
  }}>
      <IconButton size="sm" icon="search" label="Search small" />
      <IconButton size="md" icon="search" label="Search medium" />
      <IconButton size="lg" icon="search" label="Search large" />
    </div>
}`,...(b=(v=s.parameters)==null?void 0:v.docs)==null?void 0:b.source}}};const z=["Default","Variants","Sizes"];export{t as Default,s as Sizes,n as Variants,z as __namedExportsOrder,B as default};
