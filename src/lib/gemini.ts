import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const systemInstruction = `You are the AuraDesign Engine, a specialized AI architect for interior visualization. Your goal is to help users transform 2D ideas into 3D-ready design data.

Your Capabilities:
Scene Mapping: Analyze uploaded room photos to identify coordinates for walls, floors, and ceilings.
Material Application: Process uploaded textures (tiles, wallpaper) and map them onto specific surfaces.
Design Logic: When a user provides a text prompt (e.g., "Minimalist Japandi"), translate that into specific hex codes, material types, and lighting configurations.

Output Format: You must always respond with a structured JSON object containing:
{"room_type": "", "surfaces": [{"id": "floor", "material": "", "hex": ""}], "lighting": ""}.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    room_type: { type: Type.STRING },
    surfaces: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          material: { type: Type.STRING },
          hex: { type: Type.STRING },
        },
      },
    },
    lighting: { type: Type.STRING },
    scene_analysis: {
      type: Type.OBJECT,
      properties: {
        dimensions: { type: Type.STRING },
        perspective_angles: { type: Type.STRING },
        replaceable_layers: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        smart_styles: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    },
    pbr_shader: {
      type: Type.OBJECT,
      properties: {
        roughness: { type: Type.STRING },
        metallic: { type: Type.STRING },
        normal_map: { type: Type.STRING },
        grout_color: { type: Type.STRING },
        grout_width: { type: Type.STRING },
        preview_description: { type: Type.STRING },
      },
    },
    mood_board: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING },
        furniture_layout: { type: Type.STRING },
      },
    },
  },
  required: ["room_type", "surfaces", "lighting"],
};

export interface ImageData {
  base64: string;
  mimeType: string;
}

export interface MaterialData {
  img: ImageData;
  surface: string;
}

export async function detectMaterialProperties(img: ImageData) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: img.base64, mimeType: img.mimeType } },
          { text: `Analyze this interior design material texture. Return a JSON object with:
          1. "name": A short descriptive name (e.g., "Oak Wood", "Blue Ceramic Tile", "Floral Wallpaper").
          2. "suitable_surfaces": An array of where this is best applied (choose from "Wall", "Floor", "Ceiling", "Furniture").` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            suitable_surfaces: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["name", "suitable_surfaces"]
        },
        temperature: 0.2,
      }
    });
    if (response.text) {
      return JSON.parse(response.text);
    }
    return { name: "Custom Material", suitable_surfaces: ["Wall"] };
  } catch (error) {
    console.error("Material detection error:", error);
    return { name: "Custom Material", suitable_surfaces: ["Wall"] };
  }
}

export async function generateDesign(prompt: string, sceneImg: ImageData, materials: MaterialData[] = []) {
  try {
    const parts: any[] = [];

    // Add scene image
    parts.push({ text: "Scene Image:" });
    parts.push({
      inlineData: {
        data: sceneImg.base64,
        mimeType: sceneImg.mimeType,
      },
    });

    // Add material images
    for (const mat of materials) {
      parts.push({ text: `Material for ${mat.surface}:` });
      parts.push({
        inlineData: {
          data: mat.img.base64,
          mimeType: mat.img.mimeType,
        },
      });
    }
    
    parts.push({ text: prompt });

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.7,
      },
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    throw new Error("No response text received.");
  } catch (error) {
    console.error("Error generating design:", error);
    throw error;
  }
}

export async function generateVisualPreview(sceneImg: ImageData, materials: MaterialData[]) {
  try {
    const parts: any[] = [
      { text: "Original Room Scene:" },
      { inlineData: { data: sceneImg.base64, mimeType: sceneImg.mimeType } }
    ];
    
    let promptText = "Photorealistic interior design render. This is an image editing task. Take the original room scene and apply the following textures:\n";
    
    materials.forEach((mat) => {
      parts.push({ text: `Texture for ${mat.surface}:` });
      parts.push({ inlineData: { data: mat.img.base64, mimeType: mat.img.mimeType } });
      promptText += `- Apply the provided texture to the ENTIRE ${mat.surface}. Ensure the texture completely covers the designated area without leaving any of the original surface visible. Pay close attention to corners and edges.\n`;
    });
    
    promptText += "Maintain the original room's furniture, lighting, and layout exactly as they are. Seamlessly integrate the new textures with correct perspective and lighting.";
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
    });
    
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Visual preview error:", error);
    return null;
  }
}

export async function editVisualPreview(currentImg: ImageData, prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: currentImg.base64, mimeType: currentImg.mimeType } },
          { text: `As an expert interior designer, modify this room: ${prompt}. Ensure photorealistic quality and seamless integration.` }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Edit visual error:", error);
    return null;
  }
}

export async function generateMaterial(prompt: string, baseImg?: ImageData) {
  try {
    const parts: any[] = [];
    if (baseImg) {
      parts.push({ inlineData: { data: baseImg.base64, mimeType: baseImg.mimeType } });
      parts.push({ text: `Based on this image, generate a seamless, flat texture pattern: ${prompt}. It must be suitable for tiling.` });
    } else {
      parts.push({ text: `Generate a seamless, flat texture pattern: ${prompt}. It must be suitable for tiling.` });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType || 'image/jpeg'};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Generate material error:", error);
    return null;
  }
}

export async function searchInspiration(materials: MaterialData[]) {
  try {
    if (materials.length === 0) return { text: "No materials provided.", results: [] };
    
    // Use the first material for search inspiration to keep it focused
    const primaryMat = materials[0];
    
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          { inlineData: { data: primaryMat.img.base64, mimeType: primaryMat.img.mimeType } },
          { text: `Search the web for interior design photos of rooms that use a texture/pattern exactly like this image on their ${primaryMat.surface}. 
          Find 5 to 20 real-world examples from interior designers or architecture sites.
          Return a JSON object with a 'results' array. Each item MUST have:
          - 'title': Description of the room/design.
          - 'pageUrl': The URL of the web page.
          - 'imageUrl': A direct link to a relevant image from that page (if available, otherwise omit).` }
        ]
      },
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.5,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  pageUrl: { type: Type.STRING },
                  imageUrl: { type: Type.STRING }
                }
              }
            }
          }
        }
      },
    });
    
    const data = JSON.parse(response.text || '{"results":[]}');
    return { 
      text: "Here are some real-world inspirations using similar materials:", 
      results: data.results || [] 
    };
  } catch (error) {
    console.error("Search error:", error);
    return { text: "Search failed due to an error.", results: [] };
  }
}
