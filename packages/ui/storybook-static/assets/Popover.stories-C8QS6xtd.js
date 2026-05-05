import{s as h,j as O,i as c,c as d,d as f,t as a,a as E,u as b,e as g,S as C,l as P}from"./web-Cgu1012X.js";import{B}from"./Button-DBpNMQzl.js";import{u as D}from"./useEscape-CG0jdldW.js";import"./Icon-DaBH5SzS.js";const R="_wrap_8xyo3_1",S="_panel_8xyo3_6",y={wrap:R,panel:S};var j=a("<span role=dialog>"),A=a("<span><span>");function k(o){const[n]=h(o,["open","defaultOpen","onOpenChange","trigger","children","class"]),[w,x]=O(n.defaultOpen??!1),l=()=>n.open??w(),s=e=>{var r;n.open===void 0&&x(e),(r=n.onOpenChange)==null||r.call(n,e)};let i;const u=e=>{l()&&i&&!i.contains(e.target)&&s(!1)};return typeof document<"u"&&(document.addEventListener("mousedown",u),E(()=>document.removeEventListener("mousedown",u))),D(()=>s(!1),l),(()=>{var e=A(),r=e.firstChild,m=i;return typeof m=="function"?b(m,e):i=e,r.$$keydown=t=>{(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),s(!l()))},r.$$click=()=>s(!l()),c(r,()=>n.trigger),c(e,d(C,{get when(){return l()},get children(){var t=j();return c(t,()=>n.children),f(()=>g(t,y.panel)),t}}),null),f(()=>g(e,`${y.wrap}${n.class?` ${n.class}`:""}`)),e})()}P(["click","keydown"]);var H=a("<strong style=display:block;margin-bottom:8px>Quick spells"),L=a("<ul style=margin:0;padding-left:18px><li>Heal</li><li>Magic Arrow</li><li>Recall"),M=a("<div style=padding:60px;display:flex;justify-content:center>");const z={title:"Primitives/Popover",component:k},p={render:()=>(()=>{var o=M();return c(o,d(k,{get trigger(){return d(B,{children:"Open spellbook"})},get children(){return[H(),L()]}})),o})()};var v,$,_;p.parameters={...p.parameters,docs:{...(v=p.parameters)==null?void 0:v.docs,source:{originalSource:`{
  render: () => <div style={{
    padding: '60px',
    display: 'flex',
    'justify-content': 'center'
  }}>
      <Popover trigger={<Button>Open spellbook</Button>}>
        <strong style={{
        display: 'block',
        'margin-bottom': '8px'
      }}>Quick spells</strong>
        <ul style={{
        margin: 0,
        'padding-left': '18px'
      }}>
          <li>Heal</li>
          <li>Magic Arrow</li>
          <li>Recall</li>
        </ul>
      </Popover>
    </div>
}`,...(_=($=p.parameters)==null?void 0:$.docs)==null?void 0:_.source}}};const F=["Default"];export{p as Default,F as __namedExportsOrder,z as default};
