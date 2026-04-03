import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Camera, Upload, Loader2 } from 'lucide-react';

interface ProofSubmissionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: { id: string; mission_id: string } | null;
  mission: { title: string; description: string; icon: string; eco_points_reward: number } | null;
  userId: string;
  onSubmit: (data: { submissionId: string; photoUrl?: string; notes?: string; coords?: { lat: number; lng: number } }) => Promise<void>;
}

export default function ProofSubmissionSheet({ open, onOpenChange, submission, mission, userId, onSubmit }: ProofSubmissionSheetProps) {
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const uploadProofFile = async (file: File) => {
    if (!userId) return;

    setUploadError(null);
    setLastFile(file);

    const localPreview = URL.createObjectURL(file);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(localPreview);

    setUploading(true);
    setUploadProgress(5);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => (prev >= 90 ? prev : prev + 8));
    }, 180);

    try {
      const path = `${userId}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('mission-photos').upload(path, file);
      if (error || !data) {
        throw error || new Error('Upload failed');
      }

      const { data: urlData } = supabase.storage.from('mission-photos').getPublicUrl(data.path);
      setPhotoUrl(urlData.publicUrl);
      setUploadProgress(100);
    } catch (error) {
      setUploadError((error as Error)?.message || 'Upload failed. Please retry.');
    } finally {
      clearInterval(progressInterval);
      setUploading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadProofFile(file);
  };

  const handleLocation = () => {
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      () => setLocationLoading(false),
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async () => {
    if (!submission || uploading) return;
    setSubmitting(true);
    try {
      await onSubmit({
        submissionId: submission.id,
        photoUrl: photoUrl ?? undefined,
        notes: notes || undefined,
        coords: coords ?? undefined,
      });
      setNotes('');
      setPhotoUrl(null);
      setUploadProgress(0);
      setUploadError(null);
      setLastFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setCoords(null);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!mission || !submission) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 font-heading text-foreground">
            <span className="text-2xl">{mission.icon}</span>
            {mission.title}
          </SheetTitle>
          <SheetDescription>{mission.description}</SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-heading font-bold text-foreground mb-2">
              <Camera className="inline w-4 h-4 mr-1" /> Upload Photo Proof
            </label>
            {previewUrl || photoUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-border">
                <img src={previewUrl || photoUrl || ''} alt="Proof" className="w-full h-48 object-cover" />
                <button
                  onClick={() => {
                    setPhotoUrl(null);
                    setUploadProgress(0);
                    setUploadError(null);
                    setLastFile(null);
                    if (previewUrl) {
                      URL.revokeObjectURL(previewUrl);
                    }
                    setPreviewUrl(null);
                  }}
                  className="absolute top-2 right-2 bg-card rounded-full p-1 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-muted/30">
                {uploading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : (
                  <>
                    <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click or drag to upload</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </label>
            )}

            {(uploading || uploadProgress > 0) && (
              <div className="mt-3">
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-jungle-bright transition-all duration-200"
                    style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {uploading ? `Uploading... ${Math.min(uploadProgress, 99)}%` : uploadProgress >= 100 ? 'Upload complete' : 'Upload paused'}
                </p>
              </div>
            )}

            {uploadError && (
              <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs text-destructive mb-2">{uploadError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => {
                    if (lastFile) void uploadProofFile(lastFile);
                  }}
                  disabled={!lastFile || uploading}
                >
                  Retry Upload
                </Button>
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <Button variant="outline" size="sm" onClick={handleLocation} disabled={locationLoading} className="rounded-xl">
              <MapPin className="w-4 h-4 mr-1" />
              {coords ? `📍 ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : locationLoading ? 'Getting location...' : 'Tag my location'}
            </Button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-heading font-bold text-foreground mb-2">Tell us what you did...</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe your mission experience..."
              className="rounded-xl min-h-[100px]"
            />
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || uploading}
            className="w-full font-heading font-bold rounded-xl shadow-card"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Submit Proof · +{mission.eco_points_reward} pts 🌿
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
