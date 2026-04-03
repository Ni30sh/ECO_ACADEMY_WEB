import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Lock, Upload, MapPin, FileText, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMissionSteps } from '@/hooks/useMissionSteps.ts';
import { useToast } from '@/hooks/use-toast';

interface MissionStepViewerProps {
  missionId: string;
  submissionId: string;
  missionTitle: string;
}

export default function MissionStepViewer({
  missionId,
  submissionId,
  missionTitle
}: MissionStepViewerProps) {
  const { steps, stepSubmissions, submitStep, isLoading } = useMissionSteps(missionId, submissionId);
  const { toast } = useToast();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [checkpointData, setCheckpointData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-2 animate-bounce">🌿</div>
          <p className="text-muted-foreground">Loading mission steps...</p>
        </div>
      </div>
    );
  }

  if (!steps.length) {
    return (
      <div className="rounded-lg bg-muted p-8 text-center">
        <p className="text-muted-foreground">No steps defined for this mission</p>
      </div>
    );
  }

  const currentStep = steps[currentStepIndex];
  const currentStepSubmission = stepSubmissions.find(
    (ss: any) => ss.step_id === currentStep.id
  );

  const getCheckpointIcon = (type: string | null) => {
    const iconClass = 'w-5 h-5';
    switch (type) {
      case 'photo':
        return <Upload className={iconClass} />;
      case 'location':
        return <MapPin className={iconClass} />;
      case 'text':
        return <FileText className={iconClass} />;
      default:
        return null;
    }
  };

  const getStepStatus = (index: number) => {
    const stepSubmission = stepSubmissions.find(
      (ss: any) => ss.mission_steps.step_number === index + 1
    );
    
    if (!stepSubmission) return 'pending';
    return stepSubmission.status; // 'pending', 'verified', 'rejected'
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    try {
      // In production, upload to Supabase Storage
      // const { data, error } = await supabase.storage
      //   .from('mission-photos')
      //   .upload(`${submissionId}/${currentStep.id}`, file);

      // For now, create a mock URL
      const mockUrl = URL.createObjectURL(file);
      
      setCheckpointData({
        ...checkpointData,
        photo_url: mockUrl,
        checkpoint_type: 'photo'
      });

      toast({ title: 'Photo selected ✅' });
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLocationCapture = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Geolocation not available',
        variant: 'destructive'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCheckpointData({
          ...checkpointData,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          checkpoint_type: 'location'
        });
        toast({ title: 'Location captured ✅' });
      },
      (error) => {
        toast({
          title: 'Location access denied',
          description: error.message,
          variant: 'destructive'
        });
      }
    );
  };

  const handleTextInput = (text: string) => {
    setCheckpointData({
      ...checkpointData,
      text_input: text,
      checkpoint_type: 'text'
    });
  };

  const handleSubmitStep = async () => {
    if (!currentStep.has_checkpoint && !checkpointData) {
      // No checkpoint required, just mark as done
      await submitStep.mutateAsync({
        missionSubmissionId: submissionId,
        stepId: currentStep.id,
        checkpointData: null,
        stepNumber: currentStep.step_number
      });
    } else if (checkpointData) {
      await submitStep.mutateAsync({
        missionSubmissionId: submissionId,
        stepId: currentStep.id,
        checkpointData,
        stepNumber: currentStep.step_number
      });
    } else {
      toast({
        title: 'Missing checkpoint',
        description: `This step requires ${currentStep.checkpoint_type} proof`,
        variant: 'destructive'
      });
      return;
    }

    // Move to next step
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      setCheckpointData(null);
    } else {
      toast({ title: 'Mission complete! 🎉' });
    }
  };

  const progressPercentage = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="w-full space-y-6">
      {/* Mission Title & Progress */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">{missionTitle}</h2>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
            <span className="text-muted-foreground">{Math.round(progressPercentage)}%</span>
          </div>
          
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-jungle-bright to-jungle-mid"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>

      {/* Step Timeline */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-2">
        {steps.map((step: any, idx: number) => {
          const status = getStepStatus(idx);
          const isActive = idx === currentStepIndex;
          const isCompleted = status === 'verified';
          const isLocked = idx > currentStepIndex && status === 'pending';

          return (
            <button
              key={step.id}
              onClick={() => !isLocked && setCurrentStepIndex(idx)}
              disabled={isLocked}
              className={`
                relative p-4 rounded-xl text-sm font-semibold transition-all duration-300
                ${isActive
                  ? 'bg-primary text-primary-foreground shadow-lg scale-105'
                  : isCompleted
                  ? 'bg-accent text-accent-foreground'
                  : isLocked
                  ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
                  : 'bg-card border border-border hover:border-primary/50 text-foreground'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                {isCompleted ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Step {idx + 1}
                  </>
                ) : isLocked ? (
                  <>
                    <Lock className="w-4 h-4" />
                    Step {idx + 1}
                  </>
                ) : (
                  <span>Step {idx + 1}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Current Step Details */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="rounded-2xl bg-card border border-border p-8 space-y-6"
        >
          {/* Step Content */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-bold text-foreground mb-2">
                {currentStep.title}
              </h3>
              <p className="text-muted-foreground">{currentStep.description}</p>
            </div>

            {currentStep.instructions && (
              <div className="bg-muted/40 rounded-lg p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {currentStep.instructions}
                </p>
              </div>
            )}
          </div>

          {/* Checkpoint Section */}
          {currentStep.has_checkpoint && (
            <div className="space-y-4 p-4 bg-jungle-pale/10 rounded-lg border border-jungle-pale/30">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Proof Required:</span>
                <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-primary/10 text-primary">
                  {getCheckpointIcon(currentStep.checkpoint_type)}
                  {currentStep.checkpoint_type === 'photo'
                    ? 'Photo'
                    : currentStep.checkpoint_type === 'location'
                    ? 'Location'
                    : currentStep.checkpoint_type === 'text'
                    ? 'Text'
                    : 'Checkpoint'}
                </span>
              </div>

              {currentStep.checkpoint_requirement && (
                <p className="text-sm text-muted-foreground">
                  {currentStep.checkpoint_requirement}
                </p>
              )}

              {/* Checkpoint Input */}
              {currentStep.checkpoint_type === 'photo' && (
                <div className="mt-4">
                  <label className="block w-full">
                    <div className="border-2 border-dashed border-jungle-pale/40 rounded-xl p-8 text-center hover:border-jungle-pale/70 transition-colors cursor-pointer">
                      {checkpointData?.photo_url ? (
                        <div className="space-y-3">
                          <img
                            src={checkpointData.photo_url}
                            alt="Checkpoint"
                            className="max-h-48 mx-auto rounded-lg"
                          />
                          <p className="text-sm text-jungle-bright font-semibold">
                            ✅ Photo selected
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                          <p className="font-semibold text-foreground">
                            Click to upload photo
                          </p>
                          <p className="text-xs text-muted-foreground">
                            or drag and drop
                          </p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        disabled={isSubmitting}
                      />
                    </div>
                  </label>
                </div>
              )}

              {currentStep.checkpoint_type === 'location' && (
                <Button
                  variant={checkpointData?.latitude ? 'default' : 'outline'}
                  className="w-full mt-4"
                  onClick={handleLocationCapture}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  {checkpointData?.latitude
                    ? `📍 Location: ${checkpointData.latitude.toFixed(4)}, ${checkpointData.longitude.toFixed(4)}`
                    : 'Capture Location'}
                </Button>
              )}

              {currentStep.checkpoint_type === 'text' && (
                <textarea
                  value={checkpointData?.text_input || ''}
                  onChange={(e) => handleTextInput(e.target.value)}
                  placeholder="Enter your response..."
                  className="w-full p-3 rounded-lg border border-input bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-24 resize-none"
                />
              )}
            </div>
          )}

          {/* Status Badge */}
          {currentStepSubmission && (
            <div className={`
              p-3 rounded-lg text-sm font-semibold
              ${currentStepSubmission.status === 'verified'
                ? 'bg-accent/20 text-accent-foreground border border-accent/40'
                : currentStepSubmission.status === 'rejected'
                ? 'bg-coral/20 text-coral border border-coral/40'
                : 'bg-sun-gold/20 text-sun-gold border border-sun-gold/40'
              }
            `}>
              {currentStepSubmission.status === 'verified' && '✅ Step Verified'}
              {currentStepSubmission.status === 'pending' && '⏳ Awaiting Review'}
              {currentStepSubmission.status === 'rejected' && (
                <div>
                  ❌ Step Rejected
                  {currentStepSubmission.verification_notes && (
                    <p className="text-xs mt-1">{currentStepSubmission.verification_notes}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
            >
              ← Previous
            </Button>
            
            {!(currentStepSubmission?.status === 'verified') && (
              <Button
                className="flex-1"
                onClick={handleSubmitStep}
                disabled={
                  submitStep.isPending ||
                  (currentStep.has_checkpoint && !checkpointData)
                }
              >
                {submitStep.isPending ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Step <ChevronRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}

            {currentStepIndex < steps.length - 1 && currentStepSubmission?.status === 'verified' && (
              <Button
                className="flex-1"
                onClick={() => setCurrentStepIndex(currentStepIndex + 1)}
              >
                Next Step <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
