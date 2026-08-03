import LocaleToggle from './LocaleToggle';

export default function Header({ title, sub }) {
  return (
    <div className="header">
      <img src="/logo.png" alt="Black Whale Academy" className="brand-logo" />
      <div style={{ flex: 1 }}>
        <h1>{title || 'الحوت الأسود'}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      <LocaleToggle />
    </div>
  );
}
