import { useEffect, useState } from 'react'
import './App.css'

type TelegramWebApp = {
  ready: () => void
  expand: () => void
  initDataUnsafe?: { user?: { first_name?: string } }
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

const sections = [
  { icon: '▣', label: 'Портфель' },
  { icon: '◔', label: 'Аналитика' },
  { icon: '✦', label: 'AI' },
  { icon: '◉', label: 'Профиль' },
]

function App() {
  const [name, setName] = useState('инвестор')
  const [activeSection, setActiveSection] = useState('Портфель')

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    webApp?.ready()
    webApp?.expand()
    setName(webApp?.initDataUnsafe?.user?.first_name ?? 'инвестор')
  }, [])

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">I</div>
        <div>
          <p className="eyebrow">INVESTAI</p>
          <h1>Добро пожаловать, {name}</h1>
        </div>
        <button className="avatar" aria-label="Открыть профиль">◉</button>
      </header>

      <section className="hero-card" aria-label="Сводка портфеля">
        <p className="card-label">Общая стоимость</p>
        <strong className="portfolio-value">0 ₽</strong>
        <div className="yield-chip">↗ 0% за всё время</div>
        <button className="primary-button">＋ Добавить актив</button>
      </section>

      <section className="quick-stats" aria-label="Ближайшие выплаты">
        <article>
          <span className="stat-icon pink">₽</span>
          <div>
            <p>Купоны</p>
            <strong>0 ₽</strong>
          </div>
        </article>
        <article>
          <span className="stat-icon blue">◷</span>
          <div>
            <p>Следующая выплата</p>
            <strong>Нет данных</strong>
          </div>
        </article>
      </section>

      <section className="portfolio-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ВАШИ АКТИВЫ</p>
            <h2>Портфель</h2>
          </div>
          <button className="text-button">Смотреть всё</button>
        </div>
        <div className="empty-state">
          <span className="empty-icon">◌</span>
          <h3>Портфель пока пуст</h3>
          <p>Добавьте первую акцию или облигацию, чтобы следить за доходностью.</p>
        </div>
      </section>

      <section className="ai-card">
        <span className="ai-orb">✦</span>
        <div>
          <p className="eyebrow">AI-ПОМОЩНИК</p>
          <h2>Помогу разобраться с портфелем</h2>
        </div>
        <button aria-label="Открыть AI-помощника">→</button>
      </section>

      <nav className="bottom-nav" aria-label="Основная навигация">
        {sections.map((section) => (
          <button
            className={activeSection === section.label ? 'nav-item active' : 'nav-item'}
            key={section.label}
            onClick={() => setActiveSection(section.label)}
          >
            <span>{section.icon}</span>
            {section.label}
          </button>
        ))}
      </nav>
    </main>
  )
}

export default App
