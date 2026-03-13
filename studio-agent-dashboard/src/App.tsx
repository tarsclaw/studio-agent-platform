import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { LandingPage } from './pages/LandingPage';
import { AIHub } from './pages/AIHub';
import { Overview } from './pages/Overview';
import { ROI } from './pages/ROI';
import { Usage } from './pages/Usage';
import { Performance } from './pages/Performance';
import { Tools } from './pages/Tools';
import { BotComparison } from './pages/BotComparison';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/dashboard" element={<Shell />}>
        {/* Wave 1: AI Hub is the primary entry point */}
        <Route index element={<Navigate to="ai-hub" replace />} />
        <Route path="ai-hub" element={<AIHub />} />

        {/* Existing analytics pages — preserved as-is */}
        <Route path="overview" element={<Overview />} />
        <Route path="roi" element={<ROI />} />
        <Route path="usage" element={<Usage />} />
        <Route path="performance" element={<Performance />} />
        <Route path="tools" element={<Tools />} />
        <Route path="bots" element={<BotComparison />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
