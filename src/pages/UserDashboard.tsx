import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { NotificationCenter } from "@/components/NotificationCenter";
import { BookingHistory } from "@/components/BookingHistory";
import { CalendarCheck, Clock, Package, Bell, User, Plus } from "lucide-react";
import { format } from "date-fns";

interface LaundryOrder {
  id: string;
  machine_id: string;
  machine_type: string;
  status: string;
  service_type: string;
  created_at: string;
  estimated_completion?: string;
}

const UserDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentOrder, setCurrentOrder] = useState<LaundryOrder | null>(null);
  const [recentOrders, setRecentOrders] = useState<LaundryOrder[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!profileError) {
          setProfile(profileData);
        }

        // Fetch current active order
        const { data: currentOrderData, error: currentError } = await supabase
          .from('laundry_orders')
          .select('*')
          .eq('user_id', user.id)
          .in('status', ['queued', 'washing', 'drying', 'ready_for_pickup'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (!currentError && currentOrderData && currentOrderData.length > 0) {
          setCurrentOrder(currentOrderData[0]);
        }

        // Fetch recent completed orders
        const { data: recentOrdersData, error: recentError } = await supabase
          .from('laundry_orders')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!recentError) {
          setRecentOrders(recentOrdersData || []);
        }
      } catch (error) {
        toast({
          title: "Error loading dashboard",
          description: "Please try refreshing the page",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to real-time order updates
    const channel = supabase
      .channel('user-orders')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'laundry_orders',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate, toast]);

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued': return <Clock className="h-4 w-4" />;
      case 'washing': return <Package className="h-4 w-4" />;
      case 'drying': return <Package className="h-4 w-4" />;
      case 'ready_for_pickup': return <Bell className="h-4 w-4" />;
      case 'completed': return <CalendarCheck className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar isLoggedIn={!!user} onLogin={() => navigate("/auth")} />
      
      <div className="flex-1 container py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                Welcome, {profile?.full_name || user?.email?.split('@')[0]}!
              </h1>
              <p className="text-muted-foreground">Manage your laundry orders and bookings</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Current Order Status */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      My Laundry Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {currentOrder ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-lg capitalize">
                              {currentOrder.service_type} • Machine {currentOrder.machine_id}
                            </h3>
                            <p className="text-muted-foreground">
                              Started {format(new Date(currentOrder.created_at), "PPpp")}
                            </p>
                          </div>
                          <Badge className={`${getStatusColor(currentOrder.status)} text-white flex items-center gap-1`}>
                            {getStatusIcon(currentOrder.status)}
                            {currentOrder.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${getStatusColor(currentOrder.status)}`}
                            style={{
                              width: currentOrder.status === 'queued' ? '25%' :
                                     currentOrder.status === 'washing' ? '50%' :
                                     currentOrder.status === 'drying' ? '75%' :
                                     currentOrder.status === 'ready_for_pickup' ? '100%' : '0%'
                            }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>Queued</span>
                          <span>Washing</span>
                          <span>Drying</span>
                          <span>Ready</span>
                        </div>

                        {currentOrder.estimated_completion && (
                          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                            <p className="text-sm">
                              <strong>Estimated completion:</strong> {format(new Date(currentOrder.estimated_completion), "PPpp")}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="font-semibold text-lg mb-2">No Active Laundry Orders</h3>
                        <p className="text-muted-foreground mb-4">
                          You don't have any laundry orders in progress
                        </p>
                        <Button onClick={() => navigate("/booking")} className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Book New Slot
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button 
                      onClick={() => navigate("/booking")} 
                      className="w-full flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Book New Laundry Slot
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => navigate("/")} 
                      className="w-full"
                    >
                      Check Machine Status
                    </Button>
                  </CardContent>
                </Card>

                {/* Recent Orders */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Orders</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentOrders.length > 0 ? (
                      <div className="space-y-3">
                        {recentOrders.map((order) => (
                          <div key={order.id} className="flex justify-between items-center p-2 rounded border">
                            <div>
                              <p className="font-medium text-sm capitalize">{order.service_type}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(order.created_at), "MMM dd")}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              Completed
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-4">
                        No recent orders
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>


          <TabsContent value="bookings">
            <BookingHistory />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationCenter />
          </TabsContent>
        </Tabs>
      </div>
      
      <Footer />
    </div>
  );
};

export default UserDashboard;