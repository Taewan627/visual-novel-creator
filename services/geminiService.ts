import { GoogleGenAI, Type, Modality } from "@google/genai";
import { VisualNovel, Character, DialogueLine } from '../types';

export async function generateStory(theme: string): Promise<VisualNovel> {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Create a complete visual novel story based on the theme "${theme}".
    The story should be a self-contained minigame with a clear beginning, middle, and end.
    It must include at least 2 characters and 4 scenes.
    The scenes should connect via choices. Ensure all scenes are reachable.
    Multiple characters can be present in a scene and have dialogue with each other.
    The final scene(s) should have no choices to signify the end of the story.
    Each character should have one 'default' expression.
    All dialogue lines should have the 'expressionId' field set to null.
    Provide the result as a single valid JSON object strictly following this schema. Do not include markdown formatting like \`\`\`json.
    
    The JSON object must have the following structure:
    {
      "title": "A creative title based on the theme",
      "characters": [
        { 
          "id": "char_1", 
          "name": "Character Name",
          "defaultExpressionId": "expr_1",
          "expressions": [
            { "id": "expr_1", "name": "Default", "imageUrl": "A placeholder image URL from https://picsum.photos/400/600" }
          ]
        }
      ],
      "scenes": [
        {
          "id": "scene_1",
          "name": "A short, descriptive name for the scene (e.g., 'The Confrontation')",
          "backgroundUrl": "A placeholder image URL from https://picsum.photos/1280/720",
          "presentCharacterIds": ["char_1"],
          "dialogue": [
            { "characterId": "char_1", "expressionId": null, "text": "A line of dialogue spoken by Character 1." },
            { "characterId": null, "expressionId": null, "text": "This is a narrator line. The 'characterId' field for a narrator is null." }
          ],
          "choices": [
            { "text": "The choice text", "nextSceneId": "scene_2" }
          ]
        }
      ],
      "startSceneId": "The ID of the first scene (e.g., 'scene_1')"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            startSceneId: { type: Type.STRING },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  defaultExpressionId: { type: Type.STRING, nullable: true },
                  expressions: {
                      type: Type.ARRAY,
                      items: {
                          type: Type.OBJECT,
                          properties: {
                              id: { type: Type.STRING },
                              name: { type: Type.STRING },
                              imageUrl: { type: Type.STRING },
                          },
                          required: ['id', 'name', 'imageUrl']
                      }
                  }
                },
                required: ['id', 'name', 'expressions'],
              },
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  backgroundUrl: { type: Type.STRING },
                  presentCharacterIds: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  dialogue: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        characterId: { type: Type.STRING, nullable: true },
                        expressionId: { type: Type.STRING, nullable: true },
                        text: { type: Type.STRING },
                      },
                      required: ['text', 'expressionId'],
                    }
                  },
                  choices: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        text: { type: Type.STRING },
                        nextSceneId: { type: Type.STRING },
                      },
                      required: ['text', 'nextSceneId'],
                    },
                  },
                },
                required: ['id', 'name', 'backgroundUrl', 'presentCharacterIds', 'dialogue', 'choices'],
              },
            },
          },
          required: ['title', 'startSceneId', 'characters', 'scenes'],
        },
      },
    });

    const jsonString = response.text.trim();
    const generatedData = JSON.parse(jsonString);

    // Basic validation
    if (!generatedData.title || !generatedData.scenes || !generatedData.characters || !generatedData.startSceneId) {
        throw new Error("Missing required fields in AI response.");
    }
    
    return generatedData as VisualNovel;
  } catch (error) {
    console.error("Error generating story (Gemini):", error);
    if (error instanceof Error) {
        if (error.message.includes('JSON.parse')) {
            throw new Error("Failed to generate story. The AI returned an invalid JSON structure.");
        }
        if (error.message.includes('missing required fields')) {
            throw new Error("Failed to generate story. The AI response was incomplete. Please try again.");
        }
    }
    throw new Error("Failed to generate story. Check the console for more details.");
  }
}


export async function generateSceneBackground(prompt: string): Promise<string> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const fullPrompt = `A high-quality visual novel background image. Scene description: ${prompt}. Style: vibrant, anime, digital art, detailed.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: fullPrompt }] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }

        throw new Error("No image found in image generation result.");
    } catch (error) {
        console.error("Error generating background (Gemini):", error);
        throw new Error("Failed to generate background image.");
    }
}

export async function generateSceneDialogue(sceneName: string, scenePrompt: string, presentCharacters: Character[]): Promise<DialogueLine[]> {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const characterDescriptions = presentCharacters.length > 0 
        ? presentCharacters.map(c => `- ${c.name} (id: ${c.id})`).join('\n')
        : 'None. Use only the narrator.';

    const prompt = `
        You are a dialogue writer for a visual novel.
        The current scene is named "${sceneName}".
        The theme of the scene is "${scenePrompt}".
        The characters present are:
        ${characterDescriptions}

        Write a short, engaging dialogue sequence for this scene. It should be 3-5 lines long.
        You can use a "narrator" for descriptive text. For narrator lines, the "characterId" should be null.
        Use the provided "id" for lines spoken by characters.
        Provide the result as a single valid JSON object array strictly following this schema. Do not include markdown formatting like \`\`\`json.
        
        The JSON array must have the following structure:
        [
          { "characterId": "the_character_id" | null, "text": "The dialogue spoken by the character or narrator." }
        ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            characterId: { type: Type.STRING, nullable: true },
                            text: { type: Type.STRING },
                        },
                        required: ['text'],
                    }
                }
            }
        });

        const jsonString = response.text.trim();
        const generatedDialogue = JSON.parse(jsonString);

        if (!Array.isArray(generatedDialogue)) {
            throw new Error("AI response is not a valid array.");
        }
        
        return generatedDialogue.map(line => ({
            characterId: line.characterId || null,
            expressionId: null,
            text: line.text
        }));
    } catch (error) {
        console.error("Error generating dialogue (Gemini):", error);
        throw new Error("Failed to generate dialogue.");
    }
}