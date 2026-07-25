import { useEffect, useMemo, useState } from 'react'
import './App.css'

type TelegramWebApp = {
  ready: () => void
  expand: () => void
  initDataUnsafe?: { user?: { first_name?: string } }
  themeParams?: { bg_color?: string }
  HapticFeedback?: { impactOccurred: (style: 'light' | 'medium' | 'heavy') => void }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

const sections = [
  { href: '#portfolio', label: 'Портфель' },
  { href: '#market', label: 'Рынок' },
  { href: '#coupons', label: 'Купоны' },
]

type Instrument = {
  secid: string
  ticker: string
  name: string
  kind: 'Акция' | 'Облигация'
  category: 'Акции' | 'ОФЗ' | 'Корпоративные'
  price: number
  valuePrice: number
  change?: number
  coupon?: string
  couponValue?: number
  date?: string
  couponDate?: string
  maturityDate?: string
  faceValue?: number
  accruedInterest?: number
  lotSize?: number
  isin?: string
  priceUnit?: '₽' | '%'
}

type Position = {
  quantity: number
  buyPrice: number
}

const fallbackInstruments: Instrument[] = [
  { secid: 'SBER', ticker: 'SBER', name: 'Сбербанк', kind: 'Акция', category: 'Акции', price: 310.5, valuePrice: 310.5, change: 1.24 },
  { secid: 'LKOH', ticker: 'LKOH', name: 'Лукойл', kind: 'Акция', category: 'Акции', price: 6780, valuePrice: 6780, change: -0.38 },
  { secid: 'SU26238RMFS4', ticker: 'SU26238RMFS4', name: 'ОФЗ-ПД 26238', kind: 'Облигация', category: 'ОФЗ', price: 64.87, valuePrice: 648.7, coupon: '35,18 ₽', couponValue: 35.18, date: '—', faceValue: 1000, priceUnit: '%' },
  { secid: 'SU26240RMFS0', ticker: 'SU26240RMFS0', name: 'ОФЗ-ПД 26240', kind: 'Облигация', category: 'ОФЗ', price: 72.1, valuePrice: 721, coupon: '36,90 ₽', couponValue: 36.9, date: '—', faceValue: 1000, priceUnit: '%' },
]

type IssBlock = { columns: string[]; data: Array<Array<string | number | null>> }
type IssResponse = { securities?: IssBlock; marketdata?: IssBlock; 'securities.cursor'?: IssBlock }

const blockRows = (block?: IssBlock) => {
  if (!block) return []
  return block.data.map((values) => Object.fromEntries(block.columns.map((column, index) => [column, values[index]])))
}

const loadBoard = async (
  market: 'shares' | 'bonds',
  board: 'TQBR' | 'TQOB' | 'TQCB',
  category: Instrument['category'],
) => {
  const base = 'https://iss.moex.com/iss/engines/stock/markets'
  const query = 'iss.meta=off&iss.only=securities,marketdata,securities.cursor&securities.columns=SECID,SHORTNAME,COUPONVALUE,NEXTCOUPON,FACEVALUE,ACCRUEDINT,MATDATE,LOTSIZE,ISIN&marketdata.columns=SECID,LAST,MARKETPRICE,LASTTOPREVPRICE'
  const requestPage = async (start: number) => {
    const response = await fetch(`${base}/${market}/boards/${board}/securities.json?${query}&start=${start}`)
    if (!response.ok) throw new Error('MOEX is unavailable')
    return response.json() as Promise<IssResponse>
  }
  const first = await requestPage(0)
  const cursor = blockRows(first['securities.cursor'])[0]
  const total = Number(cursor?.TOTAL ?? 0)
  const pageSize = Number(cursor?.PAGESIZE ?? 100)
  const starts = Array.from({ length: Math.max(0, Math.ceil(total / pageSize) - 1) }, (_, index) => (index + 1) * pageSize)
  const payloads = [first, ...await Promise.all(starts.map(requestPage))]

  return payloads.flatMap((payload) => {
    const securityRows = blockRows(payload.securities)
    const marketRows = blockRows(payload.marketdata)
    return securityRows.map((security) => ({
      ...security,
      ...marketRows.find((market) => market.SECID === security.SECID),
    }))
  }).map((row): Instrument => {
    const isBond = market === 'bonds'
    const price = Number(row.LAST ?? row.MARKETPRICE)
    const coupon = Number(row.COUPONVALUE)
    const faceValue = Number(row.FACEVALUE)
    const accrued = Number(row.ACCRUEDINT)
    const safePrice = Number.isFinite(price) && price > 0 ? price : 0
    const couponDateRaw = typeof row.NEXTCOUPON === 'string' ? row.NEXTCOUPON : undefined
    const couponDate = couponDateRaw
      ? new Date(couponDateRaw).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
      : '—'
    return {
      secid: String(row.SECID),
      ticker: String(row.SECID),
      name: String(row.SHORTNAME ?? row.SECID),
      kind: isBond ? 'Облигация' : 'Акция',
      category,
      price: safePrice,
      valuePrice: isBond && Number.isFinite(faceValue)
        ? safePrice / 100 * faceValue + (Number.isFinite(accrued) ? accrued : 0)
        : safePrice,
      change: Number.isFinite(Number(row.LASTTOPREVPRICE)) ? Number(row.LASTTOPREVPRICE) : undefined,
      coupon: isBond && Number.isFinite(coupon) ? `${coupon.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽` : undefined,
      couponValue: isBond && Number.isFinite(coupon) ? coupon : undefined,
      date: couponDate,
      couponDate: couponDateRaw,
      maturityDate: typeof row.MATDATE === 'string' ? row.MATDATE : undefined,
      faceValue: Number.isFinite(faceValue) ? faceValue : undefined,
      accruedInterest: Number.isFinite(accrued) ? accrued : undefined,
      lotSize: Number.isFinite(Number(row.LOTSIZE)) ? Number(row.LOTSIZE) : undefined,
      isin: typeof row.ISIN === 'string' ? row.ISIN : undefined,
      priceUnit: isBond ? '%' : '₽',
    }
  })
}

const loadMoexMarket = async () => {
  const groups = await Promise.all([
    loadBoard('shares', 'TQBR', 'Акции'),
    loadBoard('bonds', 'TQOB', 'ОФЗ'),
    loadBoard('bonds', 'TQCB', 'Корпоративные'),
  ])
  return groups.flat().filter((instrument) => instrument.price > 0)
}

function App() {
  const [name, setName] = useState('инвестор')
  const [isTelegram, setIsTelegram] = useState(false)
  const [instruments, setInstruments] = useState(fallbackInstruments)
  const [marketStatus, setMarketStatus] = useState<'loading' | 'live' | 'error'>('loading')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [marketQuery, setMarketQuery] = useState('')
  const [marketFilter, setMarketFilter] = useState<'Все' | Instrument['category']>('Все')
  const [visibleCount, setVisibleCount] = useState(20)
  const [portfolio, setPortfolio] = useState<Record<string, Position>>(() => {
    const saved = localStorage.getItem('investai-portfolio')
    if (!saved) return {}
    const parsed = JSON.parse(saved) as Record<string, Position | number>
    return Object.fromEntries(Object.entries(parsed).map(([ticker, position]) => [
      ticker,
      typeof position === 'number'
        ? { quantity: position, buyPrice: fallbackInstruments.find((item) => item.ticker === ticker)?.price ?? 0 }
        : position,
    ]))
  })
  const [notice, setNotice] = useState('Выберите бумагу из списка рынка')
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null)
  const [detailInstrument, setDetailInstrument] = useState<Instrument | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [buyPrice, setBuyPrice] = useState('')
  const [showAdvice, setShowAdvice] = useState(false)

  const portfolioItems = instruments.filter((instrument) => portfolio[instrument.ticker])
  const filteredInstruments = useMemo(() => {
    const query = marketQuery.trim().toLocaleLowerCase('ru')
    return instruments.filter((instrument) => {
      const matchesFilter = marketFilter === 'Все' || instrument.category === marketFilter
      const matchesQuery = !query || `${instrument.ticker} ${instrument.name}`.toLocaleLowerCase('ru').includes(query)
      return matchesFilter && matchesQuery
    })
  }, [instruments, marketFilter, marketQuery])
  const portfolioValue = useMemo(
    () => portfolioItems.reduce((sum, instrument) => sum + instrument.valuePrice * portfolio[instrument.ticker].quantity, 0),
    [portfolio, portfolioItems],
  )
  const investedValue = useMemo(
    () => portfolioItems.reduce((sum, instrument) => sum + portfolio[instrument.ticker].buyPrice * portfolio[instrument.ticker].quantity, 0),
    [portfolio, portfolioItems],
  )
  const profit = portfolioValue - investedValue
  const profitPercent = investedValue ? profit / investedValue * 100 : 0
  const stockShare = portfolioValue
    ? portfolioItems.filter((item) => item.kind === 'Акция').reduce((sum, item) => sum + item.valuePrice * portfolio[item.ticker].quantity, 0) / portfolioValue * 100
    : 0
  const portfolioBonds = portfolioItems
    .filter((item) => item.kind === 'Облигация' && item.couponValue)
    .sort((a, b) => (a.couponDate ? new Date(a.couponDate).getTime() : Infinity) - (b.couponDate ? new Date(b.couponDate).getTime() : Infinity))
  const calendarBonds = portfolioBonds.length
    ? portfolioBonds
    : instruments
        .filter((item) => item.kind === 'Облигация' && item.couponValue && item.couponDate)
        .sort((a, b) => new Date(a.couponDate!).getTime() - new Date(b.couponDate!).getTime())
        .slice(0, 4)
  const expectedCoupons = portfolioBonds.reduce(
    (sum, bond) => sum + (bond.couponValue ?? 0) * portfolio[bond.ticker].quantity,
    0,
  )

  const advice = portfolioItems.length === 0
    ? 'Добавьте хотя бы две бумаги — после этого я оценю структуру портфеля.'
    : portfolioItems.length === 1
      ? 'Портфель зависит от одной бумаги. Для снижения риска добавьте актив другого эмитента.'
      : stockShare > 80
        ? `Акции занимают ${stockShare.toFixed(0)}% портфеля. Рассмотрите облигации, если хотите снизить колебания.`
        : stockShare < 20
          ? `Облигации занимают ${(100 - stockShare).toFixed(0)}% портфеля. Доля акций небольшая — потенциал роста может быть ограничен.`
          : `Структура выглядит умеренно сбалансированной: акции ${stockShare.toFixed(0)}%, облигации ${(100 - stockShare).toFixed(0)}%.`

  const openAddInstrument = (instrument: Instrument) => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    setSelectedInstrument(instrument)
    setQuantity('1')
    setBuyPrice(String(instrument.valuePrice))
  }

  const addInstrument = () => {
    if (!selectedInstrument) return
    const amount = Math.max(1, Number(quantity) || 1)
    const price = Math.max(0, Number(buyPrice) || selectedInstrument.valuePrice)
    setPortfolio((current) => {
      const existing = current[selectedInstrument.ticker]
      const totalQuantity = (existing?.quantity ?? 0) + amount
      const averagePrice = existing
        ? ((existing.buyPrice * existing.quantity) + (price * amount)) / totalQuantity
        : price
      return { ...current, [selectedInstrument.ticker]: { quantity: totalQuantity, buyPrice: averagePrice } }
    })
    setNotice(`${selectedInstrument.ticker} добавлен в портфель`)
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')
    setSelectedInstrument(null)
  }

  useEffect(() => {
    localStorage.setItem('investai-portfolio', JSON.stringify(portfolio))
  }, [portfolio])

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return
    webApp.ready()
    webApp.expand()
    setName(webApp.initDataUnsafe?.user?.first_name ?? 'инвестор')
    setIsTelegram(true)
  }, [])

  useEffect(() => {
    let active = true
    const refreshMarket = async () => {
      try {
        const next = await loadMoexMarket()
        if (!active) return
        setInstruments(next)
        setUpdatedAt(new Date())
        setMarketStatus('live')
      } catch {
        if (active) setMarketStatus('error')
      }
    }
    void refreshMarket()
    const timer = window.setInterval(refreshMarket, 5 * 60_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const formatPrice = (instrument: Instrument) =>
    `${instrument.price.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${instrument.priceUnit ?? '₽'}`

  useEffect(() => {
    setVisibleCount(20)
  }, [marketFilter, marketQuery])

  return (
    <div className={isTelegram ? 'telegram-app' : undefined}>
      <header className="topbar">
        <a className="brand" href="#">
          <svg className="brand-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="brand-gradient" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
                <stop stopColor="#C8CDFF" />
                <stop offset=".48" stopColor="#7B89F4" />
                <stop offset="1" stopColor="#9B63EA" />
              </linearGradient>
            </defs>
            <rect x="5" y="5" width="54" height="54" rx="17" fill="#11162D" />
            <rect x="6" y="6" width="52" height="52" rx="16" stroke="url(#brand-gradient)" strokeOpacity=".65" strokeWidth="2" />
            <path d="M17 42V30M28 42V23M39 42V16" stroke="url(#brand-gradient)" strokeWidth="5" strokeLinecap="round" />
            <path d="m17 25 10-8 10 2 10-9m-5 0 5-.2-.2 5" stroke="#B9F0D1" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="brand-copy">
            <strong>InvestAI</strong>
            <small>{isTelegram ? `Привет, ${name}` : 'умные инвестиции'}</small>
          </span>
        </a>
        <nav className="site-nav" aria-label="Навигация">
          {sections.map((section) => <a href={section.href} key={section.href}>{section.label}</a>)}
        </nav>
        <a className="header-button" href="#market">Начать</a>
      </header>

      <main className="app-shell">
        <section className="intro">
          <div>
            <p className="eyebrow">УМНЫЙ ПОРТФЕЛЬ</p>
            <h1>Инвестиции под контролем</h1>
            <p className="intro-copy">Соберите портфель из акций и облигаций, следите за его стоимостью и ближайшими выплатами в одном месте.</p>
            <div className="intro-actions">
              <a className="primary-link" href="#market">Собрать портфель</a>
              <a className="secondary-link" href="#coupons">Смотреть купоны</a>
            </div>
          </div>
          <div className="intro-visual" aria-hidden="true">
            <span>+12,4%</span>
            <div className="chart-bars"><i /><i /><i /><i /><i /><i /></div>
            <p>динамика портфеля</p>
          </div>
        </section>

        <section className="dashboard-grid" id="portfolio">
          <div>
            <p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</p>
            <h2>Ваш портфель</h2>
          </div>
          <div className={`status-pill ${marketStatus === 'error' ? 'status-error' : ''}`}>
            ● {marketStatus === 'loading' ? 'Загрузка MOEX' : marketStatus === 'live' ? 'Данные MOEX' : 'Нет связи с MOEX'}
          </div>
        </section>

        <section className="summary-grid" aria-label="Сводка портфеля">
          <article className="hero-card">
            <p className="card-label">Общая стоимость</p>
            <strong className="portfolio-value">{portfolioValue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</strong>
            <div className={profit >= 0 ? 'yield-chip' : 'yield-chip negative'}>{portfolioItems.length ? `${profit >= 0 ? '+' : ''}${profit.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽ · ${profitPercent >= 0 ? '+' : ''}${profitPercent.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%` : 'Портфель ещё не заполнен'}</div>
            <a className="primary-button" href="#market">＋ Добавить актив</a>
          </article>
          <div className="quick-stats">
            <article><span className="stat-icon pink">₽</span><div><p>Ближайшие купоны</p><strong>{portfolioBonds.length ? `${expectedCoupons.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽` : 'Добавьте облигации'}</strong></div></article>
            <article><span className="stat-icon blue">◷</span><div><p>Следующая выплата</p><strong>{portfolioBonds[0]?.date ?? 'Нет данных'}</strong></div></article>
          </div>
        </section>

      <section className="portfolio-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ВАШИ АКТИВЫ</p>
            <h2>Портфель</h2>
          </div>
          <button className="text-button">Смотреть всё</button>
        </div>
        {portfolioItems.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">◌</span>
            <h3>Портфель пока пуст</h3>
            <p>{notice}. Добавьте первую акцию или облигацию, чтобы следить за доходностью.</p>
          </div>
        ) : (
          <div className="portfolio-list">
            {portfolioItems.map((instrument) => (
              <article className="portfolio-row" key={instrument.ticker}>
                <span className="instrument-badge">{instrument.kind === 'Акция' ? 'A' : 'О'}</span>
                <button className="portfolio-main" type="button" onClick={() => setDetailInstrument(instrument)}><strong>{instrument.ticker}</strong><p>{portfolio[instrument.ticker].quantity} шт. · средняя {portfolio[instrument.ticker].buyPrice.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</p></button>
                <strong>{(portfolio[instrument.ticker].quantity * instrument.valuePrice).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</strong>
                <button className="remove-button" onClick={() => setPortfolio((current) => {
                  const next = { ...current }
                  delete next[instrument.ticker]
                  return next
                })} aria-label={`Удалить ${instrument.name}`}>×</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="market-section" id="market">
        <div className="section-heading">
          <div><p className="eyebrow">КАТАЛОГ MOEX</p><h2>Акции и облигации</h2></div>
          <span className={`demo-label ${marketStatus}`}>
            {marketStatus === 'loading'
              ? 'обновляем…'
              : marketStatus === 'live'
                ? `MOEX · задержка 15 мин${updatedAt ? ` · ${updatedAt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''}`
                : 'последние сохранённые цены'}
          </span>
        </div>
        <div className="market-tools">
          <label className="market-search">
            <span>⌕</span>
            <input
              type="search"
              value={marketQuery}
              onChange={(event) => setMarketQuery(event.target.value)}
              placeholder="Название или тикер"
              aria-label="Поиск ценных бумаг"
            />
          </label>
          <div className="market-filters" role="group" aria-label="Тип ценной бумаги">
            {(['Все', 'Акции', 'ОФЗ', 'Корпоративные'] as const).map((filter) => (
              <button
                className={marketFilter === filter ? 'active' : undefined}
                key={filter}
                onClick={() => setMarketFilter(filter)}
                type="button"
              >
                {filter}
              </button>
            ))}
          </div>
          <p className="catalog-count">
            {marketStatus === 'loading' ? 'Загружаем каталог…' : `Найдено: ${filteredInstruments.length}`}
          </p>
        </div>
        <div className="market-list">
          {filteredInstruments.slice(0, visibleCount).map((instrument) => (
            <article className="market-row" key={instrument.ticker}>
              <button className="market-main instrument-open" type="button" onClick={() => setDetailInstrument(instrument)}><strong>{instrument.ticker}</strong><p>{instrument.name} · {instrument.category}</p></button>
              <div className="market-price"><strong>{formatPrice(instrument)}</strong>{instrument.change !== undefined ? <span className={instrument.change >= 0 ? 'up' : 'down'}>{instrument.change >= 0 ? '+' : ''}{instrument.change}%</span> : <span>Купон {instrument.coupon}</span>}</div>
              <button className="add-button" onClick={() => openAddInstrument(instrument)} aria-label={`Добавить ${instrument.name}`}>＋</button>
            </article>
          ))}
        </div>
        {marketStatus !== 'loading' && filteredInstruments.length === 0 && (
          <div className="catalog-empty">Ничего не найдено. Попробуйте другой тикер или фильтр.</div>
        )}
        {visibleCount < filteredInstruments.length && (
          <button className="load-more" type="button" onClick={() => setVisibleCount((count) => count + 20)}>
            Показать ещё
          </button>
        )}
      </section>

      <section className="coupon-section" id="coupons">
        <div className="section-heading"><div><p className="eyebrow">КАЛЕНДАРЬ</p><h2>{portfolioBonds.length ? 'Ваши выплаты' : 'Ближайшие купоны MOEX'}</h2></div></div>
        {!portfolioBonds.length && <p className="calendar-hint">Добавьте облигацию в портфель — сумма выплаты рассчитается с учётом количества.</p>}
        {calendarBonds.map((bond) => {
          const amount = portfolio[bond.ticker]
            ? (bond.couponValue ?? 0) * portfolio[bond.ticker].quantity
            : bond.couponValue ?? 0
          return <button className="coupon-row coupon-button" type="button" onClick={() => setDetailInstrument(bond)} key={bond.ticker}><span>₽</span><div><strong>{bond.name}</strong><p>{portfolio[bond.ticker] ? `${portfolio[bond.ticker].quantity} шт. · ${bond.ticker}` : bond.ticker}</p></div><div><strong>{amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong><p>{bond.date}</p></div></button>
        })}
      </section>

      <section className="ai-card" id="ai">
        <span className="ai-orb">✦</span>
        <div>
          <p className="eyebrow">AI-ПОМОЩНИК</p>
          <h2>Помогу разобраться с портфелем</h2>
        </div>
        <button onClick={() => setShowAdvice(true)} aria-label="Открыть AI-помощника">→</button>
      </section>

      </main>
      <footer><span>InvestAI</span><p>Демонстрационный сервис. Не является инвестиционной рекомендацией.</p></footer>

      <nav className="telegram-nav" aria-label="Навигация приложения">
        <a href="#portfolio"><span>▣</span>Портфель</a>
        <a href="#market"><span>◔</span>Рынок</a>
        <a href="#coupons"><span>₽</span>Купоны</a>
        <a href="#ai"><span>✦</span>AI</a>
      </nav>

      {selectedInstrument && (
        <div className="modal-backdrop" onClick={() => setSelectedInstrument(null)}>
          <form className="asset-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); addInstrument() }}>
            <button className="modal-close" type="button" onClick={() => setSelectedInstrument(null)} aria-label="Закрыть">×</button>
            <p className="eyebrow">ДОБАВИТЬ В ПОРТФЕЛЬ</p>
            <h2>{selectedInstrument.name}</h2>
            <p className="modal-caption">{selectedInstrument.ticker} · текущая цена {formatPrice(selectedInstrument)}</p>
            <label>Количество<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            <label>Цена покупки за бумагу, ₽<input type="number" min="0" step="0.01" value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} /></label>
            <div className="modal-total"><span>Сумма</span><strong>{((Number(quantity) || 0) * (Number(buyPrice) || 0)).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong></div>
            <button className="modal-submit" type="submit">Добавить актив</button>
          </form>
        </div>
      )}

      {detailInstrument && (
        <div className="modal-backdrop" onClick={() => setDetailInstrument(null)}>
          <section className="asset-modal detail-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setDetailInstrument(null)} aria-label="Закрыть">×</button>
            <div className="detail-title">
              <span className="instrument-badge">{detailInstrument.kind === 'Акция' ? 'A' : 'О'}</span>
              <div><p className="eyebrow">{detailInstrument.category}</p><h2>{detailInstrument.name}</h2></div>
            </div>
            <p className="modal-caption">{detailInstrument.ticker}{detailInstrument.isin ? ` · ISIN ${detailInstrument.isin}` : ''}</p>
            <div className="detail-price">
              <span>Текущая котировка</span>
              <strong>{formatPrice(detailInstrument)}</strong>
              {detailInstrument.change !== undefined && <small className={detailInstrument.change >= 0 ? 'up' : 'down'}>{detailInstrument.change >= 0 ? '+' : ''}{detailInstrument.change}% за день</small>}
            </div>
            <div className="detail-grid">
              <div><span>Цена за бумагу</span><strong>{detailInstrument.valuePrice.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong></div>
              <div><span>Лот</span><strong>{detailInstrument.lotSize ?? 1} шт.</strong></div>
              {detailInstrument.kind === 'Облигация' && <>
                <div><span>Купон</span><strong>{detailInstrument.coupon ?? '—'}</strong></div>
                <div><span>Следующий купон</span><strong>{detailInstrument.date ?? '—'}</strong></div>
                <div><span>Номинал</span><strong>{detailInstrument.faceValue?.toLocaleString('ru-RU') ?? '—'} ₽</strong></div>
                <div><span>НКД</span><strong>{detailInstrument.accruedInterest?.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) ?? '—'} ₽</strong></div>
                <div><span>Погашение</span><strong>{detailInstrument.maturityDate ? new Date(detailInstrument.maturityDate).toLocaleDateString('ru-RU') : '—'}</strong></div>
              </>}
            </div>
            <p className="detail-note">{detailInstrument.kind === 'Облигация' ? 'Цена облигации на бирже указана в процентах от номинала. Цена за бумагу учитывает НКД.' : 'Изменение рассчитано относительно предыдущей торговой сессии.'}</p>
            <button className="modal-submit" type="button" onClick={() => { const instrument = detailInstrument; setDetailInstrument(null); openAddInstrument(instrument) }}>＋ Добавить в портфель</button>
          </section>
        </div>
      )}

      {showAdvice && (
        <div className="modal-backdrop" onClick={() => setShowAdvice(false)}>
          <section className="asset-modal advice-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowAdvice(false)} aria-label="Закрыть">×</button>
            <span className="advice-orb">✦</span>
            <p className="eyebrow">AI-АНАЛИЗ</p>
            <h2>Разбор портфеля</h2>
            <p className="advice-text">{advice}</p>
            <div className="advice-metrics">
              <div><span>Позиций</span><strong>{portfolioItems.length}</strong></div>
              <div><span>Результат</span><strong className={profit >= 0 ? 'up' : 'down'}>{profit >= 0 ? '+' : ''}{profit.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</strong></div>
            </div>
            <p className="advice-disclaimer">Демонстрационный анализ, не инвестиционная рекомендация.</p>
            <button className="modal-submit" type="button" onClick={() => setShowAdvice(false)}>Понятно</button>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
