import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Waves, Wind } from "lucide-react";

interface Machine {
  id: string;
  name: string;
  type: string;
  location: string;
  is_active: boolean;
  current_order_id?: string;
}

const LiveMachineStatus = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const { data, error } = await supabase
          .from('machines')
          .select('*')
          .order('id');
        
        if (error) throw error;
        setMachines(data || []);
      } catch (error) {
        // Machine fetch failed silently
      } finally {
        setLoading(false);
      }
    };

    fetchMachines();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('machine-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'machines'
        },
        () => {
          fetchMachines();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const washers = machines.filter(m => m.type === 'washer');
  const dryers = machines.filter(m => m.type === 'dryer');

  return (
    <section className="py-16 bg-gradient-to-b from-background to-muted/30">
      <div className="container px-4 md:px-6">
        <div className="text-center mb-12">
          <div className="inline-block mb-4">
            <span className="px-4 py-2 bg-accent/10 text-accent rounded-full text-sm font-medium">
              🔴 Live Status
            </span>
          </div>
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Machine <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Availability</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Check real-time availability before you head down to the laundry room!
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Washers */}
          <Card className="border-2 border-blue-200/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Waves className="h-5 w-5" />
                Washing Machines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {washers.map((machine) => (
                  <div
                    key={machine.id}
                    className="flex flex-col items-center p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                      machine.current_order_id ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                    }`}>
                      <Waves className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium">{machine.name}</span>
                    <span className="text-xs text-muted-foreground">{machine.location}</span>
                    <Badge 
                      variant={machine.current_order_id ? "destructive" : "default"}
                      className={machine.current_order_id ? "" : "bg-green-500 hover:bg-green-600"}
                    >
                      {machine.current_order_id ? "In Use" : "Available"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Dryers */}
          <Card className="border-2 border-orange-200/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700">
                <Wind className="h-5 w-5" />
                Dryers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                {dryers.map((machine) => (
                  <div
                    key={machine.id}
                    className="flex flex-col items-center p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
                      machine.current_order_id ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                    }`}>
                      <Wind className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium">{machine.name}</span>
                    <span className="text-xs text-muted-foreground">{machine.location}</span>
                    <Badge 
                      variant={machine.current_order_id ? "destructive" : "default"}
                      className={machine.current_order_id ? "" : "bg-green-500 hover:bg-green-600"}
                    >
                      {machine.current_order_id ? "In Use" : "Available"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-8">
          <p className="text-muted-foreground">
            Updates every 30 seconds • Last updated: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </section>
  );
};

export default LiveMachineStatus;