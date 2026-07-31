import HallOfFame from '../components/hall-of-fame';

const HallPage = () => {
  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel">LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA</p>
      </div>

      <HallOfFame />
    </div>
  );
};

export default HallPage;
