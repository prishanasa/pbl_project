import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { QrCode, Camera, X } from 'lucide-react';
import QrScanner from 'qr-scanner';

interface Machine {
  id: string;
  name: string;
  type: string;
  status: string;
  qr_code: string;
}

export const QRCodeScanner = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [machine, setMachine] = useState<Machine | null>(null);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);

  const startScanning = async () => {
    if (!videoRef.current) return;

    try {
      setScanning(true);
      
      scannerRef.current = new QrScanner(
        videoRef.current,
        async (result) => {
          await handleQRCodeResult(result.data);
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );

      await scannerRef.current.start();
    } catch (error: any) {
      toast({
        title: "Camera access denied",
        description: "Please allow camera access to scan QR codes",
        variant: "destructive",
      });
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleQRCodeResult = async (qrData: string) => {
    try {
      setLoading(true);
      stopScanning();

      // Find machine by QR code
      const { data: machineData, error: machineError } = await supabase
        .from('machines')
        .select('*')
        .eq('qr_code', qrData)
        .single();

      if (machineError) {
        toast({
          title: "Invalid QR Code",
          description: "This QR code is not associated with any machine",
          variant: "destructive",
        });
        return;
      }

      if (machineData.status !== 'Available') {
        toast({
          title: "Machine unavailable",
          description: `Machine ${machineData.name} is currently ${machineData.status}`,
          variant: "destructive",
        });
        return;
      }

      setMachine(machineData);
      toast({
        title: "Machine scanned successfully!",
        description: `Ready to start laundry on ${machineData.name}`,
      });
    } catch (error: any) {
      toast({
        title: "Error processing QR code",
        description: "Could not process the QR code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startLaundryProcess = async () => {
    if (!user || !machine) return;

    try {
      setLoading(true);

      // Use atomic RPC to create order and update machine status
      const { data, error } = await supabase.rpc('start_laundry_order', {
        p_machine_id: machine.id,
        p_service_type: 'Quick Wash',
      });

      if (error) throw error;

      toast({
        title: "Laundry started!",
        description: `Your laundry has started on ${machine.name}. Estimated completion in 45 minutes.`,
      });

      setMachine(null);
    } catch (error: any) {
      toast({
        title: "Error starting laundry",
        description: "Could not start laundry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          QR Code Scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!scanning && !machine && (
          <div className="text-center space-y-4">
            <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg">
              <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Scan a machine's QR code to start your laundry
              </p>
              <Button onClick={startScanning} className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Start Scanning
              </Button>
            </div>
          </div>
        )}

        {scanning && (
          <div className="space-y-4">
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full rounded-lg border"
                style={{ maxHeight: '300px' }}
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2"
                onClick={stopScanning}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-center text-muted-foreground">
              Point your camera at the machine's QR code
            </p>
          </div>
        )}

        {machine && (
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold text-lg">{machine.name}</h3>
              <p className="text-muted-foreground">Type: {machine.type}</p>
              <p className="text-green-600 font-medium">Status: {machine.status}</p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={startLaundryProcess}
                disabled={loading}
                className="flex-1"
              >
                {loading ? "Starting..." : "Start Laundry"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setMachine(null)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};