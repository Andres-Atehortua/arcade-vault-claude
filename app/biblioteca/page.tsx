import LibraryFilters from '../components/library-filters';
import { getGames } from '../lib/supabase/queries';

export const revalidate = 60;

const Biblioteca = async () => {
  const games = await getGames();

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <LibraryFilters games={games} />
    </div>
  );
};

export default Biblioteca;
