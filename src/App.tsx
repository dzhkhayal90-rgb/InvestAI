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

type Operation = {
  id: string
  ticker: string
  name: string
  type: 'Покупка' | 'Изменение' | 'Удаление'
  quantity: number
  price: number
  date: string
}

type PortfolioSnapshot = {
  date: string
  value: number
}

type Currency = 'RUB' | 'USD' | 'EUR'
type AppSection = 'portfolio' | 'market' | 'coupons' | 'ai'

const lessons = [
  { title: 'Как собрать первый портфель', time: '3 минуты', text: 'Начните с цели и срока. Для умеренного портфеля можно сочетать акции крупных компаний и облигации. Не вкладывайте все деньги в одну бумагу и сохраняйте финансовую подушку отдельно.' },
  { title: 'Что такое диверсификация', time: '2 минуты', text: 'Диверсификация — распределение денег между разными активами. Она снижает зависимость портфеля от одной компании или отрасли, но не исключает риск полностью.' },
  { title: 'Как читать доходность', time: '3 минуты', text: 'Доходность показывает изменение стоимости относительно цены покупки. Результат за день отражает движение рынка сегодня, а результат за всё время — прибыль или убыток с момента покупки.' },
  { title: 'Акции и облигации: разница', time: '4 минуты', text: 'Акция даёт долю в компании и обычно сильнее меняется в цене. Облигация — это долг эмитента с заранее определёнными выплатами. Их сочетание помогает управлять риском.' },
  { title: 'Зачем нужна финансовая подушка', time: '2 минуты', text: 'Перед инвестициями сформируйте запас денег на несколько месяцев расходов. Тогда вам не придётся продавать активы в неудачный момент из-за срочной потребности в деньгах.' },
  { title: 'Что такое ребалансировка', time: '3 минуты', text: 'Ребалансировка возвращает доли активов к выбранной структуре. Обычно достаточно проверять портфель несколько раз в год, а не реагировать на каждое движение рынка.' },
]

