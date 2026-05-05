import{s as m,b as u,m as g,i as p,t as E,c as d,f as r}from"./web-Cgu1012X.js";import{C as G}from"./Card-Ckx94eJp.js";var f=E("<div>");const y=s=>`var(--br-space-${s})`;function k(s){const[e,n]=m(s,["gap","align","justify","style","children"]),i=()=>({display:"flex","flex-direction":"column",gap:y(e.gap??"3"),...e.align!==void 0?{"align-items":e.align}:{},...e.justify!==void 0?{"justify-content":e.justify}:{},...e.style??{}});return(()=>{var a=f();return u(a,g({get style(){return i()}},n),!1,!0),p(a,()=>e.children),a})()}function M(s){const[e,n]=m(s,["gap","wrap","align","justify","style","children"]),i=()=>({display:"flex","flex-direction":"row","flex-wrap":e.wrap??!0?"wrap":"nowrap",gap:y(e.gap??"3"),"align-items":e.align??"center",...e.justify!==void 0?{"justify-content":e.justify}:{},...e.style??{}});return(()=>{var a=f();return u(a,g({get style(){return i()}},n),!1,!0),p(a,()=>e.children),a})()}function P(s){const[e,n]=m(s,["minColumn","columns","gap","style","children"]),i=()=>({display:"grid",gap:y(e.gap??"4"),"grid-template-columns":e.columns!==void 0?`repeat(${e.columns}, minmax(0, 1fr))`:`repeat(auto-fill, minmax(${e.minColumn??"240px"}, 1fr))`,...e.style??{}});return(()=>{var a=f();return u(a,g({get style(){return i()}},n),!1,!0),p(a,()=>e.children),a})()}var T=E("<strong>");const F={title:"Layout/Helpers",component:k},t=s=>d(G,{get children(){var e=T();return p(e,s),e}}),l={render:()=>d(k,{gap:"3",get children(){return[r(()=>t("First")),r(()=>t("Second")),r(()=>t("Third"))]}})},o={render:()=>d(M,{gap:"2",get children(){return[r(()=>t("Sword")),r(()=>t("Shield")),r(()=>t("Scroll")),r(()=>t("Potion"))]}})},c={render:()=>d(P,{minColumn:"180px",gap:"4",get children(){return[r(()=>t("Britain")),r(()=>t("Trinsic")),r(()=>t("Magincia")),r(()=>t("Moonglow")),r(()=>t("Yew")),r(()=>t("Jhelom"))]}})};var x,h,S;l.parameters={...l.parameters,docs:{...(x=l.parameters)==null?void 0:x.docs,source:{originalSource:`{
  render: () => <Stack gap="3">
      {tile('First')}
      {tile('Second')}
      {tile('Third')}
    </Stack>
}`,...(S=(h=l.parameters)==null?void 0:h.docs)==null?void 0:S.source}}};var w,v,C;o.parameters={...o.parameters,docs:{...(w=o.parameters)==null?void 0:w.docs,source:{originalSource:`{
  render: () => <Cluster gap="2">
      {tile('Sword')}
      {tile('Shield')}
      {tile('Scroll')}
      {tile('Potion')}
    </Cluster>
}`,...(C=(v=o.parameters)==null?void 0:v.docs)==null?void 0:C.source}}};var $,j,_;c.parameters={...c.parameters,docs:{...($=c.parameters)==null?void 0:$.docs,source:{originalSource:`{
  render: () => <Grid minColumn="180px" gap="4">
      {tile('Britain')}
      {tile('Trinsic')}
      {tile('Magincia')}
      {tile('Moonglow')}
      {tile('Yew')}
      {tile('Jhelom')}
    </Grid>
}`,...(_=(j=c.parameters)==null?void 0:j.docs)==null?void 0:_.source}}};const J=["StackExample","ClusterExample","GridExample"];export{o as ClusterExample,c as GridExample,l as StackExample,J as __namedExportsOrder,F as default};
