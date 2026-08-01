import Link from 'next/link';
import { FeatureIcon, FloatingSilhouettes } from './components/home-icons';
import { RECENT_SCORES, TOP_PLAYERS } from './data/activity';
import { getGames } from './lib/supabase/queries';
import Reveal from './components/reveal';
import type { FeatureIconKind } from './components/home-icons';

interface Stat {
  n: string;
  u: string;
  s: string;
}

const STATS: Stat[] = [
  { n: '12+', u: 'JUEGOS', s: 'Y CONTANDO' },
  { n: 'MILES', u: 'DE PARTIDAS', s: 'JUGADAS CADA DÍA' },
  { n: 'GLOBAL', u: 'RANKING', s: 'COMPITE CON EL MUNDO' },
];

export const revalidate = 60;

const topRankClass = (i: number) => (i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : '');

const PLAN_BENEFITS = [
  'Acceso a todos los juegos',
  'Ranking global y salón de la fama',
  'Sin anuncios entre partidas',
  'Guarda tus puntuaciones',
  'Nuevos juegos cada mes',
  'Funciona en cualquier navegador',
];

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: FaqItem[] = [
  {
    q: '¿REALMENTE ES GRATIS?',
    a: 'Sí. Arcade Vault es un proyecto sin fines de lucro hecho por amor a los clásicos. No hay versión "premium" escondida.',
  },
  {
    q: '¿NECESITO CREAR CUENTA?',
    a: 'No. Puedes jugar como invitado. Si quieres guardar tu puntuación y aparecer en el ranking, regístrate en 10 segundos.',
  },
  {
    q: '¿CÓMO SOBREVIVEN SIN COBRAR?',
    a: 'Es un proyecto comunitario. Si te gusta, compártelo. Esa es toda la moneda que aceptamos.',
  },
];

interface Feature {
  icon: FeatureIconKind;
  title: string;
  desc: string;
  color: 'cyan' | 'yellow' | 'magenta' | 'green';
}

const FEATURES: Feature[] = [
  {
    icon: 'GAMEPAD',
    title: 'JUEGOS CLÁSICOS',
    desc: 'Arkanoid, Tetris, Snake y muchos más. Los mejores arcades de todos los tiempos en un solo lugar.',
    color: 'cyan',
  },
  {
    icon: 'FREE',
    title: '100% GRATIS',
    desc: 'Sin suscripciones, sin pagos ocultos. Todos los juegos disponibles de forma gratuita.',
    color: 'yellow',
  },
  {
    icon: 'TROPHY',
    title: 'LADDER BOARDS',
    desc: 'Compite con jugadores de todo el mundo. Escala el ranking y demuestra quién es el mejor.',
    color: 'magenta',
  },
  {
    icon: 'ROCKET',
    title: 'SIEMPRE CRECIENDO',
    desc: 'Agregamos nuevos juegos constantemente. Vuelve seguido, siempre habrá algo nuevo que jugar.',
    color: 'green',
  },
];

