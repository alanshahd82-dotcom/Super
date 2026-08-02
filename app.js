const icons={tomato:`<svg viewBox="0 0 60 60"><circle cx="30" cy="33" r="17"/><path d="M30 17c-1-8 5-11 10-11-1 5-4 9-10 11Z" class="leaf"/><path d="M29 18c-5-4-10-2-12 1 5 3 9 2 12-1Z" class="leaf"/></svg>`,potato:`<svg viewBox="0 0 60 60"><path d="M17 42C8 37 10 23 18 17c8-6 20-5 26 2 5 7 2 18-4 23-7 5-16 4-23 0Z"/><path d="M28 14c-1-5 2-8 6-9" class="stem"/><path d="M34 9c4-2 7 0 8 3-4 2-7 1-8-3Z" class="leaf"/></svg>`,carrot:`<svg viewBox="0 0 60 60"><path d="m18 18 25 3-13 31-12-34Z"/><path d="M20 18c-4-7 0-11 5-12m-2 12c3-7 8-8 12-6" class="leaf"/></svg>`,onion:`<svg viewBox="0 0 60 60"><path d="M30 8c-1 7-13 9-15 23-2 13 7 21 15 21s17-8 15-21C43 17 31 15 30 8Z"/><path d="M30 8c-2-4 0-7 3-9" class="stem"/></svg>`,pepper:`<svg viewBox="0 0 60 60"><path d="M18 17c-2 7-5 23 2 31 6 7 17 4 21-3 4-8-1-19-4-28Z"/><path d="M31 17c-1-6 3-9 8-9-1 5-4 8-8 9Z" class="leaf"/></svg>`,lemon:`<svg viewBox="0 0 60 60"><path d="M17 39c-6-8 2-20 11-24 10-4 21 1 20 9-1 11-13 22-23 23-4 0-6-3-8-8Z"/><path d="M37 15c2-6 6-8 11-7-2 5-5 8-11 7Z" class="leaf"/></svg>`};
const products=[
  {id:'tomato',name:'الطماطم',price:'4.80',trend:'↑ 8.2%',className:'tomato-art',market:'6 أسواق',category:'vegetables',icon:icons.tomato},
  {id:'potato',name:'البطاطس',price:'3.60',trend:'↓ 4.1%',className:'potato-art',market:'8 أسواق',category:'vegetables',icon:icons.potato},
  {id:'carrot',name:'الجزر',price:'5.20',trend:'↑ 2.5%',className:'carrot-art',market:'5 أسواق',category:'vegetables',icon:icons.carrot},
  {id:'onion',name:'البصل',price:'4.10',trend:'— ثابت',className:'onion-art',market:'7 أسواق',category:'vegetables',icon:icons.onion},
  {id:'pepper',name:'الفلفل الأخضر',price:'7.40',trend:'↓ 1.8%',className:'pepper-art',market:'4 أسواق',category:'vegetables',icon:icons.pepper},
  {id:'lemon',name:'الليمون',price:'6.90',trend:'↑ 1.2%',className:'lemon-art',market:'3 أسواق',category:'fruit',icon:icons.lemon}
];
const markets=[['س','سوق الجملة','الدار البيضاء','2.4 كم','4.20','green',true],['م','سوق مديونة','مديونة','6.8 كم','4.60','amber',false],['ب','سوق البرنوصي','الدار البيضاء','8.1 كم','5.10','violet',false],['ق','سوق القريعة','الدار البيضاء','9.7 كم','5.30','green',false]];
let route='onboarding',previous='home',slide=0,selected=products[0],category='all';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const favorites=new Set(JSON.parse(localStorage.getItem('al-aswaq-favorites')||'[]'));
function persistFavorites(){localStorage.setItem('al-aswaq-favorites',JSON.stringify([...favorites]))}
function renderProducts(query=''){
  const needle=query.trim().toLowerCase();
  const rows=products.filter(p=>(category==='all'||p.category===category)&&p.name.toLowerCase().includes(needle));
  const count=$('#results-count');if(count)count.textContent=`${rows.length} ${rows.length===1?'منتج متاح':'منتجات متاحة'}`;
  $('#vegetables').innerHTML=rows.length?rows.map(p=>`<article class="product-row" data-product="${p.id}" tabindex="0" role="button" aria-label="عرض تفاصيل ${p.name}"><span class="produce-art ${p.className}">${p.icon}</span><span><b>${p.name}</b><small>متوسط ${p.market}</small></span><strong>${p.price}<em class="${p.trend[0]==='↓'?'down':''}">${p.trend}<br><small>درهم / كغ</small></em><b class="row-arrow">‹</b></article>`).join(''):`<div class="notifications-empty"><span>⌕</span><b>لم نجد هذه الخضرة</b><small>جرّب كلمة بحث مختلفة.</small></div>`;
}
function renderMarkets(){$('#markets').innerHTML=markets.map((m,i)=>`<article class="market-row ${m[6]?'best':''}"><i class="market-rank">${String(i+1).padStart(2,'0')}</i><span class="market-mark ${m[5]}">${m[0]}</span><span><b>${m[1]} ${m[6]?'<em class="best-tag">الأفضل</em>':''}</b><small>${m[2]} · ${m[3]} منك</small></span><strong>${m[4]}<small> د.م / كغ</small></strong></article>`).join('')}
function go(next){if(next!==route&&route!=='onboarding')previous=route;route=next;location.hash=next;$$('.view').forEach(v=>v.classList.toggle('active',v.id===next));$('#nav').style.display=next==='onboarding'?'none':'flex';$$('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.go===next));if(next==='home')renderProducts($('#search')?.value||'');if(next==='detail')updateDetail()}
function updateDetail(){const p=selected;$('#detail-name').textContent=p.name;$('#detail-price').innerHTML=`${p.price} <em>درهم / كغ</em>`;$('#detail-trend').textContent=p.trend;$('#detail-art').className=`produce-art ${p.className}`;$('#detail-art').innerHTML=p.icon;const f=$('#favorite');f.classList.toggle('is-saved',favorites.has(p.id));f.textContent=favorites.has(p.id)?'♥':'♡'}
function toast(text){const t=$('#toast');t.textContent=text;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2400)}
function setSlide(n){slide=n;const copy=[['اعرف السعر.<br><em>اختر الأفضل.</em>','مؤشر الأسواق يساعدك على مقارنة أسعار الخضر حولك، قبل أن تخرج للتسوق.'],['قارن بوضوح.<br><em>وفر أكثر.</em>','كل سوق أمامك ببياناته ومسافته وسعره، لتصل إلى القرار الصحيح بسرعة.'],['شارك القيمة.<br><em>ابنِ الثقة.</em>','للبائعين والفلاحين: انشر السعر المحدث واجعل السوق أكثر شفافية للجميع.']][n];$('#intro-title').innerHTML=copy[0];$('#intro-text').textContent=copy[1];$$('.dots button').forEach((b,i)=>b.classList.toggle('active',i===n));$('[data-next]').innerHTML=n===2?'ابدأ الآن <b>←</b>':'ابدأ التجربة <b>←</b>'}
function selectCategory(next){category=next;$$('.category-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.category===next));renderProducts($('#search')?.value||'')}
document.addEventListener('click',e=>{
  const target=e.target.closest('[data-go]');if(target){previous=route;go(target.dataset.go);return}
  if(e.target.closest('[data-back]')){go(previous||'home');return}
  const product=e.target.closest('[data-product]');if(product){selected=products.find(p=>p.id===product.dataset.product)||products[0];go('detail');return}
  const dot=e.target.closest('[data-slide]');if(dot){setSlide(+dot.dataset.slide);return}
  if(e.target.closest('[data-next]')){slide<2?setSlide(slide+1):go('home');return}
  const cat=e.target.closest('[data-category]');if(cat){selectCategory(cat.dataset.category);return}
  if(e.target.closest('#favorite')){favorites.has(selected.id)?favorites.delete(selected.id):favorites.add(selected.id);persistFavorites();updateDetail();toast(favorites.has(selected.id)?'تمت الإضافة إلى مفضلاتك':'تمت الإزالة من مفضلاتك');return}
  if(e.target.closest('[data-toast]'))toast(e.target.closest('[data-toast]').dataset.toast);
});
$('#search').addEventListener('input',e=>renderProducts(e.target.value));
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search').focus()}});
document.addEventListener('keydown',e=>{const el=e.target.closest('[data-product]');if(el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();el.click()}});
$('#price-form').addEventListener('submit',e=>{e.preventDefault();const price=e.target.elements.price.value;if(!price||+price<=0)return toast('أدخل سعراً صحيحاً أولاً');toast('تم نشر السعر بنجاح — شكراً لمساهمتك');e.target.reset()});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(next&&$('#'+next))go(next)});
renderProducts();renderMarkets();setSlide(0);go(location.hash.slice(1)||'onboarding');