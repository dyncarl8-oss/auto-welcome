import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import OnboardingWizard from "@/components/OnboardingWizard";
import { 
  Settings, 
  Users, 
  Upload, 
  Video, 
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Music,
  TrendingUp,
  Send,
  Sparkles,
  Zap,
  Info,
  FileImage,
  FileAudio,
  RotateCcw
} from "lucide-react";

type Creator = {
  id: string;
  whopUserId: string;
  whopCompanyId: string | null;
  messageTemplate: string;
  heygenAvatarGroupId: string | null;
  heygenAvatarLookId: string | null;
  avatarPhotoUrl: string | null;
  audioFileUrl: string | null;
  fishAudioModelId: string | null;
  useAudioForGeneration: boolean;
  voiceId: string | null;
  isSetupComplete: boolean;
  createdAt: string;
  updatedAt: string;
};

type Customer = {
  id: string;
  whopUserId: string;
  name: string;
  email: string | null;
  username: string | null;
  planName: string | null;
  joinedAt: string;
  firstVideoSent: boolean;
  videos: {
    id: string;
    status: string;
    videoUrl: string | null;
    createdAt: string;
    sentAt: string | null;
    errorMessage: string | null;
    whopChatId: string | null;
    whopMessageId: string | null;
  }[];
};

type Analytics = {
  totalCustomers: number;
  totalVideos: number;
  videosSent: number;
  videosViewed: number;
  videosPending: number;
  videosFailed: number;
  totalViews: number;
  averageViewsPerVideo: number;
  recentVideos: any[];
};

interface AdminDashboardProps {
  userName?: string | null;
  experienceId?: string;
}

