const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kit = '@cian/ui-kit/';
let timer;
function toast(message) {
  clearTimeout(timer);
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  timer = setTimeout(() => $('#toast').classList.remove('visible'), 2400);
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Скопировано');
  } catch {
    const field = document.createElement('textarea');
    field.value = text;
    field.style.cssText = 'position:fixed;left:-9999px;';
    const previous = document.activeElement;
    (document.querySelector('dialog[open]') || document.body).append(field);
    field.select();
    const ok = document.execCommand('copy');
    field.remove();
    previous?.focus();
    toast(ok ? 'Скопировано' : 'Не удалось скопировать. Выделите текст вручную.');
  }
}

async function getJSON(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

async function init() {
  const [tokensData, classes, icons, sources, manifest] = await Promise.all([
    getJSON('tokens/tokens.json'), getJSON('data/classes.json'), getJSON('data/icons.json'),
    getJSON('data/sources.json'), getJSON('data/manifest.json'),
  ]);
  const sourceByPath = new Map(sources.map((s) => [s.path, s]));
  const tokenByName = new Map(tokensData.tokens.map((t) => [t.name, t]));
  const cls = (path, ...names) => names.filter(Boolean).map((name) => {
    const value = classes[kit + path]?.[name];
    if (!value) throw new Error(`Не найден CSS-класс ${path}: ${name}`);
    return value;
  }).join(' ');
  const icon = (name) => icons.find((item) => item.name === name)?.svg.replace('<svg ', '<svg aria-hidden="true" ') || '';
  const spinnerSource = sourceByPath.get(kit + 'loader/components/Spinner/Spinner.js').content;
  const spinnerPaths = [...spinnerSource.matchAll(/d:\s*"([^"]+)"/g)].map((m) => `<path d="${escapeHTML(m[1])}" fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"/>`).join('');
  const spinner = (size = 16) => `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 16 16" class="${cls('loader/components/Spinner/styles.module.css', 'spinner')}">${spinnerPaths}</svg>`;
  const button = (text, {theme = 'main_primary', size = 'M', disabled = false, loading = false, beforeIcon = '', id = '', type = 'button'} = {}) => {
    const shared = 'button/styles/shared.module.css';
    return `<button type="${type}" ${id ? `id="${id}"` : ''} ${disabled ? 'disabled' : ''} ${loading ? 'aria-busy="true" aria-disabled="true"' : ''} class="${cls(shared, 'button', size, beforeIcon && 'button--before-icon')} ${cls('button/styles/button.module.css', 'button', loading && 'loading')} ${cls(`button/themes/Button/${theme}.module.css`, 'button')}">${loading ? `<span class="${cls('button/styles/button.module.css', 'spinner')}">${spinner()}</span>` : ''}${beforeIcon ? icon(beforeIcon) : ''}<span class="${cls(shared, 'text')}"><span class="${cls(shared, 'title')}">${escapeHTML(text)}</span></span></button>`;
  };

  let mode = 'light';
  const themeButton = $('#theme-toggle');
  function applyTheme(next) {
    mode = next;
    document.documentElement.className = `design-theme--${next}`;
    themeButton.setAttribute('aria-pressed', String(next === 'dark'));
    themeButton.textContent = next === 'dark' ? 'Светлая тема' : 'Тёмная тема';
    $('#token-mode').value = next;
    try { localStorage.setItem('cian-reference-theme', next); } catch { /* storage is optional */ }
    renderPalette();
    renderTokens(true);
  }
  themeButton.addEventListener('click', () => applyTheme(mode === 'light' ? 'dark' : 'light'));

  function renderPalette() {
    const palette = [
      ['--control-main-primary-default', 'Основное действие'],
      ['--surface-main-default', 'Акцентная подложка'],
      ['--text-primary-default', 'Основной текст'],
      ['--text-secondary-default', 'Вторичный текст'],
      ['--background-secondary', 'Фон страницы'],
      ['--stroke-border-default', 'Граница'],
    ];
    $('#palette-overview').innerHTML = palette.map(([name, title]) => `<button class="palette-card" data-copy="var(${name})" title="Копировать var(${name})"><span class="palette-color" style="background:var(${name})"></span><strong>${title}</strong><small>${escapeHTML(tokenByName.get(name).resolved[mode].toUpperCase())}</small></button>`).join('');
  }

  const themes = ['main_primary', 'main_secondary', 'stroke_primary', 'stroke_secondary', 'positive_primary', 'positive_secondary', 'negative_primary', 'negative_secondary', 'warning_primary', 'warning_secondary', 'inverted'];
  $('#button-theme').innerHTML = themes.map((theme) => `<option>${theme}</option>`).join('');
  function renderButtons() {
    const theme = $('#button-theme').value;
    const size = $('#button-size').value;
    $('#button-playground').innerHTML = [
      ['Обычная', button('Показать объявления', {theme, size, id:'example-action'})],
      ['С иконкой', button('Найти', {theme, size, beforeIcon:'ActionSearch16'})],
      ['Disabled', button('Показать', {theme, size, disabled:true})],
      ['Loading', button('Показать', {theme, size, loading:true})],
    ].map(([label, sample]) => `<div class="demo-state">${sample}<span>${label}</span></div>`).join('');
    $('#button-code').textContent = `<Button theme="${theme}" size="${size}">Показать объявления</Button>`;
  }
  $('#button-theme').addEventListener('change', renderButtons);
  $('#button-size').addEventListener('change', renderButtons);
  $('#button-playground').addEventListener('click', (event) => { if(event.target.closest('button:not([disabled]):not([aria-busy])')) toast('Демонстрация кнопки — действие не отправляется на Циан'); });
  renderButtons();

  const wrapper = 'internal/components/InputWrapper/styles/styles.module.css';
  const inputField = ({id, label, placeholder = '', value = '', invalid = false, disabled = false}) => {
    const root = [cls(wrapper, 'input-wrapper', invalid && 'invalid', disabled && 'disabled'), cls('internal/components/InputWrapper/styles/size/M.module.css', 'input-wrapper'), cls('internal/styles/inputWrapperGroup.module.css', 'input-wrapper')].join(' ');
    const children = cls(wrapper, 'children-wrapper') + ' ' + cls('internal/components/InputWrapper/styles/size/M.module.css', 'children-wrapper');
    return `<div><label class="field-label" for="${id}">${label}</label><div class="${root}" data-input-wrapper><div class="${children}"><input id="${id}" class="${cls('internal/components/InputWrapperInput/styles.module.css','input')}" placeholder="${placeholder}" value="${value}" ${disabled ? 'disabled' : ''} ${invalid ? `aria-invalid="true" aria-describedby="${id}-error"` : ''}></div></div>${invalid ? `<p class="field-message" id="${id}-error">Укажите стоимость числом</p>` : ''}</div>`;
  };
  $('#fields-demo').innerHTML = [
    inputField({id:'field-location',label:'Город, район или метро',placeholder:'Например, Сокольники'}),
    inputField({id:'field-price',label:'Стоимость до, ₽',value:'Десять миллионов',invalid:true}),
    inputField({id:'field-disabled',label:'Недоступное поле',value:'Москва',disabled:true}),
  ].join('');
  let keyboard = false;
  document.addEventListener('keydown', () => {keyboard = true;});
  document.addEventListener('pointerdown', () => {keyboard = false;});
  $('#fields-demo').addEventListener('focusin', (event) => event.target.closest('[data-input-wrapper]')?.classList.add(cls(wrapper, keyboard ? 'focused_keyboard' : 'focused_mouse')));
  $('#fields-demo').addEventListener('focusout', (event) => event.target.closest('[data-input-wrapper]')?.classList.remove(cls(wrapper,'focused_keyboard'),cls(wrapper,'focused_mouse')));
  const checkCSS = 'checkbox/components/CheckToggle/styles.module.css';
  function checkbox(text, checked = false, disabled = false) {
    return `<label class="check-label"><input type="checkbox" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span aria-hidden="true" class="${cls(checkCSS, 'root', checked && 'checked', disabled && 'disabled')}"><span class="${cls(checkCSS,'box')}" style="color:var(--icon-on-bright-default)">${icon('FunctionalSuccess16')}</span></span><span>${text}</span></label>`;
  }
  const controlCSS = 'internal/components/ControlButton/styles/styles.module.css';
  const radio = (text, checked = false) => `<label class="${cls(controlCSS, 'control-button')}"><input type="radio" name="rooms-demo" value="${text}" ${checked?'checked':''}><span class="${cls(controlCSS,'button')} ${cls('internal/components/ControlButton/styles/size/M.module.css','button')}">${text}</span></label>`;
  $('#controls-demo').innerHTML = `<div><p class="field-label">Комнатность</p><div class="control-buttons">${['Студия','1','2','3','4+'].map((text,i)=>radio(text,i===2)).join('')}</div></div><div class="checks">${checkbox('Только с фотографиями',true)}${checkbox('Без комиссии')}${checkbox('Без посредников',false,true)}</div>`;
  $('#controls-demo').addEventListener('change',(event)=> {if(event.target.type==='checkbox') event.target.nextElementSibling.classList.toggle(cls(checkCSS,'checked'),event.target.checked);});
  const labelCSS='label/components/Label/styles.module.css';
  const label=(text,bg,fg)=>`<span class="${cls(labelCSS,'label')}" style="background:var(${bg});color:var(${fg})"><span class="${cls(labelCSS,'text')}">${text}</span></span>`;
  $('#labels-demo').innerHTML = [label('Хорошая цена','--surface-positive-default','--text-positive-default'), label('Только на Циан','--surface-main-default','--text-main-default'),label('Проверено','--surface-neutral-default','--text-secondary-default'),label('Снижение цены','--surface-warning-default','--text-warning-default')].join('');
  const skeletonCSS='skeleton/components/Skeleton/styles.module.css';
  $('#loading-demo').innerHTML = `<div class="skeleton-lines" aria-label="Пример загрузки" aria-busy="true"><div class="${cls(skeletonCSS,'skeleton')}" style="width:65%;height:22px"></div><div class="${cls(skeletonCSS,'skeleton')}" style="width:100%;height:14px"></div><div class="${cls(skeletonCSS,'skeleton')}" style="width:80%;height:14px"></div></div><span style="color:var(--icon-main-default)">${spinner(24)}</span>`;
  $('#open-modal-button').innerHTML = button('Открыть окно',{theme:'main_secondary',id:'open-demo-dialog'});
  $('#save-search-button').innerHTML = button('Сохранить',{type:'submit'});
  $('#open-demo-dialog').addEventListener('click',()=>$('#demo-dialog').showModal());
  $('#demo-form').addEventListener('submit', (event)=>{event.preventDefault();$('#demo-dialog').close();toast(`Поиск «${$('#saved-search-name').value}» сохранён в демо`);});

  const apiSections = [
    ['#button-specimen', 'Button', [
      ['theme', 'main_primary', 'В примере доступны 11 актуальных тем; legacy-темы сохранены в исходниках.'],
      ['size', 'M', 'XS: 36 px · M: 44 px · L: 56 px.'],
      ['loading', 'false', 'Spinner внутри кнопки, текст сохраняет ширину и становится прозрачным.'],
      ['beforeIcon / afterIcon', '—', 'Иконка до или после текста.'],
      ['subtitle', '—', 'Вторая строка 12/16 px под основным текстом.'],
      ['fullWidth / maxWidth', '—', 'Ширина 100% или ограничение максимальной ширины.'],
      ['disabled / onClick', 'HTML props', 'Передаются нативному button вместе с остальными HTML-атрибутами.'],
    ], '<Button theme="main_primary" size="M" loading={false}>Найти</Button>'],
    ['#fields-demo', 'Input', [
      ['type', 'text', 'Нативный тип поля.'], ['size', 'Из контекста', 'XS, M и L; высоты совпадают с размерами кнопок.'],
      ['invalid / disabled / loading', '—', 'Ошибка, недоступность или Spinner в правой части.'],
      ['leftAdornment / rightAdornment', '—', 'Дополнительные элементы слева и справа.'],
      ['onChange', '(event, value)', 'Второй аргумент — текстовое значение currentTarget.value.'],
      ['inputRef / ref', '—', 'inputRef указывает на input; ref — на обёртку.'],
    ], '<Input placeholder="Город или метро" onChange={(event, value) => setValue(value)} />'],
    ['#controls-demo', 'Checkbox / RadioButton', [
      ['checked / defaultChecked', 'defaultChecked: false', 'Управляемое или внутреннее состояние Checkbox.'],
      ['label / description / error', '—', 'Подпись, описание и сообщение ошибки.'],
      ['onChange', '(event, checked)', 'Второй аргумент Checkbox — новое логическое состояние.'],
      ['invalid / disabled', '—', 'Отдельные цветовые состояния.'],
      ['Адаптивность', 'По типу устройства', 'Оригинальный Checkbox на телефоне превращается в CheckboxCell; здесь показан desktop-вариант.'],
      ['RadioButton', 'ControlButton', 'Кнопка выбора с нативным type="radio".'],
    ], '<Checkbox label="Без комиссии" checked={checked} onChange={(event, next) => setChecked(next)} />'],
    ['#labels-demo', 'Label', [
      ['background', 'text-secondary-default', 'Семантический токен фона.'], ['color', 'theme-white', 'Токен цвета текста.'],
      ['icon / rightIcon', '—', 'Иконки по 16 px слева и справа.'],
      ['truncate / shadow / bold', 'false', 'Обрезка текста, drop-shadow или начертание 600.'],
      ['borderColor / borderStyle / borderWidth', '—', 'Необязательная обводка.'],
    ], '<Label background="surface-positive-default" color="text-positive-default">Хорошая цена</Label>'],
    ['#loading-demo', 'Spinner / Skeleton', [
      ['Spinner.size', 'small', 'small: 20 px · medium: 40 px · также принимает положительное число.'],
      ['Spinner.colorType', 'default', 'Семантический цвет; main, positive, negative, warning, inverted, onBright, inherit.'],
      ['Skeleton', 'CSS shape', 'По умолчанию 100% × 16 px, радиус 4 px.'],
      ['prefers-reduced-motion', 'Учитывается', 'В справочнике выключаются анимации всех демонстраций.'],
    ], '<Spinner size={24} colorType="main" />'],
    ['#open-modal-button', 'Tooltip / ModalWindow', [
      ['Tooltip.placement', 'top', 'Положение всплывающей подсказки на desktop.'],
      ['Tooltip на телефоне', 'Modal', 'Оригинал открывает модальное окно; здесь показан только desktop-паттерн подсказки.'],
      ['ModalWindow.escape', 'true', 'Закрытие по Escape.'], ['ModalWindow.portal', 'true', 'Рендер через portal.'],
      ['ModalWindow.size / fixed / outside', 'Из ModalWindowView', 'Остальные значения проверяйте в исходнике view и контексте страницы.'],
    ], null],
  ];
  apiSections.forEach(([selector, name, rows, snippet], index) => {
    const article = $(selector).closest('article');
    const details = document.createElement('details');
    details.className = 'api-details';
    details.innerHTML = `<summary>API и особенности ${name}</summary><div class="api-table-wrap"><table><thead><tr><th>Свойство</th><th>По умолчанию</th><th>Назначение</th></tr></thead><tbody>${rows.map(row=>'<tr>'+row.map((value,i)=>`<td>${i<2?'<code>':''}${escapeHTML(value)}${i<2?'</code>':''}</td>`).join('')+'</tr>').join('')}</tbody></table></div>${snippet?`<div class="code-bar"><code id="api-example-${index}">${escapeHTML(snippet)}</code><button class="copy-button" data-copy-target="api-example-${index}">Копировать</button></div>`:''}`;
    article.append(details);
  });

  const typeScale=[['UIHeading1',28,36,700,-.5,'Найдите место для жизни'],['UIHeading2',22,28,700,-.5,'Квартиры в Москве'],['UIHeading3',18,24,700,-.5,'Подходящие объявления'],['UIHeading4',16,24,700,-.2,'Параметры квартиры'],['UIHeading5',14,20,700,-.2,'Проверено в Росреестре'],['UIHeading6',12,16,700,-.2,'Обновлено сегодня'],['Body1',16,24,400,0,'Двухкомнатная квартира рядом с метро'],['Body2',14,20,400,0,'Москва, район Сокольники · 10 минут пешком'],['Caption',12,16,400,0,'Стоимость и доступность уточняйте в объявлении']];
  $('#type-specimens').innerHTML = typeScale.map(([name,size,line,weight,spacing,text])=>`<div class="type-row"><span>${name}</span><span class="type-sample" style="font-size:${size}px;line-height:${line}px;font-weight:${weight};letter-spacing:${spacing}px">${text}</span><span>${size}/${line} px · ${weight}</span></div>`).join('');
  $('#spacing-grid').innerHTML = tokensData.tokens.filter(t=>t.name.startsWith('--unit_')).map(t=>`<button class="space-item palette-card" data-copy="var(${t.name})"><span class="space-bar-wrap"><span class="space-bar" style="height:${escapeHTML(t.value)}"></span></span><strong>${t.value}</strong><code>${t.name}</code></button>`).join('');

  let visibleTokens = 40;
  function renderTokens(reset = false) {
    if(reset) visibleTokens=40;
    const query=$('#token-search').value.trim().toLowerCase();
    const group=$('#token-group').value;
    const selectedMode=$('#token-mode').value;
    const matches=tokensData.tokens.filter(t=>(group==='all'||t.group===group)&&`${t.name} ${t.modes[selectedMode]} ${t.resolved[selectedMode]}`.toLowerCase().includes(query));
    $('#token-count').textContent=`${matches.length} ${query?'найдено':'токенов'} · показано ${Math.min(visibleTokens,matches.length)}`;
    $('#token-rows').innerHTML=matches.slice(0,visibleTokens).map(t=>{
      const value=t.resolved[selectedMode];
      const isColor=/^(#|rgba?\(|hsla?\(|linear-gradient)/.test(value);
      return `<tr><td><div class="token-name"><span aria-hidden="true" class="token-swatch" style="${isColor?`background:${escapeHTML(value)}`:'background:var(--surface-neutral-default)'}"></span><code>${t.name}</code></div></td><td class="token-value"><code>${escapeHTML(t.modes[selectedMode])}</code></td><td class="token-value"><code>${escapeHTML(value)}</code></td><td><button class="copy-button" data-copy="var(${t.name})" aria-label="Копировать ${t.name}">Копировать</button></td></tr>`;
    }).join('');
    $('#tokens-empty').hidden=matches.length>0;
    $('.token-table-wrap').hidden=matches.length===0;
    $('#tokens-more').hidden=visibleTokens>=matches.length;
  }
  $('#token-search').addEventListener('input',()=>renderTokens(true));
  $('#token-group').addEventListener('change',()=>renderTokens(true));
  $('#token-mode').addEventListener('change',()=>renderTokens(true));
  $('#tokens-more').addEventListener('click',()=>{visibleTokens+=40;renderTokens();});
  $$('[data-token-count]').forEach(e=>e.textContent=manifest.counts.tokens);
  $$('[data-icon-count]').forEach(e=>e.textContent=manifest.counts.icons);

  function renderIcons() {
    const query=$('#icon-search').value.toLowerCase().trim();
    const matches=icons.filter(i=>`${i.name} ${i.category} ${i.size}`.toLowerCase().includes(query));
    $('#icon-grid').innerHTML=matches.map(i=>`<button class="icon-tile" data-icon="${i.name}" title="Копировать SVG ${i.name}"><span class="icon-stage">${icon(i.name)}</span><span>${i.name}<br>${i.size} × ${i.size}</span></button>`).join('');
    $('#icon-count').textContent=matches.length ? `${matches.length} иконок` : 'Ничего не найдено. Попробуйте Search или Close.';
  }
  $('#icon-search').addEventListener('input',renderIcons);
  renderIcons();

  function openSource(path) {
    const record=sourceByPath.get(path);
    if(!record) return toast('Исходник не входит в этот снимок');
    $('#source-title').textContent=path;
    $('#source-code').textContent=record.content;
    $('#source-map-link').href=record.sourceMap;
    $('#source-dialog').showModal();
  }
  function renderSources() {
    const query=$('#source-search').value.trim().toLowerCase();
    $('#source-list').innerHTML=sources.filter(s=>s.path.toLowerCase().includes(query)).map(s=>`<button class="source-file" data-source="${escapeHTML(s.path)}">${escapeHTML(s.path)}</button>`).join('') || '<p class="caption">Исходники не найдены.</p>';
  }
  $('#source-search').addEventListener('input',renderSources);
  $('[data-source-count]').textContent=manifest.counts.sourceFiles;
  $('#source-summary').innerHTML=[[String(manifest.counts.sourceFiles),'исходных файла'],[String(manifest.counts.semanticTokens),'семантических токенов'],['5','цветовых режимов'],['12.11.2026','дата снимка']].map(([value,label])=>`<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  $('#source-links').innerHTML=manifest.assets.map((a,i)=>`<a href="${a.url}" target="_blank" rel="noreferrer">${['JavaScript source map','CSS source map','Production CSS'][i]} ↗</a>`).join('')+'<a href="data/sources.json" download>Все исходники JSON ↓</a>';
  renderSources();
  document.addEventListener('click',(event)=>{
    const target=event.target.closest('[data-copy],[data-copy-target],[data-source],[data-icon],[data-close-dialog]');
    if(!target)return;
    if(target.dataset.copy) copy(target.dataset.copy);
    if(target.dataset.copyTarget) copy(document.getElementById(target.dataset.copyTarget).textContent);
    if(target.dataset.source) openSource(target.dataset.source);
    if(target.dataset.icon) copy(icons.find(i=>i.name===target.dataset.icon).svg);
    if(target.dataset.closeDialog) document.getElementById(target.dataset.closeDialog).close();
  });
  $$('dialog').forEach(dialog=>dialog.addEventListener('click',(event)=>{
    if(event.target!==dialog)return;
    const r=dialog.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();
  }));
  const menu=$('.menu-toggle');
  menu.addEventListener('click',()=>{const open=$('#sidebar').classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
  document.addEventListener('keydown',(event)=>{if(event.key==='Escape'){$('#sidebar').classList.remove('open');menu.setAttribute('aria-expanded','false');}});
  $$('.sidebar nav a').forEach(a=>a.addEventListener('click',()=>{$('#sidebar').classList.remove('open');menu.setAttribute('aria-expanded','false');}));
  const nav=$$('.sidebar nav a');
  const sections=$$('main>section');
  let scrollPending=false;
  function updateNavigation() {
    scrollPending=false;
    const current=sections.filter(section=>section.getBoundingClientRect().top<=200).at(-1)||sections[0];
    nav.forEach(a=>{const active=a.hash==='#'+current.id;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
  }
  document.addEventListener('scroll',()=>{if(!scrollPending){scrollPending=true;requestAnimationFrame(updateNavigation);}},{passive:true});
  updateNavigation();
  let initial='light';
  try {if(localStorage.getItem('cian-reference-theme')==='dark')initial='dark';}catch{/* optional */}
  applyTheme(initial);
}

init().catch(error=>{
  const message=$('#load-error');
  message.hidden=false;
  message.textContent=`Не удалось загрузить справочник. Откройте страницу через локальный HTTP-сервер, затем обновите. ${error.message}`;
  console.error(error);
});
