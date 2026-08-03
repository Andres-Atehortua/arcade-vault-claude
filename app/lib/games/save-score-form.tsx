'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { saveScore } from '@/app/actions/scores';

/**
 * Sits over the lower band of the CRT while the canvas keeps painting its own
 * GAME OVER title, so the screen reads as one overlay: score above, signature
 * below. Restarting without saving stays available the whole time.
 */
const SaveScoreForm = ({ gameId, score }: { gameId: string; score: number }) => {
  const [alias, setAlias] = useState('');
  const [error, setError] = useState('');
  const [rank, setRank] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAlias(event.target.value.toUpperCase());
    setError('');
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    const result = await saveScore(gameId, alias, score);

    setSaving(false);
    if (result.ok) setRank(result.rank);
    else setError(result.error);
  };

  if (rank !== null) {
    return (
      <div className="save-score saved">
        <div className="pixel rank">PUESTO #{rank}</div>
        <p className="mono">Puntaje guardado. Pulsa ESPACIO o toca la pantalla para volver a jugar.</p>
      </div>
    );
  }

  return (
    <form className="save-score" onSubmit={onSubmit}>
      <label className="pixel" htmlFor="alias">
        FIRMA TU PUNTAJE
      </label>
      <div className="save-score-row">
        <input
          id="alias"
          name="alias"
          value={alias}
          onChange={onChange}
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
          placeholder="TU ALIAS"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'alias-error' : undefined}
        />
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'GUARDANDO…' : 'GUARDAR'}
        </button>
      </div>
      {error && (
        <p className="mono error" id="alias-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
};

export default SaveScoreForm;
