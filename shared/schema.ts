import { z } from "zod";

// Creator Schema (for database documents with _id)
export const creatorSchema = z.object({
  _id: z.string(),
  whopUserId: z.string(),
  whopCompanyId: z.string(),
  heygenAvatarGroupId: z.string().nullable().optional(),
  heygenAvatarLookId: z.string().nullable().optional(),
  messageTemplate: z.string().default("Hi {name}! Welcome to our community. We're excited to have you here!"),
  avatarPhotoUrl: z.string().nullable().optional(),
  audioFileUrl: z.string().nullable().optional(),
  useAudioForGeneration: z.boolean().default(false),
  voiceId: z.string().default("1bd001e7e50f421d891986aad5158bc8"),
  fishAudioModelId: z.string().nullable().optional(),
  isSetupComplete: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const insertCreatorSchema = z.object({
  whopUserId: z.string(),
  whopCompanyId: z.string(),
  heygenAvatarGroupId: z.string().nullable().optional(),
  heygenAvatarLookId: z.string().nullable().optional(),
  messageTemplate: z.string().default("Hi {name}! Welcome to our community. We're excited to have you here!"),
  avatarPhotoUrl: z.string().nullable().optional(),
  audioFileUrl: z.string().nullable().optional(),
  useAudioForGeneration: z.boolean().default(false),
  voiceId: z.string().default("1bd001e7e50f421d891986aad5158bc8"),
  fishAudioModelId: z.string().nullable().optional(),
  isSetupComplete: z.boolean().default(false),
});

export type InsertCreator = z.infer<typeof insertCreatorSchema>;
export type Creator = z.infer<typeof creatorSchema>;

// Customer Schema (for database documents with _id)
export const customerSchema = z.object({
  _id: z.string(),
  creatorId: z.string(),
  whopUserId: z.string(),
  whopMemberId: z.string(),
  whopCompanyId: z.string().nullable().optional(),
  name: z.string(),
  email: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  planName: z.string().nullable().optional(),
  joinedAt: z.date(),
  firstVideoSent: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const insertCustomerSchema = z.object({
  creatorId: z.string(),
  whopUserId: z.string(),
  whopMemberId: z.string(),
  whopCompanyId: z.string().nullable().optional(),
  name: z.string(),
  email: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  planName: z.string().nullable().optional(),
  joinedAt: z.date(),
  firstVideoSent: z.boolean().default(false),
  updatedAt: z.date().optional(),
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = z.infer<typeof customerSchema>;

// Video Schema (for database documents with _id)
export const videoSchema = z.object({
  _id: z.string(),
  customerId: z.string(),
  creatorId: z.string(),
  heygenVideoId: z.string().nullable().optional(),
  heygenGenerationId: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  status: z.string().default("pending"),
  personalizedScript: z.string(),
  whopChatId: z.string().nullable().optional(),
  whopMessageId: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  viewCount: z.number().default(0),
  createdAt: z.date(),
  updatedAt: z.date(),
  completedAt: z.date().nullable().optional(),
  sentAt: z.date().nullable().optional(),
  viewedAt: z.date().nullable().optional(),
});

export const insertVideoSchema = z.object({
  customerId: z.string(),
  creatorId: z.string(),
  heygenVideoId: z.string().nullable().optional(),
  heygenGenerationId: z.string().nullable().optional(),
  videoUrl: z.string().nullable().optional(),
  thumbnailUrl: z.string().nullable().optional(),
  status: z.string().default("pending"),
  personalizedScript: z.string(),
  whopChatId: z.string().nullable().optional(),
  whopMessageId: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  viewCount: z.number().default(0),
  updatedAt: z.date().optional(),
  completedAt: z.date().nullable().optional(),
  sentAt: z.date().nullable().optional(),
  viewedAt: z.date().nullable().optional(),
});

export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = z.infer<typeof videoSchema>;

// Video status enum values
export const VIDEO_STATUSES = {
  PENDING: "pending",           // Waiting to be generated
  GENERATING: "generating",     // HeyGen is generating the video
  COMPLETED: "completed",       // Video generated successfully
  SENDING: "sending",           // Sending DM to customer
  SENT: "sent",                 // DM sent successfully
  DELIVERED: "delivered",       // Customer received the DM
  VIEWED: "viewed",             // Customer viewed the video
  FAILED: "failed",             // Generation or sending failed
} as const;

// Placeholder types for message templates
export const TEMPLATE_PLACEHOLDERS = {
  NAME: "{name}",
  EMAIL: "{email}",
  USERNAME: "{username}",
  PLAN: "{plan}",
  DATE: "{date}",
} as const;

// Helper function to replace placeholders in message template
export function replacePlaceholders(
  template: string,
  data: {
    name?: string | null;
    email?: string | null;
    username?: string | null;
    planName?: string | null;
  }
): string {
  let result = template;
  result = result.replace(/{name}/g, data.name || "there");
  result = result.replace(/{email}/g, data.email || "");
  result = result.replace(/{username}/g, data.username || "");
  result = result.replace(/{plan}/g, data.planName || "our community");
  result = result.replace(/{date}/g, new Date().toLocaleDateString());
  return result;
}
