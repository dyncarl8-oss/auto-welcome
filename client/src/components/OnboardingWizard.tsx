import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  FileImage, 
  FileAudio, 
  MessageSquare,
  CheckCircle2,
  Clock,
  Info,
  Music,
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Mic,
  Square,
  Play,
  Pause,
  Trash2
} from "lucide-react";

interface OnboardingWizardProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  previewUrl: string;
  setPreviewUrl: (url: string) => void;
  selectedAudioFile: File | null;
  setSelectedAudioFile: (file: File | null) => void;
  messageTemplate: string;
  setMessageTemplate: (template: string) => void;
  onComplete: () => Promise<void>;
  isUploading: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAudioFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  existingAvatarUrl?: string | null;
  existingAudioUrl?: string | null;
}

export default function OnboardingWizard({
  selectedFile,
  setSelectedFile,
  previewUrl,
  setPreviewUrl,
  selectedAudioFile,
  setSelectedAudioFile,
  messageTemplate,
  setMessageTemplate,
  onComplete,
  isUploading,
  onFileSelect,
  onAudioFileSelect,
  existingAvatarUrl,
  existingAudioUrl,
}: OnboardingWizardProps) {
  const hasAvatar = !!selectedFile || !!existingAvatarUrl || !!previewUrl;
  const hasMessage = !!messageTemplate && messageTemplate.trim().length > 0;
  const hasAudio = !!selectedAudioFile || !!existingAudioUrl;

  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioPlayback, setAudioPlayback] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showRecordingPrompt, setShowRecordingPrompt] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isDraggingAudio, setIsDraggingAudio] = useState(false);

  const sampleRecordingText = "Hello, my name is Alex and I love creating content. Today is a beautiful day and I'm excited to share my thoughts with you. I enjoy talking about things that matter to me and connecting with people who share similar interests. Thank you for taking the time to listen to what I have to say. I really appreciate your support and hope you have a wonderful day.";
  
  const getInitialStep = () => {
    if (!hasAvatar) return 1;
    if (hasAvatar && hasMessage) return 2;
    if (hasAvatar && !hasMessage) return 3;
    return 1;
  };

  const [currentStep, setCurrentStep] = useState(1);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      const newStep = getInitialStep();
      setCurrentStep(newStep);
      initialized.current = true;
    }
  }, [hasAvatar, hasMessage, existingAudioUrl]);

  const handleContinueFromStep1 = () => {
    if (!hasAvatar) {
      return;
    }
    setCurrentStep(2);
  };

  const handleBackFromStep2 = () => {
    setCurrentStep(1);
  };

  const handleContinueFromStep2 = () => {
    setCurrentStep(3);
  };

  const handleSkipStep2 = () => {
    setCurrentStep(3);
  };

  const handleBackFromStep3 = () => {
    setCurrentStep(2);
  };

  const handleComplete = async () => {
    await onComplete();
  };

  const startRecording = async () => {
    try {
      setShowRecordingPrompt(false);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        setRecordedAudio(audioBlob);
        const extension = mimeType.includes('webm') ? 'webm' : 'ogg';
        const audioFile = new File([audioBlob], `recording-${Date.now()}.${extension}`, { type: mimeType });
        setSelectedAudioFile(audioFile);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const playRecording = () => {
    if (recordedAudio) {
      if (audioPlayback) {
        audioPlayback.pause();
        audioPlayback.currentTime = 0;
      }
      const audio = new Audio(URL.createObjectURL(recordedAudio));
      audio.onended = () => setIsPlaying(false);
      audio.play();
      setAudioPlayback(audio);
      setIsPlaying(true);
    }
  };

  const pausePlayback = () => {
    if (audioPlayback) {
      audioPlayback.pause();
      setIsPlaying(false);
    }
  };

  const deleteRecording = () => {
    if (audioPlayback) {
      audioPlayback.pause();
    }
    setRecordedAudio(null);
    setAudioPlayback(null);
    setIsPlaying(false);
    setRecordingTime(0);
    setSelectedAudioFile(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleImageDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleImageDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImage(true);
  };

  const handleImageDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImage(false);
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingImage(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setPreviewUrl(e.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleAudioDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAudioDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingAudio(true);
  };

  const handleAudioDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingAudio(false);
  };

  const handleAudioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingAudio(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('audio/')) {
        setSelectedAudioFile(file);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Step {currentStep} of 3
          </span>
          <span className="text-2xl font-bold text-primary">
            {Math.round((currentStep / 3) * 100)}%
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
            style={{ width: `${(currentStep / 3) * 100}%` }}
          ></div>
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span className={currentStep >= 1 ? "text-primary font-medium" : ""}>Clone Face</span>
          <span className={currentStep >= 2 ? "text-primary font-medium" : ""}>Clone Voice</span>
          <span className={currentStep >= 3 ? "text-primary font-medium" : ""}>Final Setup</span>
        </div>
      </div>

      {/* Step 1: Avatar Photo */}
      {currentStep === 1 && (
        <Card className="border-primary/20 shadow-xl animate-slide-in-up">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileImage className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Create Your AI Clone Face</CardTitle>
                <CardDescription className="mt-1">
                  Upload a clear photo to create your AI clone's appearance
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {previewUrl && (
              <>
                <div className="flex justify-center">
                  <div className="relative w-80 h-80 rounded-xl overflow-hidden border-4 border-primary/20 shadow-2xl ring-4 ring-primary/10">
                    <img 
                      src={previewUrl} 
                      alt="Avatar preview" 
                      className="w-full h-full object-cover"
                      data-testid="img-avatar-preview"
                    />
                  </div>
                </div>
                
                {selectedFile && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-3">
                      <FileImage className="h-5 w-5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreviewUrl("");
                        }}
                        data-testid="button-remove-avatar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {!previewUrl && (
              <>
                <input
                  id="avatar-file-wizard"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  data-testid="input-avatar-file"
                  onChange={onFileSelect}
                />
                
                <div
                  onDragOver={handleImageDragOver}
                  onDragEnter={handleImageDragEnter}
                  onDragLeave={handleImageDragLeave}
                  onDrop={handleImageDrop}
                  onClick={() => document.getElementById('avatar-file-wizard')?.click()}
                  data-testid="dropzone-avatar"
                  className={`
                    relative cursor-pointer rounded-xl p-12 
                    border-2 border-dashed transition-all duration-300 ease-in-out
                    ${isDraggingImage 
                      ? 'border-primary bg-primary/10 scale-[1.02]' 
                      : 'border-muted-foreground/25 bg-muted/20 hover-elevate'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-4 pointer-events-none">
                    <div className={`
                      p-4 rounded-full transition-all duration-300
                      ${isDraggingImage 
                        ? 'bg-primary/20 scale-110' 
                        : 'bg-primary/10'
                      }
                    `}>
                      <FileImage className={`h-10 w-10 transition-colors ${
                        isDraggingImage ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold mb-1">
                        {isDraggingImage ? 'Drop your image here' : 'Drag & drop your photo here'}
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports: JPG, PNG • Max size: 10MB
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}


            {!selectedFile && existingAvatarUrl && (
              <div className="p-4 rounded-lg bg-chart-2/10 border border-chart-2/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-chart-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-chart-2">Avatar already uploaded</p>
                    <p className="text-xs text-muted-foreground">
                      You can continue to the next step or upload a new photo
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <Button
                size="lg"
                className="w-full"
                disabled={!hasAvatar}
                onClick={handleContinueFromStep1}
                data-testid="button-continue-step-1"
              >
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
              {!hasAvatar && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Please select an avatar photo to continue
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Audio File (Optional) */}
      {currentStep === 2 && (
        <Card className="border-primary/20 shadow-xl animate-slide-in-up">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleBackFromStep2}
                data-testid="button-back-step-2"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileAudio className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Clone Your Voice</CardTitle>
                  <CardDescription className="mt-1">
                    Record or upload audio to give your AI clone your voice
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isRecording && (
              <div className="space-y-4">
                <div className="p-8 rounded-lg bg-destructive/10 border-2 border-destructive/30 text-center">
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <Mic className="h-12 w-12 text-destructive animate-pulse" />
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                      </span>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-destructive mb-1">Recording...</p>
                  <p className="text-2xl font-mono text-destructive">{formatTime(recordingTime)}</p>
                </div>

                <div className="p-6 rounded-lg bg-primary/5 border-2 border-primary/20">
                  <div className="flex items-start gap-2 mb-3">
                    <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <h4 className="font-semibold text-sm">Read this out loud:</h4>
                  </div>
                  <div className="p-4 rounded bg-background/80 border">
                    <p className="text-sm leading-relaxed">
                      {sampleRecordingText}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {recordedAudio && selectedAudioFile && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3">
                  <FileAudio className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Recorded Audio</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(recordingTime)} - Ready for voice training
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!isPlaying ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={playRecording}
                        data-testid="button-play-recording"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={pausePlayback}
                        data-testid="button-pause-recording"
                      >
                        <Pause className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={deleteRecording}
                      data-testid="button-delete-recording"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {selectedAudioFile && !recordedAudio && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3">
                  <FileAudio className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedAudioFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedAudioFile.size / 1024 / 1024).toFixed(2)} MB - Ready for voice training
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedAudioFile(null)}
                    data-testid="button-remove-audio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!selectedAudioFile && existingAudioUrl && (
              <div className="p-4 rounded-lg bg-chart-2/10 border border-chart-2/20">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-chart-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-chart-2">Voice model already trained</p>
                    <p className="text-xs text-muted-foreground">
                      You can continue or upload new audio to retrain
                    </p>
                  </div>
                </div>
              </div>
            )}

            {showRecordingPrompt && !isRecording && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground flex items-start gap-2">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Speak naturally for 15-20 seconds to clone your voice. You can read the sample below or say anything you want!</span>
                  </p>
                </div>

                <div className="p-6 rounded-lg bg-primary/5 border-2 border-primary/20">
                  <div className="flex items-start gap-2 mb-3">
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Sample Script (Optional)</h4>
                      <p className="text-xs text-muted-foreground">
                        You can read this or just talk about anything:
                      </p>
                    </div>
                  </div>
                  <div className="p-4 rounded bg-background/80 border">
                    <p className="text-sm leading-relaxed">
                      {sampleRecordingText}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline"
                    className="h-14"
                    onClick={() => setShowRecordingPrompt(false)}
                    data-testid="button-cancel-recording"
                  >
                    Back
                  </Button>
                  <Button 
                    variant="default"
                    className="h-14"
                    onClick={startRecording}
                    data-testid="button-begin-recording"
                  >
                    <Mic className="h-5 w-5 mr-2" />
                    <span className="font-semibold">Start Recording</span>
                  </Button>
                </div>
              </div>
            )}

            {!selectedAudioFile && !isRecording && !recordedAudio && !showRecordingPrompt && (
              <div className="space-y-4">
                <input
                  id="audio-file-wizard"
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  data-testid="input-audio-file"
                  onChange={onAudioFileSelect}
                />
                
                <div
                  onDragOver={handleAudioDragOver}
                  onDragEnter={handleAudioDragEnter}
                  onDragLeave={handleAudioDragLeave}
                  onDrop={handleAudioDrop}
                  onClick={() => document.getElementById('audio-file-wizard')?.click()}
                  data-testid="dropzone-audio"
                  className={`
                    relative cursor-pointer rounded-xl p-10
                    border-2 border-dashed transition-all duration-300 ease-in-out
                    ${isDraggingAudio 
                      ? 'border-primary bg-primary/10 scale-[1.02]' 
                      : 'border-muted-foreground/25 bg-muted/20 hover-elevate'
                    }
                  `}
                >
                  <div className="flex flex-col items-center gap-4 pointer-events-none">
                    <div className={`
                      p-4 rounded-full transition-all duration-300
                      ${isDraggingAudio 
                        ? 'bg-primary/20 scale-110' 
                        : 'bg-primary/10'
                      }
                    `}>
                      <FileAudio className={`h-10 w-10 transition-colors ${
                        isDraggingAudio ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold mb-1">
                        {isDraggingAudio ? 'Drop your audio here' : 'Drag & drop your audio here'}
                      </p>
                      <p className="text-sm text-muted-foreground mb-3">
                        or click to browse
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Supports: MP3, WAV, M4A, WebM
                      </p>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-muted-foreground/20"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                <Button 
                  variant="outline"
                  className="w-full h-12"
                  onClick={() => setShowRecordingPrompt(true)}
                  disabled={isRecording}
                  data-testid="button-start-recording"
                >
                  <Mic className="h-5 w-5 mr-2" />
                  <span className="font-semibold">Record Audio Instead</span>
                </Button>
              </div>
            )}

            {isRecording && (
              <Button 
                variant="destructive"
                className="w-full h-14"
                onClick={stopRecording}
                data-testid="button-stop-recording"
              >
                <Square className="h-5 w-5 mr-2" />
                <span className="font-semibold">Stop Recording</span>
              </Button>
            )}

            {!showRecordingPrompt && !isRecording && (
              <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleSkipStep2}
                  data-testid="button-skip-step-2"
                >
                  Skip
                </Button>
                <Button
                  size="lg"
                  onClick={handleContinueFromStep2}
                  data-testid="button-continue-step-2"
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Welcome Message */}
      {currentStep === 3 && (
        <Card className="border-primary/20 shadow-xl animate-slide-in-up">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <Button
                size="icon"
                variant="ghost"
                onClick={handleBackFromStep3}
                disabled={isUploading}
                data-testid="button-back-step-3"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Set Your Clone's Message</CardTitle>
                  <CardDescription className="mt-1">
                    Customize what your AI clone will say to new members
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="template-wizard" data-testid="label-template">
                Message Template
              </Label>
              <Textarea
                id="template-wizard"
                data-testid="textarea-template"
                placeholder="Hey {name}! Welcome to {plan}. I'm excited to have you here..."
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Info className="h-3 w-3" />
                Use placeholders: {"{name}"}, {"{email}"}, {"{username}"}, {"{plan}"}
              </p>
            </div>

            {!selectedAudioFile && (
              <div className="p-3 rounded-lg bg-chart-3/10 border border-chart-3/20">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-chart-3 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-chart-3">AI Text-to-Speech will be used</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      Since no audio file was uploaded, this message will be spoken by AI voice
                    </p>
                  </div>
                </div>
              </div>
            )}

            {selectedAudioFile && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-primary">Your cloned voice will say this message</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      We trained your AI voice from the audio you uploaded
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
              <Button
                size="lg"
                className="w-full"
                disabled={isUploading || !hasMessage}
                onClick={handleComplete}
                data-testid="button-complete-setup"
              >
                {isUploading ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Training your AI Clone...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Train Your AI Clone
                  </>
                )}
              </Button>
              {!hasMessage && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Please enter a welcome message to continue
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
