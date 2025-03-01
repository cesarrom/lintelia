'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getLogsAnalytics, getTopUsers, getTopSources, getLogsTrend } from '../../../(actions)/actions';
import { LogsFilter } from '@/lib/services/logs.service';
import { Log } from '@/lib/entities/tenant/log.entity';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Info, Bug, User, Clock, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

// Import recharts directly - it's already installed in the project
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface LogsDashboardProps {
  initialFilter?: LogsFilter;
}

interface ChartDataItem {
  name: string;
  value: number;
  color?: string;
}

interface TrendDataItem {
  date: string;
  total: number;
  info: number;
  warning: number;
  error: number;
  debug: number;
}

export default function LogsDashboard({ initialFilter }: LogsDashboardProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [topUsers, setTopUsers] = useState<Array<{ userId: string; count: number }>>([]);
  const [topSources, setTopSources] = useState<Array<{ source: string; count: number }>>([]);
  const [trend, setTrend] = useState<Array<{ date: string; count: number; byLevel: Record<string, number> }>>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Colors for charts
  const COLORS = {
    info: '#3b82f6',    // blue
    warning: '#f59e0b',  // amber
    error: '#ef4444',    // red
    debug: '#6b7280',    // gray
    system: '#8b5cf6',   // violet
    workflow: '#10b981', // emerald
    user: '#f97316',     // orange
    form: '#06b6d4',     // cyan
    security: '#ec4899',  // pink
    integration: '#14b8a6' // teal
  };

  const PIE_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#6b7280', '#8b5cf6', '#10b981', '#f97316', '#06b6d4', '#ec4899', '#14b8a6'];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [analyticsData, usersData, sourcesData, trendData] = await Promise.all([
          getLogsAnalytics(initialFilter),
          getTopUsers(10),
          getTopSources(10),
          getLogsTrend(30)
        ]);
        
        setAnalytics(analyticsData);
        setTopUsers(usersData);
        setTopSources(sourcesData);
        setTrend(trendData);
      } catch (error) {
        console.error('Error fetching analytics data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [initialFilter]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Prepare data for charts
  const levelData: ChartDataItem[] = analytics ? Object.entries(analytics.byLevel).map(([level, count]) => ({
    name: level,
    value: count as number,
    color: COLORS[level as keyof typeof COLORS]
  })) : [];

  const categoryData: ChartDataItem[] = analytics ? Object.entries(analytics.byCategory).map(([category, count]) => ({
    name: category,
    value: count as number,
    color: COLORS[category as keyof typeof COLORS]
  })) : [];

  const trendData: TrendDataItem[] = trend.map(item => ({
    date: format(parseISO(item.date), 'MMM dd'),
    total: item.count,
    info: item.byLevel.info,
    warning: item.byLevel.warning,
    error: item.byLevel.error,
    debug: item.byLevel.debug
  }));

  const topUsersData: ChartDataItem[] = topUsers.map(item => ({
    name: item.userId,
    value: item.count
  }));

  const topSourcesData: ChartDataItem[] = topSources.map(item => ({
    name: item.source || 'unknown',
    value: item.count
  }));

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'debug':
        return <Bug className="h-4 w-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return <Badge variant="destructive">{level}</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-500/90">{level}</Badge>;
      case 'info':
        return <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-500/90">{level}</Badge>;
      case 'debug':
        return <Badge variant="secondary">{level}</Badge>;
      default:
        return <Badge>{level}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
            <div className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              System events recorded
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Logs</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.byLevel.error || 0}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.byLevel.error > 0 
                ? `${((analytics.byLevel.error / analytics.totalCount) * 100).toFixed(1)}% of total logs` 
                : 'No errors recorded'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(analytics?.byUser || {}).length}</div>
            <p className="text-xs text-muted-foreground">
              Users generating logs
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.recentActivity.filter((log: Log) => log.acknowledged).length || 0} / {analytics?.recentActivity.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Recent logs acknowledged
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different analytics views */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Logs by Level</CardTitle>
                <CardDescription>Distribution of logs by severity level</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={levelData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => 
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {levelData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Logs by Category</CardTitle>
                <CardDescription>Distribution of logs by category</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }: { name: string; percent: number }) => 
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Latest error logs that may require attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.topErrors.length > 0 ? (
                  analytics.topErrors.map((log: Log) => (
                    <div key={log.id} className="flex items-start space-x-3 p-3 border rounded-md">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-medium">{log.message}</div>
                        <div className="text-sm text-muted-foreground">
                          {log.source && <span className="mr-3">Source: {log.source}</span>}
                          {log.userId && <span className="mr-3">User: {log.userId}</span>}
                          <span>
                            <Clock className="inline h-3 w-3 mr-1" />
                            {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No errors found. That's great news!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Log Volume Over Time</CardTitle>
              <CardDescription>Daily log activity for the past 30 days</CardDescription>
            </CardHeader>
            <CardContent className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#8884d8" name="Total" strokeWidth={2} />
                  <Line type="monotone" dataKey="info" stroke={COLORS.info} name="Info" />
                  <Line type="monotone" dataKey="warning" stroke={COLORS.warning} name="Warning" />
                  <Line type="monotone" dataKey="error" stroke={COLORS.error} name="Error" />
                  <Line type="monotone" dataKey="debug" stroke={COLORS.debug} name="Debug" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Log Distribution by Level</CardTitle>
              <CardDescription>Daily breakdown by severity level</CardDescription>
            </CardHeader>
            <CardContent className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="info" stackId="a" fill={COLORS.info} name="Info" />
                  <Bar dataKey="warning" stackId="a" fill={COLORS.warning} name="Warning" />
                  <Bar dataKey="error" stackId="a" fill={COLORS.error} name="Error" />
                  <Bar dataKey="debug" stackId="a" fill={COLORS.debug} name="Debug" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Users</CardTitle>
              <CardDescription>Users generating the most logs</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topUsersData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3b82f6" name="Log Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>User Activity</CardTitle>
              <CardDescription>Recent logs by user</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.recentActivity
                  .filter((log: Log) => log.userId)
                  .slice(0, 5)
                  .map((log: Log) => (
                    <div key={log.id} className="flex items-start space-x-3 p-3 border rounded-md">
                      <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-medium">{log.userId}</div>
                        <div className="text-sm">
                          {getLevelBadge(log.level)}
                          <span className="ml-2">{log.message}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Sources Tab */}
        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Sources</CardTitle>
              <CardDescription>Components generating the most logs</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSourcesData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={150} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" name="Log Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Source Distribution</CardTitle>
              <CardDescription>Percentage of logs by source</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topSourcesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }: { name: string; percent: number }) => 
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {topSourcesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Distribution</CardTitle>
              <CardDescription>Errors by category and source</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={Object.entries(analytics?.byCategory || {}).map(([category, count]) => ({
                    name: category,
                    errors: analytics?.topErrors.filter((log: Log) => log.category === category).length || 0,
                    total: count
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="errors" fill="#ef4444" name="Errors" />
                  <Bar dataKey="total" fill="#3b82f6" name="Total Logs" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>All Errors</CardTitle>
              <CardDescription>Complete list of error logs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-auto">
                {analytics?.topErrors.length > 0 ? (
                  analytics.topErrors.map((log: Log) => (
                    <div key={log.id} className="flex items-start space-x-3 p-3 border rounded-md">
                      <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="space-y-1 w-full">
                        <div className="font-medium">{log.message}</div>
                        {log.details && (
                          <div className="text-sm whitespace-pre-wrap bg-muted p-2 rounded-md">
                            {log.details}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{log.category}</Badge>
                          {log.source && <span>Source: {log.source}</span>}
                          {log.userId && (
                            <span className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              {log.userId}
                            </span>
                          )}
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {format(new Date(log.createdAt), 'MMM dd, yyyy HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    No errors found. That's great news!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 