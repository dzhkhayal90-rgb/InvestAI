import { useEffect, useMemo, useState } from 'react'
import './App.css'

type TelegramWebApp = {
  ready: () => void
  expand: () => void
  initDataUnsafe?: { user?: { first_name?: string } }
  themeParams?: { bg_color?: string }
  HapticFeedback?: { impactOccurred: (style: 'light' | 'medium' | 'heavy') => void }
  CloudStorage?: {
    getItems: (keys: string[], callback: (error: string | null, values?: Record<string, string>) => void) => void
    setItem: (key: string, value: string, callback?: (error: string | null, stored?: boolean) => void) => void
  }
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
  dividendValue?: number
  dividendDate?: string
  couponPercent?: number
  yieldValue?: number
  listLevel?: number
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

type CashFlow = {
  id: string
  type: 'Пополнение' | 'Вывод' | 'Дивиденд'
  amount: number
  date: string
  ticker?: string
  note?: string
}

type MarketNews = {
  id: number
  title: string
  publishedAt: string
}

type Currency = 'RUB' | 'USD' | 'EUR'
type AppSection = 'portfolio' | 'market' | 'coupons' | 'ai' | 'analytics' | 'news'
type DetailTab = 'overview' | 'events' | 'income' | 'operations'
type AnalyticsPeriod = 'day' | 'month' | 'sixMonths' | 'year' | 'all'
type NewsFilter = 'Все' | 'Рынок' | 'Акции' | 'Облигации'

const companyDomains: Record<string, string> = {
  SBER: 'sberbank.com', GAZP: 'gazprom.ru', LKOH: 'lukoil.ru', ROSN: 'rosneft.ru',
  NVTK: 'novatek.ru', GMKN: 'nornickel.ru', YDEX: 'yandex.ru', YNDX: 'yandex.ru',
  OZON: 'ozon.ru', VKCO: 'vk.company', MOEX: 'moex.com', AFLT: 'aeroflot.ru',
  MGNT: 'magnit.com', T: 'tbank.ru', TCSG: 'tbank.ru', X5: 'x5.ru',
  PLZL: 'polyus.com', MTS: 'mts.ru', MTSS: 'mts.ru', IRAO: 'irao-generation.ru',
  CHMF: 'severstal.com', NLMK: 'nlmk.com', MAGN: 'mmk.ru', RUAL: 'rusal.ru',
  PHOR: 'phosagro.ru', TATN: 'tatneft.ru', TRNFP: 'transneft.ru',
}

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
  const query = 'iss.meta=off&iss.only=securities,marketdata,securities.cursor&securities.columns=SECID,SHORTNAME,COUPONVALUE,NEXTCOUPON,FACEVALUE,ACCRUEDINT,MATDATE,LOTSIZE,ISIN,DIVIDENDVALUE,DIVIDENDDATE,COUPONPERCENT,LISTLEVEL&marketdata.columns=SECID,LAST,MARKETPRICE,LASTTOPREVPRICE,YIELD'
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
      dividendValue: Number.isFinite(Number(row.DIVIDENDVALUE)) ? Number(row.DIVIDENDVALUE) : undefined,
      dividendDate: typeof row.DIVIDENDDATE === 'string' ? row.DIVIDENDDATE : undefined,
      couponPercent: Number.isFinite(Number(row.COUPONPERCENT)) ? Number(row.COUPONPERCENT) : undefined,
      yieldValue: Number.isFinite(Number(row.YIELD)) ? Number(row.YIELD) : undefined,
      listLevel: Number.isFinite(Number(row.LISTLEVEL)) ? Number(row.LISTLEVEL) : undefined,
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

const loadMoexNews = async () => {
  const response = await fetch('https://iss.moex.com/iss/sitenews.json?iss.meta=off&iss.only=sitenews&sitenews.columns=id,title,published_at')
  if (!response.ok) throw new Error('MOEX news unavailable')
  const payload = await response.json() as { sitenews?: IssBlock }
  return blockRows(payload.sitenews).slice(0, 20).map((item): MarketNews => ({
    id: Number(item.id),
    title: String(item.title ?? 'Новость Московской биржи'),
    publishedAt: String(item.published_at ?? new Date().toISOString()),
  }))
}

function App() {
  const [name, setName] = useState('инвестор')
  const [isTelegram, setIsTelegram] = useState(false)
  const [instruments, setInstruments] = useState(fallbackInstruments)
  const [marketStatus, setMarketStatus] = useState<'loading' | 'live' | 'error'>('loading')
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const [marketNews, setMarketNews] = useState<MarketNews[]>([])
  const [newsStatus, setNewsStatus] = useState<'loading' | 'live' | 'error'>('loading')
  const [marketQuery, setMarketQuery] = useState('')
  const [homeSearch, setHomeSearch] = useState('')
  const [marketFilter, setMarketFilter] = useState<'Все' | Instrument['category']>('Все')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [marketSort, setMarketSort] = useState<'name' | 'growth' | 'decline' | 'price'>('name')
  const [visibleCount, setVisibleCount] = useState(20)
  const [resultPeriod, setResultPeriod] = useState<'today' | 'all'>('today')
  const [activeSection, setActiveSection] = useState<AppSection>('portfolio')
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('all')
  const [newsFilter, setNewsFilter] = useState<NewsFilter>('Все')
  const [currency, setCurrency] = useState<Currency>(() => (localStorage.getItem('investai-currency') as Currency | null) ?? 'RUB')
  const [currencyRates, setCurrencyRates] = useState<Record<Currency, number>>({ RUB: 1, USD: 90, EUR: 98 })
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('investai-theme') === 'light' ? 'light' : 'dark')
  const [cloudReady, setCloudReady] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced'>('local')
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
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const [quantity, setQuantity] = useState('1')
  const [buyPrice, setBuyPrice] = useState('')
  const [showAdvice, setShowAdvice] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [showOperations, setShowOperations] = useState(false)
  const [showCashFlow, setShowCashFlow] = useState(false)
  const [cashFlowType, setCashFlowType] = useState<CashFlow['type']>('Пополнение')
  const [cashFlowAmount, setCashFlowAmount] = useState('')
  const [cashFlowTicker, setCashFlowTicker] = useState('')
  const [cashFlowDate, setCashFlowDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paymentFilter, setPaymentFilter] = useState<'Все' | 'Купоны' | 'Дивиденды'>('Все')
  const [bondCalculator, setBondCalculator] = useState<Instrument | null>(null)
  const [calculatorQuantity, setCalculatorQuantity] = useState('1')
  const [showGoal, setShowGoal] = useState(false)
  const [goalInput, setGoalInput] = useState('')
  const [investmentGoal, setInvestmentGoal] = useState(() => Number(localStorage.getItem('investai-goal')) || 0)
  const [goalMonths, setGoalMonths] = useState(() => Number(localStorage.getItem('investai-goal-months')) || 24)
  const [selectedLesson, setSelectedLesson] = useState<(typeof lessons)[number] | null>(null)
  const [completedLessons, setCompletedLessons] = useState<string[]>(() => {
    const saved = localStorage.getItem('investai-completed-lessons')
    return saved ? JSON.parse(saved) as string[] : []
  })
  const [operations, setOperations] = useState<Operation[]>(() => {
    const saved = localStorage.getItem('investai-operations')
    return saved ? JSON.parse(saved) as Operation[] : []
  })
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioSnapshot[]>(() => {
    const saved = localStorage.getItem('investai-history')
    return saved ? JSON.parse(saved) as PortfolioSnapshot[] : []
  })
  const [cashFlows, setCashFlows] = useState<CashFlow[]>(() => {
    const saved = localStorage.getItem('investai-cash-flows')
    return saved ? JSON.parse(saved) as CashFlow[] : []
  })

  const portfolioItems = instruments.filter((instrument) => portfolio[instrument.ticker])
  const favoriteItems = instruments.filter((instrument) => favorites.includes(instrument.ticker))
  const filteredInstruments = useMemo(() => {
    const query = marketQuery.trim().toLocaleLowerCase('ru')
    const filtered = instruments.filter((instrument) => {
      const matchesFilter = (marketFilter === 'Все' || instrument.category === marketFilter)
        && (!favoritesOnly || favorites.includes(instrument.ticker))
      const matchesQuery = !query || `${instrument.ticker} ${instrument.name}`.toLocaleLowerCase('ru').includes(query)
      return matchesFilter && matchesQuery
    })
    return [...filtered].sort((a, b) => {
      if (marketSort === 'growth') return (b.change ?? -Infinity) - (a.change ?? -Infinity)
      if (marketSort === 'decline') return (a.change ?? Infinity) - (b.change ?? Infinity)
      if (marketSort === 'price') return b.valuePrice - a.valuePrice
      return a.name.localeCompare(b.name, 'ru')
    })
  }, [favorites, favoritesOnly, instruments, marketFilter, marketQuery, marketSort])
  const portfolioValue = useMemo(
    () => portfolioItems.reduce((sum, instrument) => sum + instrument.valuePrice * portfolio[instrument.ticker].quantity, 0),
    [portfolio, portfolioItems],
  )
  const investedValue = useMemo(
    () => portfolioItems.reduce((sum, instrument) => sum + portfolio[instrument.ticker].buyPrice * portfolio[instrument.ticker].quantity, 0),
    [portfolio, portfolioItems],
  )
  const deposits = cashFlows.filter((flow) => flow.type === 'Пополнение').reduce((sum, flow) => sum + flow.amount, 0)
  const withdrawals = cashFlows.filter((flow) => flow.type === 'Вывод').reduce((sum, flow) => sum + flow.amount, 0)
  const dividends = cashFlows.filter((flow) => flow.type === 'Дивиденд').reduce((sum, flow) => sum + flow.amount, 0)
  const trackedCapital = deposits - withdrawals
  const marketProfit = portfolioValue - investedValue
  const profit = trackedCapital > 0 ? portfolioValue + withdrawals + dividends - deposits : marketProfit + dividends
  const profitBase = trackedCapital > 0 ? deposits : investedValue
  const profitPercent = profitBase ? profit / profitBase * 100 : 0
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
  const allocationItems = portfolioItems
    .map((instrument) => ({
      instrument,
      value: instrument.valuePrice * portfolio[instrument.ticker].quantity,
      share: portfolioValue ? instrument.valuePrice * portfolio[instrument.ticker].quantity / portfolioValue * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)
  const allocationColors = ['#38d878', '#5f7cff', '#bd75ef', '#f0a44b', '#35c6d4', '#ef6680']
  const allocationGradient = allocationItems.length
    ? allocationItems.reduce<{ stops: string[]; cursor: number }>((result, item, index) => {
        const next = result.cursor + item.share
        result.stops.push(`${allocationColors[index % allocationColors.length]} ${result.cursor}% ${next}%`)
        result.cursor = next
        return result
      }, { stops: [], cursor: 0 }).stops.join(', ')
    : '#303033 0 100%'
  const paymentEvents = [
    ...portfolioBonds.filter((bond) => bond.couponDate).flatMap((bond) => {
      const firstDate = new Date(`${bond.couponDate}T12:00:00`)
      const maturity = bond.maturityDate ? new Date(`${bond.maturityDate}T12:00:00`) : firstDate
      const dates: Date[] = []
      for (let date = firstDate, index = 0; date <= maturity && index < 20; index += 1) {
        dates.push(date)
        date = new Date(date)
        date.setMonth(date.getMonth() + 6)
      }
      return dates.map((date, index) => ({
        id: `coupon-${bond.ticker}-${index}`,
        date: date.toISOString(),
        title: bond.name,
        type: 'Купон',
        amount: (bond.couponValue ?? 0) * portfolio[bond.ticker].quantity,
      }))
    }),
    ...cashFlows.filter((flow) => flow.type === 'Дивиденд').map((flow) => ({
      id: flow.id,
      date: flow.date,
      title: flow.ticker || flow.note || 'Дивиденды',
      type: 'Дивиденд',
      amount: flow.amount,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const paymentMonths = Object.entries(paymentEvents.reduce<Record<string, typeof paymentEvents>>((groups, payment) => {
    const key = payment.date.slice(0, 7)
    groups[key] = [...(groups[key] ?? []), payment]
    return groups
  }, {}))
  const filteredPaymentMonths = paymentMonths
    .map(([month, payments]) => [
      month,
      payments.filter((payment) => paymentFilter === 'Все' || (paymentFilter === 'Купоны' ? payment.type === 'Купон' : payment.type === 'Дивиденд')),
    ] as const)
    .filter(([, payments]) => payments.length > 0)
  const monthlyGoalContribution = investmentGoal
    ? Math.max(0, investmentGoal - portfolioValue) / Math.max(1, goalMonths)
    : 0
  const improvementSteps = [
    {
      done: portfolioItems.length >= 3,
      title: 'Добавить минимум 3 бумаги',
      text: portfolioItems.length >= 3 ? `${portfolioItems.length} активов в портфеле` : `Сейчас ${portfolioItems.length} из 3`,
    },
    {
      done: largestPositionShare <= 50 && portfolioItems.length > 1,
      title: 'Снизить концентрацию',
      text: portfolioItems.length ? `Крупнейшая позиция — ${largestPositionShare.toFixed(0)}%` : 'Одна бумага — не более 50%',
    },
    {
      done: stockShare >= 20 && stockShare <= 80 && portfolioItems.length > 1,
      title: 'Сбалансировать типы активов',
      text: portfolioItems.length ? `Акции ${stockShare.toFixed(0)}% · облигации ${(100 - stockShare).toFixed(0)}%` : 'Добавьте акции и облигации',
    },
  ]
  const analyticsHistory = useMemo(() => {
    if (analyticsPeriod === 'all') return portfolioHistory
    const periodDays: Record<Exclude<AnalyticsPeriod, 'all'>, number> = {
      day: 1,
      month: 30,
      sixMonths: 183,
      year: 365,
    }
    const cutoff = Date.now() - periodDays[analyticsPeriod] * 86_400_000
    const filtered = portfolioHistory.filter((point) => new Date(`${point.date}T12:00:00`).getTime() >= cutoff)
    return filtered.length > 1 ? filtered : portfolioHistory.slice(-2)
  }, [analyticsPeriod, portfolioHistory])
  const chartValues = analyticsHistory.map((point) => point.value)
  const chartMin = chartValues.length ? Math.min(...chartValues) : 0
  const chartMax = chartValues.length ? Math.max(...chartValues) : 0
  const chartRange = Math.max(1, chartMax - chartMin)
  const chartPoints = analyticsHistory.map((point, index) => {
    const x = analyticsHistory.length > 1 ? index / (analyticsHistory.length - 1) * 100 : 50
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

  const answerPortfolioQuestion = (question: string) => {
    const normalized = question.toLocaleLowerCase('ru')
    if (!portfolioItems.length) return 'Сначала добавьте хотя бы одну бумагу в портфель. Тогда я смогу учитывать стоимость, доли активов, выплаты и изменение цены.'
    if (/выплат|купон|дивиденд/.test(normalized)) {
      const futurePayments = paymentEvents.filter((payment) => new Date(payment.date).getTime() >= Date.now())
      const total = futurePayments.reduce((sum, payment) => sum + payment.amount, 0)
      const nearest = futurePayments[0]
      return nearest
        ? `В календаре ${futurePayments.length} будущих выплат на общую сумму ${total.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽. Ближайшая — ${nearest.title}, ${new Date(nearest.date).toLocaleDateString('ru-RU')}, ожидаемая сумма ${nearest.amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽.`
        : 'В портфеле пока нет будущих купонных или дивидендных выплат с известной датой.'
    }
    if (/риск|опас|паден/.test(normalized)) {
      const leader = allocationItems[0]
      return `Расчётный уровень риска — ${riskLevel.toLocaleLowerCase('ru')}. Крупнейшая позиция ${leader?.instrument.ticker ?? '—'} занимает ${largestPositionShare.toFixed(1)}%. ${largestPositionShare > 50 ? 'Портфель сильно зависит от одной бумаги — снижение её доли улучшит устойчивость.' : 'Критической концентрации в одной позиции не обнаружено.'}`
    }
    if (/доход|прибыл|результат/.test(normalized)) {
      return `Результат за сегодня: ${todayProfit >= 0 ? '+' : ''}${todayProfit.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽ (${todayProfitPercent.toFixed(2)}%). За всё время: ${profit >= 0 ? '+' : ''}${profit.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽ (${profitPercent.toFixed(2)}%). Пополнения и выводы учитываются, если вы внесли их в разделе операций.`
    }
    if (/структур|дол|состав|диверсиф/.test(normalized)) {
      return `В портфеле ${portfolioItems.length} активов: акции занимают ${stockShare.toFixed(1)}%, облигации ${(100 - stockShare).toFixed(1)}%. Оценка диверсификации — ${diversificationScore}/100. ${advice}`
    }
    if (/что купить|рекоменд|добавить/.test(normalized)) {
      return `Я не выбираю конкретную бумагу вместо вас. По структуре портфеля полезно проверить три вещи: долю крупнейшей позиции (${largestPositionShare.toFixed(1)}%), баланс акций и облигаций (${stockShare.toFixed(1)}% / ${(100 - stockShare).toFixed(1)}%) и соответствие сроку вашей цели.`
    }
    return `${advice} Сейчас в портфеле ${portfolioItems.length} активов общей стоимостью ${portfolioValue.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽. Уточните вопрос про риск, доходность, структуру или ближайшие выплаты — я сделаю более точный расчёт.`
  }

  const submitAiQuestion = (question = aiQuestion) => {
    const value = question.trim()
    if (!value) return
    setAiQuestion(value)
    setAiAnswer(answerPortfolioQuestion(value))
  }

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

  const saveCashFlow = () => {
    const amount = Math.max(0, Number(cashFlowAmount) || 0)
    if (!amount) return
    const next: CashFlow = {
      id: `${Date.now()}-${cashFlowType}`,
      type: cashFlowType,
      amount,
      date: new Date(`${cashFlowDate}T12:00:00`).toISOString(),
      ticker: cashFlowType === 'Дивиденд' ? cashFlowTicker.trim().toUpperCase() || undefined : undefined,
    }
    setCashFlows((current) => [next, ...current].slice(0, 200))
    setCashFlowAmount('')
    setCashFlowTicker('')
    setShowCashFlow(false)
    setNotice(`${cashFlowType} сохранено`)
  }

  const exportPortfolio = () => {
    const data = JSON.stringify({
      version: 1,
      exportedAt: new Date().toISOString(),
      portfolio,
      favorites,
      operations,
      investmentGoal,
      goalMonths,
      completedLessons,
      portfolioHistory,
      cashFlows,
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
        goalMonths?: number
        completedLessons?: string[]
        portfolioHistory?: PortfolioSnapshot[]
        cashFlows?: CashFlow[]
      }
      if (data.portfolio) setPortfolio(data.portfolio)
      if (data.favorites) setFavorites(data.favorites)
      if (data.operations) setOperations(data.operations)
      if (typeof data.investmentGoal === 'number') setInvestmentGoal(data.investmentGoal)
      if (typeof data.goalMonths === 'number') setGoalMonths(data.goalMonths)
      if (data.completedLessons) setCompletedLessons(data.completedLessons)
      if (data.portfolioHistory) setPortfolioHistory(data.portfolioHistory)
      if (data.cashFlows) setCashFlows(data.cashFlows)
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
    localStorage.setItem('investai-goal-months', String(goalMonths))
  }, [goalMonths])

  useEffect(() => {
    localStorage.setItem('investai-completed-lessons', JSON.stringify(completedLessons))
  }, [completedLessons])

  useEffect(() => {
    if (!portfolioItems.length) return
    const today = new Date().toISOString().slice(0, 10)
    setPortfolioHistory((current) => {
      const next = current.some((point) => point.date === today)
        ? current.map((point) => point.date === today ? { ...point, value: portfolioValue } : point)
        : [...current, { date: today, value: portfolioValue }]
      return next.slice(-365)
    })
  }, [portfolioItems.length, portfolioValue])

  useEffect(() => {
    localStorage.setItem('investai-history', JSON.stringify(portfolioHistory))
  }, [portfolioHistory])

  useEffect(() => {
    localStorage.setItem('investai-cash-flows', JSON.stringify(cashFlows))
  }, [cashFlows])

  useEffect(() => {
    localStorage.setItem('investai-currency', currency)
  }, [currency])

  useEffect(() => {
    localStorage.setItem('investai-theme', theme)
  }, [theme])

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
    const storage = webApp.CloudStorage
    if (!storage) {
      setCloudReady(true)
      return
    }
    const keys = ['portfolio', 'favorites', 'cashflows', 'operations', 'history', 'settings']
    storage.getItems(keys, (error, values) => {
      if (!error && values) {
        try {
          if (values.portfolio) setPortfolio(JSON.parse(values.portfolio) as Record<string, Position>)
          if (values.favorites) setFavorites(JSON.parse(values.favorites) as string[])
          if (values.cashflows) setCashFlows(JSON.parse(values.cashflows) as CashFlow[])
          if (values.operations) setOperations(JSON.parse(values.operations) as Operation[])
          if (values.history) setPortfolioHistory(JSON.parse(values.history) as PortfolioSnapshot[])
          if (values.settings) {
            const settings = JSON.parse(values.settings) as { goal?: number; goalMonths?: number; currency?: Currency; theme?: 'dark' | 'light'; completedLessons?: string[] }
            if (typeof settings.goal === 'number') setInvestmentGoal(settings.goal)
            if (typeof settings.goalMonths === 'number') setGoalMonths(settings.goalMonths)
            if (settings.currency) setCurrency(settings.currency)
            if (settings.theme) setTheme(settings.theme)
            if (settings.completedLessons) setCompletedLessons(settings.completedLessons)
          }
          setSyncStatus('synced')
        } catch {
          setSyncStatus('local')
        }
      }
      setCloudReady(true)
    })
  }, [])

  useEffect(() => {
    const storage = window.Telegram?.WebApp?.CloudStorage
    if (!isTelegram || !cloudReady || !storage) return
    setSyncStatus('syncing')
    const timer = window.setTimeout(() => {
      const values: Record<string, unknown> = {
        portfolio,
        favorites,
        cashflows: cashFlows.slice(0, 100),
        operations: operations.slice(0, 25),
        history: portfolioHistory.slice(-365),
        settings: { goal: investmentGoal, goalMonths, currency, theme, completedLessons },
      }
      Object.entries(values).forEach(([key, value]) => storage.setItem(key, JSON.stringify(value)))
      setSyncStatus('synced')
    }, 700)
    return () => window.clearTimeout(timer)
  }, [cashFlows, cloudReady, completedLessons, currency, favorites, goalMonths, investmentGoal, isTelegram, operations, portfolio, portfolioHistory, theme])

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

  useEffect(() => {
    let active = true
    const refreshNews = async () => {
      try {
        const news = await loadMoexNews()
        if (!active) return
        setMarketNews(news)
        setNewsStatus('live')
      } catch {
        if (active) setNewsStatus('error')
      }
    }
    void refreshNews()
    const timer = window.setInterval(refreshNews, 15 * 60_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const formatPrice = (instrument: Instrument) =>
    `${instrument.price.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${instrument.priceUnit ?? '₽'}`
  const instrumentDescription = (instrument: Instrument) => instrument.kind === 'Акция'
    ? `${instrument.name} — акция российского эмитента, обращающаяся на Московской бирже. Цена зависит от результатов компании, дивидендной политики, отраслевых событий и общего состояния рынка.`
    : `${instrument.name} — ${instrument.category === 'ОФЗ' ? 'государственная облигация Российской Федерации' : 'корпоративная облигация'}. Инвестор получает купонные выплаты и номинал при погашении, принимая процентный и кредитный риск.`
  const instrumentLogo = (instrument: Instrument) => companyDomains[instrument.ticker]
    ? `https://www.google.com/s2/favicons?domain=${companyDomains[instrument.ticker]}&sz=128`
    : undefined
  const instrumentMark = (instrument: Instrument) => instrument.category === 'ОФЗ'
    ? '₽'
    : instrument.kind === 'Облигация'
      ? instrument.name.replace(/[^А-ЯA-Z]/g, '').slice(0, 2) || 'ОБ'
      : instrument.ticker.slice(0, 2)
  const logoFor = (instrument: Instrument) => (
    <span className={`instrument-logo ${instrument.kind === 'Облигация' ? 'bond-logo' : ''}`}>
      <span>{instrumentMark(instrument)}</span>
      {instrumentLogo(instrument) && <img src={instrumentLogo(instrument)} alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} />}
    </span>
  )
  const newsImpact = (title: string) => {
    const value = title.toLocaleLowerCase('ru')
    if (/ставк|инфляц|банк росс|валют|рубл/.test(value)) return { label: 'Весь рынок', level: 'high', text: 'Может повлиять на ставки, рубль и оценку большинства активов.' }
    if (/облигац|офз|купон|долг|заимств/.test(value)) return { label: 'Облигации', level: 'bond', text: 'Может изменить доходности и цены долговых бумаг.' }
    if (/дивиденд|акци|эмитент|компан|отчет/.test(value)) return { label: 'Акции', level: 'share', text: 'Может повысить волатильность отдельных акций или отрасли.' }
    return { label: 'Рынок', level: 'normal', text: 'Важное событие инфраструктуры или торгов Московской биржи.' }
  }
  const filteredMarketNews = marketNews.filter((item) => {
    if (newsFilter === 'Все') return true
    const impactLabel = newsImpact(item.title).label
    return impactLabel === newsFilter || (newsFilter === 'Рынок' && impactLabel === 'Весь рынок')
  })
  const formatMoney = (rubles: number, maximumFractionDigits = currency === 'RUB' ? 0 : 2) =>
    new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      maximumFractionDigits,
    }).format(rubles / currencyRates[currency])

  useEffect(() => {
    setVisibleCount(20)
  }, [favoritesOnly, marketFilter, marketQuery])

  useEffect(() => {
    setDetailTab('overview')
  }, [detailInstrument?.ticker])

  const submitHomeSearch = () => {
    const query = homeSearch.trim()
    if (!query) return
    setMarketQuery(query)
    setFavoritesOnly(false)
    setActiveSection('market')
  }

  return (
    <div className={`${isTelegram ? 'telegram-app' : ''} theme-${theme}`}>
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
        {isTelegram && <div className="telegram-header-actions"><span className={`sync-dot ${syncStatus}`}>{syncStatus === 'synced' ? '☁' : '•'}</span><button type="button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label="Переключить тему">{theme === 'dark' ? '☀' : '☾'}</button></div>}
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

        <form className="home-search" onSubmit={(event) => { event.preventDefault(); submitHomeSearch() }}>
          <span>⌕</span>
          <input value={homeSearch} onChange={(event) => setHomeSearch(event.target.value)} placeholder="Бумага, компания или тикер" aria-label="Поиск по рынку" />
        </form>

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
                {dividends > 0 && <span><small>Дивиденды</small><strong>{formatMoney(dividends)}</strong></span>}
              </div>
            )}
            {isTelegram ? <div className="dashboard-actions">
              <button type="button" onClick={() => { setCashFlowType('Пополнение'); setShowCashFlow(true) }}><span>＋</span>Пополнить</button>
              <button type="button" onClick={() => setShowOperations(true)}><span>◷</span>Операции</button>
              <button type="button" onClick={() => setActiveSection('analytics')}><span>◔</span>Аналитика</button>
              <button type="button" onClick={() => { setFavoritesOnly(true); setMarketQuery(''); setMarketFilter('Все'); setActiveSection('market') }}><span>★</span>Избранное</button>
            </div> : <a className="primary-button" href="#market">＋ Добавить актив</a>}
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
            <div className="holdings-allocation">
              <div className="donut-chart" style={{ background: `conic-gradient(${allocationGradient})` }}><span>{portfolioItems.length}<small>бумаг</small></span></div>
              <div className="holdings-legend">
                {allocationItems.slice(0, 6).map((item, index) => <div key={item.instrument.ticker}><i style={{ background: allocationColors[index % allocationColors.length] }} /><span>{item.instrument.ticker}</span><strong>{item.share.toFixed(1)}%</strong></div>)}
              </div>
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
                {logoFor(instrument)}
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
                onClick={() => { setMarketFilter(filter); setFavoritesOnly(false) }}
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
            {marketStatus === 'loading' ? 'Загружаем каталог…' : `${favoritesOnly ? 'Избранное' : 'Найдено'}: ${filteredInstruments.length}`}
          </p>
        </div>
        {favoriteItems.length > 0 && !marketQuery && marketFilter === 'Все' && (
          <div className="favorites-strip">
            <div className="favorites-head"><strong>★ Избранное</strong><span>{favoriteItems.length}</span></div>
            <div className="favorites-scroll">
              {favoriteItems.map((instrument) => (
                <button type="button" key={instrument.ticker} onClick={() => setDetailInstrument(instrument)}>
                  <span>{instrument.ticker}</span>
                  <strong>{formatPrice(instrument)}</strong>
                  <small className={(instrument.change ?? 0) >= 0 ? 'up' : 'down'}>
                    {instrument.change !== undefined ? `${instrument.change >= 0 ? '+' : ''}${instrument.change}%` : instrument.coupon}
                  </small>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="market-list">
          {filteredInstruments.slice(0, visibleCount).map((instrument) => (
            <article className="market-row" key={instrument.ticker}>
              {logoFor(instrument)}
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
        <div className="section-heading"><div><p className="eyebrow">КАЛЕНДАРЬ</p><h2>{portfolioBonds.length || dividends ? 'Купоны и дивиденды' : 'Ближайшие купоны MOEX'}</h2></div></div>
        {(paymentMonths.length > 0 || dividends > 0) && <div className="payment-filters" role="group" aria-label="Тип выплаты">
          {(['Все', 'Купоны', 'Дивиденды'] as const).map((filter) => <button className={paymentFilter === filter ? 'active' : ''} type="button" onClick={() => setPaymentFilter(filter)} key={filter}>{filter}</button>)}
        </div>}
        {filteredPaymentMonths.length > 0 && <div className="payment-calendar">
          {filteredPaymentMonths.map(([month, payments]) => <article key={month}>
            <div className="payment-month"><div><strong>{new Date(`${month}-01T12:00:00`).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</strong><small>{payments.length} выплат</small></div><strong>{payments.reduce((sum, payment) => sum + payment.amount, 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong></div>
            {payments.map((payment) => <div className="payment-event" key={payment.id}><span className={payment.type === 'Дивиденд' ? 'dividend-event' : ''}>{payment.type === 'Дивиденд' ? 'D' : '₽'}</span><div><strong>{payment.title}</strong><small>{payment.type} · {new Date(payment.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</small></div><strong>{payment.amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong></div>)}
          </article>)}
        </div>}
        {paymentMonths.length > 0 && filteredPaymentMonths.length === 0 && <div className="catalog-empty">Выплат этого типа пока нет.</div>}
        {portfolioBonds.length > 0 && <p className="calendar-hint schedule-note">Будущие купоны рассчитаны ориентировочно с интервалом 6 месяцев до погашения. Фактический график эмитента может отличаться.</p>}
        {!portfolioBonds.length && <p className="calendar-hint">Добавьте облигацию в портфель — сумма выплаты рассчитается с учётом количества.</p>}
        {paymentMonths.length === 0 && calendarBonds.map((bond) => {
          const amount = portfolio[bond.ticker]
            ? (bond.couponValue ?? 0) * portfolio[bond.ticker].quantity
            : bond.couponValue ?? 0
          return <button className="coupon-row coupon-button" type="button" onClick={() => setDetailInstrument(bond)} key={bond.ticker}><span>₽</span><div><strong>{bond.name}</strong><p>{portfolio[bond.ticker] ? `${portfolio[bond.ticker].quantity} шт. · ${bond.ticker}` : bond.ticker}</p></div><div><strong>{amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong><p>{bond.date}</p></div></button>
        })}
      </section>

      <section className="analytics-section" id="analytics">
        <div className="analytics-title"><button type="button" onClick={() => setActiveSection('portfolio')} aria-label="Назад">‹</button><div><p className="eyebrow">ВАШ ПОРТФЕЛЬ</p><h2>Аналитика</h2></div></div>
        <article className="analytics-card">
          <div className="analytics-value"><div><strong>{formatMoney(portfolioValue, 2)}</strong><span>Стоимость портфеля</span></div><span>{currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : '€'}</span></div>
          {analyticsHistory.length > 1 ? <svg className="analytics-chart" viewBox="0 0 100 48" preserveAspectRatio="none" role="img" aria-label="Динамика стоимости портфеля"><polygon points={`0,48 ${chartPoints} 100,48`} fill="rgba(76,132,255,.2)" /><polyline points={chartPoints} fill="none" stroke="#66a0ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg> : <div className="analytics-empty-chart"><span>◒</span><p>График появится после второго дневного значения портфеля</p></div>}
          <div className="analytics-periods" role="group" aria-label="Период графика">
            {([
              ['day', 'День'],
              ['month', 'Месяц'],
              ['sixMonths', '6 мес'],
              ['year', 'Год'],
              ['all', 'Всё время'],
            ] as const).map(([period, label]) => <button className={analyticsPeriod === period ? 'active' : ''} type="button" onClick={() => setAnalyticsPeriod(period)} key={period}>{label}</button>)}
          </div>
          <div className="income-list">
            <div><span>Общий доход</span><strong className={profit >= 0 ? 'up' : 'down'}>{profit >= 0 ? '+' : ''}{formatMoney(profit, 2)} · {profitPercent.toFixed(2)}%</strong></div>
            <div><span>Доход от изменения цены</span><strong className={marketProfit >= 0 ? 'up' : 'down'}>{marketProfit >= 0 ? '+' : ''}{formatMoney(marketProfit, 2)}</strong></div>
            <div><span>Дивиденды</span><strong className="up">+{formatMoney(dividends, 2)}</strong></div>
          </div>
        </article>
        <article className="analytics-card">
          <div className="analytics-card-head"><div><h3>Будущие выплаты</h3><p>{paymentEvents.reduce((sum, payment) => sum + payment.amount, 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽ всего</p></div><button type="button" onClick={() => setActiveSection('coupons')}>Все</button></div>
          {paymentMonths.length ? <div className="payments-bars">{paymentMonths.slice(0, 7).map(([month, payments]) => {
            const amount = payments.reduce((sum, payment) => sum + payment.amount, 0)
            const max = Math.max(...paymentMonths.map(([, values]) => values.reduce((sum, payment) => sum + payment.amount, 0)))
            return <div key={month}><small>{amount >= 1000 ? `${(amount / 1000).toFixed(1)}к` : amount.toFixed(0)}</small><i style={{ height: `${Math.max(8, amount / max * 100)}%` }} /><span>{new Date(`${month}-01`).toLocaleDateString('ru-RU', { month: 'short' })}</span></div>
          })}</div> : <div className="analytics-empty-chart compact"><p>Добавьте облигации или дивиденды, чтобы увидеть прогноз выплат.</p></div>}
        </article>
        <article className="analytics-card">
          <div className="analytics-card-head"><div><h3>Структура портфеля</h3><p>По отдельным активам</p></div></div>
          {portfolioItems.length ? <div className="analytics-allocation">
            <div className="donut-chart large" style={{ background: `conic-gradient(${allocationGradient})` }}><span>{formatMoney(portfolioValue)}<small>{portfolioItems.length} активов</small></span></div>
            <div className="holdings-legend">{allocationItems.slice(0, 6).map((item, index) => <div key={item.instrument.ticker}><i style={{ background: allocationColors[index % allocationColors.length] }} /><span>{item.instrument.ticker}</span><strong>{item.share.toFixed(1)}%</strong></div>)}</div>
          </div> : <div className="analytics-empty-chart compact"><p>Добавьте активы, чтобы увидеть структуру портфеля.</p></div>}
        </article>
      </section>

      <section className="news-section" id="news">
        <div className="section-heading"><div><p className="eyebrow">МОСКОВСКАЯ БИРЖА</p><h2>Новости рынка</h2></div><span className={`news-live ${newsStatus}`}>{newsStatus === 'loading' ? 'Загрузка' : newsStatus === 'live' ? 'Обновляется' : 'Нет связи'}</span></div>
        <p className="news-intro">События, которые могут влиять на стоимость акций, облигаций, валюту и общую волатильность рынка.</p>
        {marketNews.length > 0 && <div className="news-filters" role="group" aria-label="Фильтр новостей">
          {(['Все', 'Рынок', 'Акции', 'Облигации'] as NewsFilter[]).map((filter) => <button className={newsFilter === filter ? 'active' : ''} type="button" onClick={() => setNewsFilter(filter)} key={filter}>{filter}</button>)}
        </div>}
        {filteredMarketNews.length ? <div className="news-list">{filteredMarketNews.map((item) => {
          const impact = newsImpact(item.title)
          return <a href={`https://www.moex.com/n${item.id}`} target="_blank" rel="noreferrer" key={item.id}>
            <div className="news-meta"><span className={`impact-${impact.level}`}>{impact.label}</span><time>{new Date(item.publishedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</time></div>
            <h3>{item.title}</h3>
            <p>{impact.text}</p>
            <small>Источник: Московская биржа ↗</small>
          </a>
        })}</div> : <div className="catalog-empty">{newsStatus === 'loading' ? 'Загружаем официальные новости MOEX…' : marketNews.length ? 'В этой категории пока нет новостей.' : 'Новости временно недоступны. Попробуйте позднее.'}</div>}
        <p className="news-disclaimer">Метка влияния определяется по теме новости и не является прогнозом движения цены или инвестиционной рекомендацией.</p>
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
        <article className="checklist-card">
          <div className="goal-head"><div><p className="eyebrow">ПЛАН УЛУЧШЕНИЯ</p><h3>{improvementSteps.filter((step) => step.done).length} из {improvementSteps.length} выполнено</h3></div><span className="checklist-score">{diversificationScore}</span></div>
          <div className="checklist-track"><span style={{ width: `${improvementSteps.filter((step) => step.done).length / improvementSteps.length * 100}%` }} /></div>
          <div className="checklist-list">
            {improvementSteps.map((step) => <div className={step.done ? 'done' : ''} key={step.title}><span>{step.done ? '✓' : '○'}</span><div><strong>{step.title}</strong><small>{step.text}</small></div></div>)}
          </div>
        </article>
        <article className="goal-card">
          <div className="goal-head"><div><p className="eyebrow">ВАША ЦЕЛЬ</p><h3>{investmentGoal ? formatMoney(investmentGoal) : 'Создайте финансовую цель'}</h3></div><button type="button" onClick={() => { setGoalInput(investmentGoal ? String(investmentGoal) : ''); setShowGoal(true) }}>{investmentGoal ? 'Изменить' : 'Добавить'}</button></div>
          {investmentGoal ? <>
            <div className="goal-track"><span style={{ width: `${Math.min(100, portfolioValue / investmentGoal * 100)}%` }} /></div>
            <p>Накоплено {Math.min(100, portfolioValue / investmentGoal * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}% · осталось {formatMoney(Math.max(0, investmentGoal - portfolioValue))}</p>
            <div className="goal-plan">
              <div><small>Пополняйте ежемесячно</small><strong>{formatMoney(monthlyGoalContribution)}</strong></div>
              <label><span>Срок</span><select value={goalMonths} onChange={(event) => setGoalMonths(Number(event.target.value))}><option value="6">6 месяцев</option><option value="12">1 год</option><option value="24">2 года</option><option value="36">3 года</option><option value="60">5 лет</option></select></label>
            </div>
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
        <div className="section-heading ai-lessons-head"><div><p className="eyebrow">БАЗА ЗНАНИЙ</p><h2>Короткие уроки</h2></div><span className="lesson-progress">{completedLessons.length}/{lessons.length}</span></div>
        <div className="lesson-list">
          {lessons.map((lesson, index) => (
            <button className={completedLessons.includes(lesson.title) ? 'completed' : ''} type="button" onClick={() => setSelectedLesson(lesson)} key={lesson.title}>
              <span>{completedLessons.includes(lesson.title) ? '✓' : index + 1}</span>
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
        <button className={activeSection === 'news' ? 'active' : undefined} type="button" onClick={() => setActiveSection('news')}><span>◫</span>Новости</button>
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
              {logoFor(detailInstrument)}
              <div><p className="eyebrow">{detailInstrument.category}</p><h2>{detailInstrument.name}</h2></div>
            </div>
            <p className="modal-caption">{detailInstrument.ticker}{detailInstrument.isin ? ` · ISIN ${detailInstrument.isin}` : ''}</p>
            <div className="detail-price">
              <span>Текущая котировка</span>
              <strong>{formatPrice(detailInstrument)}</strong>
              {detailInstrument.change !== undefined && <small className={detailInstrument.change >= 0 ? 'up' : 'down'}>{detailInstrument.change >= 0 ? '+' : ''}{detailInstrument.change}% за день</small>}
            </div>
            <div className="detail-tabs">
              <button className={detailTab === 'overview' ? 'active' : ''} onClick={() => setDetailTab('overview')} type="button">Обзор</button>
              <button className={detailTab === 'events' ? 'active' : ''} onClick={() => setDetailTab('events')} type="button">События</button>
              {(detailInstrument.kind === 'Облигация' || detailInstrument.dividendValue !== undefined) && <button className={detailTab === 'income' ? 'active' : ''} onClick={() => setDetailTab('income')} type="button">{detailInstrument.kind === 'Акция' ? 'Дивиденды' : 'Купоны'}</button>}
              <button className={detailTab === 'operations' ? 'active' : ''} onClick={() => setDetailTab('operations')} type="button">Операции</button>
            </div>
            {detailTab === 'overview' && <div className="detail-panel">
              <div className="detail-grid">
                <div><span>Цена за бумагу</span><strong>{detailInstrument.valuePrice.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong></div>
                <div><span>Лот</span><strong>{detailInstrument.lotSize ?? 1} шт.</strong></div>
                <div><span>Уровень листинга</span><strong>{detailInstrument.listLevel ? `${detailInstrument.listLevel} уровень` : '—'}</strong></div>
                <div><span>Изменение за день</span><strong className={(detailInstrument.change ?? 0) >= 0 ? 'up' : 'down'}>{detailInstrument.change !== undefined ? `${detailInstrument.change >= 0 ? '+' : ''}${detailInstrument.change}%` : '—'}</strong></div>
              </div>
              <div className="instrument-description"><h3>О компании</h3><p>{instrumentDescription(detailInstrument)}</p></div>
              <div className="instrument-risks"><h3>Что влияет на цену</h3><div>{detailInstrument.kind === 'Акция' ? <><span>Отчётность компании</span><span>Дивиденды</span><span>Новости отрасли</span><span>Курс рубля</span></> : <><span>Ключевая ставка</span><span>Кредитный риск</span><span>Срок погашения</span><span>Ликвидность</span></>}</div></div>
              <p className="detail-note">{detailInstrument.kind === 'Облигация' ? 'Цена облигации на бирже указана в процентах от номинала. Цена за бумагу учитывает НКД.' : 'Изменение рассчитано относительно предыдущей торговой сессии.'}</p>
            </div>}
            {detailTab === 'events' && <div className="detail-panel event-list">
              {detailInstrument.couponDate && <article><span>Купон</span><div><strong>Ближайшая купонная выплата</strong><small>{new Date(detailInstrument.couponDate).toLocaleDateString('ru-RU')}</small></div></article>}
              {detailInstrument.dividendDate && <article><span>DIV</span><div><strong>Закрытие реестра акционеров</strong><small>{new Date(detailInstrument.dividendDate).toLocaleDateString('ru-RU')}</small></div></article>}
              {detailInstrument.maturityDate && <article><span>₽</span><div><strong>Погашение облигации</strong><small>{new Date(detailInstrument.maturityDate).toLocaleDateString('ru-RU')}</small></div></article>}
              {marketNews.filter((item) => item.title.toLocaleLowerCase('ru').includes(detailInstrument.name.split(' ')[0].toLocaleLowerCase('ru')) || item.title.includes(detailInstrument.ticker)).slice(0, 3).map((item) => <article key={item.id}><span>NEWS</span><div><strong>{item.title}</strong><small>{new Date(item.publishedAt).toLocaleDateString('ru-RU')}</small></div></article>)}
              {!detailInstrument.couponDate && !detailInstrument.dividendDate && !detailInstrument.maturityDate && <div className="detail-empty"><span>◷</span><strong>Нет подтверждённых ближайших событий</strong><small>Добавим их, когда MOEX опубликует данные.</small></div>}
            </div>}
            {detailTab === 'income' && <div className="detail-panel income-summary">
              {detailInstrument.kind === 'Акция' ? <>
                <div><span>Дивиденд на акцию</span><strong>{detailInstrument.dividendValue?.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong></div>
                <div><span>Дата закрытия реестра</span><strong>{detailInstrument.dividendDate ? new Date(detailInstrument.dividendDate).toLocaleDateString('ru-RU') : 'Ожидается'}</strong></div>
                <div><span>Доходность выплаты</span><strong>{detailInstrument.dividendValue && detailInstrument.valuePrice ? `${(detailInstrument.dividendValue / detailInstrument.valuePrice * 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%` : '—'}</strong></div>
              </> : <>
                <div><span>Купон</span><strong>{detailInstrument.coupon ?? '—'}</strong></div>
                <div><span>Ставка купона</span><strong>{detailInstrument.couponPercent !== undefined ? `${detailInstrument.couponPercent.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%` : '—'}</strong></div>
                <div><span>Доходность MOEX</span><strong>{detailInstrument.yieldValue !== undefined ? `${detailInstrument.yieldValue.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}%` : '—'}</strong></div>
                <div><span>Следующий купон</span><strong>{detailInstrument.date ?? '—'}</strong></div>
                <div><span>Погашение</span><strong>{detailInstrument.maturityDate ? new Date(detailInstrument.maturityDate).toLocaleDateString('ru-RU') : '—'}</strong></div>
              </>}
            </div>}
            {detailTab === 'operations' && <div className="detail-panel instrument-operations">
              {operations.filter((item) => item.ticker === detailInstrument.ticker).length ? operations.filter((item) => item.ticker === detailInstrument.ticker).map((item) => <article key={item.id}><span>{item.type === 'Покупка' ? '+' : item.type === 'Удаление' ? '−' : '↻'}</span><div><strong>{item.type}</strong><small>{new Date(item.date).toLocaleString('ru-RU')}</small></div><div><strong>{item.quantity} шт.</strong><small>{item.price.toLocaleString('ru-RU')} ₽</small></div></article>) : <div className="detail-empty"><span>⇄</span><strong>Операций пока нет</strong><small>История появится после добавления бумаги в портфель.</small></div>}
            </div>}
            {detailInstrument.kind === 'Облигация' && <button className="calculator-button" type="button" onClick={() => {
              setBondCalculator(detailInstrument)
              setCalculatorQuantity(String(portfolio[detailInstrument.ticker]?.quantity ?? 1))
              setDetailInstrument(null)
            }}>Калькулятор облигации</button>}
            <button className={`detail-favorite ${favorites.includes(detailInstrument.ticker) ? 'active' : ''}`} type="button" onClick={() => setFavorites((current) => current.includes(detailInstrument.ticker) ? current.filter((ticker) => ticker !== detailInstrument.ticker) : [...current, detailInstrument.ticker])}>{favorites.includes(detailInstrument.ticker) ? '★ В избранном' : '☆ Добавить в избранное'}</button>
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
            <div className="ai-quick-questions">
              {['Какие выплаты ближайшие?', 'Какой риск портфеля?', 'Покажи доходность', 'Как улучшить структуру?'].map((question) => (
                <button type="button" onClick={() => submitAiQuestion(question)} key={question}>{question}</button>
              ))}
            </div>
            {aiAnswer && <div className="ai-conversation"><span>✦</span><p>{aiAnswer}</p></div>}
            <form className="ai-question-form" onSubmit={(event) => { event.preventDefault(); submitAiQuestion() }}>
              <input value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} placeholder="Спросите о своём портфеле…" aria-label="Вопрос AI-помощнику" />
              <button type="submit" aria-label="Отправить вопрос">↑</button>
            </form>
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
            <button className="modal-submit" type="button" onClick={() => {
              setCompletedLessons((current) => current.includes(selectedLesson.title) ? current : [...current, selectedLesson.title])
              setSelectedLesson(null)
            }}>{completedLessons.includes(selectedLesson.title) ? 'Урок пройден ✓' : 'Отметить как пройденный'}</button>
          </section>
        </div>
      )}

      {showOperations && (
        <div className="modal-backdrop" onClick={() => setShowOperations(false)}>
          <section className="asset-modal operations-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setShowOperations(false)} aria-label="Закрыть">×</button>
            <p className="eyebrow">ИСТОРИЯ</p>
            <h2>Операции</h2>
            <p className="modal-caption">{isTelegram ? 'Изменения синхронизируются между вашими устройствами через Telegram.' : 'Изменения сохраняются в браузере. Можно скачать резервную копию.'}</p>
            {operations.length ? <div className="operations-list">{operations.map((operation) => (
              <article key={operation.id}>
                <span className={`operation-icon operation-${operation.type.toLocaleLowerCase('ru')}`}>{operation.type === 'Покупка' ? '+' : operation.type === 'Удаление' ? '−' : '↻'}</span>
                <div><strong>{operation.ticker}</strong><small>{operation.type} · {new Date(operation.date).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div>
                <div><strong>{operation.quantity} шт.</strong><small>{operation.price.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</small></div>
              </article>
            ))}</div> : <div className="catalog-empty">Операций пока нет. Добавьте первый актив.</div>}
            {cashFlows.length > 0 && <>
              <p className="operations-subtitle">Денежные операции</p>
              <div className="operations-list">{cashFlows.map((flow) => (
                <article key={flow.id}>
                  <span className={`operation-icon cash-${flow.type.toLocaleLowerCase('ru')}`}>{flow.type === 'Пополнение' ? '+' : flow.type === 'Вывод' ? '−' : 'D'}</span>
                  <div><strong>{flow.ticker || flow.type}</strong><small>{flow.type} · {new Date(flow.date).toLocaleDateString('ru-RU')}</small></div>
                  <div><strong>{flow.amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong><button className="delete-flow" type="button" onClick={() => setCashFlows((current) => current.filter((item) => item.id !== flow.id))}>Удалить</button></div>
                </article>
              ))}</div>
            </>}
            <div className="backup-actions">
              <button type="button" onClick={exportPortfolio}>Скачать копию</button>
              <label>Восстановить<input type="file" accept="application/json,.json" onChange={(event) => { void importPortfolio(event.target.files?.[0]) }} /></label>
            </div>
          </section>
        </div>
      )}

      {showCashFlow && (
        <div className="modal-backdrop" onClick={() => setShowCashFlow(false)}>
          <form className="asset-modal" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); saveCashFlow() }}>
            <button className="modal-close" type="button" onClick={() => setShowCashFlow(false)} aria-label="Закрыть">×</button>
            <p className="eyebrow">ДЕНЕЖНАЯ ОПЕРАЦИЯ</p>
            <h2>Учёт движения денег</h2>
            <div className="flow-type-switch">
              {(['Пополнение', 'Вывод', 'Дивиденд'] as CashFlow['type'][]).map((type) => <button className={cashFlowType === type ? 'active' : ''} type="button" onClick={() => setCashFlowType(type)} key={type}>{type}</button>)}
            </div>
            {cashFlowType === 'Дивиденд' && <label>Тикер акции<input value={cashFlowTicker} onChange={(event) => setCashFlowTicker(event.target.value)} placeholder="Например, SBER" /></label>}
            <label>Сумма, ₽<input type="number" min="0" step="0.01" value={cashFlowAmount} onChange={(event) => setCashFlowAmount(event.target.value)} placeholder="10000" autoFocus /></label>
            <label>Дата<input type="date" value={cashFlowDate} onChange={(event) => setCashFlowDate(event.target.value)} /></label>
            <p className="detail-note">Пополнения и выводы учитываются при расчёте общей доходности. Дивиденды добавляются к финансовому результату.</p>
            <button className="modal-submit" type="submit">Сохранить операцию</button>
          </form>
        </div>
      )}

      {bondCalculator && (
        <div className="modal-backdrop" onClick={() => setBondCalculator(null)}>
          <section className="asset-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setBondCalculator(null)} aria-label="Закрыть">×</button>
            <p className="eyebrow">КАЛЬКУЛЯТОР ОБЛИГАЦИЙ</p>
            <h2>{bondCalculator.name}</h2>
            <p className="modal-caption">{bondCalculator.ticker} · расчёт до погашения</p>
            <label>Количество<input type="number" min="1" step="1" value={calculatorQuantity} onChange={(event) => setCalculatorQuantity(event.target.value)} /></label>
            {(() => {
              const count = Math.max(1, Number(calculatorQuantity) || 1)
              const purchase = bondCalculator.valuePrice * count
              const redemption = (bondCalculator.faceValue ?? 1000) * count
              const coupon = (bondCalculator.couponValue ?? 0) * count
              const maturityYears = bondCalculator.maturityDate ? Math.max(0, (new Date(bondCalculator.maturityDate).getTime() - Date.now()) / 31_557_600_000) : 0
              const estimatedCouponPayments = maturityYears ? Math.max(1, Math.floor(maturityYears * 2)) : 1
              const totalCoupons = coupon * estimatedCouponPayments
              const result = redemption + totalCoupons - purchase
              const yieldPercent = purchase ? result / purchase * 100 : 0
              return <div className="bond-results">
                <div><span>Стоимость покупки</span><strong>{purchase.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong></div>
                <div><span>Ближайший купон</span><strong>{coupon.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong></div>
                <div><span>Оценка купонов до погашения</span><strong>{totalCoupons.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong></div>
                <div><span>Сумма при погашении</span><strong>{redemption.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽</strong></div>
                <div className="bond-result-total"><span>Ориентировочная доходность</span><strong>{yieldPercent.toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%</strong></div>
              </div>
            })()}
            <p className="advice-disclaimer">Оценочный расчёт предполагает две купонные выплаты в год. Налоги, комиссии и реинвестирование не учитываются.</p>
            <button className="modal-submit" type="button" onClick={() => setBondCalculator(null)}>Готово</button>
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
