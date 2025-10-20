import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Video, CheckCircle2, Clock, Play, Sparkles, Zap, MessageSquare, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type WelcomeStatus = {
  hasWelcomeVideo: boolean;
  videoStatus: string | null;
  videoUrl: string | null;
  message: string;
  userName: string;
  userId: string;
};

export default function CustomerView() {
  const { toast } = useToast();
  
  const { data: status, isLoading } = useQuery<WelcomeStatus>({
    queryKey: ["/api/customer/welcome-status"],
  });

  const resetTestStatusMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/customer/reset-test-status", {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/welcome-status"] });
      toast({
        title: "Test status reset",
        description: "You can now test the welcome video again",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to reset status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const triggerTestVideoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/customer/trigger-test-video", {});
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customer/welcome-status"] });
      toast({
        title: "Video generation started",
        description: data.message || "Your personalized welcome video is being created. Check your DMs in 1-2 minutes.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate video",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusDisplay = () => {
    if (!status?.videoStatus) {
      return {
        icon: <Sparkles className="h-16 w-16 text-primary" />,
        title: "Welcome!",
        description: "Your personalized video message is being prepared",
        gradient: "from-primary/20 to-primary/5",
      };
    }

    switch (status.videoStatus) {
      case "sent":
      case "delivered":
        return {
          icon: <CheckCircle2 className="h-16 w-16 text-chart-2" />,
          title: "Video Sent!",
          description: "Check your Whop DMs to watch your personalized welcome video",
          gradient: "from-chart-2/20 to-chart-2/5",
        };
      case "generating":
      case "processing":
        return {
          icon: <Clock className="h-16 w-16 text-chart-3 animate-pulse" />,
          title: "Creating Your Video",
          description: "Your personalized video is being generated. This usually takes 1-2 minutes.",
          gradient: "from-chart-3/20 to-chart-3/5",
        };
      default:
        return {
          icon: <Video className="h-16 w-16 text-primary" />,
          title: "Welcome!",
          description: "A special message will be sent to your DMs soon",
          gradient: "from-primary/20 to-primary/5",
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full space-y-8">
          <div className="text-center space-y-4">
            <Skeleton className="h-12 w-64 mx-auto" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const statusDisplay = getStatusDisplay();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8 py-12">
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full"></div>
            <h1 className="relative text-4xl lg:text-5xl font-bold bg-gradient-to-r from-foreground via-primary to-primary/60 bg-clip-text text-transparent" data-testid="text-welcome-title">
              Welcome{status?.userName ? `, ${status.userName}` : ""}!
            </h1>
          </div>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto flex items-center justify-center gap-2" data-testid="text-welcome-subtitle">
            <Sparkles className="h-5 w-5 text-primary" />
            {status?.message || "We're excited to have you here"}
          </p>
        </div>

        <Card className={`border-primary/20 shadow-2xl bg-gradient-to-br ${statusDisplay.gradient} backdrop-blur-sm`}>
          <CardContent className="pt-12 pb-12">
            <div className="text-center space-y-6">
              <div className="flex justify-center relative">
                <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 blur-2xl rounded-full"></div>
                <div className="relative p-6 rounded-2xl bg-background/50 backdrop-blur-sm border border-primary/10">
                  {statusDisplay.icon}
                </div>
              </div>
              
              <div className="space-y-3">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent" data-testid="text-status-title">
                  {statusDisplay.title}
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto text-lg">
                  {statusDisplay.description}
                </p>
              </div>

              {status?.videoStatus === "sent" || status?.videoStatus === "delivered" ? (
                <div className="pt-6">
                  <div className="inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-gradient-to-r from-chart-2/20 to-chart-2/10 border border-chart-2/30 text-chart-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">Video successfully delivered</span>
                  </div>
                </div>
              ) : status?.videoStatus === "generating" || status?.videoStatus === "processing" ? (
                <div className="pt-6">
                  <div className="inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-gradient-to-r from-chart-3/20 to-chart-3/10 border border-chart-3/30 text-chart-3 animate-pulse">
                    <Clock className="h-5 w-5" />
                    <span className="font-semibold">Video being created...</span>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-primary/10 hover-elevate transition-all duration-300 group">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Play className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">Test Welcome Video</CardTitle>
              </div>
              <CardDescription>
                Generate a personalized video to see how it works
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => triggerTestVideoMutation.mutate()}
                disabled={triggerTestVideoMutation.isPending || status?.videoStatus === "generating"}
                className="w-full"
                size="lg"
                data-testid="button-trigger-test-video"
              >
                {triggerTestVideoMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : status?.videoStatus === "generating" ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-pulse" />
                    Video Being Generated...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Generate Test Video
                  </>
                )}
              </Button>
              
              {(status?.videoStatus === "generating" || status?.hasWelcomeVideo) && (
                <Button
                  onClick={() => resetTestStatusMutation.mutate()}
                  disabled={resetTestStatusMutation.isPending}
                  variant="outline"
                  size="sm"
                  className="w-full"
                  data-testid="button-reset-test-status"
                >
                  {resetTestStatusMutation.isPending ? "Resetting..." : "Reset Test Status"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/10 hover-elevate transition-all duration-300 group">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-chart-2/10 group-hover:bg-chart-2/20 transition-colors">
                  <Gift className="h-5 w-5 text-chart-2" />
                </div>
                <CardTitle className="text-lg">What to Expect</CardTitle>
              </div>
              <CardDescription>
                How our AI welcome videos work
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="p-1 rounded-md bg-chart-2/20">
                    <MessageSquare className="h-4 w-4 text-chart-2 flex-shrink-0" />
                  </div>
                  <span className="text-sm">Personalized video message in your DMs</span>
                </li>
                <li className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="p-1 rounded-md bg-chart-2/20">
                    <Sparkles className="h-4 w-4 text-chart-2 flex-shrink-0" />
                  </div>
                  <span className="text-sm">AI avatar welcomes you by name</span>
                </li>
                <li className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="p-1 rounded-md bg-chart-2/20">
                    <Zap className="h-4 w-4 text-chart-2 flex-shrink-0" />
                  </div>
                  <span className="text-sm">Delivered automatically to Whop messages</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
