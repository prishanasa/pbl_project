import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Wallet, Plus, Minus, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

interface WalletData {
  id: string;
  balance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export const WalletSystem = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchWalletData = async () => {
      try {
        // Fetch wallet
        const { data: walletData, error: walletError } = await supabase
          .from('user_wallets')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (walletError && walletError.code !== 'PGRST116') {
          throw walletError;
        }

        if (walletData) {
          setWallet(walletData);
        }

        // Fetch transactions
        const { data: transactionsData, error: transactionsError } = await supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!transactionsError) {
          setTransactions(transactionsData || []);
        }
      } catch (error: any) {
        console.error('Error fetching wallet data:', error);
        toast({
          title: "Error loading wallet",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWalletData();

    // Subscribe to real-time wallet updates
    const channel = supabase
      .channel('wallet-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchWalletData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  const addMoney = async (amount: number) => {
    if (!user || !wallet) return;

    try {
      // Use atomic database function to prevent race conditions
      const { data, error } = await supabase.rpc('add_wallet_funds', {
        p_wallet_id: wallet.id,
        p_user_id: user.id,
        p_amount: amount,
        p_description: `Added ₹${amount} to wallet`
      });

      if (error) throw error;

      toast({
        title: "Money added successfully!",
        description: `₹${amount} has been added to your wallet`,
      });

      // Update local state with new balance from server
      setWallet({ ...wallet, balance: data as number });
    } catch (error: any) {
      toast({
        title: "Error adding money",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-8 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Wallet Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Laundry Wallet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-3xl font-bold text-primary">
                ₹{wallet?.balance?.toFixed(2) || '0.00'}
              </p>
              <p className="text-muted-foreground">Available Balance</p>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={() => addMoney(100)} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add ₹100
              </Button>
              <Button onClick={() => addMoney(200)} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add ₹200
              </Button>
              <Button onClick={() => addMoney(500)} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add ₹500
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length > 0 ? (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      transaction.type === 'credit' ? 'bg-green-100' : 'bg-red-100'
                    }`}>
                      {transaction.type === 'credit' ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(transaction.created_at), "PPpp")}
                      </p>
                    </div>
                  </div>
                  <Badge variant={transaction.type === 'credit' ? 'default' : 'destructive'}>
                    {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              No transactions yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};