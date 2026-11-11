import { PASSWORD_RULES } from '../lib/auth/validation';

/**
 * Live password strength readout: a segmented meter (one cell per rule, like
 * an arcade energy bar) over the list of rules, each lighting up when met.
 */
const PasswordChecklist = ({ password, id }: { password: string; id: string }) => {
  const results = PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(password) }));
  const metCount = results.filter((rule) => rule.met).length;

  return (
    <div className="pw-check" id={id}>
      <div className="pw-meter" aria-hidden="true" data-level={metCount}>
        {results.map((rule, index) => (
          <span key={rule.id} className={index < metCount ? 'on' : ''} />
        ))}
      </div>
      <ul aria-label="Requisitos de la contraseña">
        {results.map((rule) => (
          <li key={rule.id} className={rule.met ? 'met' : ''}>
            <span className="pw-tick" aria-hidden="true" />
            {rule.label}
            <span className="sr-only">{rule.met ? ': cumplido' : ': pendiente'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordChecklist;
