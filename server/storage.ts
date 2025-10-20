import { 
  type Creator, type InsertCreator,
  type Customer, type InsertCustomer,
  type Video, type InsertVideo,
} from "@shared/schema";
import { MongoClient, Db, ObjectId } from "mongodb";

export interface IStorage {
  // Creator operations
  getCreator(id: string): Promise<Creator | undefined>;
  getCreatorByWhopUserId(whopUserId: string): Promise<Creator | undefined>;
  getCreatorByCompanyId(companyId: string): Promise<Creator | undefined>;
  getAllCreators(): Promise<Creator[]>;
  createCreator(creator: InsertCreator): Promise<Creator>;
  updateCreator(id: string, updates: Partial<InsertCreator>): Promise<Creator | undefined>;
  
  // Customer operations
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByWhopUserId(creatorId: string, whopUserId: string): Promise<Customer | undefined>;
  getCustomersByCreator(creatorId: string): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | undefined>;
  
  // Video operations
  getVideo(id: string): Promise<Video | undefined>;
  getVideoByHeygenId(heygenVideoId: string): Promise<Video | undefined>;
  getVideosByCustomer(customerId: string): Promise<Video[]>;
  getVideosByCreator(creatorId: string): Promise<Video[]>;
  getVideosByStatus(status: string): Promise<Video[]>;
  createVideo(video: InsertVideo): Promise<Video>;
  updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video | undefined>;
}

export class MongoStorage implements IStorage {
  private client: MongoClient;
  private db!: Db;
  private connected = false;

