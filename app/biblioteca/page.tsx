import LibraryFilters from '../components/library-filters';
import { GAMES } from '../data/games';

const Biblioteca = () => {
  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <LibraryFilters games={GAMES} />
    </div>
  );
};

export default Biblioteca;
