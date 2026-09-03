import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import { TripProvider } from './state/TripContext.jsx';
import LandingPage from './pages/LandingPage.jsx';
import PackagesCatalogue from './pages/PackagesCatalogue.jsx';
import PackageDetail from './pages/PackageDetail.jsx';
import PackageBuilder from './pages/PackageBuilder.jsx';
import Checkout from './pages/Checkout.jsx';

/** Each screen in the flow starts at the top, the way a real navigation would. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    // HashRouter, not BrowserRouter: the prototype has to work when opened
    // straight off disk and when served as a static bundle, without a server
    // rewrite rule sending every deep link back to index.html.
    <HashRouter>
      <TripProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/packages" element={<PackagesCatalogue />} />
          {/* The results page is gone: a search now opens the builder directly,
              with the three auto-generated packages carried into its sidebar.
              The old URL redirects so shared links still land somewhere. */}
          <Route path="/results" element={<Navigate to="/builder" replace />} />
          <Route path="/package/:slug" element={<PackageDetail />} />
          <Route path="/builder" element={<PackageBuilder />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </TripProvider>
    </HashRouter>
  );
}
