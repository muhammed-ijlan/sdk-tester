import type { SdkFn } from './functions';
import { useState } from 'react';

type Result = { ok: true; value: string } | { ok: false; error: string };

const formatResult = (value: unknown): string => {
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
};

export const SdkPanel = ({ fn }: { fn: SdkFn }) => {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fn.fields.map(f => [f.name, f.defaultValue ?? ''])),
  );
  const [result, setResult] = useState<Result | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      const raw = await fn.call(values);
      setResult({ ok: true, value: formatResult(raw) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, error: message });
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setValues(Object.fromEntries(fn.fields.map(f => [f.name, f.defaultValue ?? ''])));
    setResult(null);
  };

  const copyResult = () => {
    if (result?.ok) {
      void navigator.clipboard.writeText(result.value);
    }
  };

  return (
    <section className="panel" id={fn.name}>
      <header className="panel-header">
        <div>
          <h2>{fn.name}</h2>
          <p className="sig">{fn.signature}</p>
          <p className="desc">{fn.description}</p>
        </div>
      </header>

      {fn.fields.length > 0 && (
        <div className="fields">
          {fn.fields.map(field => {
            const id = `${fn.name}-${field.name}`;
            return (
              <div key={field.name} className="field">
                <label htmlFor={id}>
                  {field.name}
                  {field.optional && <span className="optional"> (optional)</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    id={id}
                    value={values[field.name]}
                    placeholder={field.placeholder}
                    onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                  />
                ) : (
                  <input
                    id={id}
                    type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                    value={values[field.name]}
                    placeholder={field.placeholder}
                    onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="actions">
        <button onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run'}
        </button>
        {fn.fields.length > 0 && (
          <button className="secondary" onClick={reset}>
            Reset
          </button>
        )}
        {result?.ok && (
          <button className="secondary" onClick={copyResult}>
            Copy output
          </button>
        )}
      </div>

      {result && (
        <>
          <div className="output-header">
            <span>{result.ok ? 'Output' : 'Error'}</span>
          </div>
          <pre className={`output ${result.ok ? 'success' : 'error'}`}>{result.ok ? result.value : result.error}</pre>
        </>
      )}
    </section>
  );
};