const Home = async () => {
  const games = await getGames();

  return (
    <div className="home fade-in">
      <section className="home-hero">
        <FloatingSilhouettes />
        <div className="home-hero-inner">
          <div className="hero-eyebrow pixel neon-yellow">
            ▸ INSERTA UNA MONEDA<span className="blink">_</span>
          </div>
          <h1 className="home-title">
            <span className="line-1">EL ARCADE</span>
            <span className="line-2">CLÁSICO ESTÁ</span>
            <span className="line-3">DE VUELTA</span>
          </h1>
          <p className="home-sub">
            Juega los mejores clásicos directamente en tu navegador.
            <br />
            Sin descargas. Sin costo. Solo diversión.
          </p>
          <div className="home-ctas">
            <Link className="btn xl pulse" href="/biblioteca">
              ▶ EXPLORAR JUEGOS
            </Link>
            <Link className="btn xl magenta" href="/auth">
              ✦ CREAR CUENTA
            </Link>
          </div>
          <div className="hero-scroll" aria-hidden="true">
            <span>DESLIZA</span>
            <span className="arrow">▼</span>
          </div>
        </div>
      </section>

      <Reveal className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-magenta">{'// 01'}</div>
          <h2 className="section-title">¿POR QUÉ ARCADE VAULT?</h2>
          <div className="section-rule" />
        </div>
        <div className="feature-grid">
          {FEATURES.map((feature, i) => (
            <div key={feature.title} className={'feature-card ' + feature.color} style={{ transitionDelay: i * 80 + 'ms' }}>
              <FeatureIcon kind={feature.icon} />
              <div className="ft-title pixel">{feature.title}</div>
              <div className="ft-desc">{feature.desc}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-cyan">{'// 02'}</div>
          <h2 className="section-title">JUEGOS DISPONIBLES AHORA</h2>
          <div className="section-rule" />
        </div>
        <div className="mini-rail">
          {games.slice(0, 6).map((game) => (
            <Link key={game.id} className="mini-card" href={`/juegos/${game.id}`}>
              <div className="mini-cover">
                <div className={'cover-bg ' + game.cover} />
              </div>
              <div className="mini-meta">
                <div className="mini-title">{game.title}</div>
                <div className="mini-cat">{game.cat}</div>
              </div>
            </Link>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link className="btn lg" href="/biblioteca">
            VER TODOS LOS JUEGOS →
          </Link>
        </div>
      </Reveal>

      <Reveal className="home-stats">
        <div className="stats-inner">
          {STATS.map((stat, i) => (
            <div key={stat.u} className="stat-block" style={{ transitionDelay: i * 90 + 'ms' }}>
              <div className="stat-n neon-yellow">{stat.n}</div>
              <div className="stat-u pixel">{stat.u}</div>
              <div className="stat-s">{stat.s}</div>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-yellow">{'// 03'}</div>
          <h2 className="section-title">ACTIVIDAD EN VIVO</h2>
          <div className="section-rule" />
        </div>
        <div className="activity-grid">
          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel">▸ ÚLTIMAS PUNTUACIONES</div>
            </div>
            <div className="ticker">
              {RECENT_SCORES.map((row, i) => (
                <div key={row.player} className="tick-row" style={{ animationDelay: i * 60 + 'ms' }}>
                  <span className={'tk-p neon-' + row.color}>{row.player}</span>
                  <span className="tk-mid">▸ {row.game}</span>
                  <span className="tk-s">+{row.score.toLocaleString('es-ES')}</span>
                  <span className="tk-t">{row.ago}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="activity-card">
            <div className="ac-head">
              <div className="ac-title pixel neon-magenta">▸ TOP JUGADORES · HOY</div>
              <Link className="lb-link" href="/salon">
                VER SALÓN →
              </Link>
            </div>
            <div className="top-list">
              {TOP_PLAYERS.map((row, i) => (
                <div key={row.player} className={'top-row' + topRankClass(i)}>
                  <span className="tp-rk">#{String(row.rank).padStart(2, '0')}</span>
                  <span className="tp-bar">
                    <span className="tp-fill" style={{ width: 100 - i * 16 + '%' }} />
                  </span>
                  <span className="tp-p">{row.player}</span>
                  <span className="tp-s">{row.score.toLocaleString('es-ES')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      <Reveal className="home-section">
        <div className="section-head">
          <div className="kicker pixel neon-green">{'// 04'}</div>
          <h2 className="section-title">PRECIOS</h2>
          <div className="section-rule" />
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <div className="pc-label pixel">PLAN ÚNICO</div>
            <div className="pc-name pixel">JUGADOR VAULT</div>
            <div className="pc-amount">
              <span className="pc-amount-n">$0</span>
              <span className="pc-amount-u">/ SIEMPRE</span>
            </div>
            <div className="pc-tag">SIN TRUCOS · SIN LETRA PEQUEÑA</div>
            <ul className="pc-list">
              {PLAN_BENEFITS.map((benefit) => (
                <li key={benefit}>✔ {benefit}</li>
              ))}
            </ul>
            <Link className="btn xl pulse" style={{ width: '100%' }} href="/auth">
              EMPEZAR GRATIS →
            </Link>
            <div className="pc-foot">No pedimos tarjeta. Nunca lo haremos.</div>
            <div className="pc-stamp pixel">
              FREE
              <br />
              PLAY
            </div>
          </div>

          <div className="pricing-faq">
            {FAQ.map((item) => (
              <div key={item.q} className="faq-item">
                <div className="faq-q pixel">{item.q}</div>
                <div className="faq-a">{item.a}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="home-final">
        <h2 className="final-title pixel">¿LISTO PARA JUGAR?</h2>
        <Link className="btn xl pulse final-cta" href="/biblioteca">
          INSERTAR MONEDA →
        </Link>
        <div className="final-tag">Gratis. Sin registro obligatorio. Empieza en segundos.</div>
      </Reveal>
    </div>
  );
};

export default Home;
