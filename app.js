const icon = (name, size = 18) => {
  const paths = {
    home: `<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>`,
    compare: `<path d="M5 20V10m7 10V4m7 16v-7"/><path d="M3 20h18"/>`,
    plus: `<path d="M12 5v14M5 12h14"/>`,
    bell: `<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/>`,
    settings: `<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1A2 2 0 0 1 3 15.1l.1-.1a2 2 0 0 0-1.4-3.4h-.2a2 2 0 0 1 0-4h.2A2 2 0 0 0 3.1 4.2L3 4.1A2 2 0 0 1 5.8 1.3l.1.1a2 2 0 0 0 3.4-1.4v-.2a2 2 0 0 1 4 0V0a2 2 0 0 0 3.4 1.4l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a2 2 0 0 0 1.4 3.4h.2a2 2 0 0 1 0 4h-.2a2 2 0 0 0-1.4 3.4Z" transform="translate(1 1) scale(.83)"/>`,
    location: `<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>`,
    search: `<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>`,
    filter: `<path d="M4 6h16M7 12h10m-7 6h4"/>`,
    down: `<path d="m6 9 6 6 6-6"/>`,
    up: `<path d="m6 15 6-6 6 6"/>`,
    back: `<path d="m15 18-6-6 6-6"/>`,
    star: `<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>`,
    check: `<path d="m5 12 4 4L19 6"/>`,
    info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>`,
    user: `<circle cx="12" cy="8" r="3"/><path d="M5 20a7 7 0 0 1 14 0"/>`,
    globe: `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.3 2.5 3.2 5.5 3.2 9s-.9 6.5-3.2 9c-2.3-2.5-3.2-5.5-3.2-9S9.7 5.5 12 3Z"/>`,
    shield: `<path d="M12 21s8-3.8 8-10V5l-8-3-8 3v6c0 6.2 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>`,
    store: `<path d="M4 10v10h16V10M3 10l2-6h14l2 6"/><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6"/>`,
    clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>`,
    leaf: `<path d="M20 4C9 4 4 9 4 20c5-1 9-3 11-7"/><path d="M4 20c3-5 7-8 13-11"/>`,
    close: `<path d="m6 6 12 12M18 6 6 18"/>`,
  };
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
};

const vegetables = {
  tomato: { name: 'طماطم', emoji: '🍅', icon: 'veg-icon--tomato', price: '6.80', unit: 'كغ', market: 'سوق الجملة — مكناس', change: '-8.4%', direction: 'down', spark: '2,18 12,16 21,19 30,12 40,14 50,7 59,10' },
  potato: { name: 'بطاطس', emoji: '🥔', icon: 'veg-icon--potato', price: '4.50', unit: 'كغ', market: 'سوق سلا المركزي', change: '+3.1%', direction: 'up', spark: '2,7 12,10 21,8 30,14 40,12 50,18 59,17' },
  onion: { name: 'بصل', emoji: '🧅', icon: 'veg-icon--onion', price: '5.20', unit: 'كغ', market: 'سوق القنيطرة', change: '-2.7%', direction: 'down', spark: '2,16 12,13 21,15 30,10 40,12 50,9 59,11' },
  pepper: { name: 'فلفل أخضر', emoji: '🫑', icon: 'veg-icon--pepper', price: '9.90', unit: 'كغ', market: 'سوق إنزكان', change: '+6.8%', direction: 'up', spark: '2,18 12,15 21,17 30,11 40,13 50,5 59,7' },
  carrot: { name: 'جزر', emoji: '🥕', icon: 'veg-icon--carrot', price: '5.80', unit: 'كغ', market: 'سوق الجملة — الرباط', change: '-4.2%', direction: 'down', spark: '2,14 12,17 21,12 30,14 40,8 50,10 59,5' },
  zucchini: { name: 'كوسة', emoji: '🥒', icon: 'veg-icon--zucchini', price: '7.40', unit: 'كغ', market: 'سوق الدار البيضاء', change: '+1.9%', direction: 'up', spark: '2,8 12,9 21,13 30,11 40,16 50,14 59,18' },
};

const markets = [
  { name: 'سوق الجملة — مكناس', city: 'مكناس', distance: '1.8 كم', price: '6.80', change: '-8.4%', direction: 'down', letter: 'م' },
  { name: 'السوق المركزي', city: 'فاس', distance: '12.4 كم', price: '7.10', change: '-3.2%', direction: 'down', letter: 'ف' },
  { name: 'سوق سلا المركزي', city: 'سلا', distance: '22.1 كم', price: '7.35', change: '+1.4%', direction: 'up', letter: 'س' },
  { name: 'سوق الجملة', city: 'الرباط', distance: '25.7 كم', price: '7.60', change: '+2.1%', direction: 'up', letter: 'ر' },
];

const navItems = [
  { id: 'home', label: 'الرئيسية', icon: 'home' }, { id: 'compare', label: 'مقارنة', icon: 'compare' }, { id: 'post', label: 'نشر سعر', icon: 'plus' }, { id: 'alerts', label: 'التنبيهات', icon: 'bell' }, { id: 'settings', label: 'الإعدادات', icon: 'settings' },
];
let currentScreen = 'home';
let selectedVegetable = 'tomato';
let toastTimer;

const appHeader = document.querySelector('#appHeader');
const screenContainer = document.querySelector('#screenContainer');
const bottomNav = document.querySelector('#bottomNav');
const toast = document.querySelector('#toast');

const sparkline = (points, className = '') => `<svg class="sparkline ${className}" viewBox="0 0 61 24" preserveAspectRatio="none"><polyline points="${points}" /></svg>`;
const trend = (value, direction) => `<span class="trend-chip trend-chip--${direction}">${icon(direction === 'up' ? 'up' : 'down', 12)}${value}</span>`;
const vegIcon = (veg) => `<span class="veg-icon ${veg.icon}">${veg.emoji}</span>`;

function renderHeader(title = 'مؤشر الأسواق', subtitle = 'أسعار اليوم في المغرب') {
  appHeader.innerHTML = `<div class="header-row"><div class="brand-lockup"><span class="brand-mark">${icon('leaf', 21)}</span><div><div class="brand-name">${title}</div><div class="brand-caption">${subtitle}</div></div></div><div class="header-actions"><button class="icon-button" data-action="notifications" aria-label="التنبيهات">${icon('bell', 17)}<span class="badge-dot"></span></button></div></div>`;
}

function renderNav(active) {
  bottomNav.innerHTML = navItems.map(item => `<button class="nav-item ${active === item.id ? 'is-active' : ''}" data-screen="${item.id}">${icon(item.icon, 18)}<span>${item.label}</span></button>`).join('');
}

function homeScreen() {
  const statVeg = vegetables.tomato;
  return `<div class="screen home-screen"><div class="location-pill">${icon('location', 12)} <span>مكناس، المغرب</span>${icon('down', 11)}</div><p class="eyebrow">صباح الخير، ياسين</p><h1>نظرة سريعة على السوق</h1><div class="stat-grid"><article class="stat-card stat-card--primary"><div><div class="stat-label">مؤشر الخضروات اليوم</div><div class="stat-value">82.4 <span class="stat-unit">نقطة</span></div></div><div class="stat-foot"><div><div class="trend-chip trend-chip--down">${icon('down', 12)} 2.6%</div><div class="stat-note">مقارنة بالأمس</div></div>${sparkline('2,25 15,23 27,25 39,15 50,16 60,8 75,11', 'primary-spark')}</div></article><article class="stat-card"><div class="stat-label">أكبر انخفاض</div><div class="stat-value">${statVeg.change}</div><div class="stat-foot"><div class="stat-note">${statVeg.name}</div>${sparkline('2,17 12,16 21,17 31,12 41,14 51,7 59,9')}</div></article><article class="stat-card"><div class="stat-label">أكبر ارتفاع</div><div class="stat-value">+6.8%</div><div class="stat-foot"><div class="stat-note">فلفل أخضر</div>${sparkline('2,17 12,15 21,16 31,11 41,13 51,5 59,7')}</div></article></div><div class="section-heading"><h2>أسعار الخضروات</h2><button class="link-button" data-screen="compare">عرض الكل</button></div><div class="vegetable-list">${Object.entries(vegetables).map(([key, veg]) => `<button class="vegetable-row" data-detail="${key}">${vegIcon(veg)}<span class="veg-meta"><strong class="veg-name">${veg.name}</strong><span class="veg-market">${veg.market}</span></span><span class="veg-chart">${sparkline(veg.spark)}</span><span class="veg-price"><strong>${veg.price} <small>د.م</small></strong>${trend(veg.change, veg.direction)}</span></button>`).join('')}</div></div>`;
}

function compareScreen() {
  const veg = vegetables[selectedVegetable];
  return `<div class="screen"><div class="page-intro"><p class="eyebrow">اكتشف أفضل سعر</p><h1>مقارنة الأسواق</h1><p>أسعار محدثة من أسواق قريبة منك</p></div><div class="selection-card">${vegIcon(veg)}<div class="selection-main"><strong>${veg.name}</strong><span>آخر تحديث منذ 12 دقيقة</span></div><button class="change-button" data-action="cycle-vegetable">تغيير</button></div><div class="search-row"><div class="search-box">${icon('search', 16)}<input class="search-input" id="marketSearch" placeholder="ابحث عن سوق أو مدينة" /></div><button class="filter-button" data-action="filter">${icon('filter', 17)}</button></div><div class="section-heading"><h2>الأرخص أولاً</h2><span class="muted tiny">${markets.length} أسواق قريبة</span></div><div class="market-list">${markets.map((market, index) => `<button class="market-row ${index === 0 ? 'best-price' : ''}" data-detail="${selectedVegetable}"><span class="rank">${index + 1}</span><span class="market-avatar">${market.letter}</span><span class="market-main"><strong>${market.name}${index === 0 ? '<span class="best-badge">الأفضل</span>' : ''}</strong><span>${market.city} · ${market.distance}</span></span><span class="market-price"><strong>${market.price} <small>د.م</small></strong>${trend(market.change, market.direction)}</span></button>`).join('')}</div></div>`;
}

function chartSvg() {
  return `<svg viewBox="0 0 340 140" preserveAspectRatio="none" role="img" aria-label="منحنى تغير السعر خلال سبعة أيام"><defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7e7b4" stop-opacity=".45"/><stop offset="1" stop-color="#a7e7b4" stop-opacity="0"/></linearGradient></defs><path class="chart-grid" d="M0 30h340M0 68h340M0 106h340"/><path class="chart-area" d="M0 89 C28 86, 34 63, 62 69 S96 101, 125 78 S159 48, 188 58 S221 85, 247 67 S290 31, 340 40 L340 140 L0 140Z"/><path class="chart-line" d="M0 89 C28 86, 34 63, 62 69 S96 101, 125 78 S159 48, 188 58 S221 85, 247 67 S290 31, 340 40"/><circle class="chart-dot" cx="0" cy="89" r="3"/><circle class="chart-dot" cx="62" cy="69" r="3"/><circle class="chart-dot" cx="125" cy="78" r="3"/><circle class="chart-dot" cx="188" cy="58" r="3"/><circle class="chart-dot" cx="247" cy="67" r="3"/><circle class="chart-dot" cx="340" cy="40" r="3"/></svg>`;
}

function detailScreen() {
  const veg = vegetables[selectedVegetable];
  return `<div class="screen"><div class="detail-top"><button class="back-button" data-action="back">${icon('back', 17)}</button><div class="detail-title"><h1>${veg.name}</h1><p>نظرة تفصيلية على الأسعار</p></div><button class="favorite-button" data-action="favorite" aria-label="إضافة للمفضلة">${icon('star', 17)}</button></div><article class="detail-price"><div class="detail-price-top"><div><small>متوسط السعر اليومي</small><div class="price-big">${veg.price} <span>د.م / ${veg.unit}</span></div></div>${trend(veg.change, veg.direction)}</div><div class="chart-wrap">${chartSvg()}</div><div class="chart-labels"><span>اليوم</span><span>أمس</span><span>السبت</span><span>الجمعة</span><span>الخميس</span><span>الأربعاء</span><span>الثلاثاء</span></div></article><div class="info-strip"><div class="info-item"><strong>4.90 د.م</strong><span>أقل سعر</span></div><div class="info-item"><strong>9.20 د.م</strong><span>أعلى سعر</span></div><div class="info-item"><strong>12 دقيقة</strong><span>آخر تحديث</span></div></div><div class="section-heading"><h2>حسب السوق</h2><span class="muted tiny">اليوم، 09:28</span></div><div class="market-list">${markets.slice(0, 3).map((market, index) => `<div class="market-row"><span class="market-avatar">${market.letter}</span><span class="market-main"><strong>${market.name}</strong><span>${market.city} · ${market.distance}</span></span><span class="market-price"><strong>${(Number(market.price) + (index * .7)).toFixed(2)} <small>د.م</small></strong>${trend(index === 0 ? '-8.4%' : '+1.2%', index === 0 ? 'down' : 'up')}</span></div>`).join('')}</div></div>`;
}

function postScreen() {
  return `<div class="screen"><div class="page-intro"><p class="eyebrow">ساهم في تحديث السوق</p><h1>نشر سعر جديد</h1><p>شارك آخر سعر رأيته ليستفيد منه الجميع</p></div><form class="form-card" id="postForm"><div class="form-group"><label class="form-label" for="vegetableSelect">الخضروات</label><div class="select-wrap"><select class="field-control" id="vegetableSelect"><option value="tomato">طماطم</option><option value="potato">بطاطس</option><option value="onion">بصل</option><option value="pepper">فلفل أخضر</option><option value="carrot">جزر</option><option value="zucchini">كوسة</option></select></div></div><div class="form-group"><label class="form-label" for="priceInput">السعر لكل كيلوغرام</label><div class="currency-field"><input class="field-control" id="priceInput" type="number" min="0" step=".1" placeholder="مثال: 6.50" required /><span>د.م</span></div></div><div class="form-group"><label class="form-label" for="marketSelect">السوق والمدينة</label><div class="select-wrap"><select class="field-control" id="marketSelect"><option>سوق الجملة — مكناس</option><option>السوق المركزي — فاس</option><option>سوق سلا المركزي</option><option>سوق الجملة — الرباط</option></select></div></div><button class="submit-button" type="submit">نشر السعر</button><p class="form-helper">سيظهر السعر باسمك بعد المراجعة السريعة</p></form><div class="tip-card">${icon('info', 16)}<span>كل مشاركة منك تساعد المزارعين والمشترين على اتخاذ قرار أفضل.</span></div></div>`;
}

function sellerScreen() {
  const sellerPosts = [vegetables.tomato, vegetables.onion, vegetables.carrot];
  return `<div class="screen"><div class="detail-top"><button class="back-button" data-action="back">${icon('back', 17)}</button><div class="detail-title"><h1>ملف البائع</h1><p>معلومات ومشاركات البائع</p></div></div><div class="profile-head"><div class="profile-avatar">ع</div><div class="profile-copy"><h2>عبدالرحيم الفاسي</h2><span class="verified">${icon('check', 12)} بائع موثّق</span><div class="profile-meta">مكناس · عضو منذ مارس 2024</div></div><div class="profile-stat"><strong>48</strong><span>مشاركة</span></div></div><div class="section-heading"><h2>آخر الأسعار المنشورة</h2><span class="muted tiny">هذا الشهر</span></div><div class="post-list">${sellerPosts.map((veg, i) => `<div class="post-row">${vegIcon(veg)}<div class="post-main"><strong>${veg.name}</strong><span>سوق الجملة — مكناس · ${i + 1} ${i ? 'أيام' : 'ساعة'}</span></div><div class="post-price"><strong>${veg.price} د.م</strong><span>تم التحقق</span></div></div>`).join('')}</div><div class="tip-card">${icon('shield', 16)}<span>نراجع المشاركات لحماية دقة الأسعار في مؤشر الأسواق.</span></div></div>`;
}

function alertsScreen() {
  const alerts = [{ veg: 'طماطم', market: 'سوق الجملة — مكناس', text: 'انخفض السعر بنسبة 8.4%', time: 'منذ 12 دقيقة', amber: false }, { veg: 'بصل', market: 'سوق القنيطرة', text: 'وصل إلى السعر الذي حددته', time: 'منذ ساعتين', amber: true }, { veg: 'جزر', market: 'سوق الجملة — الرباط', text: 'انخفض السعر بنسبة 4.2%', time: 'أمس، 18:40', amber: false }, { veg: 'فلفل أخضر', market: 'سوق إنزكان', text: 'ارتفع السعر بنسبة 6.8%', time: 'أمس، 14:12', amber: true }];
  return `<div class="screen"><div class="page-intro"><p class="eyebrow">ابق على اطلاع</p><h1>التنبيهات</h1><p>آخر التغييرات التي تهمك في السوق</p></div><div class="alert-list">${alerts.map(alert => `<button class="alert-row" data-detail="${Object.keys(vegetables).find(k => vegetables[k].name === alert.veg) || 'tomato'}"><span class="alert-icon ${alert.amber ? 'alert-icon--amber' : ''}">${icon(alert.amber ? 'up' : 'down', 16)}</span><span class="alert-copy"><strong>${alert.veg} · ${alert.market}</strong><p>${alert.text}</p></span><span class="alert-time">${alert.time}</span></button>`).join('')}</div></div>`;
}

function settingsScreen() {
  const rows = [{ icon: 'globe', title: 'اللغة', value: 'العربية' }, { icon: 'bell', title: 'الإشعارات', value: 'مفعّلة' }, { icon: 'location', title: 'الأسواق المفضلة', value: '3 أسواق' }, { icon: 'shield', title: 'الخصوصية والأمان', value: 'حساب محمي' }, { icon: 'info', title: 'عن مؤشر الأسواق', value: 'الإصدار 1.0.0' }];
  return `<div class="screen"><div class="page-intro"><p class="eyebrow">تحكم بتجربتك</p><h1>الإعدادات</h1></div><div class="settings-profile"><div class="settings-avatar">ي</div><div><h2>ياسين العمري</h2><p>مشتري وبائع · مكناس</p></div></div><div class="settings-section"><div class="settings-section-title">التفضيلات</div><div class="settings-list">${rows.slice(0, 3).map(row => settingRow(row)).join('')}</div></div><div class="settings-section"><div class="settings-section-title">الحساب</div><div class="settings-list">${rows.slice(3).map(row => settingRow(row)).join('')}</div></div><div class="settings-section"><div class="settings-list"><button class="setting-row" data-action="logout"><span class="setting-icon" style="color:#c85646;background:#ffebe7">${icon('user', 15)}</span><span class="setting-copy"><strong style="color:#c85646">تسجيل الخروج</strong></span><span class="chevron">${icon('back', 14)}</span></button></div></div></div>`;
}
function settingRow(row) { return `<button class="setting-row" data-action="setting" data-setting="${row.title}"><span class="setting-icon">${icon(row.icon, 15)}</span><span class="setting-copy"><strong>${row.title}</strong><span>${row.value}</span></span><span class="chevron">${icon('back', 14)}</span></button>`; }

function render(screen = currentScreen) {
  currentScreen = screen;
  if (screen === 'home') { renderHeader(); screenContainer.innerHTML = homeScreen(); }
  if (screen === 'compare') { renderHeader('مؤشر الأسواق', 'مقارنة الأسعار القريبة'); screenContainer.innerHTML = compareScreen(); }
  if (screen === 'post') { renderHeader('مؤشر الأسواق', 'مشاركة الأسعار'); screenContainer.innerHTML = postScreen(); }
  if (screen === 'alerts') { renderHeader('مؤشر الأسواق', 'تنبيهات الأسعار'); screenContainer.innerHTML = alertsScreen(); }
  if (screen === 'settings') { renderHeader('مؤشر الأسواق', 'الإعدادات'); screenContainer.innerHTML = settingsScreen(); }
  renderNav(screen === 'detail' || screen === 'seller' ? 'home' : screen);
  screenContainer.scrollTop = 0;
}

function showDetail(key) { selectedVegetable = key; currentScreen = 'detail'; renderHeader('مؤشر الأسواق', 'تفاصيل السعر'); screenContainer.innerHTML = detailScreen(); renderNav('compare'); screenContainer.scrollTop = 0; }
function showToast(message) { clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('is-visible'); toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600); }
function cycleVeg() { const keys = Object.keys(vegetables); selectedVegetable = keys[(keys.indexOf(selectedVegetable) + 1) % keys.length]; render('compare'); showToast(`تم اختيار ${vegetables[selectedVegetable].name}`); }

