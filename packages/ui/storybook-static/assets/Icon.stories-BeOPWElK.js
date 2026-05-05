import{i as s,c,t as y,F as z}from"./web-Cgu1012X.js";import{I as x,i as _}from"./Icon-DaBH5SzS.js";var h=y('<div style="display:grid;grid-template-columns:repeat(6, minmax(80px, 1fr));gap:12px;color:var(--br-sigil-300);background:var(--br-dungeon-600);padding:16px;border-radius:var(--br-radius-lg)">'),k=y("<div style=display:flex;flex-direction:column;align-items:center;gap:6px;font-family:var(--br-font-ui);font-size:var(--br-fs-label);color:var(--br-parchment-100)><code>");const $={title:"Primitives/Icon",component:x,args:{name:"sword",size:32}},r={},e={render:()=>(()=>{var i=h();return s(i,c(z,{get each(){return Object.keys(_)},children:o=>(()=>{var a=k(),t=a.firstChild;return s(a,c(x,{name:o,size:28}),t),s(t,o),a})()})),i})()},n={args:{name:"spinner",size:40,spin:!0,label:"Loading"}};var l,d,p;r.parameters={...r.parameters,docs:{...(l=r.parameters)==null?void 0:l.docs,source:{originalSource:"{}",...(p=(d=r.parameters)==null?void 0:d.docs)==null?void 0:p.source}}};var m,g,u;e.parameters={...e.parameters,docs:{...(m=e.parameters)==null?void 0:m.docs,source:{originalSource:`{
  render: () => <div style={{
    display: 'grid',
    'grid-template-columns': 'repeat(6, minmax(80px, 1fr))',
    gap: '12px',
    color: 'var(--br-sigil-300)',
    background: 'var(--br-dungeon-600)',
    padding: '16px',
    'border-radius': 'var(--br-radius-lg)'
  }}>
      <For each={Object.keys(iconRegistry) as (keyof typeof iconRegistry)[]}>
        {name => <div style={{
        display: 'flex',
        'flex-direction': 'column',
        'align-items': 'center',
        gap: '6px',
        'font-family': 'var(--br-font-ui)',
        'font-size': 'var(--br-fs-label)',
        color: 'var(--br-parchment-100)'
      }}>
            <Icon name={name} size={28} />
            <code>{name}</code>
          </div>}
      </For>
    </div>
}`,...(u=(g=e.parameters)==null?void 0:g.docs)==null?void 0:u.source}}};var f,b,v;n.parameters={...n.parameters,docs:{...(f=n.parameters)==null?void 0:f.docs,source:{originalSource:`{
  args: {
    name: 'spinner',
    size: 40,
    spin: true,
    label: 'Loading'
  }
}`,...(v=(b=n.parameters)==null?void 0:b.docs)==null?void 0:v.source}}};const F=["Default","Registry","Spinner"];export{r as Default,e as Registry,n as Spinner,F as __namedExportsOrder,$ as default};
