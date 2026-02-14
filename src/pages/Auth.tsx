
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Create profile entry
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            email: data.user.email,
            full_name: fullName,
            role: 'student'
          });

        if (profileError) {
          // Profile creation failed silently - user can still proceed
        }

        toast({
          title: "Account created successfully",
          description: "Welcome to Hostel LaundryLink!",
        });
        
        // Navigate to appropriate dashboard based on role
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Error creating account",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Get user profile to determine role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      toast({
        title: "Logged in successfully",
        description: "Welcome back to Hostel LaundryLink!",
      });
      
      // Navigate to appropriate dashboard based on role
      if (profile?.role === 'admin') {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Error signing in",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar isLoggedIn={false} onLogin={() => {}} />
      
      <div className="flex-1 container py-12 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <Tabs defaultValue="user-signin">
            <CardHeader>
              <CardTitle className="text-2xl text-center mb-4">Welcome to Hostel LaundryLink</CardTitle>
              <CardDescription className="text-center mb-4">
                Choose your login type
              </CardDescription>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="user-signin">User Login</TabsTrigger>
                <TabsTrigger value="admin-signin">Admin Login</TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <CardContent>
              <TabsContent value="user-signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="user-email">Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="user-password">Password</Label>
                    <Input
                      id="user-password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-laundry-500 hover:bg-laundry-600"
                    disabled={loading}
                  >
                    {loading ? "Signing in as User..." : "Sign In as User"}
                  </Button>
                  <p className="text-sm text-center text-muted-foreground mt-2">
                    Don't have an account? <button type="button" onClick={() => {}} className="text-laundry-500 hover:underline">Sign up below</button>
                  </p>
                </form>
              </TabsContent>

              <TabsContent value="admin-signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Admin Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="Enter admin email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Admin Password</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      placeholder="Enter admin password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-laundry-500 hover:bg-laundry-600"
                    disabled={loading}
                  >
                    {loading ? "Signing in as Admin..." : "Sign In as Admin"}
                  </Button>
                  <p className="text-sm text-center text-muted-foreground mt-2">
                    Admin access only
                  </p>
                </form>
              </TabsContent>
              
              <TabsContent value="signup" className="mt-6">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-center">Create User Account</h3>
                  <p className="text-sm text-center text-muted-foreground">Sign up to book laundry slots</p>
                </div>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Enter your password (min. 6 characters)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={6}
                      required
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full bg-laundry-500 hover:bg-laundry-600"
                    disabled={loading}
                  >
                    {loading ? "Creating account..." : "Sign Up as User"}
                  </Button>
                </form>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
      
      <Footer />
    </div>
  );
};

export default Auth;
