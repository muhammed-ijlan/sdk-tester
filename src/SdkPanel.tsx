import type { SdkFn } from './functions';
import { useState } from 'react';
import { WasmCallError, type WasmCallArg } from './CryptoSDK';

type ErrorDetails = {
  wasmName?: string;
  isUnreachable: boolean;
  args?: WasmCallArg[];
  causeMessage?: string;
  causeStack?: string;
  fnName: string;
  fields: Record<string, string>;
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
      const isWasm = err instanceof WasmCallError;
      const message = err instanceof Error ? err.message : String(err);
      const redacted = redactFields(values, fn.fields);
      const details: ErrorDetails = {
        fnName: fn.name,
        fields: redacted,
        isUnreachable: isWasm ? err.isUnreachable : /unreachable/i.test(message),
        wasmName: isWasm ? err.wasmName : undefined,
        args: isWasm ? err.args : undefined,
        causeMessage: isWasm ? err.causeMessage : message,
        causeStack: isWasm ? err.causeStack : err instanceof Error ? err.stack : undefined,
      };

      // Mirror everything to console so you don't have to dig through the
      // collapsible <details> on screen.
      console.group(`%c[panel] ${fn.name} → error`, 'color:#ff5252; font-weight:bold');
      console.error('thrown:', err);
      if (details.isUnreachable) {
        console.warn(
          'WASM unreachable trap → the Rust side panicked. This pkg/ build does NOT install console_error_panic_hook, so the original Rust message is lost. Inspect the args below to spot a null-pointer or wrong-slot value.',
        );
      }
      if (details.wasmName) console.log('wasm fn:', details.wasmName);
      if (details.args) console.table(details.args);
      console.log('panel fields (passwords redacted):', redacted);
      if (details.causeStack) console.log('stack:', details.causeStack);
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
        wasmFn: result.details.wasmName,
        isUnreachable: result.details.isUnreachable,
        message: result.details.causeMessage,
        args: result.details.args,
        fields: result.details.fields,
        stack: result.details.causeStack,
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
            {result.details.isUnreachable && (
              <span className="error-badge" title="WASM `unreachable` trap — Rust panicked. This pkg/ build has no panic_hook so the Rust message is lost.">
                WASM unreachable · Rust panic
              </span>
            )}
          </div>

          <pre className="output error">{result.error}</pre>

          {result.details.isUnreachable && (
            <p className="error-note">
              The WebAssembly module hit an <code>unreachable</code> instruction. That is what JS sees whenever
              Rust panics without <code>console_error_panic_hook</code> installed — there is no Rust-side message
              to recover. Check the args below for a null-pointer slot (<code>0</code> / <code>0x0</code>) or a
              value in the wrong slot.
            </p>
          )}

          {result.details.wasmName && (
            <div className="error-row">
              <div className="error-row-label">wasm export</div>
              <code className="error-row-value">{result.details.wasmName}</code>
            </div>
          )}

          {result.details.args && result.details.args.length > 0 && (
            <div className="error-row">
              <div className="error-row-label">args passed</div>
              <table className="error-args">
                <thead>
                  <tr>
                    <th>slot</th>
                    <th>value</th>
                    <th>hex</th>
                  </tr>
                </thead>
                <tbody>
                  {result.details.args.map((a, i) => {
                    const isNullPtr = a.hex === '0x0';
                    return (
                      <tr key={i} className={isNullPtr ? 'null-ptr' : ''}>
                        <td>{a.slot}</td>
                        <td>{String(a.value)}</td>
                        <td>{a.hex ?? ''}{isNullPtr ? ' ← NULL' : ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="error-row">
            <div className="error-row-label">panel fields (passwords redacted)</div>
            <pre className="error-fields">{JSON.stringify(result.details.fields, null, 2)}</pre>
          </div>

          {result.details.causeStack && (
            <details className="error-stack">
              <summary>stack trace</summary>
              <pre>{result.details.causeStack}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  );
};
