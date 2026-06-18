"use client";

import { useState, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  userName?: string | null;
  onAvatarChange: (url: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function AvatarUpload({
  currentAvatarUrl,
  userName,
  onAvatarChange,
  onRemove,
  disabled = false,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = (file: File): boolean => {
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, GIF, or WebP).",
        variant: "destructive",
      });
      return false;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Image must be less than 5MB. Please compress your image and try again.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!validateFile(file)) return;

      setIsUploading(true);

      try {
        // Show preview immediately
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          setPreview(result);
        };
        reader.readAsDataURL(file);

        // Upload file to server
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/user/upload-avatar", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.error || "Failed to upload image";
          const errorDetails = errorData.details ? `\n\nDetails: ${errorData.details}` : "";
          const errorHelp = errorData.help ? `\n\n${errorData.help}` : "";
          throw new Error(`${errorMessage}${errorDetails}${errorHelp}`);
        }

        const data = await response.json();
        
        if (!data.avatarUrl) {
          throw new Error("Upload succeeded but no avatar URL was returned.");
        }
        
        // Update with the server URL
        onAvatarChange(data.avatarUrl);
        
        toast({
          title: "Profile picture updated",
          description: "Your profile picture has been uploaded successfully.",
        });
      } catch (error) {
        setPreview(null); // Clear preview on error
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to upload image. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [onAvatarChange, toast]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFileSelect]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setPreview(null);
      onRemove();
      toast({
        title: "Profile picture removed",
        description: "Your profile picture has been removed.",
      });
    },
    [onRemove, toast]
  );

  const handleAvatarClick = useCallback(() => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled, isUploading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && !disabled && !isUploading) {
        e.preventDefault();
        handleAvatarClick();
      }
    },
    [disabled, isUploading, handleAvatarClick]
  );

  const displayImage = preview || currentAvatarUrl;
  const initials = userName?.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex items-start gap-6">
      <div className="relative group">
        <button
          type="button"
          onClick={handleAvatarClick}
          onKeyDown={handleKeyDown}
          disabled={disabled || isUploading}
          className={cn(
            "relative rounded-full transition-all",
            "hover:ring-2 hover:ring-accent hover:ring-offset-2 hover:ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            disabled && "opacity-50 cursor-not-allowed",
            !disabled && "cursor-pointer"
          )}
          aria-label="Click to upload profile picture"
          tabIndex={disabled ? -1 : 0}
        >
          <Avatar className="h-24 w-24 ring-2 ring-border ring-offset-2 ring-offset-background">
            <AvatarImage src={displayImage || undefined} alt={userName || "User"} />
            <AvatarFallback className="text-2xl font-semibold bg-gradient-to-br from-primary/20 to-primary/10">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          {/* Overlay on hover */}
          <div className={cn(
            "absolute inset-0 rounded-full bg-black/50 flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            disabled && "hidden"
          )}>
            {isUploading ? (
              <Icons.spinner className="h-6 w-6 animate-spin text-white" />
            ) : (
              <Camera className="h-6 w-6 text-white" />
            )}
          </div>
        </button>

        {displayImage && (
          <button
            type="button"
            onClick={handleRemove}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRemove(e as any);
              }
            }}
            disabled={disabled || isUploading}
            className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-background border-2 border-border text-foreground flex items-center justify-center shadow-md hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed z-10"
            aria-label="Remove profile picture"
            tabIndex={disabled ? -1 : 0}
          >
            <X className="h-3 w-3" />
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled || isUploading}
          aria-label="Upload profile picture"
        />
      </div>

      <div className="flex-1 space-y-1.5 pt-1">
        <h3 className="text-sm font-semibold">Profile Picture</h3>
        <p className="text-xs text-muted-foreground">
          Click on your profile picture to upload a new one. JPG, PNG, GIF or WebP. Max 5MB.
        </p>
        {displayImage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={disabled || isUploading}
            className="h-8 text-xs text-muted-foreground hover:text-destructive"
            aria-label="Remove profile picture"
            tabIndex={disabled ? -1 : 0}
          >
            <X className="h-3 w-3 mr-1.5" />
            Remove photo
          </Button>
        )}
      </div>
    </div>
  );
}
