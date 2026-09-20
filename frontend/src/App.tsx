import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { SiteNav } from '@/components/SiteNav';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { ToastProvider } from '@/components/Toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';

const LandingPage = lazy(() => import('@/pages/LandingPage'));
const HowItWorks = lazy(() => import('@/pages/HowItWorks'));
const About = lazy(() => import('@/pages/About'));
const AppHome = lazy(() => import('@/pages/app/AppHome'));
const AgentsList = lazy(() => import('@/pages/app/AgentsList'));
const NewAgent = lazy(() => import('@/pages/app/NewAgent'));
const EditAgent = lazy(() => import('@/pages/app/EditAgent'));
const AgentDetail = lazy(() => import('@/pages/app/AgentDetail'));
const ReviewSuite = lazy(() => import('@/pages/app/ReviewSuite'));
const Evaluations = lazy(() => import('@/pages/app/Evaluations'));
const Settings = lazy(() => import('@/pages/app/Settings'));
const EvaluationRunning = lazy(() => import('@/pages/app/EvaluationRunning'));
const EvaluationResults = lazy(() => import('@/pages/app/EvaluationResults'));
const TestTrace = lazy(() => import('@/pages/app/TestTrace'));
const Compare = lazy(() => import('@/pages/app/Compare'));
const NotFound = lazy(() => import('@/pages/NotFound'));
const AuthPage = lazy(() => import('@/pages/Auth'));
const AcceptInvite = lazy(() => import('@/pages/AcceptInvite'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const Demo = lazy(() => import('@/pages/Demo'));
const Team = lazy(() => import('@/pages/app/Team'));
const Billing = lazy(() => import('@/pages/app/Billing'));
const Developer = lazy(() => import('@/pages/app/Developer'));
const SharedReport = lazy(() => import('@/pages/SharedReport'));

const publicRoutes = ['/', '/how-it-works', '/about'];

function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isPublic = publicRoutes.includes(location.pathname)
    || location.pathname.startsWith('/shared-report/');

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
    /* reducedMotion="user" honours the OS setting: framer-motion then skips
       transform and opacity animations and renders the settled state straight
       away. Two reasons it matters here — the obvious accessibility one, and that
       every screen's content currently fades in, so anything that stops the
       animation loop leaves the page blank rather than unanimated. */
    <AppErrorBoundary>
      <BrowserRouter>
        <MotionConfig reducedMotion="user">
          <AuthProvider>
            <WorkspaceProvider>
              <ToastProvider>
                <Layout>
                  <Suspense fallback={(
                  <div className="flex min-h-[60vh] items-center justify-center bg-ink-950 font-mono text-xs uppercase tracking-[0.22em] text-bone-500">
                    Loading Aegis…
                  </div>
                  )}>
                    <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/how-it-works" element={<HowItWorks />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/demo" element={<Demo />} />
                    <Route path="/shared-report/:token" element={<SharedReport />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="/auth/callback" element={<AuthPage />} />
                    <Route path="/accept-invite" element={<ProtectedRoute><AcceptInvite /></ProtectedRoute>} />
                    <Route path="/app" element={<ProtectedRoute><AppHome /></ProtectedRoute>} />
                    <Route path="/app/agents" element={<ProtectedRoute><AgentsList /></ProtectedRoute>} />
                    <Route path="/app/agents/new" element={<ProtectedRoute roles={['owner', 'admin', 'member']}><NewAgent /></ProtectedRoute>} />
                    <Route path="/app/agents/:id" element={<ProtectedRoute><AgentDetail /></ProtectedRoute>} />
                    <Route path="/app/agents/:id/review" element={<ProtectedRoute roles={['owner', 'admin', 'member']}><ReviewSuite /></ProtectedRoute>} />
                    <Route path="/app/agents/:id/edit" element={<ProtectedRoute roles={['owner', 'admin', 'member']}><EditAgent /></ProtectedRoute>} />
                    <Route path="/app/evaluations" element={<ProtectedRoute><Evaluations /></ProtectedRoute>} />
                    <Route path="/app/evaluations/:id/running" element={<ProtectedRoute><EvaluationRunning /></ProtectedRoute>} />
                    <Route path="/app/evaluations/:id" element={<ProtectedRoute><EvaluationResults /></ProtectedRoute>} />
                    <Route path="/app/evaluations/:evaluationId/tests/:testId" element={<ProtectedRoute><TestTrace /></ProtectedRoute>} />
                    <Route path="/app/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
                    <Route path="/app/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="/app/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
                    <Route path="/app/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
                    <Route path="/app/developer" element={<ProtectedRoute roles={['owner', 'admin']}><Developer /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </Layout>
              </ToastProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </MotionConfig>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
