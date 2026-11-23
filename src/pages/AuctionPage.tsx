import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Badge, Button, Icon, Input } from '@/ui';
import { PageLayout } from '@/components/Layout';
import { Gallery } from '@/components/Realty';
import { listingLabel, listings, money } from '@/data/listings';
import s from './AuctionPage.module.css';

type Role = 'seller' | 'buyer';
type SellerStep = 'listing' | 'setup' | 'review' | 'published';
type BidState = 'idle' | 'loading' | 'accepted' | 'failed';

const listing = listings[0];
const auctionPhotos = [
  '/images/auction/living-room.jpg',
  '/images/auction/dining-room.jpg',
  '/images/auction/bedroom.jpg',
];
type AuctionTerms = { startingPrice: number; increment: number; finishDate: string };

function defaultFinish() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  date.setHours(19, 0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T19:00`;
}

function formatFinish(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'выберите дату'
    : new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
        .format(date)
        .replace(/ в /g, '\u00a0в\u00a0');
}

function useAuction(buyerDemo: boolean) {
  const [step, setStep] = useState<SellerStep>('listing');
  const [placementStep, setPlacementStep] = useState(0);
  const [startingPrice, setStartingPrice] = useState('19900000');
  const [increment, setIncrement] = useState('100000');
  const [finishDate, setFinishDate] = useState(defaultFinish);
  const [errors, setErrors] = useState<Partial<Record<keyof AuctionTerms, string>>>({});
  const [published, setPublished] = useState<AuctionTerms | null>(() =>
    buyerDemo
      ? {
          startingPrice: 19_900_000,
          increment: 100_000,
          finishDate,
        }
      : null,
  );
  const [currentBid, setCurrentBid] = useState<number | null>(null);
  const [bid, setBid] = useState('');
  const [bidState, setBidState] = useState<BidState>('idle');
  const [bidError, setBidError] = useState('');
  const [finished, setFinished] = useState(false);
  const [pendingBid, setPendingBid] = useState<number | null>(null);
  const minBid = published
    ? currentBid === null
      ? published.startingPrice
      : currentBid + published.increment
    : 0;

  useEffect(() => {
    if (bidState !== 'loading' || pendingBid === null || finished) return;
    const timer = window.setTimeout(() => {
      setCurrentBid(pendingBid);
      setBidState('accepted');
      setPendingBid(null);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [bidState, pendingBid, finished]);

  const publish = () => {
    if (currentBid !== null || bidState === 'loading' || finished) return;
    setPublished({
      startingPrice: Number(startingPrice),
      increment: Number(increment),
      finishDate,
    });
    setCurrentBid(null);
    setBid('');
    setBidState('idle');
    setBidError('');
    setPendingBid(null);
    setFinished(false);
    setStep('published');
  };
  const submitBid = () => {
    if (!published || finished || bidState === 'loading') return;
    const numericBid = Number(bid);
    if (!Number.isSafeInteger(numericBid) || numericBid < minBid) {
      setBidError(`Минимальная ставка — ${money(minBid)}`);
      setBidState('idle');
      return;
    }
    setBidError('');
    setPendingBid(numericBid);
    setBidState('loading');
  };
  const finish = () => {
    setFinished(true);
    setPendingBid(null);
    setBidState(currentBid === null ? 'idle' : 'accepted');
  };
  return {
    step,
    setStep,
    placementStep,
    setPlacementStep,
    startingPrice,
    setStartingPrice,
    increment,
    setIncrement,
    finishDate,
    setFinishDate,
    errors,
    setErrors,
    published,
    publish,
    currentBid,
    bid,
    setBid,
    bidState,
    setBidState,
    bidError,
    setBidError,
    finished,
    setFinished,
    minBid,
    submitBid,
    finish,
    ensurePublished: () =>
      setPublished(
        (terms) =>
          terms ?? {
            startingPrice: 19_900_000,
            increment: 100_000,
            finishDate: defaultFinish(),
          },
      ),
  };
}
type Auction = ReturnType<typeof useAuction>;

function AuctionNavigation() {
  return (
    <nav className={s.roleSwitch} aria-label="Разделы Циана">
      <NavLink to="/auction" end>
        <Icon name="Menu" size={20} />
        Главная
      </NavLink>
      <NavLink to="/auction/search">
        <Icon name="ActionSearch16" size={20} />
        Поиск
      </NavLink>
      <NavLink to="/auction/seller">
        <Icon name="ActionProfile24" size={20} />
        Мои объявления
      </NavLink>
    </nav>
  );
}

function AuctionHome({
  auction,
  search,
  onOpenBuyer,
}: {
  auction: Auction;
  search: boolean;
  onOpenBuyer: () => void;
}) {
  return (
    <>
      <section className={s.homeSearch}>
        <span className={s.eyebrow}>МОСКВА</span>
        <h1>{search ? 'Квартиры в\u00a0Москве' : 'Найдите своё место'}</h1>
        <Link className={s.searchEntry} to="/auction/search">
          <Icon name="ActionSearch16" size={20} /> Купить квартиру в&nbsp;Москве
          <Icon name="ActionChevronRight16" size={16} />
        </Link>
        <div className={s.searchTags}>
          <span>Купить</span>
          <span>Квартира</span>
          <span>Москва</span>
        </div>
      </section>
      <section className={s.homeListings}>
        <div className={s.sectionHeading}>
          <h2>{search ? '1 квартира' : 'Могут подойти'}</h2>
          {!search && <Link to="/auction/search">Все объявления →</Link>}
        </div>
        <Link
          className={s.homeListing}
          to="/auction/apartment"
          onClick={onOpenBuyer}
          aria-label="Открыть квартиру: Светлая квартира у&nbsp;парка"
        >
          <div className={s.homeListingPhoto}>
            <img src={auctionPhotos[0]} alt="Светлая гостиная с&nbsp;большими окнами" />
            <Badge tone="main">{auction.finished ? 'Аукцион завершён' : 'Аукцион'}</Badge>
          </div>
          <div className={s.homeListingBody}>
            <strong>
              {money(auction.currentBid ?? auction.published?.startingPrice ?? 19_900_000)}
            </strong>
            <p>{listingLabel(listing)}</p>
            <p>{listing.address}</p>
            <span>Сокольники · 7 минут пешком</span>
            <div className={s.auctionTeaser}>
              {auction.finished ? 'Посмотреть результаты' : 'Посмотреть условия аукциона'}{' '}
              <span>→</span>
            </div>
          </div>
        </Link>
      </section>
    </>
  );
}

function PlacementStart({ auction }: { auction: Auction }) {
  const { placementStep, setPlacementStep } = auction;
  const titles = ['Сделка', 'Продажа', 'Продажа жилой'];
  const choices = [
    ['Аренда', 'Продажа'],
    ['Жилая', 'Коммерческая'],
    [
      'Квартира',
      'Квартира в\u00a0новостройке',
      'Комната',
      'Доля в\u00a0квартире',
      'Дом/дача',
      'Коттедж',
      'Таунхаус',
      'Часть дома',
      'Участок',
      'Гараж',
    ],
  ];
  const enabled = ['Продажа', 'Жилая', 'Квартира'];
  return (
    <section className={s.placementStart}>
      <div className={s.placementHeading}>
        {placementStep === 0 ? (
          <Link to="/auction" aria-label="Закрыть размещение">
            ×
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setPlacementStep(placementStep - 1)}
            aria-label="Предыдущий шаг"
          >
            ←
          </button>
        )}
        <h1>Новое объявление</h1>
      </div>
      <div className={s.placementProgress} aria-label={`Шаг ${placementStep + 1} из 4`}>
        <span style={{ width: `${(placementStep + 1) * 25}%` }} />
      </div>
      <div className={s.placementNote}>
        <p>
          В&nbsp;этом прототипе размещаем квартиру собственника для&nbsp;продажи через&nbsp;аукцион.
        </p>
        <span>Без&nbsp;оплаты и&nbsp;оформления сделки</span>
      </div>
      <h2>{titles[placementStep]}</h2>
      <div className={s.placementChoices}>
        {choices[placementStep].map((choice) => (
          <Button
            key={choice}
            theme="stroke_primary"
            disabled={choice !== enabled[placementStep]}
            onClick={() => setPlacementStep(placementStep + 1)}
          >
            {choice}
          </Button>
        ))}
      </div>
    </section>
  );
}

function AuctionFacts({ terms }: { terms: AuctionTerms }) {
  return (
    <dl className={s.facts}>
      <div>
        <dt>Стартовая цена</dt>
        <dd>{money(terms.startingPrice)}</dd>
      </div>
      <div>
        <dt>Минимальный шаг</dt>
        <dd>{money(terms.increment)}</dd>
      </div>
      <div>
        <dt>Окончание</dt>
        <dd>{formatFinish(terms.finishDate)}</dd>
      </div>
    </dl>
  );
}

function SellerScenario({ auction, onOpenBuyer }: { auction: Auction; onOpenBuyer: () => void }) {
  const {
    step,
    setStep,
    startingPrice,
    setStartingPrice,
    increment,
    setIncrement,
    finishDate,
    setFinishDate,
    errors,
    setErrors,
    published,
    publish,
    currentBid,
    finished,
  } = auction;
  const startingPriceNumber = Number(startingPrice);
  const incrementNumber = Number(increment);
  const draft = { startingPrice: startingPriceNumber, increment: incrementNumber, finishDate };
  const canEdit = currentBid === null && auction.bidState !== 'loading' && !finished;

  const review = () => {
    const nextErrors = {
      startingPrice:
        !Number.isFinite(startingPriceNumber) || startingPriceNumber < 1_000_000
          ? 'Укажите цену от\u00a01 000 000 ₽'
          : undefined,
      increment:
        !Number.isFinite(incrementNumber) || incrementNumber < 10_000
          ? 'Минимальный шаг — 10 000 ₽'
          : undefined,
      finishDate: Number.isNaN(new Date(finishDate).getTime())
        ? 'Выберите дату окончания'
        : new Date(finishDate).getTime() <= Date.now()
          ? 'Выберите дату и\u00a0время в\u00a0будущем'
          : undefined,
    };
    setErrors(nextErrors);
    const firstError = Object.entries(nextErrors).find(([, error]) => error)?.[0];
    if (firstError) document.getElementById(`auction-${firstError}`)?.focus();
    else setStep('review');
  };

  if (step === 'listing')
    return (
      <section className={s.ownerOverview}>
        <div className={s.ownerPhoto}>
          <img src={auctionPhotos[0]} alt="Светлая гостиная с&nbsp;большими окнами" />
          <Badge tone="main">{published ? 'Ваше объявление' : 'Квартира для\u00a0продажи'}</Badge>
        </div>
        <div className={s.ownerBody}>
          <span className={s.eyebrow}>МОЯ КВАРТИРА · ЛОТ 001</span>
          <h2>Светлая квартира у&nbsp;парка</h2>
          <p>{listingLabel(listing)}</p>
          <p>{listing.address}, Сокольники</p>
          <strong className={s.ownerPrice}>
            {money(currentBid ?? published?.startingPrice ?? 19_900_000)}
          </strong>
          <div className={s.ownerCallout}>
            <span className={s.calloutIcon}>↗</span>
            <div>
              <h3>Как продать квартиру</h3>
              <p>Вы&nbsp;задаёте стартовую цену и&nbsp;срок. Покупатели предлагают свою цену.</p>
            </div>
          </div>
          <Button fullWidth size="L" disabled={!canEdit} onClick={() => setStep('setup')}>
            Продать на&nbsp;аукционе
          </Button>
          {!canEdit && (
            <p>
              Во&nbsp;время отправки, после&nbsp;ставки или&nbsp;завершения торгов условия нельзя
              менять.
            </p>
          )}
          {published && (
            <Button fullWidth theme="main_secondary" onClick={onOpenBuyer}>
              Посмотреть объявление
            </Button>
          )}
        </div>
      </section>
    );

  if (step === 'published' && published)
    return (
      <section className={s.successPanel} aria-live="polite">
        <img
          className={s.successPhoto}
          src={auctionPhotos[0]}
          alt="Светлая гостиная с&nbsp;большими окнами"
        />
        <span className={s.successIcon}>
          <Icon name="FunctionalSuccess16" size={28} />
        </span>
        <Badge tone={finished ? 'neutral' : 'positive'}>
          {finished ? 'Аукцион завершён' : 'Аукцион опубликован'}
        </Badge>
        <h2>{finished ? 'Торги окончены' : 'Квартира участвует в\u00a0торгах'}</h2>
        <AuctionFacts terms={published} />
        <p>
          Текущая цена: <strong>{money(currentBid ?? published.startingPrice)}</strong>
        </p>
        <p>
          {finished
            ? currentBid === null
              ? 'Ставок не\u00a0было.'
              : 'Итоговая ставка показана в\u00a0объявлении.'
            : 'В\u00a0объявлении покупатели видят условия и\u00a0могут сделать ставку.'}
        </p>
        <div className={s.inlineActions}>
          <Button onClick={onOpenBuyer}>Посмотреть объявление</Button>
          <Button theme="main_secondary" disabled={!canEdit} onClick={() => setStep('setup')}>
            Изменить условия
          </Button>
        </div>
        {!canEdit && (
          <p>
            Во&nbsp;время отправки, после&nbsp;ставки или&nbsp;завершения торгов условия нельзя
            менять.
          </p>
        )}
      </section>
    );

  return (
    <div className={s.sellerGrid}>
      <section className={s.formCard}>
        <div className={s.stepTrack} aria-label="Этапы публикации">
          <span className={s.stepDone}>01 Условия</span>
          <span className={step === 'review' ? s.stepDone : ''}>02 Проверка</span>
        </div>
        {step === 'setup' ? (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              review();
            }}
          >
            <div className={s.cardHeading}>
              <Badge tone="main">Шаг 1 из&nbsp;2</Badge>
              <h2>Настройте аукцион</h2>
              <p>Задайте стартовую цену, шаг ставки и&nbsp;срок.</p>
            </div>
            <div className={s.formFields}>
              <Input
                id="auction-startingPrice"
                label="Стартовая цена, ₽"
                inputMode="numeric"
                value={startingPrice}
                onChange={(event) => setStartingPrice(event.currentTarget.value.replace(/\D/g, ''))}
                error={errors.startingPrice}
                hint="Цена, с&nbsp;которой начнутся торги"
                size="L"
              />
              <Input
                id="auction-increment"
                label="Минимальный шаг, ₽"
                inputMode="numeric"
                value={increment}
                onChange={(event) => setIncrement(event.currentTarget.value.replace(/\D/g, ''))}
                error={errors.increment}
                hint="На&nbsp;эту сумму или&nbsp;больше можно повысить ставку"
                size="L"
              />
              <label className={s.dateField}>
                <span>Дата и&nbsp;время окончания</span>
                <input
                  type="datetime-local"
                  id="auction-finishDate"
                  value={finishDate}
                  onChange={(event) => setFinishDate(event.currentTarget.value)}
                  aria-invalid={Boolean(errors.finishDate)}
                  aria-describedby={errors.finishDate ? 'auction-date-error' : undefined}
                />
                {errors.finishDate && <small id="auction-date-error">{errors.finishDate}</small>}
              </label>
            </div>
            <Button fullWidth size="L" type="submit">
              Проверить условия
            </Button>
          </form>
        ) : (
          <>
            <div className={s.cardHeading}>
              <Badge tone="main">Шаг 2 из&nbsp;2</Badge>
              <h2>Проверьте условия</h2>
              <p>После&nbsp;публикации покупатели смогут отправлять ставки.</p>
            </div>
            <AuctionFacts terms={draft} />
            <div className={s.notice}>
              <Icon name="FunctionalInformationCircle16" size={20} /> Условия — учебное допущение.
              Оплата и&nbsp;оформление сделки в&nbsp;прототип не&nbsp;входят.
            </div>
            <div className={s.formActions}>
              <Button fullWidth size="L" onClick={publish}>
                Опубликовать аукцион
              </Button>
              <Button fullWidth theme="main_secondary" onClick={() => setStep('setup')}>
                Вернуться к&nbsp;условиям
              </Button>
            </div>
          </>
        )}
      </section>
      <aside className={s.previewCard}>
        <img src={auctionPhotos[0]} alt="Светлая гостиная с&nbsp;большими окнами" />
        <div className={s.previewBody}>
          <span className={s.eyebrow}>ВАША КВАРТИРА</span>
          <h2>Светлая квартира у&nbsp;парка</h2>
          <p>{listingLabel(listing)}</p>
          <p>{listing.address}, Москва</p>
          <AuctionFacts terms={draft} />
        </div>
      </aside>
    </div>
  );
}

function BuyerScenario({ auction, onOpenSeller }: { auction: Auction; onOpenSeller: () => void }) {
  const {
    published,
    currentBid,
    bid,
    setBid,
    bidState,
    setBidState,
    bidError,
    setBidError,
    finished,
    setFinished,
    minBid,
    submitBid,
    finish,
  } = auction;
  if (!published)
    return (
      <section className={s.formCard}>
        <h2>Аукцион ещё не&nbsp;опубликован</h2>
        <p>Сначала задайте условия и&nbsp;опубликуйте аукцион от&nbsp;имени продавца.</p>
        <Button onClick={onOpenSeller}>Перейти к&nbsp;продавцу</Button>
      </section>
    );
  return (
    <div className={s.buyerGrid}>
      <section className={s.listingCard}>
        <div className={s.photos}>
          <Gallery images={auctionPhotos} title="Светлая квартира у&nbsp;парка" />
        </div>
        <div className={s.listingBody}>
          <div className={s.listingBadges}>
            <Badge tone={finished ? 'neutral' : 'positive'}>
              {finished ? 'Аукцион завершён' : 'Торги идут'}
            </Badge>
            {!finished && <span>До&nbsp;{formatFinish(published.finishDate)}</span>}
          </div>
          <strong className={s.propertyPrice}>
            {money(currentBid ?? published.startingPrice)}
          </strong>
          <span className={s.pricePerMeter}>
            {money(Math.round((currentBid ?? published.startingPrice) / listing.area))}/м²
          </span>
          <h2>Светлая квартира у&nbsp;парка</h2>
          <dl className={s.propertyDetails}>
            <div>
              <dt>Квартира</dt>
              <dd>{listing.rooms}-комн.</dd>
            </div>
            <div>
              <dt>Общая площадь</dt>
              <dd>{listing.area} м²</dd>
            </div>
            <div>
              <dt>Этаж</dt>
              <dd>
                {listing.floor} из&nbsp;{listing.floors}
              </dd>
            </div>
          </dl>
          <p className={s.address}>
            {listing.address}, {listing.district}
          </p>
          <p className={s.metro}>
            М {listing.metro} · {listing.walkMinutes} минут пешком
          </p>
          <AuctionFacts terms={published} />
        </div>
      </section>
      <aside className={s.bidCard}>
        {finished ? (
          <section className={s.finished} aria-live="polite">
            <span className={s.finishIcon}>
              <Icon name="FunctionalSuccess16" size={24} />
            </span>
            <h2>Аукцион завершён</h2>
            <p>
              {currentBid === null
                ? 'Аукцион завершился без\u00a0ставок.'
                : `Победила ставка ${money(currentBid)}.`}{' '}
              Ставки больше не&nbsp;принимаются.
            </p>
            <details className={s.simulations}>
              <summary>Демо-состояния</summary>
              <Button theme="main_secondary" fullWidth onClick={() => setFinished(false)}>
                Показать активный аукцион
              </Button>
            </details>
          </section>
        ) : (
          <>
            <h2 className={s.auctionTitle}>Аукцион</h2>
            <span className={s.eyebrow}>
              {currentBid === null ? 'СТАРТОВАЯ ЦЕНА' : 'ТЕКУЩАЯ СТАВКА'}
            </span>
            <strong className={s.currentPrice}>
              {money(currentBid ?? published.startingPrice)}
            </strong>
            <p className={s.bidHint}>Следующая ставка — от&nbsp;{money(minBid)}</p>
            <div className={s.bidSummary}>
              <span>Шаг ставки</span>
              <strong>{money(published.increment)}</strong>
              <span>Окончание</span>
              <strong>{formatFinish(published.finishDate)}</strong>
            </div>
            {bidState === 'accepted' ? (
              <section className={s.bidAccepted} aria-live="polite">
                <Icon name="FunctionalSuccess16" size={24} />
                <div>
                  <strong>Ставка принята</strong>
                  <p>Ваша ставка {money(currentBid ?? 0)} лидирует.</p>
                </div>
              </section>
            ) : null}
            {bidState === 'failed' && (
              <section className={s.bidFailed} role="alert">
                <Icon name="FunctionalInformationCircle16" size={22} />
                <div>
                  <strong>Не&nbsp;удалось отправить ставку</strong>
                  <p>Цена не&nbsp;изменилась. Повторите отправку.</p>
                </div>
              </section>
            )}
            {bidState !== 'accepted' && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submitBid();
                }}
              >
                <Input
                  label="Ваша ставка, ₽"
                  inputMode="numeric"
                  placeholder={String(minBid)}
                  disabled={bidState === 'loading'}
                  value={bid}
                  onChange={(event) => {
                    setBid(event.currentTarget.value.replace(/\D/g, ''));
                    setBidError('');
                  }}
                  error={bidError}
                  size="L"
                />
                <Button type="submit" fullWidth size="L" loading={bidState === 'loading'}>
                  {bidState === 'loading'
                    ? 'Отправляем ставку…'
                    : bidState === 'failed'
                      ? 'Попробовать снова'
                      : 'Сделать ставку'}
                </Button>
              </form>
            )}
            <p className={s.smallPrint}>
              Учебный аукцион. Без&nbsp;оплаты и&nbsp;оформления сделки.
            </p>
            <details className={s.simulations}>
              <summary>Демо-состояния</summary>
              <button type="button" onClick={() => setBidState('failed')}>
                Показать ошибку ответа
              </button>
              <button type="button" onClick={finish}>
                Показать завершённый аукцион
              </button>
            </details>
          </>
        )}
      </aside>
    </div>
  );
}

export function AuctionPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isHome = pathname === '/auction' || pathname === '/auction/';
  const isSearch = pathname.endsWith('/search');
  const isPlacement = pathname.endsWith('/place');
  const role: Role = pathname.endsWith('/seller') || isPlacement ? 'seller' : 'buyer';
  const auction = useAuction(role === 'buyer' && !isHome && !isSearch);
  const openBuyer = () => {
    auction.ensurePublished();
    navigate('/auction/apartment');
  };
  return (
    <div className={s.auctionApp}>
      <header className={`${s.appHeader} ${isPlacement ? s.creationHeader : ''}`}>
        <Link to="/auction" aria-label="Циан — аукцион">
          <img src="/images/logo.svg" alt="Циан" width="104" height="26" />
        </Link>
        {!isPlacement && (
          <Link className={s.placeLink} to="/auction/place">
            <Icon name="ActionPlus16" size={16} /> Разместить
          </Link>
        )}
      </header>
      <PageLayout className={s.page}>
        {isHome || isSearch ? (
          <AuctionHome auction={auction} search={isSearch} onOpenBuyer={auction.ensurePublished} />
        ) : isPlacement && auction.placementStep < 3 ? (
          <PlacementStart auction={auction} />
        ) : (
          <>
            <section className={s.hero}>
              <div>
                <Link
                  className={s.backLink}
                  to={role === 'seller' ? '/auction' : '/auction/search'}
                >
                  ← {role === 'seller' ? 'Главная' : 'Квартиры в\u00a0Москве'}
                </Link>
                {role === 'seller' && <h1>{isPlacement ? 'Способ продажи' : 'Мои объявления'}</h1>}
              </div>
            </section>
            {role === 'seller' ? (
              <SellerScenario auction={auction} onOpenBuyer={openBuyer} />
            ) : (
              <BuyerScenario auction={auction} onOpenSeller={() => navigate('/auction/seller')} />
            )}
          </>
        )}
        {(!isPlacement || auction.step === 'published') && <AuctionNavigation />}
        <footer className={s.pageFooter}>
          <span>© Циан · Учебный проект</span>
          <span>Оплата и&nbsp;оформление сделки не&nbsp;предусмотрены</span>
        </footer>
      </PageLayout>
    </div>
  );
}
