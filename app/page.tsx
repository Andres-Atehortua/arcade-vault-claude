export default function Home() {
  return (
    <main className='av-main'>
      <section className='av-hero'>
        <h1>Arcade Vault</h1>
        <p className='sub'>
          Inserta una moneda <span className='blink'>_</span>
        </p>
        <div className='detail-actions' style={{ justifyContent: 'center' }}>
          <button className='btn lg pulse'>Ver biblioteca</button>
          <button className='btn lg magenta'>Salón de la fama</button>
        </div>
      </section>
    </main>
  );
}
