import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { whopSdk } from "./lib/whop-sdk";
import { heygenSdk } from "./lib/heygen-sdk";
import { fishAudioSdk } from "./lib/fish-audio-sdk";
import { TEMPLATE_PLACEHOLDERS, VIDEO_STATUSES, replacePlaceholders, type Creator, type Customer } from "@shared/schema";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars');
  if (!existsSync(uploadsDir)) {
    await fs.mkdir(uploadsDir, { recursive: true });
  }

  // Serve uploaded avatar files statically
  app.use('/uploads/avatars', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  });
  app.use('/uploads/avatars', express.static(uploadsDir));

  // Configure multer for image uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      // Accept only image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    },
  });

  // Configure multer for audio uploads
  const uploadAudio = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB limit for audio files
    },
    fileFilter: (req, file, cb) => {
      // Accept only audio files
      if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed'));
      }
    },
  });

  // Validate user access to an experience
  app.post("/api/validate-access", async (req, res) => {
    try {
      const { experienceId } = req.body;
      
      if (!experienceId) {
        return res.status(400).json({ error: "experienceId is required" });
      }

      // Extract user token from headers (passed by Whop iframe)
      const userToken = req.headers["x-whop-user-token"] as string;
      
      if (!userToken) {
        return res.status(401).json({ 
          error: "Missing x-whop-user-token header. Ensure you're accessing this app through Whop or using the dev proxy for local development.",
          hasAccess: false,
          accessLevel: "no_access"
        });
      }

      // Verify user token and get user ID
      const { userId } = await whopSdk.verifyUserToken(userToken);

      // Check if user has access to the experience
      const result = await whopSdk.access.checkIfUserHasAccessToExperience({
        userId,
        experienceId,
      });

      // Fetch user details from Whop SDK to get the user's name
      let userName = null;
      let username = null;
      try {
        const userDetails = await whopSdk.users.getUser({ userId });
        console.log("Fetched user details:", JSON.stringify(userDetails));
        userName = userDetails.name || userDetails.username || null;
        username = userDetails.username || null;
        console.log(`User details: name="${userName}", username="${username}"`);
      } catch (userError) {
        console.error("Error fetching user details in validate-access:", userError);
      }

      // Get company ID from the experience (works for all users who have access)
      let companyId = null;
      try {
        // Fetch the experience details to get the company ID
        const experience = await whopSdk.experiences.getExperience({ experienceId });
        companyId = experience.company?.id || null;
        console.log(`📦 Retrieved company ID from experience: ${companyId}`);
      } catch (experienceError) {
        console.error("Error fetching experience for company ID:", experienceError);
        
        // Fallback: For admin users, try to get from creator settings
        if (result.accessLevel === "admin") {
          try {
            const creator = await storage.getCreatorByWhopUserId(userId);
            if (creator && creator.whopCompanyId) {
              companyId = creator.whopCompanyId;
              console.log(`📦 Using fallback company ID from creator: ${companyId}`);
            }
          } catch (creatorError) {
            console.error("Error fetching creator for company ID:", creatorError);
          }
        }
      }

      // Return access information
      const response = {
        hasAccess: result.hasAccess,
        accessLevel: result.accessLevel,
        userId,
        userName,
        username,
        companyId
      };
      console.log("Sending validate-access response:", JSON.stringify(response));
      return res.json(response);
    } catch (error) {
      console.error("Error validating access:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return res.status(500).json({ 
        error: `Failed to validate access: ${errorMessage}. Check your WHOP_API_KEY and NEXT_PUBLIC_WHOP_APP_ID configuration.`,
        hasAccess: false,
        accessLevel: "no_access"
      });
    }
  });

  // Get current user information
  app.get("/api/user", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      
      if (!userToken) {
        return res.status(401).json({ error: "No user token provided" });
      }

      // Verify user token and get user ID
      const { userId } = await whopSdk.verifyUserToken(userToken);

      // Get user information
      const user = await whopSdk.users.getUser({ userId });

      return res.json({ user });
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ error: "Failed to fetch user information" });
    }
  });

  // ============================================================================
  // ADMIN ENDPOINTS
  // ============================================================================

  // Get creator settings
  app.get("/api/admin/creator", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);

      // Get creator record
      const creator = await storage.getCreatorByWhopUserId(userId);
      
      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      return res.json(creator);
    } catch (error) {
      console.error("Error fetching creator:", error);
      return res.status(500).json({ error: "Failed to fetch creator" });
    }
  });

  // Initialize or get creator settings
  app.post("/api/admin/initialize", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);
      const { experienceId } = req.body;

      // MULTI-TENANT SECURITY: Require experienceId to get company ID
      if (!experienceId) {
        return res.status(400).json({ 
          error: "experienceId is required for multi-tenant setup" 
        });
      }

      // SECURITY: Verify user has ADMIN access to the experience before allowing initialization
      // This prevents users from registering under other companies' experiences
      try {
        const accessCheck = await whopSdk.access.checkIfUserHasAccessToExperience({
          userId,
          experienceId,
        });

        if (accessCheck.accessLevel !== "admin") {
          console.error(`❌ Security: User ${userId} attempted to initialize with experience ${experienceId} but has ${accessCheck.accessLevel} access, not admin`);
          return res.status(403).json({ 
            error: "You must have admin access to this experience to set up the app" 
          });
        }

        console.log(`✅ Verified user ${userId} has admin access to experience ${experienceId}`);
      } catch (error) {
        console.error("Error verifying experience access:", error);
        return res.status(403).json({ 
          error: "Failed to verify your access to this experience" 
        });
      }

      // Get company ID from the experience (for multi-tenant support)
      let whopCompanyId: string | null = null;
      try {
        const experience = await whopSdk.experiences.getExperience({ experienceId });
        whopCompanyId = experience.company?.id || null;
        console.log(`📦 Retrieved company ID during initialization: ${whopCompanyId}`);
      } catch (error) {
        console.error("Error fetching company ID during initialization:", error);
        return res.status(500).json({ 
          error: "Failed to fetch company information. Please ensure you're accessing this app through Whop." 
        });
      }

      // MULTI-TENANT SECURITY: Require company ID for creator creation
      if (!whopCompanyId) {
        return res.status(400).json({ 
          error: "Could not determine company ID. Please ensure you're accessing this app through a Whop experience." 
        });
      }

      // Get or create creator record
      let creator = await storage.getCreatorByWhopUserId(userId);
      
      if (!creator) {
        creator = await storage.createCreator({
          whopUserId: userId,
          whopCompanyId,
          heygenAvatarGroupId: null,
          heygenAvatarLookId: null,
          messageTemplate: "Hi {name}! Welcome to our community. We're excited to have you here!",
          avatarPhotoUrl: null,
          useAudioForGeneration: false,
          voiceId: "1bd001e7e50f421d891986aad5158bc8",
          isSetupComplete: false,
        });
        console.log(`✅ Created new creator with company ID: ${whopCompanyId}`);
      } else {
        // Validate existing creator belongs to the same company
        if (creator.whopCompanyId !== whopCompanyId) {
          console.error(`❌ Security issue: User ${userId} trying to access company ${whopCompanyId} but belongs to ${creator.whopCompanyId}`);
          return res.status(403).json({ 
            error: "You cannot access this company's settings" 
          });
        }
        console.log(`✅ Found existing creator for company ${whopCompanyId}`);
      }

      return res.json({ creator });
    } catch (error) {
      console.error("Error initializing creator:", error);
      return res.status(500).json({ error: "Failed to initialize creator" });
    }
  });

  // Save creator settings (message template, avatar IDs, etc.)
  app.post("/api/admin/save-settings", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);
      const creator = await storage.getCreatorByWhopUserId(userId);

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      // SECURITY: Extract only safe-to-update fields from request
      // whopCompanyId is intentionally excluded - it can ONLY be set during initialization
      // Allowing client to set company ID would enable cross-company data access
      const { messageTemplate } = req.body;

      // Update only the message template (not company ID)
      await storage.updateCreator(creator._id, {
        messageTemplate,
      });

      // Re-fetch creator to get latest state (including any recently uploaded avatar/audio)
      const freshCreator = await storage.getCreatorByWhopUserId(userId);
      
      if (!freshCreator) {
        return res.status(404).json({ error: "Creator not found after update" });
      }

      // Setup is complete when we have: avatar photo + fish audio model + message template
      const isSetupComplete = !!(
        freshCreator.avatarPhotoUrl && 
        freshCreator.fishAudioModelId && 
        freshCreator.messageTemplate
      );

      // Update setup completion status
      const updated = await storage.updateCreator(creator._id, {
        isSetupComplete,
      });

      console.log(`✅ Settings saved. Setup complete: ${isSetupComplete}`);

      return res.json({ creator: updated });
    } catch (error) {
      console.error("Error saving settings:", error);
      return res.status(500).json({ error: "Failed to save settings" });
    }
  });

  // Upload avatar photo (save locally for later use)
  app.post("/api/admin/upload-avatar", upload.single('avatar'), async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);
      const creator = await storage.getCreatorByWhopUserId(userId);

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const fileExtension = req.file.originalname.split('.').pop();
      const filename = `avatar-${creator._id}-${Date.now()}.${fileExtension}`;

      // Save avatar to filesystem (will be used later when generating videos)
      const filePath = path.join(uploadsDir, filename);
      await fs.writeFile(filePath, req.file.buffer);
      
      // Generate public URL
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
        : `http://localhost:5000`;
      const publicUrl = `${baseUrl}/uploads/avatars/${filename}`;

      console.log(`✅ Avatar saved to filesystem: ${publicUrl}`);

      // Update creator with avatar URL only (HeyGen avatar creation happens during video generation)
      const updatedCreator = await storage.updateCreator(creator._id, {
        avatarPhotoUrl: publicUrl,
      });

      console.log('✅ Avatar uploaded and saved successfully!');

      return res.json({ 
        success: true, 
        url: publicUrl,
        message: 'Avatar uploaded successfully!',
        creator: updatedCreator
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload avatar";
      return res.status(500).json({ error: errorMessage });
    }
  });

  // Upload audio file and train Fish Audio voice model
  app.post("/api/admin/upload-audio", uploadAudio.single('audio'), async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No audio file uploaded" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);
      const creator = await storage.getCreatorByWhopUserId(userId);

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      console.log(`🎙️ Training Fish Audio voice model for creator ${creator.whopUserId}...`);

      // Create Fish Audio voice model
      const fishModel = await fishAudioSdk.createVoiceModel({
        title: `Voice Model - ${creator.whopUserId}`,
        description: `AI voice model for creator ${creator.whopUserId}`,
        voiceFile: req.file.buffer,
        fileName: req.file.originalname,
      });

      console.log(`🐟 Fish Audio model created with ID: ${fishModel._id}`);

      // Also upload to HeyGen for backward compatibility
      // HeyGen expects video/webm for WebM files, not audio/webm
      const heygenMimetype = req.file.mimetype === 'audio/webm' || req.file.mimetype.startsWith('audio/webm;')
        ? 'video/webm'
        : req.file.mimetype;
      
      const { audio_url } = await heygenSdk.uploadAudio(
        req.file.buffer,
        req.file.originalname,
        heygenMimetype
      );

      console.log(`📤 Audio uploaded to HeyGen: ${audio_url}`);

      const updatedCreator = await storage.updateCreator(creator._id, {
        audioFileUrl: audio_url,
        useAudioForGeneration: true,
        fishAudioModelId: fishModel._id,
      });

      return res.json({ 
        success: true, 
        audioUrl: audio_url,
        fishAudioModelId: fishModel._id,
        modelState: fishModel.state,
        message: 'Voice model trained successfully!',
        creator: updatedCreator
      });
    } catch (error) {
      console.error("Error training voice model:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to train voice model";
      return res.status(500).json({ error: errorMessage });
    }
  });

  // Reset onboarding - clears avatar, audio, and setup state
  app.post("/api/admin/reset-onboarding", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);
      const creator = await storage.getCreatorByWhopUserId(userId);

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      console.log(`Resetting onboarding for creator ${creator.whopUserId}...`);

      const updatedCreator = await storage.updateCreator(creator._id, {
        avatarPhotoUrl: null,
        audioFileUrl: null,
        fishAudioModelId: null,
        messageTemplate: "Hi {name}! Welcome to our community. We're excited to have you here!",
        heygenAvatarGroupId: null,
        heygenAvatarLookId: null,
        useAudioForGeneration: false,
        voiceId: "1bd001e7e50f421d891986aad5158bc8",
        isSetupComplete: false,
      });

      console.log('Onboarding reset successfully!');

      return res.json({ 
        success: true, 
        message: 'Onboarding has been reset. You can now go through the setup wizard again.',
        creator: updatedCreator
      });
    } catch (error) {
      console.error("Error resetting onboarding:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to reset onboarding";
      return res.status(500).json({ error: errorMessage });
    }
  });

  // Serve uploaded files from filesystem
  app.get("/api/files/avatars/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      
      // Security: Prevent path traversal attacks
      const filepath = path.resolve(uploadsDir, filename);
      const relativePath = path.relative(uploadsDir, filepath);
      
      // Reject if the path escapes the uploads directory or is absolute
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if file exists
      if (!existsSync(filepath)) {
        return res.status(404).json({ error: "File not found" });
      }

      // Read file from filesystem
      const fileBuffer = await fs.readFile(filepath);

      // Determine content type based on file extension
      const ext = filename.split('.').pop()?.toLowerCase();
      const contentTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
      };

      const contentType = contentTypes[ext || ''] || 'application/octet-stream';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.end(fileBuffer);
    } catch (error) {
      console.error("Error serving file:", error);
      return res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Test endpoint to manually trigger video generation
  app.post("/api/admin/test-video-generation", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);
      const creator = await storage.getCreatorByWhopUserId(userId);

      if (!creator || !creator.isSetupComplete) {
        return res.status(400).json({ error: "Setup not complete. Please upload avatar and set message template." });
      }

      console.log(`🧪 TEST: Starting test video generation for creator ${creator.whopUserId}`);

      // Use creator's company ID (should be set during initialization)
      let companyId = creator.whopCompanyId;

      // Create a test customer
      const testCustomer = await storage.createCustomer({
        creatorId: creator._id,
        whopUserId: `test_${Date.now()}`,
        whopMemberId: `test_member_${Date.now()}`,
        whopCompanyId: companyId || null,
        name: "Test Customer",
        email: "test@example.com",
        username: "testuser",
        planName: "Test Plan",
        joinedAt: new Date(),
        firstVideoSent: false,
        updatedAt: new Date(),
      });

      console.log(`🧪 TEST: Created test customer with company ID: ${companyId || 'none'}`);

      // Generate personalized script
      const personalizedScript = replacePlaceholders(creator.messageTemplate, {
        name: testCustomer.name,
        email: testCustomer.email || "",
        username: testCustomer.username || "",
        planName: testCustomer.planName || "",
      });

      console.log(`🧪 TEST: Script: ${personalizedScript}`);

      // Create video record
      const video = await storage.createVideo({
        customerId: testCustomer._id,
        creatorId: creator._id,
        personalizedScript,
        status: VIDEO_STATUSES.GENERATING,
        viewCount: 0,
        updatedAt: new Date(),
      });

      // Generate video with HeyGen Avatar IV
      let video_id: string = "";
      
      if (!creator.avatarPhotoUrl) {
        throw new Error("Avatar photo URL not found");
      }

      // Try Fish Audio TTS first if model is available and trained
      let usedFishAudio = false;
      if (creator.fishAudioModelId) {
        try {
          console.log(`🧪 TEST: Checking Fish Audio model ${creator.fishAudioModelId}...`);
          
          // Check if model is trained
          const modelStatus = await fishAudioSdk.getModel(creator.fishAudioModelId);
          
          if (modelStatus.state === 'trained') {
            console.log(`🧪 TEST: Using Fish Audio TTS with trained model`);
            
            // Generate audio with Fish Audio
            const audioBuffer = await fishAudioSdk.generateSpeech({
              text: personalizedScript,
              referenceId: creator.fishAudioModelId,
              format: 'mp3',
            });

            // Upload generated audio to HeyGen
            const audioBlob = Buffer.from(audioBuffer);
            const { audio_url } = await heygenSdk.uploadAudio(
              audioBlob,
              `fish-audio-${Date.now()}.mp3`,
              'audio/mp3'
            );

            console.log(`🐟 Fish Audio uploaded to HeyGen: ${audio_url}`);

            // Generate video with custom audio
            const result = await heygenSdk.generateAvatarIVWithAudio({
              avatar_image_url: creator.avatarPhotoUrl,
              input_audio_url: audio_url,
              test: true,
              title: `Test video for ${testCustomer.name}`,
            });
            video_id = result.video_id;
            usedFishAudio = true;
          } else {
            console.log(`⚠️ Fish Audio model state: ${modelStatus.state} (not trained yet). Falling back to other audio methods.`);
          }
        } catch (fishError) {
          console.error(`⚠️ Fish Audio TTS failed:`, fishError);
          console.log(`Falling back to other audio methods...`);
        }
      }
      
      if (!usedFishAudio && creator.useAudioForGeneration && creator.audioFileUrl) {
        console.log(`🧪 TEST: Using Avatar IV with uploaded audio file`);
        const result = await heygenSdk.generateAvatarIVWithAudio({
          avatar_image_url: creator.avatarPhotoUrl,
          input_audio_url: creator.audioFileUrl,
          test: true,
          title: `Test video for ${testCustomer.name}`,
        });
        video_id = result.video_id;
      } else if (!usedFishAudio) {
        console.log(`🧪 TEST: Using Avatar IV with HeyGen text-to-speech`);
        const result = await heygenSdk.generateAvatarIVVideo({
          avatar_image_url: creator.avatarPhotoUrl,
          input_text: personalizedScript,
          voice_id: creator.voiceId || "1bd001e7e50f421d891986aad5158bc8",
          test: true,
          title: `Test video for ${testCustomer.name}`,
        });
        video_id = result.video_id;
      }

      console.log(`🧪 TEST: HeyGen video started: ${video_id}`);

      await storage.updateVideo(video._id, {
        heygenVideoId: video_id,
      });

      return res.json({
        success: true,
        message: "Test video generation started! Check logs for progress.",
        videoId: video._id,
        heygenVideoId: video_id,
        script: personalizedScript,
      });
    } catch (error) {
      console.error("🧪 TEST ERROR:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Test failed" 
      });
    }
  });

  // Trigger video generation for an existing customer
  app.post("/api/admin/trigger-video-for-customer", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);
      const creator = await storage.getCreatorByWhopUserId(userId);

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      if (!creator.isSetupComplete) {
        return res.status(400).json({ 
          error: "Setup not complete. Please upload avatar and set message template." 
        });
      }

      const { customerId } = req.body;
      if (!customerId) {
        return res.status(400).json({ error: "customerId is required" });
      }

      const customer = await storage.getCustomer(customerId);
      if (!customer || customer.creatorId !== creator._id) {
        return res.status(404).json({ error: "Customer not found" });
      }

      console.log(`🎬 Triggering video generation for customer: ${customer.name} (${customer.whopUserId})`);

      // Generate personalized script
      const personalizedScript = replacePlaceholders(creator.messageTemplate, {
        name: customer.name,
        email: customer.email,
        username: customer.username,
        planName: customer.planName,
      });

      console.log(`📝 Personalized script: ${personalizedScript}`);

      // Create video record
      const video = await storage.createVideo({
        customerId: customer._id,
        creatorId: creator._id,
        personalizedScript,
        status: VIDEO_STATUSES.GENERATING,
        viewCount: 0,
        updatedAt: new Date(),
      });

      // Generate video with HeyGen Avatar IV
      console.log(`🎥 Calling HeyGen Avatar IV API to generate video...`);
      
      let video_id: string = "";
      
      if (!creator.avatarPhotoUrl) {
        throw new Error("Avatar photo URL not found");
      }

      // Try Fish Audio TTS first if model is available and trained
      let usedFishAudio = false;
      if (creator.fishAudioModelId) {
        try {
          console.log(`🐟 Checking Fish Audio model ${creator.fishAudioModelId}...`);
          
          // Check if model is trained
          const modelStatus = await fishAudioSdk.getModel(creator.fishAudioModelId);
          
          if (modelStatus.state === 'trained') {
            console.log(`🐟 Using Fish Audio TTS with trained model`);
            
            // Generate audio with Fish Audio
            const audioBuffer = await fishAudioSdk.generateSpeech({
              text: personalizedScript,
              referenceId: creator.fishAudioModelId,
              format: 'mp3',
            });

            // Upload generated audio to HeyGen
            const audioBlob = Buffer.from(audioBuffer);
            const { audio_url } = await heygenSdk.uploadAudio(
              audioBlob,
              `fish-audio-${Date.now()}.mp3`,
              'audio/mp3'
            );

            console.log(`🐟 Fish Audio uploaded to HeyGen: ${audio_url}`);

            // Generate video with custom audio
            const result = await heygenSdk.generateAvatarIVWithAudio({
              avatar_image_url: creator.avatarPhotoUrl,
              input_audio_url: audio_url,
              test: true,
              title: `Welcome video for ${customer.name}`,
            });
            video_id = result.video_id;
            usedFishAudio = true;
          } else {
            console.log(`⚠️ Fish Audio model state: ${modelStatus.state} (not trained yet). Falling back to other audio methods.`);
          }
        } catch (fishError) {
          console.error(`⚠️ Fish Audio TTS failed:`, fishError);
          console.log(`Falling back to other audio methods...`);
        }
      }
      
      if (!usedFishAudio && creator.useAudioForGeneration && creator.audioFileUrl) {
        console.log(`Using Avatar IV with uploaded audio file`);
        const result = await heygenSdk.generateAvatarIVWithAudio({
          avatar_image_url: creator.avatarPhotoUrl,
          input_audio_url: creator.audioFileUrl,
          test: true,
          title: `Welcome video for ${customer.name}`,
        });
        video_id = result.video_id;
      } else if (!usedFishAudio) {
        console.log(`Using Avatar IV with HeyGen text-to-speech`);
        const result = await heygenSdk.generateAvatarIVVideo({
          avatar_image_url: creator.avatarPhotoUrl,
          input_text: personalizedScript,
          voice_id: creator.voiceId || "1bd001e7e50f421d891986aad5158bc8",
          test: true,
          title: `Welcome video for ${customer.name}`,
        });
        video_id = result.video_id;
      }

      console.log(`✅ HeyGen video generation started! Video ID: ${video_id}`);

      await storage.updateVideo(video._id, {
        heygenVideoId: video_id,
      });

      return res.json({
        success: true,
        message: "Video generation started! It will automatically be sent via DM when ready.",
        videoId: video._id,
        heygenVideoId: video_id,
        script: personalizedScript,
      });
    } catch (error) {
      console.error("❌ Error triggering video generation:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to trigger video generation" 
      });
    }
  });

  // Manually send or resend a video DM to a customer
  app.post("/api/admin/send-video-dm", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);
      const creator = await storage.getCreatorByWhopUserId(userId);

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      const { videoId } = req.body;
      if (!videoId) {
        return res.status(400).json({ error: "videoId is required" });
      }

      const video = await storage.getVideo(videoId);
      if (!video || video.creatorId !== creator._id) {
        return res.status(404).json({ error: "Video not found" });
      }

      if (!video.videoUrl) {
        return res.status(400).json({ error: "Video URL not available" });
      }

      const customer = await storage.getCustomer(video.customerId);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }

      const messageContent = `Hi ${customer.name}! 🎥 I recorded a personal welcome message just for you. Check it out: ${video.videoUrl}`;

      try {
        // Send DM using Whop REST API
        const channelId = customer.whopUserId;
        
        const response = await fetch("https://api.whop.com/api/v5/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.WHOP_API_KEY}`,
          },
          body: JSON.stringify({
            channel_id: channelId,
            content: messageContent,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          const errorMessage = result?.message || result?.error || "Failed to send DM";
          
          // Check if it's a permissions error
          const isPermissionError = errorMessage.toLowerCase().includes('permission') || 
                                   errorMessage.toLowerCase().includes('unauthorized') ||
                                   errorMessage.toLowerCase().includes('forbidden');
          
          if (isPermissionError) {
            console.error("⚠️ PERMISSIONS ISSUE: The app may not have 'message:write' permission.");
            throw new Error("Missing permission: message:write. Please re-approve app permissions in Whop Dashboard.");
          }
          
          throw new Error(errorMessage);
        }

        await storage.updateVideo(video._id, {
          status: VIDEO_STATUSES.SENT,
          whopChatId: channelId,
          whopMessageId: result.id,
          sentAt: new Date(),
          errorMessage: null,
        });

        await storage.updateCustomer(customer._id, {
          firstVideoSent: true,
        });

        return res.json({ success: true, message: "DM sent successfully" });
      } catch (error) {
        console.error("Manual DM send failed:", error);
        return res.status(500).json({ 
          error: error instanceof Error ? error.message : "Failed to send DM",
          details: "Check server logs for more information"
        });
      }
    } catch (error) {
      console.error("Error in manual DM send:", error);
      return res.status(500).json({ error: "Failed to send DM" });
    }
  });

  // Get list of customers with video status
  app.get("/api/admin/customers", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);
      const creator = await storage.getCreatorByWhopUserId(userId);

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      // MULTI-TENANT VALIDATION: Ensure creator has company ID
      if (!creator.whopCompanyId) {
        console.warn(`⚠️ Creator ${creator._id} has no company ID - multi-tenant isolation may be compromised`);
      } else {
        console.log(`📊 Fetching customers for creator ${creator._id} (company: ${creator.whopCompanyId})`);
      }

      const customers = await storage.getCustomersByCreator(creator._id);
      
      // Get video status for each customer
      const customersWithVideos = await Promise.all(
        customers.map(async (customer) => {
          const videos = await storage.getVideosByCustomer(customer._id);
          return {
            ...customer,
            videos: videos.map(v => ({
              id: v._id,
              status: v.status,
              videoUrl: v.videoUrl,
              createdAt: v.createdAt,
              sentAt: v.sentAt,
              viewedAt: v.viewedAt,
              whopChatId: v.whopChatId,
              whopMessageId: v.whopMessageId,
              errorMessage: v.errorMessage,
            })),
            latestVideo: videos.length > 0 ? videos[videos.length - 1] : null,
          };
        })
      );

      return res.json({ customers: customersWithVideos });
    } catch (error) {
      console.error("Error fetching customers:", error);
      return res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  // Get analytics data
  app.get("/api/admin/analytics", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);
      const creator = await storage.getCreatorByWhopUserId(userId);

      if (!creator) {
        return res.status(404).json({ error: "Creator not found" });
      }

      // MULTI-TENANT VALIDATION: Ensure creator has company ID
      if (!creator.whopCompanyId) {
        console.warn(`⚠️ Creator ${creator._id} has no company ID - multi-tenant isolation may be compromised`);
        console.warn(`   Analytics will only show local database data, not live Whop API data`);
      }

      // Try to fetch total members from Whop API first, fallback to local storage
      let totalCustomers = 0;
      let usingWhopApi = false;
      
      if (creator.whopCompanyId) {
        try {
          let allMembers: any[] = [];
          let currentPage = 1;
          let totalPages = 1;

          // MULTI-TENANT FIX: Add company_id parameter to scope API call to specific company
          console.log(`📊 Fetching members for company: ${creator.whopCompanyId}`);
          
          while (currentPage <= totalPages) {
            const response = await fetch(`https://api.whop.com/v5/app/members?company_id=${creator.whopCompanyId}&page=${currentPage}&per=50`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${process.env.WHOP_API_KEY}`,
                'Content-Type': 'application/json',
              },
            });

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`❌ Whop API Error for company ${creator.whopCompanyId}:`);
              console.error(`   Status: ${response.status} ${response.statusText}`);
              console.error(`   Body: ${errorText}`);
              
              // Check for permission errors
              if (response.status === 403) {
                console.error(`   ⚠️  PERMISSION DENIED - The company ${creator.whopCompanyId} needs to approve member:basic:read permission`);
              }
              
              throw new Error(`Whop API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.data && Array.isArray(data.data)) {
              allMembers = allMembers.concat(data.data);
            }
            
            if (data.pagination) {
              totalPages = data.pagination.total_pages || 1;
              totalCustomers = data.pagination.total_count || allMembers.length;
            }
            
            currentPage++;
          }

          if (totalCustomers === 0) {
            totalCustomers = allMembers.length;
          }

          usingWhopApi = true;
          console.log(`✅ Fetched ${totalCustomers} members from Whop API for company ${creator.whopCompanyId}`);
        } catch (error) {
          console.error("⚠️ Error fetching members from Whop API, falling back to local storage:", error);
          if (error instanceof Error) {
            console.error("Error details:", error.message);
          }
        }
      }

      // Fallback to local storage count if Whop API failed or no company ID
      if (!usingWhopApi) {
        const customers = await storage.getCustomersByCreator(creator._id);
        totalCustomers = customers.length;
        console.log(`📊 Using local storage count: ${totalCustomers} members`);
      }

      const videos = await storage.getVideosByCreator(creator._id);

      const analytics = {
        totalCustomers,
        totalVideos: videos.length,
        videosSent: videos.filter(v => v.status === VIDEO_STATUSES.SENT || v.status === VIDEO_STATUSES.DELIVERED || v.status === VIDEO_STATUSES.VIEWED).length,
        videosViewed: videos.filter(v => v.status === VIDEO_STATUSES.VIEWED).length,
        videosPending: videos.filter(v => v.status === VIDEO_STATUSES.PENDING || v.status === VIDEO_STATUSES.GENERATING).length,
        videosFailed: videos.filter(v => v.status === VIDEO_STATUSES.FAILED).length,
        totalViews: videos.reduce((sum, v) => sum + v.viewCount, 0),
        averageViewsPerVideo: videos.length > 0 ? videos.reduce((sum, v) => sum + v.viewCount, 0) / videos.length : 0,
        recentVideos: videos.slice(-10).reverse(),
      };

      return res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      return res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // List available HeyGen avatar groups
  app.get("/api/admin/heygen/avatar-groups", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await whopSdk.verifyUserToken(userToken);

      const { avatar_group_list } = await heygenSdk.listAvatarGroups();

      return res.json({ avatarGroups: avatar_group_list });
    } catch (error) {
      console.error("Error fetching avatar groups:", error);
      return res.status(500).json({ error: "Failed to fetch avatar groups" });
    }
  });

  // List avatars/looks in a group
  app.get("/api/admin/heygen/avatar-groups/:groupId/avatars", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await whopSdk.verifyUserToken(userToken);

      const { groupId } = req.params;
      const { avatar_list } = await heygenSdk.listGroupAvatars(groupId);

      return res.json({ avatars: avatar_list });
    } catch (error) {
      console.error("Error fetching group avatars:", error);
      return res.status(500).json({ error: "Failed to fetch group avatars" });
    }
  });

  // List available voices
  app.get("/api/admin/heygen/voices", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await whopSdk.verifyUserToken(userToken);

      const { voices } = await heygenSdk.listVoices();

      return res.json({ voices });
    } catch (error) {
      console.error("Error fetching voices:", error);
      return res.status(500).json({ error: "Failed to fetch voices" });
    }
  });

  // ============================================================================
  // HEYGEN WEBHOOK
  // ============================================================================

  // Receive HeyGen video completion webhook
  app.post("/api/heygen/webhook", async (req, res) => {
    try {
      // Verify webhook signature (if configured)
      const signature = req.headers["signature"] as string;
      const webhookSecret = process.env.HEYGEN_WEBHOOK_SECRET;

      if (webhookSecret && signature) {
        const content = JSON.stringify(req.body);
        const hmac = crypto.createHmac("sha256", webhookSecret);
        hmac.update(content, "utf-8");
        const computedSignature = hmac.digest("hex");

        if (computedSignature !== signature) {
          console.error("Invalid webhook signature");
          return res.status(401).json({ error: "Invalid signature" });
        }
      }

      const { event_type, event_data } = req.body;

      if (event_type === "avatar_video.success") {
        const { video_id, url, callback_id } = event_data;

        // Find video by HeyGen video ID
        const video = await storage.getVideoByHeygenId(video_id);

        if (video) {
          // Update video with completion data
          await storage.updateVideo(video._id, {
            status: VIDEO_STATUSES.COMPLETED,
            videoUrl: url,
            completedAt: new Date(),
          });

          // Send DM to customer with video
          try {
            const customer = await storage.getCustomer(video.customerId);
            const creator = await storage.getCreator(video.creatorId);

            if (customer && creator) {
              try {
                // Send DM using Whop REST API
                const messageContent = `Hi ${customer.name}! 🎥 I recorded a personal welcome message just for you. Check it out: ${url}`;
                
                console.log(`Attempting to send DM to user ${customer.whopUserId}`);
                console.log(`Message content: ${messageContent}`);
                
                // Use customer's user ID as the channel_id for DMs
                const channelId = customer.whopUserId;
                
                const response = await fetch("https://api.whop.com/api/v5/messages", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.WHOP_API_KEY}`,
                  },
                  body: JSON.stringify({
                    channel_id: channelId,
                    content: messageContent,
                  }),
                });

                const message = await response.json();
                
                if (!response.ok) {
                  throw new Error(`Whop API error: ${response.status} - ${JSON.stringify(message)}`);
                }

                console.log(`✅ DM sent successfully to ${customer.name}`);
                console.log(`Message ID: ${message.id}`);

                // Update video status to sent after successful delivery
                await storage.updateVideo(video._id, {
                  status: VIDEO_STATUSES.SENT,
                  whopChatId: channelId,
                  whopMessageId: message.id,
                  sentAt: new Date(),
                });

                // Mark customer as having received first video
                await storage.updateCustomer(customer._id, {
                  firstVideoSent: true,
                });

                console.log(`Video ${video_id} sent to ${customer.name} via DM`);
              } catch (dmApiError: any) {
                console.error("❌ DM sending failed!");
                console.error("Error:", dmApiError);
                
                // Check if it's a permissions error
                const errorMessage = dmApiError?.message || dmApiError?.toString() || "Unknown error";
                const isPermissionError = errorMessage.toLowerCase().includes('permission') || 
                                         errorMessage.toLowerCase().includes('unauthorized') ||
                                         errorMessage.toLowerCase().includes('forbidden');
                
                if (isPermissionError) {
                  console.error("⚠️ PERMISSIONS ISSUE: The app may not have 'message:write' permission.");
                  console.error("Go to Whop Dashboard → Developer → Your App → Permissions");
                  console.error("Add 'message:write' permission and re-approve the app installation.");
                }
                
                // Mark as FAILED since DM couldn't be sent
                await storage.updateVideo(video._id, {
                  status: VIDEO_STATUSES.FAILED,
                  errorMessage: `DM delivery failed: ${errorMessage}`,
                });
                
                console.log(`❌ Video ${video_id} marked as FAILED - DM delivery failed. Video URL: ${url}`);
              }
            } else {
              console.error('❌ Customer or creator not found for video:', video._id);
              await storage.updateVideo(video._id, {
                status: VIDEO_STATUSES.FAILED,
                errorMessage: 'Customer or creator not found',
              });
            }
          } catch (dmError) {
            console.error("❌ Error in DM sending workflow:", dmError);
            await storage.updateVideo(video._id, {
              status: VIDEO_STATUSES.FAILED,
              errorMessage: dmError instanceof Error ? dmError.message : "DM workflow error",
            });
          }
        }
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Error processing webhook:", error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  // ============================================================================
  // WHOP WEBHOOKS
  // ============================================================================

  // Whop webhook handler - listens for multiple membership events
  app.post("/api/whop/webhook", async (req, res) => {
    try {
      console.log("=== WHOP WEBHOOK RECEIVED ===");
      console.log("Headers:", JSON.stringify(req.headers, null, 2));
      console.log("Body:", JSON.stringify(req.body, null, 2));

      // Verify webhook signature
      const signatureHeader = req.headers["x-whop-signature"] as string;
      const webhookSecret = process.env.WHOP_WEBHOOK_SECRET;

      if (webhookSecret) {
        if (!signatureHeader) {
          console.error("Missing Whop webhook signature");
          return res.status(401).json({ error: "Missing signature" });
        }

        // Parse Whop signature format: t=timestamp,v1=hash
        const sigParts = signatureHeader.split(',');
        const timestamp = sigParts[0]?.split('=')[1];
        const signature = sigParts[1]?.split('=')[1];

        if (!timestamp || !signature) {
          console.error("Invalid Whop webhook signature format");
          return res.status(401).json({ error: "Invalid signature format" });
        }

        // Whop signs: timestamp.json_body
        const content = JSON.stringify(req.body);
        const signedPayload = `${timestamp}.${content}`;
        
        const hmac = crypto.createHmac("sha256", webhookSecret);
        hmac.update(signedPayload, "utf-8");
        const computedSignature = hmac.digest("hex");

        if (computedSignature !== signature) {
          console.error("Invalid Whop webhook signature");
          console.error(`Expected: ${computedSignature}`);
          console.error(`Received: ${signature}`);
          console.error(`Timestamp: ${timestamp}`);
          console.error(`Payload: ${signedPayload.substring(0, 100)}...`);
          return res.status(401).json({ error: "Invalid signature" });
        }
        
        console.log("✅ Whop webhook signature verified successfully");
      } else {
        console.warn("⚠️ WHOP_WEBHOOK_SECRET not set - webhook signature verification skipped");
      }

      const { action, data } = req.body;

      console.log(`📥 Received Whop webhook action: ${action}`);

      // Handle new member joining - supports multiple event formats
      // Whop uses dots in event names: "membership.went_valid", "membership.created"
      if (action === "membership.went_valid" || action === "membership.created" || 
          action === "membership_went_valid" || action === "app_membership_went_valid") {
        console.log(`✅ Processing new member webhook event: ${action}`);
        console.log(`📋 Webhook data - status_reason: ${data?.status_reason || 'not provided'}, status: ${data?.status}`);
        
        // Log the full data object to debug what fields are available
        console.log("📋 Full webhook data object:", JSON.stringify(data, null, 2));
        
        const memberId = data.id;
        const userId = data.user_id || data.user?.id;
        const email = data.user?.email;
        const planName = data.access_pass?.name || data.plan?.id || data.plan_id;
        const productId = data.product_id;
        
        // Try multiple possible locations for company_id
        let companyId = data.company?.id || data.company_id || data.biz_id || data.business_id;
        
        // If still no company_id, try to fetch it from the membership
        if (!companyId && memberId) {
          console.log("📋 No company_id in webhook payload, attempting to fetch from membership...");
          try {
            const membership = await whopSdk.memberships.getMembership({ id: memberId });
            console.log("📋 Fetched membership:", JSON.stringify(membership, null, 2));
            companyId = membership.company_id || membership.company?.id;
          } catch (membershipError) {
            console.error("❌ Error fetching membership:", membershipError);
          }
        }

        if (!memberId || !userId) {
          console.error("Missing memberId or userId in webhook payload");
          return res.status(200).json({ success: true, message: "Invalid payload" });
        }

        console.log(`📦 Membership data - Company ID: ${companyId || 'not found'}, Product ID: ${productId || 'not found'}`);

        // Fetch full user details from Whop SDK
        let username = "New Member";
        let name = "New Member";
        try {
          const userDetails = await whopSdk.users.getUser({ userId });
          console.log("Webhook - Fetched user details:", JSON.stringify(userDetails));
          username = userDetails.username || "New Member";
          name = userDetails.name || userDetails.username || "New Member";
          console.log(`Fetched user details from Whop: ${name} (@${username})`);
        } catch (userError) {
          console.error("Error fetching user details:", userError);
          username = data.user?.username || "New Member";
          name = username;
        }

        console.log(`New member joined: ${name} (@${username}, ${userId})`);

        // MULTI-TENANT FIX: Match creator by company ID, not first available
        if (!companyId) {
          console.error("⚠️ No company ID found in webhook or membership - falling back to first setup creator");
          console.error("⚠️ This may cause issues in multi-tenant setups!");
          
          // Fallback: Use the first creator with completed setup
          const allCreators = await storage.getAllCreators();
          const setupCreator = allCreators.find(c => c.isSetupComplete);
          
          if (!setupCreator) {
            console.error("❌ No setup complete creator found");
            return res.status(200).json({ success: true, message: "No creator setup yet" });
          }
          
          companyId = setupCreator.whopCompanyId;
          console.log(`📋 Using fallback creator with company ID: ${companyId}`);
        }

        console.log(`🔍 Looking for creator with company ID: ${companyId}`);
        const creator = await storage.getCreatorByCompanyId(companyId);

        if (!creator) {
          console.log(`❌ No creator found for company ${companyId}`);
          return res.status(200).json({ success: true, message: "Company not setup yet" });
        }

        if (!creator.isSetupComplete) {
          console.log(`⚠️ Creator for company ${companyId} exists but setup not complete`);
          return res.status(200).json({ success: true, message: "Creator setup incomplete" });
        }

        console.log(`✅ Found creator for company ${companyId}: ${creator._id}`);

        // Check if customer already exists
        let customer = await storage.getCustomerByWhopUserId(creator._id, userId);

        if (!customer) {
          // Create new customer record
          customer = await storage.createCustomer({
            creatorId: creator._id,
            whopUserId: userId,
            whopMemberId: memberId,
            whopCompanyId: companyId || null,
            name: name,
            email: email || null,
            username: username || null,
            planName: planName || null,
            joinedAt: new Date(),
            firstVideoSent: false,
            updatedAt: new Date(),
          });

          console.log(`Created customer record for ${name} with company ID: ${companyId || 'none'}`);
        } else {
          console.log(`Customer ${username} already exists`);
          // Update company ID if it wasn't set before
          if (companyId && !customer.whopCompanyId) {
            await storage.updateCustomer(customer._id, { whopCompanyId: companyId });
            console.log(`Updated customer ${username} with company ID: ${companyId}`);
          }
        }

        // Skip video generation if customer already has a video
        const existingVideos = await storage.getVideosByCustomer(customer._id);
        if (existingVideos.length > 0) {
          console.log(`Customer ${username} already has videos, skipping generation`);
          return res.status(200).json({ success: true, message: "Customer already has video" });
        }

        // Generate personalized script using template
        const personalizedScript = replacePlaceholders(creator.messageTemplate, {
          name: customer.name,
          email: customer.email,
          username: customer.username,
          planName: customer.planName,
        });

        // Create video record
        const video = await storage.createVideo({
          customerId: customer._id,
          creatorId: creator._id,
          personalizedScript,
          status: VIDEO_STATUSES.GENERATING,
          heygenVideoId: null,
          heygenGenerationId: null,
          videoUrl: null,
          thumbnailUrl: null,
          whopChatId: null,
          whopMessageId: null,
          errorMessage: null,
          viewCount: 0,
          completedAt: null,
          sentAt: null,
          viewedAt: null,
          updatedAt: new Date(),
        });

        console.log(`Created video record for ${username}`);

        // Trigger HeyGen Avatar IV video generation
        try {
          let video_id: string;
          
          if (!creator.avatarPhotoUrl) {
            throw new Error("Avatar photo URL not found");
          }

          if (creator.useAudioForGeneration && creator.audioFileUrl) {
            console.log(`Using Avatar IV with audio file for ${username}`);
            const result = await heygenSdk.generateAvatarIVWithAudio({
              avatar_image_url: creator.avatarPhotoUrl,
              input_audio_url: creator.audioFileUrl,
              test: true,
              title: `Welcome video for ${customer.name}`,
            });
            video_id = result.video_id;
          } else {
            console.log(`Using Avatar IV with text-to-speech for ${username}`);
            const result = await heygenSdk.generateAvatarIVVideo({
              avatar_image_url: creator.avatarPhotoUrl,
              input_text: personalizedScript,
              voice_id: creator.voiceId || "1bd001e7e50f421d891986aad5158bc8",
              test: true,
              title: `Welcome video for ${customer.name}`,
            });
            video_id = result.video_id;
          }

          // Update video with HeyGen video ID
          await storage.updateVideo(video._id, {
            heygenVideoId: video_id,
            status: VIDEO_STATUSES.GENERATING,
          });

          console.log(`HeyGen video generation started for ${username}: ${video_id}`);
        } catch (heygenError) {
          console.error("HeyGen API error:", heygenError);
          await storage.updateVideo(video._id, {
            status: VIDEO_STATUSES.FAILED,
            errorMessage: heygenError instanceof Error ? heygenError.message : "HeyGen API error",
          });
        }
      } else {
        console.log(`ℹ️ Received webhook action "${action}" but no handler configured for this event type`);
      }

      // Always return 200 to acknowledge receipt (required by Whop)
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error processing Whop webhook:", error);
      // Still return 200 to prevent Whop from retrying
      return res.status(200).json({ success: true });
    }
  });

  // Webhook test endpoint - verify webhooks are working
  app.get("/api/whop/webhook/test", async (req, res) => {
    console.log("=== WEBHOOK TEST ENDPOINT HIT ===");
    console.log("Environment check:");
    console.log("- WHOP_API_KEY:", process.env.WHOP_API_KEY ? "✓ Set" : "✗ Missing");
    console.log("- WHOP_WEBHOOK_SECRET:", process.env.WHOP_WEBHOOK_SECRET ? "✓ Set" : "✗ Missing");
    console.log("- NEXT_PUBLIC_WHOP_APP_ID:", process.env.NEXT_PUBLIC_WHOP_APP_ID ? "✓ Set" : "✗ Missing");
    
    return res.json({
      status: "Webhook endpoint is accessible",
      webhookUrl: "/api/whop/webhook",
      environment: {
        hasApiKey: !!process.env.WHOP_API_KEY,
        hasWebhookSecret: !!process.env.WHOP_WEBHOOK_SECRET,
        hasAppId: !!process.env.NEXT_PUBLIC_WHOP_APP_ID,
      },
      instructions: "Send a POST request to /api/whop/webhook with Whop webhook payload"
    });
  });

  // ============================================================================
  // CUSTOMER ENDPOINTS
  // ============================================================================

  // Get customer welcome status
  app.get("/api/customer/welcome-status", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);

      // Search for customer record by Whop user ID
      // We need to check across all creators since we don't know which one this customer belongs to
      const allCreators = await storage.getAllCreators();
      let customer: Customer | undefined;
      
      for (const creator of allCreators) {
        customer = await storage.getCustomerByWhopUserId(creator._id, userId);
        if (customer) break;
      }

      const displayName = customer?.name || customer?.username || "there";

      if (!customer) {
        return res.json({
          hasWelcomeVideo: false,
          videoStatus: null,
          message: "Your personal video message is being prepared 🎥",
          userName: displayName,
          userId: userId,
        });
      }

      // Get latest video for this customer
      const videos = await storage.getVideosByCustomer(customer._id);
      const latestVideo = videos.length > 0 ? videos[videos.length - 1] : null;

      let message = "Check your DMs for a personal message 🎥";
      if (latestVideo) {
        if (latestVideo.status === VIDEO_STATUSES.GENERATING || latestVideo.status === VIDEO_STATUSES.PENDING) {
          message = "Your personal welcome video is being created... Check back in a moment! 🎬";
        } else if (latestVideo.status === VIDEO_STATUSES.SENT || latestVideo.status === VIDEO_STATUSES.DELIVERED) {
          message = "We just sent you a personal video message — check your DMs 🎥";
        } else if (latestVideo.status === VIDEO_STATUSES.FAILED) {
          message = "Welcome to our community! 👋";
        }
      }

      return res.json({
        hasWelcomeVideo: customer.firstVideoSent,
        videoStatus: latestVideo?.status || null,
        videoUrl: latestVideo?.videoUrl || null,
        message,
        userName: displayName,
        userId: userId,
      });
    } catch (error) {
      console.error("Error fetching welcome status:", error);
      return res.status(500).json({ error: "Failed to fetch welcome status" });
    }
  });

  // Trigger test welcome video for current customer
  // Reset test video status (for testing purposes)
  app.post("/api/customer/reset-test-status", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { userId } = await whopSdk.verifyUserToken(userToken);

      // Get the first creator with setup complete
      const allCreators = await storage.getAllCreators();
      const creator = allCreators.find(c => c.isSetupComplete);

      if (!creator) {
        return res.status(400).json({ error: "No admin has completed setup yet." });
      }

      // Find customer
      const customer = await storage.getCustomerByWhopUserId(creator._id, userId);
      
      if (customer) {
        console.log(`🔄 Resetting test status for customer ${customer.name}`);
        await storage.updateCustomer(customer._id, {
          firstVideoSent: false,
        });

        // Mark any generating videos as failed
        const videos = await storage.getVideosByCustomer(customer._id);
        for (const video of videos) {
          if (video.status === VIDEO_STATUSES.GENERATING) {
            await storage.updateVideo(video._id, {
              status: VIDEO_STATUSES.FAILED,
              errorMessage: 'Manually reset by user',
            });
          }
        }
      }

      return res.json({ success: true, message: "Test status reset successfully" });
    } catch (error) {
      console.error("Error resetting test status:", error);
      return res.status(500).json({ error: "Failed to reset test status" });
    }
  });

  app.post("/api/customer/trigger-test-video", async (req, res) => {
    try {
      const userToken = req.headers["x-whop-user-token"] as string;
      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      console.log("🧪 TEST: Customer triggering test video generation");

      const { userId } = await whopSdk.verifyUserToken(userToken);
      
      // Get user details
      const user = await whopSdk.users.getUser({ userId });
      const userName = user.name || user.username || "Member";
      const userEmail = (user as any).email || null;
      const username = user.username || null;

      console.log(`🧪 TEST: User ${userName} (${userId}) requesting test video`);

      // Get the first creator (admin) with setup complete
      const allCreators = await storage.getAllCreators();
      const creator = allCreators.find(c => c.isSetupComplete);

      if (!creator) {
        return res.status(400).json({ 
          error: "No admin has completed setup yet. Please ask the admin to upload an avatar and set a message template first." 
        });
      }

      console.log(`🧪 TEST: Using creator ${creator.whopUserId} for video generation`);

      // Check if customer already exists
      let customer = await storage.getCustomerByWhopUserId(creator._id, userId);

      // Use creator's company ID (should be set during initialization)
      let companyId = creator.whopCompanyId;

      // Create customer record if doesn't exist
      if (!customer) {
        console.log(`🧪 TEST: Creating new customer record for ${userName}`);
        customer = await storage.createCustomer({
          creatorId: creator._id,
          whopUserId: userId,
          whopMemberId: `member_test_${Date.now()}`,
          whopCompanyId: companyId || null,
          name: userName,
          email: userEmail,
          username: username,
          planName: "Test Plan",
          joinedAt: new Date(),
          firstVideoSent: false,
          updatedAt: new Date(),
        });
      } else {
        console.log(`🧪 TEST: Found existing customer record for ${userName}`);
        // Update company ID if we found one and it's not set
        if (companyId && !customer.whopCompanyId) {
          await storage.updateCustomer(customer._id, { whopCompanyId: companyId });
          console.log(`🧪 TEST: Updated customer with company ID: ${companyId}`);
        }
      }

      // Generate personalized script
      const personalizedScript = replacePlaceholders(creator.messageTemplate, {
        name: customer.name,
        email: customer.email,
        username: customer.username,
        planName: customer.planName,
      });

      console.log(`🧪 TEST: Personalized script: ${personalizedScript}`);

      // Create video record
      const video = await storage.createVideo({
        customerId: customer._id,
        creatorId: creator._id,
        personalizedScript,
        status: VIDEO_STATUSES.GENERATING,
        viewCount: 0,
        updatedAt: new Date(),
      });

      console.log(`🧪 TEST: Created video record ${video._id}`);

      // Generate video with HeyGen Avatar IV
      console.log(`🎥 Calling HeyGen Avatar IV API...`);
      
      let video_id: string;
      
      if (!creator.avatarPhotoUrl) {
        throw new Error("Avatar photo URL not found");
      }

      if (creator.useAudioForGeneration && creator.audioFileUrl) {
        console.log(`🧪 TEST: Using Avatar IV with audio file`);
        const result = await heygenSdk.generateAvatarIVWithAudio({
          avatar_image_url: creator.avatarPhotoUrl,
          input_audio_url: creator.audioFileUrl,
          test: true,
          title: `Welcome video for ${customer.name}`,
        });
        video_id = result.video_id;
      } else {
        console.log(`🧪 TEST: Using Avatar IV with text-to-speech`);
        const result = await heygenSdk.generateAvatarIVVideo({
          avatar_image_url: creator.avatarPhotoUrl,
          input_text: personalizedScript,
          voice_id: creator.voiceId || "1bd001e7e50f421d891986aad5158bc8",
          test: true,
          title: `Welcome video for ${customer.name}`,
        });
        video_id = result.video_id;
      }

      console.log(`✅ HeyGen video generation started! Video ID: ${video_id}`);

      await storage.updateVideo(video._id, {
        heygenVideoId: video_id,
      });

      return res.json({
        success: true,
        message: "🎬 Your welcome video is being generated! It will be sent to your DMs automatically when ready (usually 1-2 minutes).",
        videoId: video._id,
        heygenVideoId: video_id,
        script: personalizedScript,
      });
    } catch (error) {
      console.error("❌ Error triggering test video:", error);
      return res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to trigger test video" 
      });
    }
  });

  // ============================================================================
  // VIDEO POLLING SERVICE
  // ============================================================================

  async function processGeneratingVideos() {
    try {
      const generatingVideos = await storage.getVideosByStatus(VIDEO_STATUSES.GENERATING);
      
      if (generatingVideos.length === 0) {
        return;
      }

      console.log(`📹 Polling: Found ${generatingVideos.length} video(s) being generated...`);

      for (const video of generatingVideos) {
        if (!video.heygenVideoId) {
          console.log(`⚠️ Video ${video._id} has no HeyGen video ID, marking as failed...`);
          await storage.updateVideo(video._id, {
            status: VIDEO_STATUSES.FAILED,
            errorMessage: 'Video generation failed: No HeyGen video ID was created',
          });
          continue;
        }

        try {
          const statusResult = await heygenSdk.getVideoStatus(video.heygenVideoId);
          console.log(`📹 Video ${video.heygenVideoId} status: ${statusResult.status}`);

          if (statusResult.status === "completed" && statusResult.video_url) {
            console.log(`✅ Video ${video.heygenVideoId} is complete! URL: ${statusResult.video_url}`);

            await storage.updateVideo(video._id, {
              status: VIDEO_STATUSES.COMPLETED,
              videoUrl: statusResult.video_url,
              thumbnailUrl: statusResult.thumbnail_url,
              completedAt: new Date(),
            });

            const customer = await storage.getCustomer(video.customerId);
            const creator = await storage.getCreator(video.creatorId);

            if (customer && creator) {
              try {
                const messageContent = `Hi ${customer.name}! 🎥 I recorded a personal welcome message just for you. Check it out: ${statusResult.video_url}`;
                
                console.log(`📤 Sending DM to user ${customer.whopUserId}...`);
                console.log(`Message content: ${messageContent}`);
                
                // Use customer's user ID as the channel_id for DMs
                const channelId = customer.whopUserId;
                
                const response = await fetch("https://api.whop.com/api/v5/messages", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.WHOP_API_KEY}`,
                  },
                  body: JSON.stringify({
                    channel_id: channelId,
                    content: messageContent,
                  }),
                });

                const message = await response.json();
                
                if (!response.ok) {
                  const errorMessage = message?.message || message?.error || "Failed to send DM";
                  
                  // Check if it's a permissions error
                  const isPermissionError = errorMessage.toLowerCase().includes('permission') || 
                                           errorMessage.toLowerCase().includes('unauthorized') ||
                                           errorMessage.toLowerCase().includes('forbidden');
                  
                  if (isPermissionError) {
                    console.error("⚠️ PERMISSIONS ISSUE: The app may not have 'message:write' permission.");
                    console.error("Go to Whop Dashboard → Developer → Your App → Permissions");
                    console.error("Add 'message:write' permission and re-approve the app installation.");
                  }
                  
                  throw new Error(errorMessage);
                }

                console.log(`✅ DM sent successfully to ${customer.name}`);
                console.log(`Message ID: ${message.id}`);

                await storage.updateVideo(video._id, {
                  status: VIDEO_STATUSES.SENT,
                  whopChatId: channelId,
                  whopMessageId: message.id,
                  sentAt: new Date(),
                });

                await storage.updateCustomer(customer._id, {
                  firstVideoSent: true,
                });

                console.log(`🎉 Video ${video.heygenVideoId} successfully sent to ${customer.name}`);
              } catch (dmApiError: any) {
                console.error("❌ DM sending failed!");
                console.error("Error:", dmApiError);
                
                // Check if it's a permissions error
                const errorMessage = dmApiError?.message || dmApiError?.toString() || "Unknown error";
                const isPermissionError = errorMessage.toLowerCase().includes('permission') || 
                                         errorMessage.toLowerCase().includes('unauthorized') ||
                                         errorMessage.toLowerCase().includes('forbidden');
                
                if (isPermissionError) {
                  console.error("⚠️ PERMISSIONS ISSUE: The app may not have 'message:write' permission.");
                  console.error("Go to Whop Dashboard → Developer → Your App → Permissions");
                  console.error("Add 'message:write' permission and re-approve the app installation.");
                }
                
                // Mark as FAILED since DM couldn't be sent
                await storage.updateVideo(video._id, {
                  status: VIDEO_STATUSES.FAILED,
                  errorMessage: `DM delivery failed: ${errorMessage}`,
                });
                
                console.log(`❌ Video ${video.heygenVideoId} marked as FAILED - DM delivery failed. Video URL: ${statusResult.video_url}`);
              }
            } else {
              console.error('❌ Customer or creator not found for video:', video._id);
              await storage.updateVideo(video._id, {
                status: VIDEO_STATUSES.FAILED,
                errorMessage: 'Customer or creator not found',
              });
            }
          } else if (statusResult.status === "failed" || statusResult.error) {
            console.error(`❌ Video ${video.heygenVideoId} failed:`, statusResult.error);
            await storage.updateVideo(video._id, {
              status: VIDEO_STATUSES.FAILED,
              errorMessage: statusResult.error?.message || "HeyGen generation failed",
            });
          }
        } catch (error) {
          console.error(`❌ Error checking video ${video.heygenVideoId}:`, error);
        }
      }
    } catch (error) {
      console.error("❌ Error in video polling service:", error);
    }
  }

  // Start polling service - check every 30 seconds
  const POLLING_INTERVAL = 30000;
  setInterval(processGeneratingVideos, POLLING_INTERVAL);
  console.log(`🔄 Video polling service started (checking every ${POLLING_INTERVAL / 1000}s)`);

  // Run immediately on startup to catch any pending videos
  processGeneratingVideos();

  const httpServer = createServer(app);

  return httpServer;
}
