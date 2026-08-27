import { Link, useNavigate } from 'react-router-dom';

import './BackBar.css';

/**
 * The way back. Every screen below the landing page gets one, so the trail is
 * always visible and the browser back button is never the only route out.
 *
 * `trail` is the breadcrumb: every entry but the last should carry a `to`.
 * `backTo` overrides the default, which is simply the previous history entry —
 * right for a screen reachable from several places, wrong for a deep link, so
 * pages that can be landed on directly pass an explicit destination.
 */
export default function BackBar({ trail = [], backTo, backLabel = 'Back' }) {
  const navigate = useNavigate();

  const goBack = () => {
    if (backTo) navigate(backTo);
    else if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <nav className="wk-backbar" aria-label="Breadcrumb">
      <div className="wk-backbar-inner">
        <button type="button" className="wk-back" onClick={goBack}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {backLabel}
        </button>

        <ol className="wk-crumbs">
          {trail.map((crumb, i) => {
            const last = i === trail.length - 1;
            return (
              <li key={crumb.label}>
                {crumb.to && !last ? (
                  <Link to={crumb.to}>{crumb.label}</Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined}>{crumb.label}</span>
                )}
                {!last && <span className="wk-crumb-sep" aria-hidden="true">/</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
