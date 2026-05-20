import type { SdkFn } from './functions';
import { useState } from 'react';

type ErrorDetails = {
  fnName: string;
  fields: Record<string, string>;
  stack?: string;
};

type Result =
  | { ok: true; value: string }
  | { ok: false; error: string; details: ErrorDetails };

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

const redactFields = (fields: Record<string, string>, specs: SdkFn['fields']): Record<string, string> => {
  const isSecret = new Map(specs.map(f => [f.name, f.type === 'password']));
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, isSecret.get(k) && v.length > 0 ? `••• (${v.length} chars)` : v]),
  );
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
      const redacted = redactFields(values, fn.fields);
      const details: ErrorDetails = {
        fnName: fn.name,
        fields: redacted,
        stack: err instanceof Error ? err.stack : undefined,
      };

      console.group(`%c[panel] ${fn.name} → error`, 'color:#ff5252; font-weight:bold');
      console.error('thrown:', err);
      console.log('panel fields (passwords redacted):', redacted);
      if (details.stack) console.log('stack:', details.stack);
      console.groupEnd();

      setResult({ ok: false, error: message, details });
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

  const copyError = () => {
    if (result && !result.ok) {
      const dump = {
        fn: result.details.fnName,
        message: result.error,
        fields: result.details.fields,
        stack: result.details.stack,
      };
      void navigator.clipboard.writeText(JSON.stringify(dump, null, 2));
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
        {result && !result.ok && (
          <button className="secondary" onClick={copyError}>
            Copy error JSON
          </button>
        )}
      </div>

      {result?.ok && (
        <>
          <div className="output-header">
            <span>Output</span>
          </div>
          <pre className="output success">{result.value}</pre>
        </>
      )}

      {result && !result.ok && (
        <div className="error-block">
          <div className="error-head">
            <span className="error-label">Error</span>
          </div>

          <pre className="output error">{result.error}</pre>

          <div className="error-row">
            <div className="error-row-label">inputs (passwords redacted)</div>
            <pre className="error-fields">{JSON.stringify(result.details.fields, null, 2)}</pre>
          </div>

          {result.details.stack && (
            <details className="error-stack">
              <summary>stack trace</summary>
              <pre>{result.details.stack}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
};
