import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';
import { Navbar } from './components/Navbar';

const CoursesPage        = lazy(() => import('./pages/CoursesPage').then(m => ({ default: m.CoursesPage })));
const CourseDetailPage   = lazy(() => import('./pages/CourseDetailPage').then(m => ({ default: m.CourseDetailPage })));
const CourseLearningPage = lazy(() => import('./pages/CourseLearningPage').then(m => ({ default: m.CourseLearningPage })));
const InstructorPage     = lazy(() => import('./pages/InstructorPage').then(m => ({ default: m.InstructorPage })));
const CourseBuilderPage  = lazy(() => import('./pages/CourseBuilderPage').then(m => ({ default: m.CourseBuilderPage })));
const ProfilePage        = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const StudyPage          = lazy(() => import('./pages/StudyPage').then(m => ({ default: m.StudyPage })));
const TestTakingPage     = lazy(() => import('./pages/TestTakingPage').then(m => ({ default: m.TestTakingPage })));
const TestBuilderPage    = lazy(() => import('./pages/TestBuilderPage').then(m => ({ default: m.TestBuilderPage })));

const MAIN_SITE = import.meta.env.VITE_MAIN_SITE_URL || 'https://aziral.com';

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

/**
 * ProtectedRoute — if not logged in, redirect to aziral.com/login?redirect=<current URL>
 * After login, the SSO cookie is set and the user is returned here automatically.
 */
function ProtectedRoute({ children, requireRole }: { children: React.ReactNode; requireRole?: string }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;

  if (!user) {
    const returnTo = encodeURIComponent(`${window.location.origin}${location.pathname}${location.search}`);
    window.location.href = `${MAIN_SITE}/login?redirect=${returnTo}`;
    return null;
  }

  if (requireRole && user.role !== requireRole && user.role !== 'admin') {
    window.location.href = MAIN_SITE;
    return null;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"                                element={<CoursesPage />} />
          <Route path="/courses/:id"                     element={<CourseDetailPage />} />
          <Route path="/courses/:id/learn"               element={<ProtectedRoute><CourseLearningPage /></ProtectedRoute>} />
          <Route path="/courses/:id/learn/:lessonId"     element={<ProtectedRoute><CourseLearningPage /></ProtectedRoute>} />
          <Route path="/instructor"                      element={<ProtectedRoute requireRole="instructor"><InstructorPage /></ProtectedRoute>} />
          <Route path="/instructor/courses/:id/build"    element={<ProtectedRoute requireRole="instructor"><CourseBuilderPage /></ProtectedRoute>} />
          <Route path="/profile"                         element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/study"                           element={<StudyPage />} />
          <Route path="/study/:id"                      element={<TestTakingPage />} />
          <Route path="/instructor/tests/:id/build"     element={<ProtectedRoute requireRole="instructor"><TestBuilderPage /></ProtectedRoute>} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="bottom-right" theme="dark" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}
