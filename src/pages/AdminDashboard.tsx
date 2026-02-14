import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AdminAnalytics } from "@/components/AdminAnalytics";
import { Shield, Users, Package, AlertCircle, RefreshCw, BarChart3 } from "lucide-react";
import { format } from "date-fns";

interface LaundryOrder {
  id: string;
  user_id: string;
  machine_id: string;
  machine_type: string;
  status: string;
  service_type: string;
  created_at: string;
  estimated_completion?: string;
  profiles?: any;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [updating, setUpdating] = useState<string | null>(null);
  const [pendingBookings, setPendingBookings] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const checkAdminAndFetchData = async () => {
      try {
        // Check if user is admin
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError || profile?.role !== 'admin') {
          toast({
            title: "Access denied",
            description: "You don't have permission to access the admin dashboard",
            variant: "destructive",
          });
          navigate("/dashboard");
          return;
        }

        setIsAdmin(true);

        // Fetch active orders with user profiles
        const { data: ordersData, error: ordersError } = await supabase
          .from('laundry_orders')
          .select(`
            *,
            profiles!inner(full_name, email)
          `)
          .in('status', ['queued', 'washing', 'drying', 'ready_for_pickup'])
          .order('created_at', { ascending: false });

        if (!ordersError) {
          setActiveOrders(ordersData || []);
        }

        // Fetch all users
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (!usersError) {
          setAllUsers(usersData || []);
        }

        // Fetch pending bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            *,
            profiles!inner(full_name, email)
          `)
          .order('created_at', { ascending: false });

        if (!bookingsError) {
          setPendingBookings(bookingsData || []);
        }

      } catch (error) {
        toast({
          title: "Error loading admin dashboard",
          description: "Please try refreshing the page.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    checkAdminAndFetchData();

    // Subscribe to real-time order updates
    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'laundry_orders'
        },
        () => {
          checkAdminAndFetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate, toast]);

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    setUpdating(bookingId);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: "Booking status updated",
        description: `Booking has been ${newStatus.toLowerCase()}`,
      });

      // Refresh bookings
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select(`
          *,
          profiles!inner(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (bookingsData) {
        setPendingBookings(bookingsData);
      }
    } catch (error: any) {
      toast({
        title: "Error updating booking",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdating(orderId);
    try {
      const { error } = await supabase
        .from('laundry_orders')
        .update({ 
          status: newStatus as any,
          ...(newStatus === 'completed' && { actual_completion: new Date().toISOString() })
        })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Order updated",
        description: `Status changed to ${newStatus.replace('_', ' ')}`,
      });
    } catch (error: any) {
      toast({
        title: "Error updating order",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'bg-yellow-500';
      case 'washing': return 'bg-blue-500';
      case 'drying': return 'bg-orange-500';
      case 'ready_for_pickup': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // This will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar isLoggedIn={!!user} onLogin={() => navigate("/auth")} />
      
      <div className="flex-1 container py-8">
        {/* Admin Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-red-100">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage all laundry operations and users</p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                Orders currently in progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{allUsers.filter(u => u.role === 'student').length}</div>
              <p className="text-xs text-muted-foreground">
                Registered student accounts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Attention Needed</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activeOrders.filter(o => o.status === 'ready_for_pickup').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Orders ready for pickup
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="bookings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bookings">Booking Approvals</TabsTrigger>
            <TabsTrigger value="dashboard">Active Orders</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Recent Bookings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Machine</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingBookings.length > 0 ? (
                      pendingBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{booking.profiles?.full_name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">{booking.profiles?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>{booking.service_type}</TableCell>
                          <TableCell>{booking.machine_id}</TableCell>
                          <TableCell>
                            <div>
                              <p>{format(new Date(booking.booking_date), 'MMM dd, yyyy')}</p>
                              <p className="text-sm text-muted-foreground">{booking.time_slot}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={booking.status === 'Approved' ? 'default' : booking.status === 'Rejected' ? 'destructive' : 'secondary'}>
                              {booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {booking.status === 'Upcoming' && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => updateBookingStatus(booking.id, 'Approved')}
                                    disabled={updating === booking.id}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => updateBookingStatus(booking.id, 'Rejected')}
                                    disabled={updating === booking.id}
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}
                              {booking.status !== 'Upcoming' && (
                                <span className="text-sm text-muted-foreground">
                                  {booking.status === 'Approved' ? 'Approved' : 'Rejected'}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No bookings found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Active Orders Management */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Active Laundry Orders
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activeOrders.length > 0 ? (
                      <div className="space-y-4">
                        {activeOrders.map((order) => (
                          <div key={order.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-semibold">
                                  {order.profiles?.full_name || 'Unknown Student'}
                                </h4>
                                <p className="text-sm text-muted-foreground">
                                  {order.profiles?.email}
                                </p>
                                <p className="text-sm font-medium mt-1">
                                  Machine {order.machine_id} • {order.service_type}
                                </p>
                              </div>
                              <Badge className={`${getStatusColor(order.status)} text-white`}>
                                {order.status.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Select
                                value={order.status}
                                onValueChange={(value) => updateOrderStatus(order.id, value)}
                                disabled={updating === order.id}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="queued">Queued</SelectItem>
                                  <SelectItem value="washing">Washing</SelectItem>
                                  <SelectItem value="drying">Drying</SelectItem>
                                  <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                              
                              {updating === order.id && (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              )}
                            </div>
                            
                            <p className="text-xs text-muted-foreground mt-2">
                              Started: {format(new Date(order.created_at), "PPpp")}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No active orders</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* User Management */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      User Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Joined</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allUsers.filter(u => u.role === 'student').slice(0, 8).map((user) => (
                            <TableRow key={user.id}>
                              <TableCell className="font-medium">
                                {user.full_name || 'Unknown'}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {user.email}
                              </TableCell>
                              <TableCell className="text-sm">
                                {format(new Date(user.created_at), "MMM dd, yyyy")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {allUsers.length > 8 && (
                        <p className="text-sm text-muted-foreground text-center">
                          Showing 8 of {allUsers.length} users
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <AdminAnalytics />
          </TabsContent>
        </Tabs>
      </div>
      
      <Footer />
    </div>
  );
};

export default AdminDashboard;