if (!process.env.HEYGEN_API_KEY) {
  console.warn("HEYGEN_API_KEY environment variable is not set. HeyGen features will not work.");
}

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || "";
const HEYGEN_API_BASE = "https://api.heygen.com";
const HEYGEN_UPLOAD_BASE = "https://upload.heygen.com";

// Helper function to make HeyGen API requests
async function heygenRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${HEYGEN_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "X-Api-Key": HEYGEN_API_KEY,
      ...options.headers,
    },
  });

  const responseText = await response.text();
  
  if (!response.ok) {
    console.error(`HeyGen API error: ${response.status} - ${responseText}`);
    let error;
    try {
      error = JSON.parse(responseText);
    } catch {
      error = { error: responseText || "Request failed" };
    }
    throw new Error(JSON.stringify(error) || `HeyGen API error: ${response.status}`);
  }

  return JSON.parse(responseText);
}

export const heygenSdk = {
  // Upload an image asset to HeyGen
  async uploadAsset(file: Buffer, filename: string, mimetype: string): Promise<{ image_key: string; image_url: string }> {
    console.log(`Uploading to HeyGen: ${filename}, size: ${file.length} bytes, type: ${mimetype}`);

    // HeyGen requires raw binary data, not multipart form data
    const response = await fetch(`${HEYGEN_UPLOAD_BASE}/v1/asset`, {
      method: 'POST',
      headers: {
        'Content-Type': mimetype,
        'X-Api-Key': HEYGEN_API_KEY,
      },
      body: file,
    });

    const responseText = await response.text();
    console.log(`HeyGen response status: ${response.status}`);
    console.log(`HeyGen response body: ${responseText}`);

    if (!response.ok) {
      let error;
      try {
        error = JSON.parse(responseText);
      } catch {
        error = { error: responseText || 'Upload failed' };
      }
      throw new Error(error.error || error.message || `HeyGen asset upload failed: ${response.status} - ${responseText}`);
    }

    const result = JSON.parse(responseText);
    
    // HeyGen returns the image_key field which should be used for avatar group creation
    return {
      image_key: result.data?.image_key || result.data?.id,
      image_url: result.data?.url,
    };
  },

  // Generate AI avatar photos
  async generateAvatarPhoto(params: {
    name: string;
    age: string;
    gender: string;
    ethnicity: string;
    orientation: string;
    pose: string;
    style: string;
    appearance: string;
  }): Promise<{ generation_id: string }> {
    const response = await heygenRequest("/v2/photo_avatar/photo/generate", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return response.data;
  },

  // Check photo generation status
  async checkPhotoGenerationStatus(generationId: string): Promise<{
    status: string;
    image_url_list: string[] | null;
    image_key_list: string[] | null;
  }> {
    const response = await heygenRequest(`/v2/photo_avatar/generation/${generationId}`);
    return response.data;
  },

  // Create photo avatar group
  async createPhotoAvatarGroup(params: {
    name: string;
    image_key: string;
  }): Promise<{ id: string; group_id: string }> {
    const response = await heygenRequest("/v2/photo_avatar/avatar_group/create", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return response.data;
  },

  // Add looks to avatar group
  async addLooksToGroup(params: {
    group_id: string;
    name: string;
    image_keys: string[];
  }): Promise<{ photo_avatar_list: Array<{ id: string }> }> {
    const response = await heygenRequest("/v2/photo_avatar/avatar_group/add", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return response.data;
  },

  // Train photo avatar group
  async trainAvatarGroup(groupId: string): Promise<void> {
    await heygenRequest("/v2/photo_avatar/train", {
      method: "POST",
      body: JSON.stringify({ group_id: groupId }),
    });
  },

  // Get training status
  async getTrainingStatus(groupId: string): Promise<{ status: string }> {
    const response = await heygenRequest(`/v2/photo_avatar/train/status/${groupId}`);
    return response.data;
  },

  // List avatar groups
  async listAvatarGroups(): Promise<{ avatar_group_list: Array<{ id: string; name: string; train_status: string }> }> {
    const response = await heygenRequest("/v2/avatar_group.list");
    return response.data;
  },

  // List avatars in a group
  async listGroupAvatars(groupId: string): Promise<{ avatar_list: Array<{ id: string; name: string; status: string }> }> {
    const response = await heygenRequest(`/v2/avatar_group/${groupId}/avatars`);
    return response.data;
  },

  // List available voices
  async listVoices(): Promise<{ voices: Array<{ voice_id: string; name: string; language: string; gender: string }> }> {
    const response = await heygenRequest("/v2/voices");
    return response.data;
  },

  // Generate video (legacy method - kept for backwards compatibility)
  async generateVideo(params: {
    test?: boolean;
    caption?: boolean;
    callback_id?: string;
    dimension?: {
      width: number;
      height: number;
    };
    video_inputs: Array<{
      character: {
        type: string;
        talking_photo_id?: string;
        avatar_id?: string;
        scale?: number;
      };
      voice: {
        type: string;
        input_text?: string;
        voice_id: string;
        speed?: number;
      };
      background?: {
        type: string;
        value?: string;
      };
    }>;
  }): Promise<{ video_id: string }> {
    console.log("📤 Sending to HeyGen:", JSON.stringify(params, null, 2));
    const response = await heygenRequest("/v2/video/generate", {
      method: "POST",
      body: JSON.stringify(params),
    });
    console.log("📥 HeyGen response:", JSON.stringify(response, null, 2));
    return response.data;
  },

  // Generate Avatar IV video with text-to-speech
  async generateAvatarIVVideo(params: {
    avatar_image_url: string;
    input_text: string;
    voice_id: string;
    test?: boolean;
    title?: string;
  }): Promise<{ video_id: string }> {
    console.log("📤 Sending to HeyGen Avatar IV (text):", JSON.stringify(params, null, 2));
    const response = await heygenRequest("/v2/video/av4/generate", {
      method: "POST",
      body: JSON.stringify(params),
    });
    console.log("📥 HeyGen Avatar IV response:", JSON.stringify(response, null, 2));
    return response.data;
  },

  // Generate Avatar IV video with audio file
  async generateAvatarIVWithAudio(params: {
    avatar_image_url: string;
    input_audio_url: string;
    test?: boolean;
    title?: string;
  }): Promise<{ video_id: string }> {
    console.log("📤 Sending to HeyGen Avatar IV (audio):", JSON.stringify(params, null, 2));
    const response = await heygenRequest("/v2/video/av4/generate", {
      method: "POST",
      body: JSON.stringify(params),
    });
    console.log("📥 HeyGen Avatar IV response:", JSON.stringify(response, null, 2));
    return response.data;
  },

  // Upload audio file to HeyGen
  async uploadAudio(file: Buffer, filename: string, mimetype: string = 'audio/mpeg'): Promise<{ audio_url: string; audio_id: string }> {
    console.log(`Uploading audio to HeyGen: ${filename}, size: ${file.length} bytes, type: ${mimetype}`);

    const response = await fetch(`${HEYGEN_UPLOAD_BASE}/v1/asset`, {
      method: 'POST',
      headers: {
        'Content-Type': mimetype,
        'X-Api-Key': HEYGEN_API_KEY,
      },
      body: file,
    });

    const responseText = await response.text();
    console.log(`HeyGen audio upload response status: ${response.status}`);
    console.log(`HeyGen audio upload response body: ${responseText}`);

    if (!response.ok) {
      let error;
      try {
        error = JSON.parse(responseText);
      } catch {
        error = { error: responseText || 'Audio upload failed' };
      }
      throw new Error(error.error || error.message || `HeyGen audio upload failed: ${response.status} - ${responseText}`);
    }

    const result = JSON.parse(responseText);
    
    return {
      audio_id: result.data?.id || result.data?.audio_id,
      audio_url: result.data?.url,
    };
  },

  // Get video status
  async getVideoStatus(videoId: string): Promise<{
    status: string;
    video_url: string | null;
    thumbnail_url: string | null;
    error: { code: number; message: string; detail: string } | null;
  }> {
    const response = await heygenRequest(`/v1/video_status.get?video_id=${videoId}`);
    return response.data;
  },

  // Add webhook endpoint
  async addWebhookEndpoint(params: {
    url: string;
    events: string[];
  }): Promise<{ endpoint_id: string; secret: string }> {
    const response = await heygenRequest("/v1/webhook/endpoint.add", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return response.data;
  },
};
