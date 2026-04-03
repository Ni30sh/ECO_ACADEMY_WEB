import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, MapPin, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabaseQueries } from '@/integrations/supabase/queries';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface TeacherStepReviewProps {
  stepSubmissionId: string;
  missionTitle: string;
  studentName: string;
  stepTitle: string;
  stepNumber: number;
  checkpointData: any;
  checkpointType: string;
  onVerified?: () => void;
  onRejected?: () => void;
}

export default function TeacherStepReview({
  stepSubmissionId,
  missionTitle,
  studentName,
  stepTitle,
  stepNumber,
  checkpointData,
  checkpointType,
  onVerified,
  onRejected
}: TeacherStepReviewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reviewMode, setReviewMode] = useState<'view' | 'verify' | 'reject'>('view');

  const handleVerify = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      await supabaseQueries.missionStepSubmissions.verifyStep(
        stepSubmissionId,
        user.id,
        feedback || 'Good work!'
      );
      
      toast({
        title: 'Step verified! ✅',
        description: `${studentName}'s step has been approved`
      });
      
      onVerified?.();
      setFeedback('');
      setReviewMode('view');
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!user || !feedback) {
      toast({
        title: 'Please provide feedback',
        description: 'Let the student know why this step was rejected',
        variant: 'destructive'
      });
      return;
    }
    
    setIsLoading(true);
    try {
      await supabaseQueries.missionStepSubmissions.rejectStep(
        stepSubmissionId,
        user.id,
        feedback
      );
      
      toast({
        title: 'Step rejected',
        description: `${studentName} has been notified`
      });
      
      onRejected?.();
      setFeedback('');
      setReviewMode('view');
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-card border border-border p-6 space-y-6"
    >
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {missionTitle} • Step {stepNumber}
            </p>
            <h3 className="text-xl font-bold text-foreground">{stepTitle}</h3>
          </div>
          <span className="px-3 py-1 rounded-full bg-jungle-pale/20 text-jungle-bright text-xs font-bold">
            Pending Review
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Submitted by {studentName}</p>
      </div>

      {/* Checkpoint Preview */}
      <div className="p-4 rounded-lg bg-muted/50 space-y-4">
        <h4 className="font-semibold text-foreground text-sm">Checkpoint Evidence:</h4>

        {checkpointType === 'photo' && checkpointData?.photo_url && (
          <div className="rounded-lg overflow-hidden border border-border">
            <img
              src={checkpointData.photo_url}
              alt="Checkpoint"
              className="w-full h-auto max-h-96 object-cover"
            />
          </div>
        )}

        {checkpointType === 'location' && checkpointData?.latitude && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <MapPin className="w-4 h-4 text-jungle-bright" />
              <span>
                📍 {checkpointData.latitude.toFixed(6)}, {checkpointData.longitude.toFixed(6)}
              </span>
            </div>
            <a
              href={`https://maps.google.com/?q=${checkpointData.latitude},${checkpointData.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              View on Google Maps →
            </a>
          </div>
        )}

        {checkpointType === 'text' && checkpointData?.text_input && (
          <div className="p-3 rounded bg-card border border-input">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {checkpointData.text_input}
            </p>
          </div>
        )}
      </div>

      {/* Review Mode Selection */}
      {reviewMode === 'view' && (
        <div className="flex gap-3">
          <Button
            variant="default"
            className="flex-1 gap-2"
            onClick={() => setReviewMode('verify')}
          >
            <CheckCircle className="w-4 h-4" />
            Approve Step
          </Button>
          <Button
            variant="destructive"
            className="flex-1 gap-2"
            onClick={() => setReviewMode('reject')}
          >
            <XCircle className="w-4 h-4" />
            Reject Step
          </Button>
        </div>
      )}

      {/* Feedback Input */}
      {(reviewMode === 'verify' || reviewMode === 'reject') && (
        <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">
              {reviewMode === 'verify' ? 'Approval Note (optional)' : 'Rejection Feedback (required)'}
            </span>
          </div>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={
              reviewMode === 'verify'
                ? 'e.g., "Great photo showing the tree planted!"\n(Optional - leave blank for default message)'
                : 'e.g., "The tree is not clearly visible in the photo. Please retake."\n(This will be sent to the student)'
            }
            className="w-full p-3 rounded-lg border border-input bg-card text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-24 resize-none text-sm"
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setReviewMode('view');
                setFeedback('');
              }}
              disabled={isLoading}
            >
              Cancel
            </Button>
            {reviewMode === 'verify' && (
              <Button
                className="flex-1 bg-accent hover:bg-accent/90"
                onClick={handleVerify}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </>
                )}
              </Button>
            )}
            {reviewMode === 'reject' && (
              <Button
                className="flex-1 bg-coral hover:bg-coral/90"
                onClick={handleReject}
                disabled={isLoading || !feedback}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Guidelines */}
      <div className="p-3 rounded-lg bg-sky-blue/10 border border-sky-blue/40 text-sm space-y-2">
        <p className="font-semibold text-foreground">Review Guidelines:</p>
        <ul className="text-muted-foreground space-y-1 text-xs">
          <li>✓ Verify the checkpoint evidence is clear and relevant</li>
          <li>✓ Check if the step requirement is met</li>
          <li>✓ Approve only if ALL criteria are satisfied</li>
          <li>✓ Provide constructive feedback for rejections</li>
          <li>✓ Be encouraging - this is a learning platform!</li>
        </ul>
      </div>
    </motion.div>
  );
}