  constructor() {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not set");
    }
    this.client = new MongoClient(mongoUri);
  }

  private async connect() {
    if (!this.connected) {
      await this.client.connect();
      this.db = this.client.db("whop_video_app");
      this.connected = true;
      console.log("✅ Connected to MongoDB");
    }
  }

  private convertToCreator(doc: any): Creator | undefined {
    if (!doc) return undefined;
    return {
      _id: doc._id.toString(),
      whopUserId: doc.whopUserId,
      whopCompanyId: doc.whopCompanyId,
      heygenAvatarGroupId: doc.heygenAvatarGroupId ?? null,
      heygenAvatarLookId: doc.heygenAvatarLookId ?? null,
      messageTemplate: doc.messageTemplate ?? "Hi {name}! Welcome to our community. We're excited to have you here!",
      avatarPhotoUrl: doc.avatarPhotoUrl ?? null,
      audioFileUrl: doc.audioFileUrl ?? null,
      useAudioForGeneration: doc.useAudioForGeneration ?? false,
      voiceId: doc.voiceId ?? "1bd001e7e50f421d891986aad5158bc8",
      fishAudioModelId: doc.fishAudioModelId ?? null,
      isSetupComplete: doc.isSetupComplete ?? false,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private convertToCustomer(doc: any): Customer | undefined {
    if (!doc) return undefined;
    return {
      _id: doc._id.toString(),
      creatorId: doc.creatorId,
      whopUserId: doc.whopUserId,
      whopMemberId: doc.whopMemberId,
      whopCompanyId: doc.whopCompanyId ?? null,
      name: doc.name,
      email: doc.email ?? null,
      username: doc.username ?? null,
      planName: doc.planName ?? null,
      joinedAt: doc.joinedAt,
      firstVideoSent: doc.firstVideoSent ?? false,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  private convertToVideo(doc: any): Video | undefined {
    if (!doc) return undefined;
    return {
      _id: doc._id.toString(),
      customerId: doc.customerId,
      creatorId: doc.creatorId,
      heygenVideoId: doc.heygenVideoId ?? null,
      heygenGenerationId: doc.heygenGenerationId ?? null,
      videoUrl: doc.videoUrl ?? null,
      thumbnailUrl: doc.thumbnailUrl ?? null,
      status: doc.status ?? "pending",
      personalizedScript: doc.personalizedScript,
      whopChatId: doc.whopChatId ?? null,
      whopMessageId: doc.whopMessageId ?? null,
      errorMessage: doc.errorMessage ?? null,
      viewCount: doc.viewCount ?? 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      completedAt: doc.completedAt ?? null,
      sentAt: doc.sentAt ?? null,
      viewedAt: doc.viewedAt ?? null,
    };
  }

  // Creator operations
  async getCreator(id: string): Promise<Creator | undefined> {
    await this.connect();
    const doc = await this.db.collection("creators").findOne({ _id: new ObjectId(id) });
    return this.convertToCreator(doc);
  }

  async getCreatorByWhopUserId(whopUserId: string): Promise<Creator | undefined> {
    await this.connect();
    const doc = await this.db.collection("creators").findOne({ whopUserId });
    return this.convertToCreator(doc);
  }

  async getCreatorByCompanyId(companyId: string): Promise<Creator | undefined> {
    await this.connect();
    const doc = await this.db.collection("creators").findOne({ whopCompanyId: companyId });
    return this.convertToCreator(doc);
  }

  async getAllCreators(): Promise<Creator[]> {
    await this.connect();
    const docs = await this.db.collection("creators").find().toArray();
    return docs.map(doc => this.convertToCreator(doc)!).filter(Boolean);
  }

  async createCreator(insertCreator: InsertCreator): Promise<Creator> {
    await this.connect();
    const now = new Date();
    const creator = {
      ...insertCreator,
      heygenAvatarGroupId: insertCreator.heygenAvatarGroupId ?? null,
      heygenAvatarLookId: insertCreator.heygenAvatarLookId ?? null,
      avatarPhotoUrl: insertCreator.avatarPhotoUrl ?? null,
      audioFileUrl: insertCreator.audioFileUrl ?? null,
      useAudioForGeneration: insertCreator.useAudioForGeneration ?? false,
      voiceId: insertCreator.voiceId ?? "1bd001e7e50f421d891986aad5158bc8",
      fishAudioModelId: insertCreator.fishAudioModelId ?? null,
      isSetupComplete: insertCreator.isSetupComplete ?? false,
      messageTemplate: insertCreator.messageTemplate ?? "Hi {name}! Welcome to our community. We're excited to have you here!",
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await this.db.collection("creators").insertOne(creator);
    return this.convertToCreator({ ...creator, _id: result.insertedId })!;
  }

  async updateCreator(id: string, updates: Partial<InsertCreator>): Promise<Creator | undefined> {
    await this.connect();
    const sanitized = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    const result = await this.db.collection("creators").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...sanitized, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    
    return result?.value ? this.convertToCreator(result.value) : undefined;
  }

  // Customer operations
  async getCustomer(id: string): Promise<Customer | undefined> {
    await this.connect();
    const doc = await this.db.collection("customers").findOne({ _id: new ObjectId(id) });
    return this.convertToCustomer(doc);
  }

  async getCustomerByWhopUserId(creatorId: string, whopUserId: string): Promise<Customer | undefined> {
    await this.connect();
    const doc = await this.db.collection("customers").findOne({ creatorId, whopUserId });
    return this.convertToCustomer(doc);
  }

  async getCustomersByCreator(creatorId: string): Promise<Customer[]> {
    await this.connect();
    const docs = await this.db.collection("customers").find({ creatorId }).toArray();
    return docs.map(doc => this.convertToCustomer(doc)!).filter(Boolean);
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    await this.connect();
    const now = new Date();
    const customer = {
      ...insertCustomer,
      email: insertCustomer.email ?? null,
      username: insertCustomer.username ?? null,
      planName: insertCustomer.planName ?? null,
      whopCompanyId: insertCustomer.whopCompanyId ?? null,
      firstVideoSent: insertCustomer.firstVideoSent ?? false,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await this.db.collection("customers").insertOne(customer);
    return this.convertToCustomer({ ...customer, _id: result.insertedId })!;
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | undefined> {
    await this.connect();
    const sanitized = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    const result = await this.db.collection("customers").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...sanitized, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    
    return result?.value ? this.convertToCustomer(result.value) : undefined;
  }

  // Video operations
  async getVideo(id: string): Promise<Video | undefined> {
    await this.connect();
    const doc = await this.db.collection("videos").findOne({ _id: new ObjectId(id) });
    return this.convertToVideo(doc);
  }

  async getVideoByHeygenId(heygenVideoId: string): Promise<Video | undefined> {
    await this.connect();
    const doc = await this.db.collection("videos").findOne({ heygenVideoId });
    return this.convertToVideo(doc);
  }

  async getVideosByCustomer(customerId: string): Promise<Video[]> {
    await this.connect();
    const docs = await this.db.collection("videos").find({ customerId }).toArray();
    return docs.map(doc => this.convertToVideo(doc)!).filter(Boolean);
  }

  async getVideosByCreator(creatorId: string): Promise<Video[]> {
    await this.connect();
    const docs = await this.db.collection("videos").find({ creatorId }).toArray();
    return docs.map(doc => this.convertToVideo(doc)!).filter(Boolean);
  }

  async getVideosByStatus(status: string): Promise<Video[]> {
    await this.connect();
    const docs = await this.db.collection("videos").find({ status }).toArray();
    return docs.map(doc => this.convertToVideo(doc)!).filter(Boolean);
  }

  async createVideo(insertVideo: InsertVideo): Promise<Video> {
    await this.connect();
    const now = new Date();
    const video = {
      ...insertVideo,
      heygenVideoId: insertVideo.heygenVideoId ?? null,
      heygenGenerationId: insertVideo.heygenGenerationId ?? null,
      videoUrl: insertVideo.videoUrl ?? null,
      thumbnailUrl: insertVideo.thumbnailUrl ?? null,
      status: insertVideo.status ?? "pending",
      whopChatId: insertVideo.whopChatId ?? null,
      whopMessageId: insertVideo.whopMessageId ?? null,
      errorMessage: insertVideo.errorMessage ?? null,
      viewCount: insertVideo.viewCount ?? 0,
      completedAt: insertVideo.completedAt ?? null,
      sentAt: insertVideo.sentAt ?? null,
      viewedAt: insertVideo.viewedAt ?? null,
      createdAt: now,
      updatedAt: now,
    };
    
    const result = await this.db.collection("videos").insertOne(video);
    return this.convertToVideo({ ...video, _id: result.insertedId })!;
  }

  async updateVideo(id: string, updates: Partial<InsertVideo>): Promise<Video | undefined> {
    await this.connect();
    const sanitized = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    const result = await this.db.collection("videos").findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...sanitized, updatedAt: new Date() } },
      { returnDocument: "after" }
    );
    
    return result?.value ? this.convertToVideo(result.value) : undefined;
  }
}

export const storage = new MongoStorage();
