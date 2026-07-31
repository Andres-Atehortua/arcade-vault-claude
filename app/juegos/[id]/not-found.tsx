import Link from 'next/link';

const GameNotFound = () => {
  return (
    <section className='av-404 fade-in'>
      <div className='code neon-magenta flicker'>404</div>
      <h2 className='neon-cyan'>CARTUCHO NO ENCONTRADO</h2>
      <p>
        Esta máquina no existe en el Vault. Puede que el cartucho se haya
        quemado o que la URL esté mal tecleada.
      </p>
      <Link className='btn lg pulse' href='/biblioteca'>
        VOLVER AL VAULT
      </Link>
    </section>
  );
};

export default GameNotFound;
