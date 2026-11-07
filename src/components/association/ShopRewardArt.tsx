import React,{useId} from 'react';

/** Item illustrations are presentation-only; all shop data stays server authoritative. */
export function ShopRewardArt({itemId,large=false}:{itemId:string;large?:boolean}){
 const id=useId().replace(/:/g,'');
 const box=itemId.includes('box')||itemId.includes('equipment');
 const ticket=itemId.includes('job_draw_ticket');
 const potion=itemId.includes('vitality_potion');
 const gold=itemId.includes('gold_box');
 const silver=itemId.includes('silver_box');
 const rare=itemId.includes('rare_equipment');
 const accent=gold?'#f6c361':silver?'#c8dfef':rare?'#bb8ef4':'#c8a86a';
 const highlight=gold?'#ffdf8b':silver?'#e8f5ff':rare?'#ddbcff':'#f4cf91';
 const mid=gold?'#8e5426':silver?'#516779':rare?'#633a8e':'#7d5432';
 const dark=gold?'#3c211a':silver?'#263241':rare?'#251b4b':'#36241a';
 const face='shop-face-'+id,metal='shop-metal-'+id,shimmer='shop-shimmer-'+id;
 if(potion)return <span className={'tc-shop-art tc-shop-art-potion'+(large?' is-large':'')}>
  <img src="/assets/ui/inventory/healing_greater.png" alt="" decoding="async"/>
 </span>;
 if(ticket)return <span className={'tc-shop-art tc-shop-art-ticket'+(large?' is-large':'')}>
  <svg viewBox="0 0 118 108" role="img" aria-label="소환권 묶음" focusable="false">
   <defs><linearGradient id={face} x2="1" y2="1"><stop stopColor="#b48d58"/><stop offset=".45" stopColor="#48344f"/><stop offset="1" stopColor="#261c39"/></linearGradient><linearGradient id={metal} x2=".1" y2="1"><stop stopColor="#ffe0a6"/><stop offset="1" stopColor="#986d43"/></linearGradient></defs>
   <path d="M24 22 L97 17 L99 82 L26 90 Z" fill="#1a1728" stroke="#986b52" strokeWidth="3"/>
   <path d="M18 16 L89 11 L92 79 L20 84 Z" fill={'url(#'+face+')'} stroke={'url(#'+metal+')'} strokeWidth="4"/>
   <path d="M28 26 L77 23 L80 70 L30 74 Z" fill="#39273e" stroke="#e6b678" strokeWidth="2"/>
   <path d="M48 31 L52 41 L62 42 L54 49 L56 60 L46 54 L37 61 L40 49 L32 42 L44 41 Z" fill="#f8c867" stroke="#fff0c7" strokeWidth="1.5"/>
   <path d="M16 58 L92 51 L93 61 L18 69 Z" fill="#a44e3f" stroke="#e3ac70" strokeWidth="2"/>
   <path d="M55 15 L58 81" stroke="#d3a15a" strokeWidth="5"/>
   <circle cx="56" cy="57" r="9" fill="#dfb56c" stroke="#674031" strokeWidth="3"/>
   <path d="M52 57 L56 52 L60 57 L56 62 Z" fill="#805c91"/>
   <path d="M14 9v10M9 14h10M101 47v12M95 53h12" stroke="#f8dda2" strokeWidth="2" opacity=".7"/>
  </svg>
 </span>;
 if(box)return <span className={'tc-shop-art tc-shop-art-chest'+(large?' is-large':'')+(gold?' is-gold':silver?' is-silver':rare?' is-rare':'')}>
  <svg viewBox="0 0 128 112" role="img" aria-label={gold?'골드 보급 상자':silver?'실버 상자':'희귀 장비 상자'} focusable="false">
   <defs>
    <linearGradient id={face} x1="0" y1="0" x2="1" y2="1"><stop stopColor={highlight}/><stop offset=".4" stopColor={mid}/><stop offset="1" stopColor={dark}/></linearGradient>
    <linearGradient id={metal} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff2c9"/><stop offset=".4" stopColor={accent}/><stop offset="1" stopColor="#88603b"/></linearGradient>
    <radialGradient id={shimmer}><stop stopColor={accent} stopOpacity=".56"/><stop offset="1" stopColor={accent} stopOpacity="0"/></radialGradient>
   </defs>
   <ellipse cx="64" cy="61" rx="63" ry="44" fill={'url(#'+shimmer+')'}/>
   {gold||silver?<g opacity=".95">
    <ellipse cx="17" cy="88" rx="12" ry="5" fill={accent} stroke="#704e32" strokeWidth="2"/>
    <path d="M5 85v-8c0-4 24-4 24 0v8" fill={mid} stroke={accent} strokeWidth="2"/>
    <ellipse cx="17" cy="77" rx="12" ry="5" fill={highlight}/>
    <ellipse cx="103" cy="91" rx="13" ry="5" fill={accent} stroke="#866041" strokeWidth="2"/>
    <path d="M90 89v-17h26v17" fill={mid} stroke={accent} strokeWidth="2"/>
    <ellipse cx="103" cy="72" rx="13" ry="5" fill={highlight}/>
   </g>:<g fill="#af8af4" stroke="#ead3ff" strokeWidth="1.4"><path d="M11 94l4-19 10-7 7 12-8 18Z"/><path d="m98 96 11-26 9 9-6 21Z"/></g>}
   <path d="M30 42 52 23 100 28 114 43 112 82 96 92 31 88 20 77 21 50Z" fill={dark} stroke="#8e5c38" strokeWidth="4"/>
   <path d="M22 46L44 31 106 36 113 48 111 68 97 74 30 69 22 61Z" fill={'url(#'+face+')'} stroke={'url(#'+metal+')'} strokeWidth="4"/>
   <path d="M29 66 96 72 96 93 29 87Z" fill={dark} stroke={'url(#'+metal+')'} strokeWidth="4"/>
   <path d="M96 72 114 62 112 83 96 93Z" fill={mid} stroke={accent} strokeWidth="3"/>
   <path d="M42 35 46 89M86 37 88 92" stroke={'url(#'+metal+')'} strokeWidth="9"/>
   <path d="M42 34 46 87M86 36 88 90" stroke={dark} strokeWidth="3"/>
   <path d="M30 63 101 70" stroke={highlight} strokeWidth="4"/>
   <path d="M58 57 72 59 73 75 57 73Z" fill={'url(#'+metal+')'} stroke="#fce5b5" strokeWidth="2"/>
   <path d="M61 63 69 64 69 69 62 69Z" fill={dark}/>
   <path d="M22 46 43 33 102 38" stroke="#ffebad" strokeWidth="2.2" opacity=".85" fill="none"/>
   <path d="M26 46h7m70 15 8-6" stroke={highlight} strokeWidth="3"/>
   <path d="M18 11v12M12 17h12M113 17v10M108 22h10" stroke={highlight} strokeWidth="2.6" opacity=".85"/>
  </svg>
 </span>;
 return <span className={'tc-shop-art tc-shop-art-material'+(large?' is-large':'')}>
  <img src="/assets/ui/crafting/stone.png" alt="" decoding="async"/>
 </span>;
}
