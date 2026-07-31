import ContactForm from '../components/contact-form';
import { HighlightIcon } from '../components/home-icons';
import type { HighlightIconKind } from '../components/home-icons';
import Reveal from '../components/reveal';

interface Highlight {
  icon: HighlightIconKind;
  text: string;
  color: 'magenta' | 'cyan' | 'green';
}

const HIGHLIGHTS: Highlight[] = [
  { icon: 'HEART', text: 'HECHO CON ❤️ PARA JUGADORES', color: 'magenta' },
  { icon: 'BROWSER', text: 'JUEGOS EN HTML — CORREN EN CUALQUIER NAVEGADOR', color: 'cyan' },
  { icon: 'PLANT', text: 'PROYECTO EN CONSTANTE CRECIMIENTO', color: 'green' }
];

const AcercaDe = () => {
  return (
    <div className='about fade-in'>
      <section className='about-hero'>
        <div className='kicker pixel neon-yellow'>▸ ACERCA DE</div>
        <h1 className='about-title'>ACERCA DE ARCADE VAULT</h1>
        <p className='about-mission'>
          ARCADE VAULT nació del amor por los videojuegos clásicos. Nuestra misión es preservar y celebrar
          los arcades que definieron una generación, haciéndolos accesibles para todos, en cualquier lugar
          y sin costo.
        </p>

        <div className='highlight-row'>
          {HIGHLIGHTS.map((highlight, i) => (
            <div
              key={highlight.text}
              className={'highlight ' + highlight.color}
              style={{ transitionDelay: i * 80 + 'ms' }}
            >
              <HighlightIcon kind={highlight.icon} />
              <div className='hl-text pixel'>{highlight.text}</div>
            </div>
          ))}
        </div>
      </section>

      <Reveal className='about-divider'>
        <div className='div-bar' />
        <div className='div-pixels' aria-hidden='true'>
          {Array.from({ length: 24 }).map((_, i) => (
            <span key={i} style={{ animationDelay: i * 80 + 'ms' }} />
          ))}
        </div>
        <div className='div-bar' />
      </Reveal>

      <Reveal className='about-contact'>
        <div className='contact-grid'>
          <div className='contact-intro'>
            <div className='kicker pixel neon-cyan'>▸ CONTACTO</div>
            <h2 className='contact-title'>CONTÁCTANOS</h2>
            <p className='contact-sub'>
              ¿Tienes alguna sugerencia, quieres proponer un juego, o simplemente quieres saludar?
              Escríbenos.
            </p>
            <div className='contact-tips'>
              <div className='tip'>
                <span className='tip-led' />
                RESPUESTA EN 24-48H
              </div>
              <div className='tip'>
                <span className='tip-led y' />
                SUGERENCIAS BIENVENIDAS
              </div>
              <div className='tip'>
                <span className='tip-led m' />
                SIN SPAM, JAMÁS
              </div>
            </div>
          </div>

          <ContactForm />
        </div>
      </Reveal>
    </div>
  );
};

export default AcercaDe;
