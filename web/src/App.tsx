import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { SiteNav } from '@/components/SiteNav';
import LandingPage from '@/pages/LandingPage';
import HowItWorks from '@/pages/HowItWorks';
import About from '@/pages/About';
import AppHome from '@/pages/app/AppHome';
import AgentsList from '@/pages/app/AgentsList';
import NewAgent from '@/pages/app/NewAgent';
import AgentDetail from '@/pages/app/AgentDetail';
import EvaluationRunning from '@/pages/app/EvaluationRunning';
import EvaluationResults from '@/pages/app/EvaluationResults';
import TestTrace from '@/pages/app/TestTrace';
import Compare from '@/pages/app/Compare';
import NotFound from '@/pages/NotFound';
import { useEffect, type ReactNode } from 'react';

const publicRoutes = ['/', '/how-it-works', '/about'];

function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isPublic = publicRoutes.includes(location.pathname);

  // Without this a click from halfway down the (very long) landing page lands
  // halfway down the next one.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [location.pathname]);

  return (
    <>
      {isPublic && <SiteNav />}
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/about" element={<About />} />
          <Route path="/app" element={<AppHome />} />
          <Route path="/app/agents" element={<AgentsList />} />
          <Route path="/app/agents/new" element={<NewAgent />} />
          <Route path="/app/agents/:id" element={<AgentDetail />} />
          <Route path="/app/evaluations/:id/running" element={<EvaluationRunning />} />
          <Route path="/app/evaluations/:id" element={<EvaluationResults />} />
          <Route path="/app/evaluations/:evaluationId/tests/:testId" element={<TestTrace />} />
          <Route path="/app/compare" element={<Compare />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
