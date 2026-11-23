import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input } from '@/ui';
import { listings, money } from '@/data/listings';
import s from './AuctionPage.module.css';

const apartment = listings[0];
const apartmentImage = `${import.meta.env.BASE_URL}${apartment.images[0].replace(/^\//, '')}`;
const startPrice = 18400000;
const step = 200000;

export function AuctionPage() {
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [published, setPublished] = useState(false);
  const [ended, setEnded] = useState(false);
  const [price, setPrice] = useState(String(startPrice));
  const [duration, setDuration] = useState('7');
  const [bid, setBid] = useState('18600000');
  const [highest, setHighest] = useState(startPrice);
  const [status, setStatus] = useState<'idle' | 'pending' | 'accepted' | 'error' | 'low'>('idle');
  const minimum = highest + step;
  const submitBid = () => {
    const amount = Number(bid);
    if (!Number.isFinite(amount) || amount < minimum) { setStatus('low'); return; }
    setStatus('pending');
    window.setTimeout(() => { setHighest(amount); setStatus('accepted'); }, 1100);
  };
  return <main className={s.page} id="main">
    <div className={s.stage}>
    <div className={s.device}>
    <div className={s.screen}>
    <div className={s.top}><Link to="/">← Циан</Link><span className={s.wordmark}>аукцион<span>·</span></span><span>Москва</span></div>
    <div className={s.shell}>
      <div className={s.intro}><span className={s.eyebrow}>НОВЫЙ СПОСОБ НАЙТИ СВОЁ</span><h1>Квартира, за которую<br/><em>стоит побороться.</em></h1><p>Прозрачные условия. Один шанс предложить свою цену.</p></div>
      <div className={s.grid}><div className={s.photo}><img src={apartmentImage} alt="Интерьер квартиры"/><span className={s.photoTag}>01 / 03 · Сокольники</span></div><div className={s.panel}>
        <span className={s.live}>{ended ? '● АУКЦИОН ЗАВЕРШЁН' : published ? '● ТОРГИ ИДУТ' : '● ДЕМО АУКЦИОН'}</span>
        <h2>Светлая квартира<br/>у парка</h2><p className={s.address}>2 комнаты · 54 м² · ул. Русаковская, 12</p>
        <div className={s.price}><span>ТЕКУЩАЯ СТАВКА</span><strong>{money(highest)}</strong><small>Минимальный шаг {money(step)}</small></div>
        {role === 'buyer' ? <div className={s.flow}>
          <div className={s.facts}><span>До конца торгов<strong>{ended ? 'Завершены' : `${duration} дней`}</strong></span><span>Следующая ставка<strong>{money(minimum)}</strong></span></div>
          {ended ? <div className={s.notice}>Торги завершены. Новые ставки не принимаются.</div> : <><label htmlFor="auction-bid">Ваше предложение</label><Input label="Ваше предложение" id="auction-bid" type="number" min={minimum} step={step} value={bid} onChange={e => { setBid(e.target.value); setStatus('idle'); }} /><Button fullWidth size="L" onClick={submitBid} disabled={status === 'pending'}>{status === 'pending' ? 'Отправляем ставку…' : 'Сделать ставку →'}</Button></>}
          <div role="status" aria-live="polite">{status === 'pending' && 'Ожидаем ответ по вашей ставке…'}{status === 'accepted' && `Ставка ${money(highest)} принята. Вы лидируете!`}{status === 'low' && `Ставка ниже допустимой. Предложите от ${money(minimum)}.`}{status === 'error' && 'Не удалось отправить ставку. Попробуйте снова.'}</div>
          {!ended && <button className={s.textButton} onClick={() => setStatus('error')}>Показать ошибку отправки</button>}
        </div> : <div className={s.flow}>
          {published ? <><div className={s.notice}>Аукцион опубликован. Покупатели могут делать ставки.</div><Button fullWidth size="L" onClick={() => setRole('buyer')}>Посмотреть как покупатель →</Button><button className={s.textButton} onClick={() => setEnded(true)}>Завершить аукцион</button></> : <><p>Настройте условия торгов и проверьте их перед публикацией.</p><label htmlFor="auction-price">Стартовая цена, ₽</label><Input label="Стартовая цена, ₽" id="auction-price" type="number" min="1" value={price} onChange={e => setPrice(e.target.value)} /><label htmlFor="auction-duration">Длительность, дней</label><Input label="Длительность, дней" id="auction-duration" type="number" min="1" max="30" value={duration} onChange={e => setDuration(e.target.value)} /><div className={s.notice}>Старт {money(Number(price) || 0)} · шаг {money(step)} · {duration} дней</div><Button fullWidth size="L" disabled={Number(price) <= 0 || Number(duration) < 1 || Number(duration) > 30} onClick={() => { setHighest(Number(price)); setPublished(true); setEnded(false); }}>Проверить и опубликовать →</Button></>}
        </div>}
      </div></div>
      <div className={s.bottom}><span>01 — КВАРТИРА</span><span>02 — УСЛОВИЯ</span><span>03 — ВАША СТАВКА</span></div>
    </div>
    </div>
    </div>
    <button className={s.roleToggle} type="button" aria-label={role === 'buyer' ? 'Переключить на продавца' : 'Переключить на покупателя'} title={role === 'buyer' ? 'Переключить на продавца' : 'Переключить на покупателя'} onClick={() => setRole(role === 'buyer' ? 'seller' : 'buyer')}>⇄<span>{role === 'buyer' ? 'Продавец' : 'Покупатель'}</span></button>
    </div>
  </main>;
}
