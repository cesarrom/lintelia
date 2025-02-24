'use client';

import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Activity, Users, FileCheck, AlertCircle } from 'lucide-react';

const stats = [
  {
    name: 'Active Workflows',
    value: '12',
    change: '+2.5%',
    changeType: 'increase',
    icon: Activity,
  },
  {
    name: 'Total Users',
    value: '48',
    change: '+12.5%',
    changeType: 'increase',
    icon: Users,
  },
  {
    name: 'Completed Tasks',
    value: '1,257',
    change: '+15.3%',
    changeType: 'increase',
    icon: FileCheck,
  },
  {
    name: 'Pending Approvals',
    value: '8',
    change: '-3.2%',
    changeType: 'decrease',
    icon: AlertCircle,
  },
];

const recentActivity = [
  {
    id: 1,
    user: 'John Doe',
    action: 'completed workflow',
    target: 'Customer Onboarding',
    time: '2 hours ago',
  },
  {
    id: 2,
    user: 'Jane Smith',
    action: 'modified workflow',
    target: 'Invoice Processing',
    time: '4 hours ago',
  },
  {
    id: 3,
    user: 'Mike Johnson',
    action: 'started workflow',
    target: 'Employee Onboarding',
    time: '5 hours ago',
  },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        subtitle="Overview of your workflow system"
      />
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.name} className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-muted-foreground">{stat.name}</h3>
                  <div className="flex items-baseline">
                    <p className="text-2xl font-semibold">{stat.value}</p>
                    <p className={`ml-2 text-sm ${
                      stat.changeType === 'increase' ? 'text-green-500' : 'text-red-500'
                    }`}>
                      {stat.change}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card className="overflow-hidden">
          <div className="px-6 py-5 border-b">
            <h3 className="text-lg font-medium">Recent Activity</h3>
          </div>
          <ul className="divide-y">
            {recentActivity.map((activity) => (
              <li key={activity.id} className="px-6 py-4">
                <div className="flex space-x-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium">
                        {activity.user}
                      </h3>
                      <p className="text-sm text-muted-foreground">{activity.time}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {activity.action} <span className="font-medium">{activity.target}</span>
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}