export default function AdminDashboard({ userName, experienceId }: AdminDashboardProps) {
  const { toast } = useToast();
  const [messageTemplate, setMessageTemplate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);

  const { data: creator, isLoading: creatorLoading, error: creatorError } = useQuery<Creator>({
    queryKey: ["/api/admin/creator"],
  });

  const initCreatorMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/initialize", { experienceId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creator"] });
      toast({
        title: "Setup initialized",
        description: "Your AutoWelcome AI account has been created.",
      });
    },
  });

  // Auto-initialize company ID if creator exists but doesn't have one
  useEffect(() => {
    if (creator && !creator.whopCompanyId && experienceId && !initCreatorMutation.isPending) {
      console.log("Auto-initializing creator with company ID...");
      initCreatorMutation.mutate();
    }
  }, [creator, experienceId]);

  useEffect(() => {
    if (creator) {
      setMessageTemplate(creator.messageTemplate || "");
      setPreviewUrl(creator.avatarPhotoUrl || "");
    }
  }, [creator]);

  useEffect(() => {
    if (selectedFile) {
      const objectUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (creator?.avatarPhotoUrl) {
      setPreviewUrl(creator.avatarPhotoUrl);
    }
  }, [selectedFile, creator?.avatarPhotoUrl]);

  const { data: customersData, isLoading: customersLoading } = useQuery<{ customers: Customer[] }>({
    queryKey: ["/api/admin/customers"],
    enabled: !!creator,
  });

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ["/api/admin/analytics"],
    enabled: !!creator,
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const userToken = localStorage.getItem('whop-user-token');
      const res = await fetch('/api/admin/upload-avatar', {
        method: 'POST',
        headers: {
          'x-whop-user-token': userToken || '',
        },
        body: formData,
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creator"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadAudioMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('audio', file);
      
      const userToken = localStorage.getItem('whop-user-token');
      const res = await fetch('/api/admin/upload-audio', {
        method: 'POST',
        headers: {
          'x-whop-user-token': userToken || '',
        },
        body: formData,
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Audio upload failed');
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creator"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: { messageTemplate: string }) => {
      const res = await apiRequest("POST", "/api/admin/save-settings", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creator"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetOnboardingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/reset-onboarding", {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/creator"] });
      setSelectedFile(null);
      setSelectedAudioFile(null);
      setPreviewUrl("");
      toast({
        title: "Onboarding reset",
        description: "You can now go through the setup wizard again.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Reset failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file (JPG, PNG, etc.)",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      // Create preview URL immediately
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('audio/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an audio file (MP3, WAV, etc.)",
          variant: "destructive",
        });
        return;
      }
      setSelectedAudioFile(file);
    }
  };

  const handleSaveSettings = async () => {
    try {
      if (selectedFile) {
        await uploadAvatarMutation.mutateAsync(selectedFile);
        setSelectedFile(null);
        toast({
          title: "Avatar uploaded",
          description: "Your avatar photo has been saved successfully.",
        });
      }

      if (selectedAudioFile) {
        await uploadAudioMutation.mutateAsync(selectedAudioFile);
        setSelectedAudioFile(null);
        toast({
          title: "Voice model created",
          description: "Your AI voice model has been trained successfully.",
        });
      }

      await saveSettingsMutation.mutateAsync({
        messageTemplate,
      });

      toast({
        title: "Setup complete!",
        description: "Your AI avatar is ready to send welcome videos to new members.",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const triggerVideoMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const res = await apiRequest("POST", "/api/admin/trigger-video-for-customer", { customerId });
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      toast({
        title: "Video generation started",
        description: data.message || "The video will be sent automatically when ready.",
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return <Badge className="gap-1" data-testid={`badge-status-${status}`}><CheckCircle2 className="h-3 w-3" />Sent</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1" data-testid={`badge-status-${status}`}><XCircle className="h-3 w-3" />Failed</Badge>;
      case "generating":
      case "processing":
        return <Badge variant="secondary" className="gap-1" data-testid={`badge-status-${status}`}><Clock className="h-3 w-3" />Generating</Badge>;
      default:
        return <Badge variant="outline" className="gap-1" data-testid={`badge-status-${status}`}><AlertCircle className="h-3 w-3" />Pending</Badge>;
    }
  };

  if (creatorLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!creator && !creatorLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full border-primary/20 shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                <div className="relative bg-gradient-to-br from-primary to-primary/60 p-4 rounded-2xl">
                  <Sparkles className="h-12 w-12 text-primary-foreground" />
                </div>
              </div>
            </div>
            <CardTitle className="text-3xl">Welcome to AutoWelcome AI</CardTitle>
            <CardDescription className="text-base">
              Let's get started by initializing your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <p className="text-muted-foreground text-center">
                AutoWelcome AI automatically generates personalized HeyGen video messages for new members joining your Whop community.
              </p>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <Zap className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Automated welcome videos for every new member</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>AI-powered personalization with your avatar</span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <Video className="h-5 w-5 text-primary flex-shrink-0" />
                  <span>Delivered directly to Whop DMs</span>
                </div>
              </div>
              <Button
                onClick={() => initCreatorMutation.mutate()}
                disabled={initCreatorMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="button-init-account"
              >
                {initCreatorMutation.isPending ? "Initializing..." : "Initialize Account"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!creator?.isSetupComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                <div className="relative bg-gradient-to-br from-primary to-primary/60 p-4 rounded-2xl">
                  <Sparkles className="h-10 w-10 text-primary-foreground" />
                </div>
              </div>
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold mb-2" data-testid="text-admin-title">
              {userName ? `Welcome, ${userName}` : "Welcome"}
            </h1>
            <p className="text-muted-foreground text-lg">
              Let's set up your AI avatar in 3 simple steps
            </p>
          </div>
          
          <OnboardingWizard
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            previewUrl={previewUrl}
            setPreviewUrl={setPreviewUrl}
            selectedAudioFile={selectedAudioFile}
            setSelectedAudioFile={setSelectedAudioFile}
            messageTemplate={messageTemplate}
            setMessageTemplate={setMessageTemplate}
            onComplete={handleSaveSettings}
            isUploading={uploadAvatarMutation.isPending || uploadAudioMutation.isPending || saveSettingsMutation.isPending}
            onFileSelect={handleFileSelect}
            onAudioFileSelect={handleAudioFileSelect}
            existingAvatarUrl={creator?.avatarPhotoUrl}
            existingAudioUrl={creator?.audioFileUrl}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold mb-2" data-testid="text-admin-title">
            {userName ? `Welcome back, ${userName}` : "Dashboard"}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Manage automated welcome videos
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
        {analyticsLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </>
        ) : (
          <>
            <Card className="border-primary/10 hover-elevate transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Members
                </CardTitle>
                <div className="p-2 rounded-md bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent" data-testid="stat-total-customers">
                    {analyticsData?.totalCustomers || 0}
                  </div>
                  {analyticsData?.newMembersThisWeek ? (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-chart-2/15">
                      <span className="text-sm font-bold text-chart-2">+{analyticsData.newMembersThisWeek}</span>
                    </div>
                  ) : null}
                </div>
                {analyticsData?.newMembersThisWeek ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {analyticsData.newMembersThisWeek} new this week
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-primary/10 hover-elevate transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Videos Delivered
                </CardTitle>
                <div className="p-2 rounded-md bg-chart-2/10">
                  <Send className="h-4 w-4 text-chart-2" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent" data-testid="stat-videos-sent">
                  {analyticsData?.videosSent || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  of {analyticsData?.totalVideos || 0} generated
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/10 hover-elevate transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Success Rate
                </CardTitle>
                <div className="p-2 rounded-md bg-chart-2/10">
                  <TrendingUp className="h-4 w-4 text-chart-2" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-chart-2" data-testid="stat-delivery-rate">
                  {analyticsData?.deliveryRate || "0%"}
                </div>
                {analyticsData && analyticsData.videosFailed > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    {analyticsData.videosFailed} failed
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Tabs defaultValue="customers" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="customers" data-testid="tab-customers" className="gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <div className="p-4 rounded-lg bg-gradient-to-r from-chart-2/10 to-chart-2/5 border border-chart-2/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-chart-2/20">
                  <CheckCircle2 className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <span className="font-semibold text-chart-2">Avatar Ready</span>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Your AI avatar is configured and ready to generate videos
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resetOnboardingMutation.mutate()}
                disabled={resetOnboardingMutation.isPending}
                data-testid="button-reset-setup"
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                {resetOnboardingMutation.isPending ? "Resetting..." : "Reset Setup"}
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-primary/10 hover-elevate transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileImage className="h-5 w-5 text-primary" />
                  Avatar Photo
                </CardTitle>
                <CardDescription>
                  Upload a clear, front-facing photo for AI avatar creation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(previewUrl || creator?.avatarPhotoUrl) && (
                  <div className="relative w-40 h-40 rounded-lg overflow-hidden border-2 border-primary/20 mx-auto shadow-xl ring-4 ring-primary/10">
                    <img 
                      src={previewUrl || creator?.avatarPhotoUrl || ""} 
                      alt="Avatar preview" 
                      className="w-full h-full object-cover"
                      data-testid="img-avatar-preview"
                      onError={(e) => {
                        console.error("Avatar image failed to load:", previewUrl || creator?.avatarPhotoUrl);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    {selectedFile && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-primary/90 backdrop-blur-sm gap-1">
                          <Sparkles className="h-3 w-3" />
                          New
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
                
                <input
                  id="avatar-file"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="input-avatar-file"
                  onChange={handleFileSelect}
                />
                
                <Button 
                  variant={creator?.avatarPhotoUrl || selectedFile ? "outline" : "default"}
                  className={`w-full ${!creator?.avatarPhotoUrl && !selectedFile ? 'border-dashed border-2 h-24' : ''}`}
                  onClick={() => document.getElementById('avatar-file')?.click()}
                  data-testid="button-choose-avatar"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-5 w-5" />
                    <div>
                      <p className="font-medium">
                        {creator?.avatarPhotoUrl || selectedFile ? 'Replace Avatar' : 'Choose Avatar Photo'}
                      </p>
                      {(!creator?.avatarPhotoUrl && !selectedFile) && (
                        <p className="text-xs text-muted-foreground">JPG, PNG, GIF, WebP (max 10MB)</p>
                      )}
                    </div>
                  </div>
                </Button>

                {selectedFile && (
                  <div className="p-3 rounded-md bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{selectedFile.name}</span>
                      <Badge variant="outline" className="ml-auto">Ready</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Click "Save All Settings" below to upload this avatar
                    </p>
                  </div>
                )}

                {creator?.avatarPhotoUrl && !selectedFile && (
                  <div className="p-3 rounded-md bg-chart-2/10 border border-chart-2/20">
                    <div className="flex items-center gap-2 text-chart-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Avatar uploaded and active</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/10 hover-elevate transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileAudio className="h-5 w-5 text-primary" />
                  AI Voice Training
                </CardTitle>
                <CardDescription>
                  Upload an audio sample to clone your voice using Fish Audio AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {creator?.audioFileUrl && !selectedAudioFile && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-md bg-chart-2/10 border border-chart-2/20">
                      <div className="flex items-center gap-2 text-chart-2 mb-2">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Voice model trained</span>
                      </div>
                      {creator.fishAudioModelId && (
                        <p className="text-xs text-muted-foreground">
                          Model ID: {creator.fishAudioModelId}
                        </p>
                      )}
                    </div>
                    
                    <div className="p-4 rounded-lg bg-muted/30 border">
                      <div className="flex items-center gap-2 mb-3">
                        <Music className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Training Audio</span>
                      </div>
                      <audio 
                        controls 
                        className="w-full"
                        data-testid="audio-training-sample"
                        src={creator.audioFileUrl}
                      >
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  </div>
                )}

                {selectedAudioFile && (
                  <div className="p-4 rounded-md bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <FileAudio className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{selectedAudioFile.name}</span>
                      <Badge variant="outline" className="ml-auto">New</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Click "Save All Settings" to train a new voice model with this audio
                    </p>
                  </div>
                )}

                {!creator?.audioFileUrl && !selectedAudioFile && (
                  <div className="p-8 rounded-md bg-muted/30 text-center border-2 border-dashed">
                    <Music className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No voice model trained yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Upload audio to clone your voice</p>
                  </div>
                )}

                <input
                  id="audio-file"
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  data-testid="input-audio-file"
                  onChange={handleAudioFileSelect}
                />
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById('audio-file')?.click()}
                  data-testid="button-choose-audio"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {creator?.audioFileUrl || selectedAudioFile ? 'Retrain Voice' : 'Upload Audio Sample'}
                </Button>
                
                {(creator?.audioFileUrl || creator?.fishAudioModelId) && (
                  <p className="text-xs text-muted-foreground text-center">
                    Upload new audio to create a fresh voice model
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-primary/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Welcome Message Template
              </CardTitle>
              <CardDescription>
                This message will be spoken by your AI voice in each personalized welcome video
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template" data-testid="label-template">Message Template</Label>
                <Textarea
                  id="template"
                  data-testid="textarea-template"
                  placeholder="Hey {name}! Welcome to {plan}..."
                  value={messageTemplate}
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="h-3 w-3" />
                  Use: {"{name}"}, {"{email}"}, {"{username}"}, {"{plan}"}
                </p>
              </div>

              <div className="pt-4 border-t">
                <Button 
                  onClick={handleSaveSettings}
                  disabled={saveSettingsMutation.isPending || uploadAvatarMutation.isPending || uploadAudioMutation.isPending}
                  className="w-full"
                  size="lg"
                  data-testid="button-save-settings"
                >
                  {(saveSettingsMutation.isPending || uploadAvatarMutation.isPending || uploadAudioMutation.isPending) ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Save All Settings
                    </>
                  )}
                </Button>
                {(selectedFile || selectedAudioFile) && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    This will upload and save all your changes
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          {customersLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : !customersData?.customers.length ? (
            <Card className="border-primary/10">
              <CardContent className="py-16">
                <div className="text-center">
                  <div className="relative inline-block mb-6">
                    <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full"></div>
                    <div className="relative p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
                      <Users className="h-16 w-16 text-primary/60" />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No members yet</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Your member list will appear here. Each new member will automatically receive a personalized welcome video!
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-lg font-semibold">Members</h2>
                  <p className="text-sm text-muted-foreground">
                    Track members and their welcome video status
                  </p>
                </div>
              </div>

              <div className="grid gap-4">
                {customersData.customers.map((customer) => {
                  const latestVideo = customer.videos[customer.videos.length - 1];
                  return (
                    <Card
                      key={customer.id}
                      className="border-primary/10 hover-elevate transition-all duration-200"
                      data-testid={`customer-${customer.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-lg" data-testid={`text-customer-name-${customer.id}`}>
                                {customer.name}
                              </h3>
                              {customer.planName && (
                                <Badge variant="secondary" data-testid={`badge-plan-${customer.id}`}>
                                  {customer.planName}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                              {customer.email && (
                                <span>{customer.email}</span>
                              )}
                              <span>Joined {new Date(customer.joinedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 flex-wrap">
                            {latestVideo ? (
                              getStatusBadge(latestVideo.status)
                            ) : (
                              <Badge variant="outline">No Video</Badge>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => triggerVideoMutation.mutate(customer.id)}
                              disabled={triggerVideoMutation.isPending || !creator?.isSetupComplete}
                              data-testid={`button-test-video-${customer.id}`}
                              className="gap-1"
                            >
                              <Video className="h-3 w-3" />
                              Send Test
                            </Button>
                          </div>
                        </div>
                        
                        {latestVideo?.errorMessage && (
                          <div className="mt-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                            <p className="text-sm text-destructive flex items-center gap-2" data-testid={`error-${customer.id}`}>
                              <AlertCircle className="h-4 w-4" />
                              {latestVideo.errorMessage}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
