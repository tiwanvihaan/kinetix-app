import { Toaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Dashboard from '@/pages/Dashboard';
import TappingTest from '@/pages/TappingTest';
import TremorTest from '@/pages/TremorTest';
import SpiralTest from '@/pages/SpiralTest';
import GaitTest from '@/pages/GaitTest';
import VoiceTest from '@/pages/VoiceTest';
import BlinkTest from '@/pages/BlinkTest';
import Summary from '@/pages/Summary';
import History from '@/pages/History';
import Assessments from '@/pages/Assessments';
import Progress from '@/pages/Progress';
import Settings from '@/pages/Settings';
import AppLayout from '@/components/navigation/AppLayout';

// Kinetix has no sign-in and stores nothing on a server: every page is public and
// all results stay on the user's own device.
const AppRoutes = () => (
  <Routes>
    <Route element={<AppLayout />}>
      <Route path="/" element={<Dashboard />} />
      <Route path="/assessments" element={<Assessments />} />
      <Route path="/progress" element={<Progress />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/summary" element={<Summary />} />
      <Route path="/history" element={<History />} />
    </Route>
    <Route path="/test/tapping" element={<TappingTest />} />
    <Route path="/test/tremor" element={<TremorTest />} />
    <Route path="/test/spiral" element={<SpiralTest />} />
    <Route path="/test/gait" element={<GaitTest />} />
    <Route path="/test/voice" element={<VoiceTest />} />
    <Route path="/test/blink" element={<BlinkTest />} />
    <Route path="*" element={<PageNotFound />} />
  </Routes>
);

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router basename="/kinetix-app">
          <ScrollToTop />
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
