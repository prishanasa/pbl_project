import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, Users, Package, DollarSign, Clock } from 'lucide-react';

interface AnalyticsData {
  peakHours: { hour: string; bookings: number }[];
  popularMachines: { machine: string; usage: number }[];
  monthlyBookings: { month: string; bookings: number; revenue: number }[];
  serviceStats: { service: string; count: number; revenue: number }[];
  totalStats: {
    totalBookings: number;
    totalUsers: number;
    totalRevenue: number;
    averageBookingTime: number;
  };
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1'];

export const AdminAnalytics = () => {
  const { toast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Fetch bookings data
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*');

        if (bookingsError) throw bookingsError;

        // Fetch users data
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student');

        if (usersError) throw usersError;

        // Process peak hours data
        const hourCounts: Record<string, number> = {};
        bookingsData?.forEach(booking => {
          const hour = booking.time_slot.split(' - ')[0];
          hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        const peakHours = Object.entries(hourCounts)
          .map(([hour, count]) => ({ hour, bookings: count }))
          .sort((a, b) => a.hour.localeCompare(b.hour));

        // Process popular machines data
        const machineCounts: Record<string, number> = {};
        bookingsData?.forEach(booking => {
          const machine = `Machine ${booking.machine_id}`;
          machineCounts[machine] = (machineCounts[machine] || 0) + 1;
        });

        const popularMachines = Object.entries(machineCounts)
          .map(([machine, count]) => ({ machine, usage: count }))
          .sort((a, b) => b.usage - a.usage)
          .slice(0, 5);

        // Process monthly bookings (last 6 months)
        const monthlyData: Record<string, { bookings: number; revenue: number }> = {};
        const currentDate = new Date();
        
        for (let i = 5; i >= 0; i--) {
          const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
          const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          monthlyData[monthKey] = { bookings: 0, revenue: 0 };
        }

        bookingsData?.forEach(booking => {
          const bookingDate = new Date(booking.created_at);
          const monthKey = bookingDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          if (monthlyData[monthKey]) {
            monthlyData[monthKey].bookings++;
            monthlyData[monthKey].revenue += booking.cost || 0;
          }
        });

        const monthlyBookings = Object.entries(monthlyData)
          .map(([month, data]) => ({ month, ...data }));

        // Process service statistics
        const serviceCounts: Record<string, { count: number; revenue: number }> = {};
        bookingsData?.forEach(booking => {
          const service = booking.service_type;
          if (!serviceCounts[service]) {
            serviceCounts[service] = { count: 0, revenue: 0 };
          }
          serviceCounts[service].count++;
          serviceCounts[service].revenue += booking.cost || 0;
        });

        const serviceStats = Object.entries(serviceCounts)
          .map(([service, stats]) => ({ service, ...stats }))
          .sort((a, b) => b.count - a.count);

        // Calculate total stats
        const totalBookings = bookingsData?.length || 0;
        const totalUsers = usersData?.length || 0;
        const totalRevenue = bookingsData?.reduce((sum, booking) => sum + (booking.cost || 0), 0) || 0;
        const averageBookingTime = 45; // Assuming 45 minutes average

        setData({
          peakHours,
          popularMachines,
          monthlyBookings,
          serviceStats,
          totalStats: {
            totalBookings,
            totalUsers,
            totalRevenue,
            averageBookingTime
          }
        });
      } catch (error: any) {
        toast({
          title: "Error loading analytics",
          description: "Failed to load analytics data. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [toast]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalStats.totalBookings}</div>
            <p className="text-xs text-muted-foreground">All time bookings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{data.totalStats.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">From all bookings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Cycle Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalStats.averageBookingTime}m</div>
            <p className="text-xs text-muted-foreground">Per laundry cycle</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Peak Hours Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Peak Laundry Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.peakHours}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="bookings" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Popular Machines Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Most Used Machines</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.popularMachines}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ machine, usage }) => `${machine}: ${usage}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="usage"
                >
                  {data.popularMachines.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Bookings Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Bookings Trend (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.monthlyBookings}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="bookings" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Service Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Service Popularity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.serviceStats} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="service" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};