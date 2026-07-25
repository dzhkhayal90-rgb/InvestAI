import { useEffect, useMemo, useState } from 'react'
import './App.css'

const sections = [
  { href: '#portfolio', label: 'Портфель' },
  { href: '#market', label: 'Рынок' },
  { href: '#coupons', label: 'Купоны' },
]

type Instrument = {
  ticker: string
  name: string
  kind: 'Акция' | 'Облигация'
  price: number
  change?: number
  coupon?: string
  date?: string
}

const instruments: Instrument[] = [
  { ticker: 'SBER', name: 'Сбербанк', kind: 'Акция', price: 310.5, change: 1.24 },
  { ticker: 'LKOH', name: 'Лукойл', kind: 'Акция', price: 6780, change: -0.38 },
  { ticker: 'ОФЗ 26238', name: 'ОФЗ-ПД 26238', kind: 'Облигация', price: 648.7, coupon: '35,18 ₽', date: '03 сент.' },
  { ticker: 'РЖД 001Р-35R', name: 'РЖД 001Р-35R', kind: 'Облигация', price: 1015.2, coupon: '42,63 ₽', date: '12 авг.' },
]

function App() {
  const [portfolio, setPortfolio] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('investai-portfolio')
    return saved ? JSON.parse(saved) : {}
  })
  const [notice, setNotice] = useState('Выберите бумагу из списка рынка')

  const portfolioItems = instruments.filter((instrument) => portfolio[instrument.ticker])
  const portfolioValue = useMemo(
    () => portfolioItems.reduce((sum, instrument) => sum + instrument.price * portfolio[instrument.ticker], 0),
    [portfolio, portfolioItems],
  )

  const addInstrument = (instrument: Instrument) => {
    setPortfolio((current) => ({ ...current, [instrument.ticker]: (current[instrument.ticker] ?? 0) + 1 }))
    setNotice(`${instrument.ticker} добавлен в портфель`)
  }

  useEffect(() => {
    localStorage.setItem('investai-portfolio', JSON.stringify(portfolio))
  }, [portfolio])

  return (
    <>
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark">I</span>
          <span>InvestAI</span>
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
          <div className="status-pill">● Демо-режим</div>
        </section>

        <section className="summary-grid" aria-label="Сводка портфеля">
          <article className="hero-card">
            <p className="card-label">Общая стоимость</p>
            <strong className="portfolio-value">{portfolioValue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</strong>
            <div className="yield-chip">{portfolioItems.length ? `${portfolioItems.length} поз. в портфеле` : 'Портфель ещё не заполнен'}</div>
            <a className="primary-button" href="#market">＋ Добавить актив</a>
          </article>
          <div className="quick-stats">
            <article><span className="stat-icon pink">₽</span><div><p>Купоны</p><strong>{portfolioItems.some((item) => item.kind === 'Облигация') ? '77,81 ₽' : 'Нет данных'}</strong></div></article>
            <article><span className="stat-icon blue">◷</span><div><p>Следующая выплата</p><strong>{portfolioItems.some((item) => item.ticker === 'РЖД 001Р-35R') ? '12 авг.' : 'Нет данных'}</strong></div></article>
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
                <div><strong>{instrument.ticker}</strong><p>{portfolio[instrument.ticker]} шт. · {instrument.name}</p></div>
                <strong>{(portfolio[instrument.ticker] * instrument.price).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽</strong>
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
          <div><p className="eyebrow">РЫНОК</p><h2>Акции и облигации</h2></div>
          <span className="demo-label">демо-цены</span>
        </div>
        <div className="market-list">
          {instruments.map((instrument) => (
            <article className="market-row" key={instrument.ticker}>
              <div className="market-main"><strong>{instrument.ticker}</strong><p>{instrument.name} · {instrument.kind}</p></div>
              <div className="market-price"><strong>{instrument.price.toLocaleString('ru-RU')} ₽</strong>{instrument.change !== undefined ? <span className={instrument.change >= 0 ? 'up' : 'down'}>{instrument.change >= 0 ? '+' : ''}{instrument.change}%</span> : <span>Купон {instrument.coupon}</span>}</div>
              <button className="add-button" onClick={() => addInstrument(instrument)} aria-label={`Добавить ${instrument.name}`}>＋</button>
            </article>
          ))}
        </div>
      </section>

      <section className="coupon-section" id="coupons">
        <div className="section-heading"><div><p className="eyebrow">КАЛЕНДАРЬ</p><h2>Ближайшие купоны</h2></div></div>
        {instruments.filter((item) => item.coupon).map((bond) => <div className="coupon-row" key={bond.ticker}><span>₽</span><div><strong>{bond.name}</strong><p>{bond.ticker}</p></div><div><strong>{bond.coupon}</strong><p>{bond.date}</p></div></div>)}
      </section>

      <section className="ai-card">
        <span className="ai-orb">✦</span>
        <div>
          <p className="eyebrow">AI-ПОМОЩНИК</p>
          <h2>Помогу разобраться с портфелем</h2>
        </div>
        <button aria-label="Открыть AI-помощника">→</button>
      </section>

      </main>
      <footer><span>InvestAI</span><p>Демонстрационный сервис. Не является инвестиционной рекомендацией.</p></footer>
    </>
  )
}

export default App
