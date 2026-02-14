import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { CalendarCheck, Clock, MapPin, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface Booking {
  id: string;
  booking_date: string;
  time_slot: string;
  service_type: string;
  machine_id: string;
  status: string;
  cost: number;
  created_at: string;
}

export const BookingHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchBookings = async () => {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('user_id', user.id)
          .order('booking_date', { ascending: false });

        if (error) throw error;
        setBookings(data || []);
      } catch (error: any) {
        toast({
          title: "Error loading bookings",
          description: "Failed to load your bookings. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();

    // Subscribe to real-time booking updates
    const channel = supabase
      .channel('user-bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  const cancelBooking = async (bookingId: string) => {
    try {
      setDeleting(bookingId);
      
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId)
        .eq('user_id', user?.id); // Ensure user can only delete their own bookings

      if (error) throw error;

      setBookings(prev => prev.filter(booking => booking.id !== bookingId));
      
      toast({
        title: "Booking cancelled",
        description: "Your booking has been successfully cancelled",
      });
    } catch (error: any) {
      toast({
        title: "Error cancelling booking",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'upcoming':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const isUpcoming = (booking: Booking) => {
    const bookingDateTime = new Date(`${booking.booking_date}T${booking.time_slot.split(' - ')[0]}`);
    return bookingDateTime > new Date() && booking.status === 'Upcoming';
  };

  const groupBookingsByDate = (bookings: Booking[]) => {
    return bookings.reduce((groups, booking) => {
      const date = booking.booking_date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(booking);
      return groups;
    }, {} as Record<string, Booking[]>);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const groupedBookings = groupBookingsByDate(bookings);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5" />
          My Bookings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {bookings.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedBookings).map(([date, dateBookings]) => (
              <div key={date}>
                <h3 className="font-semibold text-lg mb-3 text-primary">
                  {format(new Date(date), "EEEE, MMMM d, yyyy")}
                </h3>
                <div className="space-y-3">
                  {dateBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Clock className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-lg">{booking.service_type}</h4>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {booking.time_slot}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                Machine {booking.machine_id}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={`${getStatusColor(booking.status)} text-white`}>
                            {booking.status}
                          </Badge>
                          {booking.cost > 0 && (
                            <span className="font-semibold text-primary">
                              ₹{booking.cost}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          Booked on {format(new Date(booking.created_at), "PPp")}
                        </p>
                        
                        {isUpcoming(booking) && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => cancelBooking(booking.id)}
                            disabled={deleting === booking.id}
                            className="flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            {deleting === booking.id ? "Cancelling..." : "Cancel"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CalendarCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No bookings yet</h3>
            <p className="text-muted-foreground">
              Your booking history will appear here once you make your first booking
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};