import { SECTIONS } from './functions';
import { SdkPanel } from './SdkPanel';
import { SdkSourceBar } from './SdkSourceBar';

export const App = () => (
  <div className="app">
    <SdkSourceBar />
    <header className="app-header">
      <div>
        <h1>rust_wallet_sdk — Tester</h1>
        <div className="subtitle">
          Standalone playground for the WASM bindings under <code>./pkg/</code>. Drop a fresh pkg/ folder in the bar
          above to hot-swap the build, or replace the files on disk for a permanent change.
        </div>
      </div>
    </header>

    {SECTIONS.map(section => (
      <nav key={`toc-${section.title}`} className="toc">
        <div className="toc-title">{section.title}</div>
        {section.fns.map(fn => (
          <a key={fn.name} href={`#${fn.name}`}>
            {fn.name.replace(/^CryptoSDK\./, '')}
          </a>
        ))}
      </nav>
    ))}

    {SECTIONS.map(section => (
      <section key={section.title} className="section">
        <header className="section-header">
          <h2>{section.title}</h2>
          <p>{section.blurb}</p>
        </header>
        {section.fns.map(fn => (
          <SdkPanel key={fn.name} fn={fn} />
        ))}
      </section>
    ))}
  </div>
);
