import { useEffect, useState } from 'react';
import { getYieldCurve } from './api';
import { YieldCurve } from './types';
import YieldCurveChart from './components/YieldCurveChart';

export default function App() {
  const [curve, setCurve] = useState<YieldCurve | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadCurve() {
    try {
      setCurve(await getYieldCurve());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'failed to load yield curve');
    }
  }

  useEffect(() => {
    loadCurve();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold text-gray-900">ModernFi Liquidity Desk</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-8">
        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-4">
            {loadError}
          </div>
        )}
        {curve && <YieldCurveChart points={curve.points} date={curve.date} />}
      </main>
    </div>
  );
}