const usefulTips = [
  'Не вкладывайте в один актив больше той суммы, потерю которой сможете спокойно пережить.',
  'Сравнивайте доходность портфеля с вашей целью, а не с чужими результатами.',
  'Проверяйте комиссии и налоги — они влияют на итоговую доходность.',
]

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
  const [marketSort, setMarketSort] = useState<'name' | 'growth' | 'decline' | 'price'>('name')
  const [visibleCount, setVisibleCount] = useState(20)
  const [resultPeriod, setResultPeriod] = useState<'today' | 'all'>('today')
  const [activeSection, setActiveSection] = useState<AppSection>('portfolio')
  const [currency, setCurrency] = useState<Currency>(() => (localStorage.getItem('investai-currency') as Currency | null) ?? 'RUB')
  const [currencyRates, setCurrencyRates] = useState<Record<Currency, number>>({ RUB: 1, USD: 90, EUR: 98 })
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
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('investai-favorites')
    return saved ? JSON.parse(saved) as string[] : []
  })
  const [notice, setNotice] = useState('Выберите бумагу из списка рынка')
  const [selectedInstrument, setSelectedInstrument] = useState<Instrument | null>(null)
  const [editingPosition, setEditingPosition] = useState(false)
  const [detailInstrument, setDetailInstrument] = useState<Instrument | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [buyPrice, setBuyPrice] = useState('')
  const [showAdvice, setShowAdvice] = useState(false)
  const [showOperations, setShowOperations] = useState(false)
  const [showGoal, setShowGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [investmentGoal, setInvestmentGoal] = useState(() => Number(localStorage.getItem('investai-goal')) || 0)
  const [selectedLesson, setSelectedLesson] = useState<(typeof lessons)[number] | null>(null)
  const [operations, setOperations] = useState<Operation[]>(() => {
    const saved = localStorage.getItem('investai-operations')
    return saved ? JSON.parse(saved) as Operation[] : []
  })
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioSnapshot[]>(() => {
    const saved = localStorage.getItem('investai-history')
    return saved ? JSON.parse(saved) as PortfolioSnapshot[] : []
  })

  const portfolioItems = instruments.filter((instrument) => portfolio[instrument.ticker])
  const favoriteItems = instruments.filter((instrument) => favorites.includes(instrument.ticker))
  const filteredInstruments = useMemo(() => {
    const query = marketQuery.trim().toLocaleLowerCase('ru')
    const filtered = instruments.filter((instrument) => {
      const matchesFilter = marketFilter === 'Все' || instrument.category === marketFilter
      const matchesQuery = !query || `${instrument.ticker} ${instrument.name}`.toLocaleLowerCase('ru').includes(query)
      return matchesFilter && matchesQuery
    })
    return [...filtered].sort((a, b) => {
      if (marketSort === 'growth') return (b.change ?? -Infinity) - (a.change ?? -Infinity)
      if (marketSort === 'decline') return (a.change ?? Infinity) - (b.change ?? Infinity)
      if (marketSort === 'price') return b.valuePrice - a.valuePrice
      return a.name.localeCompare(b.name, 'ru')
    })
  }, [instruments, marketFilter, marketQuery, marketSort])
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
  const todayProfit = portfolioItems.reduce((sum, instrument) => {
    const currentValue = instrument.valuePrice * portfolio[instrument.ticker].quantity
    const change = instrument.change ?? 0
    const previousValue = change > -100 ? currentValue / (1 + change / 100) : currentValue
    return sum + currentValue - previousValue
  }, 0)
  const todayBaseValue = portfolioValue - todayProfit
  const todayProfitPercent = todayBaseValue ? todayProfit / todayBaseValue * 100 : 0
  const displayedProfit = resultPeriod === 'today' ? todayProfit : profit
  const displayedProfitPercent = resultPeriod === 'today' ? todayProfitPercent : profitPercent
  const stockShare = portfolioValue
    ? portfolioItems.filter((item) => item.kind === 'Акция').reduce((sum, item) => sum + item.valuePrice * portfolio[item.ticker].quantity, 0) / portfolioValue * 100
    : 0
  const largestPositionShare = portfolioValue
    ? Math.max(...portfolioItems.map((item) => item.valuePrice * portfolio[item.ticker].quantity / portfolioValue * 100))
    : 0
  const diversificationScore = Math.min(
    100,
    Math.round(portfolioItems.length * 14 + Math.min(stockShare, 100 - stockShare) * 0.9),
  )
  const riskLevel = portfolioItems.length < 2 || largestPositionShare > 70 || stockShare > 85
    ? 'Высокий'
    : largestPositionShare > 45 || stockShare > 65
      ? 'Средний'
      : 'Умеренный'
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
  const chartValues = portfolioHistory.map((point) => point.value)
  const chartMin = chartValues.length ? Math.min(...chartValues) : 0
  const chartMax = chartValues.length ? Math.max(...chartValues) : 0
  const chartRange = Math.max(1, chartMax - chartMin)
  const chartPoints = portfolioHistory.map((point, index) => {
    const x = portfolioHistory.length > 1 ? index / (portfolioHistory.length - 1) * 100 : 50
    const y = 38 - (point.value - chartMin) / chartRange * 32
    return `${x},${y}`
  }).join(' ')

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
    setEditingPosition(false)
    setSelectedInstrument(instrument)
    setQuantity('1')
    setBuyPrice(String(instrument.valuePrice))
  }

  const openEditPosition = (instrument: Instrument) => {
    const position = portfolio[instrument.ticker]
    if (!position) return
    setEditingPosition(true)
    setSelectedInstrument(instrument)
    setQuantity(String(position.quantity))
    setBuyPrice(String(position.buyPrice))
  }

  const addInstrument = () => {
    if (!selectedInstrument) return
    const amount = Math.max(1, Number(quantity) || 1)
    const price = Math.max(0, Number(buyPrice) || selectedInstrument.valuePrice)
    setPortfolio((current) => {
      if (editingPosition) return { ...current, [selectedInstrument.ticker]: { quantity: amount, buyPrice: price } }
      const existing = current[selectedInstrument.ticker]
      const totalQuantity = (existing?.quantity ?? 0) + amount
      const averagePrice = existing
        ? ((existing.buyPrice * existing.quantity) + (price * amount)) / totalQuantity
        : price
      return { ...current, [selectedInstrument.ticker]: { quantity: totalQuantity, buyPrice: averagePrice } }
    })
    setNotice(editingPosition ? `${selectedInstrument.ticker} обновлён` : `${selectedInstrument.ticker} добавлен в портфель`)
    const operation: Operation = {
      id: `${Date.now()}-${selectedInstrument.ticker}`,
      ticker: selectedInstrument.ticker,
      name: selectedInstrument.name,
      type: editingPosition ? 'Изменение' : 'Покупка',
      quantity: amount,
      price,
      date: new Date().toISOString(),
    }
    setOperations((current) => [operation, ...current].slice(0, 100))
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')
    setSelectedInstrument(null)
  }

  const removeInstrument = (instrument: Instrument) => {
    const removed = portfolio[instrument.ticker]
    if (!removed) return
    setPortfolio((current) => {
      const next = { ...current }
      delete next[instrument.ticker]
      return next
    })
    const operation: Operation = {
      id: `${Date.now()}-${instrument.ticker}`,
      ticker: instrument.ticker,
      name: instrument.name,
      type: 'Удаление',
      quantity: removed.quantity,
      price: removed.buyPrice,
      date: new Date().toISOString(),
    }
    setOperations((items) => [operation, ...items].slice(0, 100))
  }

  const saveGoal = () => {
    const value = Math.max(0, Number(goalInput) || 0)
    setInvestmentGoal(value)
    setShowGoal(false)
  }

  const exportPortfolio = () => {
    const data = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      portfolio,
      favorites,
      operations,
      investmentGoal,
      portfolioHistory,
    }, null, 2)
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `investai-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importPortfolio = async (file?: File) => {
    if (!file) return
    try {
      const data = JSON.parse(await file.text()) as {
        portfolio?: Record<string, Position>
        favorites?: string[]
        operations?: Operation[]
        investmentGoal?: number
        portfolioHistory?: PortfolioSnapshot[]
      }
      if (data.portfolio) setPortfolio(data.portfolio)
      if (data.favorites) setFavorites(data.favorites)
      if (data.operations) setOperations(data.operations)
      if (typeof data.investmentGoal === 'number') setInvestmentGoal(data.investmentGoal)
      if (data.portfolioHistory) setPortfolioHistory(data.portfolioHistory)
      setNotice('Резервная копия восстановлена')
      setShowOperations(false)
    } catch {
      setNotice('Не удалось прочитать резервную копию')
    }
  }

  useEffect(() => {
    localStorage.setItem('investai-portfolio', JSON.stringify(portfolio))
  }, [portfolio])

  useEffect(() => {
    localStorage.setItem('investai-favorites', JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem('investai-operations', JSON.stringify(operations))
  }, [operations])

  useEffect(() => {
    localStorage.setItem('investai-goal', String(investmentGoal))
  }, [investmentGoal])

  useEffect(() => {
    if (!portfolioItems.length) return
    const today = new Date().toISOString().slice(0, 10)
    setPortfolioHistory((current) => {
      const next = current.some((point) => point.date === today)
        ? current.map((point) => point.date === today ? { ...point, value: portfolioValue } : point)
        : [...current, { date: today, value: portfolioValue }]
      return next.slice(-30)
    })
  }, [portfolioItems.length, portfolioValue])

  useEffect(() => {
    localStorage.setItem('investai-history', JSON.stringify(portfolioHistory))
  }, [portfolioHistory])

  useEffect(() => {
    localStorage.setItem('investai-currency', currency)
  }, [currency])

  useEffect(() => {
    const loadCurrencyRates = async () => {
      try {
        const response = await fetch('https://www.cbr-xml-daily.ru/daily_json.js')
        if (!response.ok) return
        const data = await response.json() as { Valute?: { USD?: { Value?: number }; EUR?: { Value?: number } } }
        const usd = Number(data.Valute?.USD?.Value)
        const eur = Number(data.Valute?.EUR?.Value)
        if (usd > 0 && eur > 0) setCurrencyRates({ RUB: 1, USD: usd, EUR: eur })
      } catch {
        // Оставляем резервные курсы, если сервис ЦБ временно недоступен.
      }
    }
    void loadCurrencyRates()
  }, [])

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
  const formatMoney = (rubles: number, maximumFractionDigits = currency === 'RUB' ? 0 : 2) =>
    new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits,
    }).format(rubles / currencyRates[currency])

  useEffect(() => {
    setVisibleCount(20)
  }, [marketFilter, marketQuery])

  return (
    <div className={isTelegram ? 'telegram-app' : undefined}>
      <header className="topbar">
        <a className="brand" href="#">
          <img className="brand-mark" src={`${import.meta.env.BASE_URL}investai-logo.png`} alt="InvestAI" />
          <span className="brand-copy">
            <small>{isTelegram ? `Привет, ${name}` : 'Ваш инвестиционный помощник'}</small>
          </span>
        </a>
        <nav className="site-nav" aria-label="Навигация">
          {sections.map((section) => <a href={section.href} key={section.href}>{section.label}</a>)}
        </nav>
        <a className="header-button" href="#market">Начать</a>
      </header>

      <main className={`app-shell view-${activeSection}`}>
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
            <h2>{isTelegram ? 'Главная' : 'Ваш портфель'}</h2>
          </div>
          <div className={`status-pill ${marketStatus === 'error' ? 'status-error' : ''}`}>
            ● {marketStatus === 'loading' ? 'Загрузка MOEX' : marketStatus === 'live' ? 'Данные MOEX' : 'Нет связи с MOEX'}
          </div>
        </section>

        <section className="summary-grid" aria-label="Сводка портфеля">
          <article className="hero-card">
            <div className="value-card-head">
              <p className="card-label">Общая стоимость</p>
              <div className="currency-switch" role="group" aria-label="Валюта портфеля">
                {(['RUB', 'USD', 'EUR'] as Currency[]).map((item) => (
                  <button className={currency === item ? 'active' : undefined} type="button" onClick={() => setCurrency(item)} key={item}>
                    {item === 'RUB' ? '₽' : item === 'USD' ? '$' : '€'}
                  </button>
                ))}
              </div>
            </div>
            <strong className="portfolio-value">{formatMoney(portfolioValue)}</strong>
            <div className="period-switch" role="group" aria-label="Период результата">
              <button className={resultPeriod === 'today' ? 'active' : undefined} type="button" onClick={() => setResultPeriod('today')}>Сегодня</button>
              <button className={resultPeriod === 'all' ? 'active' : undefined} type="button" onClick={() => setResultPeriod('all')}>Всё время</button>
            </div>
            <div className={displayedProfit >= 0 ? 'yield-chip' : 'yield-chip negative'}>{portfolioItems.length ? `${displayedProfit >= 0 ? '+' : ''}${formatMoney(displayedProfit, 2)} · ${displayedProfitPercent >= 0 ? '+' : ''}${displayedProfitPercent.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%` : 'Портфель ещё не заполнен'}</div>
            {portfolioItems.length > 0 && (
              <div className="portfolio-meta">
                <span><small>Вложено</small><strong>{formatMoney(investedValue)}</strong></span>
                <span><small>Активов</small><strong>{portfolioItems.length}</strong></span>
              </div>
            )}
            {isTelegram
              ? <div className="portfolio-actions"><button className="primary-button" type="button" onClick={() => setActiveSection('market')}>＋ Добавить</button><button className="primary-button secondary-action" type="button" onClick={() => setShowOperations(true)}>Операции</button></div>
              : <a className="primary-button" href="#market">＋ Добавить актив</a>}
          </article>
          <div className="quick-stats">
            <article><span className="stat-icon pink">₽</span><div><p>Ближайшие купоны</p><strong>{portfolioBonds.length ? `${expectedCoupons.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽` : 'Добавьте облигации'}</strong></div></article>
            <article><span className="stat-icon blue">◷</span><div><p>Следующая выплата</p><strong>{portfolioBonds[0]?.date ?? 'Нет данных'}</strong></div></article>
          </div>
        </section>
        {portfolioItems.length > 0 && (
          <section className="allocation-card" aria-label="Структура портфеля">
            <div className="allocation-head">
              <div><p className="eyebrow">СТРУКТУРА</p><h3>Распределение портфеля</h3></div>
              <span className={`risk-badge risk-${riskLevel.toLocaleLowerCase('ru')}`}>Риск: {riskLevel}</span>
            </div>
            <div className="allocation-track" aria-label={`Акции ${stockShare.toFixed(0)}%, облигации ${(100 - stockShare).toFixed(0)}%`}>
              <span style={{ width: `${stockShare}%` }} />
            </div>
            <div className="allocation-legend">
              <span><i className="stocks-dot" />Акции <strong>{stockShare.toFixed(0)}%</strong></span>
              <span><i className="bonds-dot" />Облигации <strong>{(100 - stockShare).toFixed(0)}%</strong></span>
            </div>
          </section>
        )}

      <section className="portfolio-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ВАШИ АКТИВЫ</p>
            <h2>{isTelegram ? 'Активы' : 'Портфель'}</h2>
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
                <button className="portfolio-main" type="button" onClick={() => setDetailInstrument(instrument)}><strong>{instrument.ticker}</strong><p>{portfolio[instrument.ticker].quantity} шт. · средняя {formatMoney(portfolio[instrument.ticker].buyPrice, 2)}</p></button>
                <div className="position-result">
                  <strong>{formatMoney(portfolio[instrument.ticker].quantity * instrument.valuePrice)}</strong>
                  {(() => {
                    const position = portfolio[instrument.ticker]
                    const allProfit = (instrument.valuePrice - position.buyPrice) * position.quantity
                    const allPercent = position.buyPrice ? (instrument.valuePrice - position.buyPrice) / position.buyPrice * 100 : 0
                    const currentValue = instrument.valuePrice * position.quantity
                    const dailyChange = instrument.change ?? 0
                    const previousValue = dailyChange > -100 ? currentValue / (1 + dailyChange / 100) : currentValue
                    const positionProfit = resultPeriod === 'today' ? currentValue - previousValue : allProfit
                    const positionPercent = resultPeriod === 'today' ? dailyChange : allPercent
                    return <small className={positionProfit >= 0 ? 'up' : 'down'}>{resultPeriod === 'today' ? 'Сегодня ' : ''}{positionProfit >= 0 ? '+' : ''}{formatMoney(positionProfit, 2)} · {positionPercent >= 0 ? '+' : ''}{positionPercent.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%</small>
                  })()}
                </div>
                <button className="remove-button" onClick={() => removeInstrument(instrument)} aria-label={`Удалить ${instrument.name}`}>×</button>
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
        {favoriteItems.length > 0 && (
          <section className="favorites-card" aria-label="Избранные бумаги">
            <div className="section-heading">
              <div><p className="eyebrow">НАБЛЮДЕНИЕ</p><h3>Избранное</h3></div>
              <span className="favorite-count">{favoriteItems.length}</span>
            </div>
            <div className="favorite-list">
              {favoriteItems.slice(0, 6).map((instrument) => (
                <button type="button" onClick={() => setDetailInstrument(instrument)} key={instrument.ticker}>
                  <span>{instrument.ticker}</span>
                  <strong>{formatPrice(instrument)}</strong>
                  {instrument.change !== undefined && <small className={instrument.change >= 0 ? 'up' : 'down'}>{instrument.change >= 0 ? '+' : ''}{instrument.change}%</small>}
                </button>
              ))}
            </div>
          </section>
        )}
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
          <label className="market-sort">
            <span>Сортировка</span>
            <select value={marketSort} onChange={(event) => setMarketSort(event.target.value as typeof marketSort)}>
              <option value="name">По названию</option>
              <option value="growth">Лидеры роста</option>
              <option value="decline">Лидеры падения</option>
              <option value="price">По цене</option>
            </select>
          </label>
          <p className="catalog-count">
            {marketStatus === 'loading' ? 'Загружаем каталог…' : `Найдено: ${filteredInstruments.length}`}
          </p>
        </div>
        <div className="market-list">
          {filteredInstruments.slice(0, visibleCount).map((instrument) => (
            <article className="market-row" key={instrument.ticker}>
              <button className="market-main instrument-open" type="button" onClick={() => setDetailInstrument(instrument)}><strong>{instrument.ticker}</strong><p>{instrument.name} · {instrument.category}</p></button>
              <div className="market-price"><strong>{formatPrice(instrument)}</strong>{instrument.change !== undefined ? <span className={instrument.change >= 0 ? 'up' : 'down'}>{instrument.change >= 0 ? '+' : ''}{instrument.change}%</span> : <span>Купон {instrument.coupon}</span>}</div>
              <button
                className={`favorite-button ${favorites.includes(instrument.ticker) ? 'active' : ''}`}
                onClick={() => setFavorites((current) => current.includes(instrument.ticker)
                  ? current.filter((ticker) => ticker !== instrument.ticker)
                  : [...current, instrument.ticker])}
                aria-label={favorites.includes(instrument.ticker) ? `Убрать ${instrument.name} из избранного` : `Добавить ${instrument.name} в избранное`}
                type="button"
              >★</button>
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

      <section className="ai-section" id="ai">
        <div className="ai-card">
          <span className="ai-orb">✦</span>
          <div>
            <p className="eyebrow">AI-ПОМОЩНИК</p>
            <h2>Разбор вашего портфеля</h2>
            <p className="ai-card-copy">{portfolioItems.length ? advice : 'Добавьте активы — я оценю структуру, риск и концентрацию портфеля.'}</p>
          </div>
          <button onClick={() => setShowAdvice(true)} aria-label="Открыть AI-помощника">→</button>
        </div>
        <div className="ai-insights">
          <article><span>◉</span><div><small>Уровень риска</small><strong>{portfolioItems.length ? riskLevel : 'Нет данных'}</strong></div></article>
          <article><span>◎</span><div><small>Диверсификация</small><strong>{portfolioItems.length ? `${diversificationScore}/100` : 'Добавьте активы'}</strong></div></article>
        </div>
        <article className="goal-card">
          <div className="goal-head"><div><p className="eyebrow">ВАША ЦЕЛЬ</p><h3>{investmentGoal ? formatMoney(investmentGoal) : 'Создайте финансовую цель'}</h3></div><button type="button" onClick={() => { setGoalInput(investmentGoal ? String(investmentGoal) : ''); setShowGoal(true) }}>{investmentGoal ? 'Изменить' : 'Добавить'}</button></div>
          {investmentGoal ? <>
            <div className="goal-track"><span style={{ width: `${Math.min(100, portfolioValue / investmentGoal * 100)}%` }} /></div>
            <p>Накоплено {Math.min(100, portfolioValue / investmentGoal * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}% · осталось {formatMoney(Math.max(0, investmentGoal - portfolioValue))}</p>
          </> : <p>Укажите сумму — InvestAI будет показывать прогресс вашего портфеля.</p>}
        </article>
        <article className="history-card">
          <div className="goal-head"><div><p className="eyebrow">ДИНАМИКА</p><h3>Стоимость портфеля</h3></div><small>30 дней</small></div>
          {portfolioHistory.length > 1 ? <>
            <svg className="portfolio-chart" viewBox="0 0 100 42" role="img" aria-label="График стоимости портфеля">
              <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#38d878" stopOpacity=".28" /><stop offset="1" stopColor="#38d878" stopOpacity="0" /></linearGradient></defs>
              <polygon points={`0,42 ${chartPoints} 100,42`} fill="url(#chartFill)" />
              <polyline points={chartPoints} fill="none" stroke="#38d878" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="chart-labels"><span>{new Date(portfolioHistory[0].date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</span><strong>{formatMoney(portfolioHistory.at(-1)?.value ?? 0)}</strong><span>{new Date(portfolioHistory.at(-1)!.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}</span></div>
          </> : <p className="history-empty">Первое значение сохранено. График появится после следующего дневного обновления.</p>}
        </article>
        <div className="section-heading ai-lessons-head"><div><p className="eyebrow">БАЗА ЗНАНИЙ</p><h2>Короткие уроки</h2></div></div>
        <div className="lesson-list">
          {lessons.map((lesson, index) => (
            <button type="button" onClick={() => setSelectedLesson(lesson)} key={lesson.title}>
              <span>{index + 1}</span>
              <div><strong>{lesson.title}</strong><small>{lesson.time}</small></div>
              <i>›</i>
            </button>
          ))}
        </div>
        <div className="section-heading ai-lessons-head"><div><p className="eyebrow">ПОЛЕЗНО ПОМНИТЬ</p><h2>Советы</h2></div></div>
        <div className="tips-list">
          {usefulTips.map((tip) => <article key={tip}><span>✓</span><p>{tip}</p></article>)}
        </div>
      </section>

      </main>
      <footer><span>InvestAI</span><p>Демонстрационный сервис. Не является инвестиционной рекомендацией.</p></footer>

      <nav className="telegram-nav" aria-label="Навигация приложения">
        <button className={activeSection === 'portfolio' ? 'active' : undefined} type="button" onClick={() => setActiveSection('portfolio')}><span>▣</span>Главная</button>
        <button className={activeSection === 'market' ? 'active' : undefined} type="button" onClick={() => setActiveSection('market')}><span>◔</span>Рынок</button>
        <button className={activeSection === 'coupons' ? 'active' : undefined} type="button" onClick={() => setActiveSection('coupons')}><span>₽</span>Купоны</button>
        <button className={activeSection === 'ai' ? 'active' : undefined} type="button" onClick={() => setActiveSection('ai')}><span>✦</span>AI</button>
      </nav>

      {selectedInstrument && (
        <div className="modal-backdrop" onClick={() => setSelectedInstrument(null)}>
          <form className="asset-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); addInstrument() }}>
            <button className="modal-close" type="button" onClick={() => setSelectedInstrument(null)} aria-label="Закрыть">×</button>
            <p className="eyebrow">{editingPosition ? 'ИЗМЕНИТЬ ПОЗИЦИЮ' : 'ДОБАВИТЬ В ПОРТФЕЛЬ'}</p>
            <h2>{selectedInstrument.name}</h2>
            <p className="modal-caption">{selectedInstrument.ticker} · текущая цена {formatPrice(selectedInstrument)}</p>
            <label>Количество<input type="number" min="1" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
            <label>Цена покупки за бумагу, ₽<input type="number" min="0" step="0.01" value={buyPrice} onChange={(event) => setBuyPrice(event.target.value)} /></label>
            <div className="modal-total"><span>Сумма</span><strong>{((Number(quantity) || 0) * (Number(buyPrice) || 0)).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong></div>
            <button className="modal-submit" type="submit">{editingPosition ? 'Сохранить изменения' : 'Добавить актив'}</button>
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
            <button className="modal-submit" type="button" onClick={() => {
              const instrument = detailInstrument
              setDetailInstrument(null)
              if (portfolio[instrument.ticker]) openEditPosition(instrument)
              else openAddInstrument(instrument)
            }}>{portfolio[detailInstrument.ticker] ? 'Изменить позицию' : '＋ Добавить в портфель'}</button>
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
              <div><span>Диверсификация</span><strong>{diversificationScore}/100</strong></div>
              <div><span>Крупнейшая позиция</span><strong>{largestPositionShare.toFixed(0)}%</strong></div>
            </div>
            <p className="advice-disclaimer">Демонстрационный анализ, не инвестиционная рекомендация.</p>
            <button className="modal-submit" type="button" onClick={() => setShowAdvice(false)}>Понятно</button>
          </section>
        </div>
      )}

      {selectedLesson && (
        <div className="modal-backdrop" onClick={() => setSelectedLesson(null)}>
          <section className="asset-modal lesson-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setSelectedLesson(null)} aria-label="Закрыть">×</button>
            <span className="advice-orb">◉</span>
            <p className="eyebrow">УРОК · {selectedLesson.time}</p>
            <h2>{selectedLesson.title}</h2>
            <p className="advice-text">{selectedLesson.text}</p>
            <p className="advice-disclaimer">Материал носит образовательный характер и не является инвестиционной рекомендацией.</p>
            <button className="modal-submit" type="button" onClick={() => setSelectedLesson(null)}>Понятно</button>
          </section>
        </div>
      )}

      {showOperations && (
        <div className="modal-backdrop" onClick={() => setShowOperations(false)}>
          <section className="asset-modal operations-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowOperations(false)} aria-label="Закрыть">×</button>
            <p className="eyebrow">ИСТОРИЯ</p>
            <h2>Операции</h2>
            <p className="modal-caption">Последние изменения портфеля сохраняются на этом устройстве.</p>
            {operations.length ? <div className="operations-list">{operations.map((operation) => (
              <article key={operation.id}>
                <span className={`operation-icon operation-${operation.type.toLocaleLowerCase('ru')}`}>{operation.type === 'Покупка' ? '+' : operation.type === 'Удаление' ? '−' : '↻'}</span>
                <div><strong>{operation.ticker}</strong><small>{operation.type} · {new Date(operation.date).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>
                <div><strong>{operation.quantity} шт.</strong><small>{operation.price.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</small></div>
              </article>
            ))}</div> : <div className="catalog-empty">Операций пока нет. Добавьте первый актив.</div>}
            <div className="backup-actions">
              <button type="button" onClick={exportPortfolio}>Скачать копию</button>
              <label>Восстановить<input type="file" accept="application/json,.json" onChange={(event) => { void importPortfolio(event.target.files?.[0]) }} /></label>
            </div>
          </section>
        </div>
      )}

      {showGoal && (
        <div className="modal-backdrop" onClick={() => setShowGoal(false)}>
          <form className="asset-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); saveGoal() }}>
            <button className="modal-close" type="button" onClick={() => setShowGoal(false)} aria-label="Закрыть">×</button>
            <p className="eyebrow">ФИНАНСОВАЯ ЦЕЛЬ</p>
            <h2>К какой сумме стремимся?</h2>
            <p className="modal-caption">Прогресс рассчитывается от текущей стоимости портфеля.</p>
            <label>Целевая сумма, ₽<input type="number" min="0" step="1000" value={goalInput} onChange={(event) => setGoalInput(event.target.value)} placeholder="1000000" autoFocus /></label>
            <button className="modal-submit" type="submit">Сохранить цель</button>
          </form>
        </div>
      )}
    </div>
  )
}

export default App