document.addEventListener('click', (event) => {
  const screenButton = event.target.closest('[data-screen]'); if (screenButton) { render(screenButton.dataset.screen); return; }
  const detailButton = event.target.closest('[data-detail]'); if (detailButton) { showDetail(detailButton.dataset.detail); return; }
  const actionButton = event.target.closest('[data-action]'); if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === 'back') render('compare');
  if (action === 'cycle-vegetable') cycleVeg();
  if (action === 'notifications') render('alerts');
  if (action === 'filter') showToast('تم تفعيل الأسواق القريبة منك');
  if (action === 'favorite') { actionButton.classList.toggle('is-saved'); showToast(actionButton.classList.contains('is-saved') ? 'أضيفت إلى الخضروات المفضلة' : 'أزيلت من المفضلة'); }
  if (action === 'setting') showToast(`${actionButton.dataset.setting}: سيتم فتحها قريباً`);
  if (action === 'logout') showToast('تم تسجيل الخروج من العرض التجريبي');
});

document.addEventListener('submit', (event) => {
  if (event.target.id !== 'postForm') return;
  event.preventDefault();
  const select = document.querySelector('#vegetableSelect'); const price = document.querySelector('#priceInput').value;
  if (!price) return;
  showToast(`تم نشر سعر ${select.options[select.selectedIndex].text} بنجاح`);
  event.target.reset();
});

document.addEventListener('input', (event) => {
  if (event.target.id !== 'marketSearch') return;
  const query = event.target.value.trim();
  document.querySelectorAll('.market-row').forEach(row => { row.style.display = !query || row.textContent.includes(query) ? '' : 'none'; });
});

render('home');
