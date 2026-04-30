import React from 'react';
import StatsDashboard from '../components/dashboard/StatsDashboard';

const StatsView: React.FC = () => {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">统计仪表盘</h1>
      <StatsDashboard />
    </div>
  );
};

export default StatsView;
