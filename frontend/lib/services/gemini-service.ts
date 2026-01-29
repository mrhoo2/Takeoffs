import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { Equipment, Location, VisualExamples } from '../types';

// Retry decorator with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let delay = initialDelay;
  
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRetryable = error instanceof Error && (
        error.message.includes('429') ||
        error.message.includes('503') ||
        error.message.includes('500') ||
        error.message.includes('DEADLINE_EXCEEDED')
      );
      
      if (i === retries - 1 || !isRetryable) {
        throw error;
      }
      
      console.log(`API error, retrying in ${delay}ms... (attempt ${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  
  throw new Error('Max retries exceeded');
}

export class GeminiService {
  private flashModel: GenerativeModel;
  private proModel: GenerativeModel;

  constructor() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY not set');
    }
    
    const genAI = new GoogleGenerativeAI(apiKey);
    // Using latest Gemini 3 models (January 2026)
    this.flashModel = genAI.getGenerativeModel({ 
      model: 'gemini-3-flash-preview',
      generationConfig: {
        responseMimeType: 'application/json',  // Force JSON responses
      }
    });
    this.proModel = genAI.getGenerativeModel({ 
      model: 'gemini-3-pro-preview',
      generationConfig: {
        responseMimeType: 'application/json',
      }
    });
    console.log('GeminiService initialized with Gemini 3 models (JSON mode)');
  }

  private getModel(modelName: string = 'flash'): GenerativeModel {
    if (modelName === 'pro') {
      console.log('Using Gemini 2.0 Pro model');
      return this.proModel;
    }
    return this.flashModel;
  }

  async extractEquipmentTypes(
    images: Buffer[],
    modelName: string = 'flash'
  ): Promise<string> {
    console.log(`extractEquipmentTypes: Starting Gemini API call (${modelName})...`);
    console.log(`extractEquipmentTypes: Processing ${images.length} image(s)`);
    const startTime = Date.now();

    const promptText = `
    You are an expert mechanical engineer. Analyze the following mechanical schedule image(s) and extract a list of equipment types.
    
    IMPORTANT: You are being provided with exactly ${images.length} image(s). Each image represents one page.
    - Image 1 = Page 1
    ${images.length > 1 ? images.slice(1).map((_, i) => `- Image ${i + 2} = Page ${i + 2}`).join('\n    ') : ''}
    
    The page number you return MUST be between 1 and ${images.length}. Do not return page numbers outside this range.
    
    For each equipment type, identify if it is "typical" (multiple instances, usually alphabetical tags like WSHP-A) or "instance-based" (unique instances, usually numeric tags like RTU-1).
    
    For each equipment type, provide the bounding box of the TABLE or SCHEDULE SECTION containing that equipment's specifications.
    
    Return the result as a JSON list of objects with the following keys:
    - type: The name/type of the equipment (e.g., "Water Source Heat Pump", "Rooftop Unit").
    - tag_prefix: The prefix used in the tags (e.g., "WSHP", "RTU"). Use null if no clear prefix.
    - is_typical: Boolean, true if typical, false if instance-based.
    - tags: A complete list of ALL unique tags found in the schedule for this equipment type (e.g., ["WSHP-A", "WSHP-B"] or ["RTU-1", "RTU-2", "RTU-3"]). It is CRITICAL to extract every single unique tag.
    - page: The page number (1 to ${images.length}) where this equipment is found. MUST be a valid page number.
    - bbox: Bounding box coordinates as [x_min, y_min, x_max, y_max] in 0-1000 scale, where (0,0) is the top-left corner of the image and (1000,1000) is the bottom-right corner. The bbox should tightly enclose the equipment schedule table.
    `;

    const model = this.getModel(modelName);

    const imageParts = images.map(buffer => ({
      inlineData: {
        data: buffer.toString('base64'),
        mimeType: 'image/jpeg' as const
      }
    }));

    const response = await retryWithBackoff(async () => {
      return await model.generateContent([promptText, ...imageParts]);
    }, 5, 2000);

    const elapsed = Date.now() - startTime;
    console.log(`extractEquipmentTypes: Gemini API returned after ${elapsed}ms`);

    const text = response.response.text();
    const jsonMatch = text.match(/\[.*\]/s);
    const result = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    console.log(`Gemini Response: ${result}`);
    return result;
  }

  async findEquipmentLocations(
    planImages: Buffer[],
    equipmentList: string,
    scheduleText?: string,
    planText?: string,
    visualExamples?: VisualExamples,
    modelName: string = 'flash'
  ): Promise<string> {
    console.log(`findEquipmentLocations: Starting (${modelName})...`);
    console.log(`findEquipmentLocations: Processing ${planImages.length} images`);

    const allLocations: Location[] = [];

    for (let pageIdx = 0; pageIdx < planImages.length; pageIdx++) {
      try {
        const image = planImages[pageIdx];
        // Check if image is large (we'll estimate based on buffer size)
        // A 2000x2000 JPEG is roughly 200-400KB, so use 300KB as threshold
        const isLargeImage = image.length > 300 * 1024;

        let pageLocations: Location[];
        
        if (isLargeImage) {
          console.log(`Image ${pageIdx + 1} appears large. Using tiling strategy.`);
          pageLocations = await this.processWithTiling(
            image,
            equipmentList,
            pageIdx + 1,
            visualExamples,
            modelName
          );
        } else {
          pageLocations = await this.processSingleImage(
            image,
            equipmentList,
            pageIdx + 1,
            scheduleText,
            planText,
            visualExamples,
            modelName
          );
        }

        console.log(`findEquipmentLocations: Page ${pageIdx + 1} returned ${pageLocations.length} locations`);
        allLocations.push(...pageLocations);
      } catch (error) {
        console.error(`findEquipmentLocations: ERROR processing page ${pageIdx + 1}:`, error);
        // Continue with other pages
      }
    }

    console.log(`findEquipmentLocations: Total locations: ${allLocations.length}`);
    return JSON.stringify(allLocations);
  }

  private async processSingleImage(
    image: Buffer,
    equipmentList: string,
    pageNum: number,
    scheduleText?: string,
    planText?: string,
    visualExamples?: VisualExamples,
    modelName: string = 'flash'
  ): Promise<Location[]> {
    let prompt = `
    You are an expert mechanical engineer. Analyze the provided floor plan image and locate the following equipment.
    
    Target Equipment and Specific Tags to Find:
    ${equipmentList}
    
    For each equipment type listed above, search specifically for the tags provided in its "tags" list. 
    For each piece of equipment found, provide its PRECISE location using a bounding box.
    
    Return the result as a JSON list of objects with the following keys:
    - type: The type of equipment found.
    - tag: The specific tag found (e.g., "WSHP-1"). Must be one of the tags from the provided list.
    - page: ${pageNum}
    - bbox: [ymin, xmin, ymax, xmax] coordinates (0-1000 scale) of the equipment on the plan. Ensure this box tightly encloses the equipment symbol and its tag.
    - confidence: Your confidence level (0.0-1.0).
    `;

    if (scheduleText) {
      prompt += `\n\nContext from Mechanical Schedule:\n${scheduleText.substring(0, 5000)}...`;
    }

    if (planText) {
      prompt += `\n\nContext from Floor Plans (Text Extracted):\n${planText.substring(0, 5000)}...`;
    }

    const parts: (string | { inlineData: { data: string; mimeType: 'image/jpeg' } })[] = [prompt];

    // Add visual examples if provided
    if (visualExamples?.image && visualExamples?.examples?.length > 0) {
      this.addVisualExamples(parts, visualExamples);
    }

    parts.push({
      inlineData: {
        data: image.toString('base64'),
        mimeType: 'image/jpeg'
      }
    });

    const model = this.getModel(modelName);

    try {
      const response = await retryWithBackoff(async () => {
        return await model.generateContent(parts);
      }, 5, 2000);

      return this.parseJsonResponse(response.response.text());
    } catch (error) {
      console.error(`Error processing page ${pageNum}:`, error);
      return [];
    }
  }

  private async processWithTiling(
    image: Buffer,
    equipmentList: string,
    pageNum: number,
    visualExamples?: VisualExamples,
    modelName: string = 'flash'
  ): Promise<Location[]> {
    console.log(`processWithTiling: Starting for page ${pageNum} (${modelName})`);
    
    // Import sharp dynamically for image manipulation
    const sharp = (await import('sharp')).default;
    
    const metadata = await sharp(image).metadata();
    const width = metadata.width || 1500;
    const height = metadata.height || 1500;
    
    const TILE_SIZE = 1500;
    const OVERLAP = 300;
    
    const cols = Math.ceil((width - OVERLAP) / (TILE_SIZE - OVERLAP));
    const rows = Math.ceil((height - OVERLAP) / (TILE_SIZE - OVERLAP));
    
    console.log(`Splitting image into ${rows}x${cols} grid`);

    interface Tile {
      image: Buffer;
      offset: [number, number];
      size: [number, number];
      index: number;
    }

    const tiles: Tile[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let left = c * (TILE_SIZE - OVERLAP);
        let top = r * (TILE_SIZE - OVERLAP);

        if (left + TILE_SIZE > width) {
          left = Math.max(0, width - TILE_SIZE);
        }
        if (top + TILE_SIZE > height) {
          top = Math.max(0, height - TILE_SIZE);
        }

        const tileWidth = Math.min(TILE_SIZE, width - left);
        const tileHeight = Math.min(TILE_SIZE, height - top);

        const tileBuffer = await sharp(image)
          .extract({ left, top, width: tileWidth, height: tileHeight })
          .jpeg({ quality: 85 })
          .toBuffer();

        tiles.push({
          image: tileBuffer,
          offset: [left, top],
          size: [tileWidth, tileHeight],
          index: tiles.length
        });
      }
    }

    const allTileLocations: Location[] = [];

    // Process tiles with concurrency control
    const CONCURRENCY = 10;
    const TILE_TIMEOUT = 180000; // 3 minutes
    const MAX_RETRIES = 3;

    const processTileWithRetry = async (tile: Tile): Promise<Location[]> => {
      const tileNum = tile.index + 1;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          if (attempt > 0) {
            console.log(`Tile ${tileNum}/${tiles.length}: Retry attempt ${attempt + 1}/${MAX_RETRIES}`);
          } else {
            console.log(`Processing tile ${tileNum}/${tiles.length}`);
          }

          const timeoutPromise = new Promise<Location[]>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), TILE_TIMEOUT);
          });

          const processPromise = this.processSingleTile(
            tile,
            equipmentList,
            pageNum,
            visualExamples,
            width,
            height,
            modelName
          );

          const result = await Promise.race([processPromise, timeoutPromise]);

          if (result.length > 0) {
            console.log(`Tile ${tileNum}: Found ${result.length} locations`);
          }
          return result;

        } catch (error) {
          if (attempt < MAX_RETRIES - 1) {
            const waitTime = (attempt + 1) * 5000;
            console.log(`Tile ${tileNum} error: ${error}. Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else {
            console.log(`Tile ${tileNum} failed after ${MAX_RETRIES} attempts`);
            return [];
          }
        }
      }

      return [];
    };

    // Process tiles in batches
    for (let i = 0; i < tiles.length; i += CONCURRENCY) {
      const batch = tiles.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(processTileWithRetry));
      results.forEach(res => allTileLocations.push(...res));
    }

    // Merge duplicates
    console.log(`processWithTiling: Merging ${allTileLocations.length} locations...`);
    const merged = this.mergeLocations(allTileLocations);
    console.log(`processWithTiling: After merge: ${merged.length} locations`);
    
    return merged;
  }

  private async processSingleTile(
    tile: { image: Buffer; offset: [number, number]; size: [number, number]; index: number },
    equipmentList: string,
    pageNum: number,
    visualExamples: VisualExamples | undefined,
    fullWidth: number,
    fullHeight: number,
    modelName: string = 'flash'
  ): Promise<Location[]> {
    const prompt = `
    You are an expert mechanical engineer. Analyze the provided floor plan tile (part of a larger plan) and locate the following equipment.
    
    Target Equipment and Specific Tags to Find:
    ${equipmentList}
    
    IMPORTANT INSTRUCTIONS:
    1. Search specifically for the tags provided in the "tags" list for each equipment type.
    2. Ignore any equipment symbols that are significantly cut off at the edges of this tile. They will be captured in overlapping tiles.
    3. Be extremely strict with tag matching. Do not hallucinate tags. If a tag is not clearly legible, do not invent one.
    4. Provide a confidence score (0.0-1.0) for each detection.
    
    For each piece of equipment found, provide its PRECISE location using a bounding box.
    
    Return the result as a JSON list of objects with the following keys:
    - type: The type of equipment found.
    - tag: The specific tag found (e.g., "WSHP-1"). Must be one of the tags from the provided list.
    - bbox: [ymin, xmin, ymax, xmax] coordinates (0-1000 scale) RELATIVE TO THIS TILE.
    - confidence: Your confidence level (0.0-1.0).
    `;

    const parts: (string | { inlineData: { data: string; mimeType: 'image/jpeg' } })[] = [prompt];

    if (visualExamples?.image && visualExamples?.examples?.length > 0) {
      this.addVisualExamples(parts, visualExamples);
    }

    parts.push({
      inlineData: {
        data: tile.image.toString('base64'),
        mimeType: 'image/jpeg'
      }
    });

    const model = this.getModel(modelName);
    const tileLocations: Location[] = [];

    try {
      const response = await retryWithBackoff(async () => {
        return await model.generateContent(parts);
      }, 5, 2000);

      const rawLocations = this.parseJsonResponse(response.response.text());
      const [tileW, tileH] = tile.size;
      const [offsetX, offsetY] = tile.offset;

      for (const loc of rawLocations) {
        // Filter low confidence
        if ((loc.confidence || 0) < 0.6) {
          continue;
        }

        if (loc.bbox) {
          const [ymin, xmin, ymax, xmax] = loc.bbox;

          // Convert from tile-relative to absolute coordinates
          const absYmin = (ymin / 1000 * tileH) + offsetY;
          const absXmin = (xmin / 1000 * tileW) + offsetX;
          const absYmax = (ymax / 1000 * tileH) + offsetY;
          const absXmax = (xmax / 1000 * tileW) + offsetX;

          // Convert back to 0-1000 scale relative to full image
          loc.bbox = [
            (absYmin / fullHeight) * 1000,
            (absXmin / fullWidth) * 1000,
            (absYmax / fullHeight) * 1000,
            (absXmax / fullWidth) * 1000
          ] as [number, number, number, number];
          loc.page = pageNum;
          tileLocations.push(loc);
        }
      }
    } catch (error) {
      console.error(`Error processing tile ${tile.index}:`, error);
    }

    return tileLocations;
  }

  private calculateIoU(box1: [number, number, number, number], box2: [number, number, number, number]): number {
    const yTop = Math.max(box1[0], box2[0]);
    const xLeft = Math.max(box1[1], box2[1]);
    const yBottom = Math.min(box1[2], box2[2]);
    const xRight = Math.min(box1[3], box2[3]);

    if (xRight < xLeft || yBottom < yTop) {
      return 0.0;
    }

    const intersectionArea = (xRight - xLeft) * (yBottom - yTop);
    const box1Area = (box1[2] - box1[0]) * (box1[3] - box1[1]);
    const box2Area = (box2[2] - box2[0]) * (box2[3] - box2[1]);
    const unionArea = box1Area + box2Area - intersectionArea;

    if (unionArea === 0) {
      return 0.0;
    }

    return intersectionArea / unionArea;
  }

  private mergeLocations(locations: Location[]): Location[] {
    if (locations.length === 0) {
      return [];
    }

    console.log(`_merge_locations: Starting merge of ${locations.length} locations`);

    // Filter low confidence
    const filtered = locations.filter(loc => (loc.confidence || 0) >= 0.6);
    console.log(`_merge_locations: ${filtered.length} locations after confidence filter`);

    // Sort by confidence descending
    const sorted = [...filtered].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    const merged: Location[] = [];

    for (const loc of sorted) {
      let isDuplicate = false;

      for (const kept of merged) {
        const iou = this.calculateIoU(loc.bbox, kept.bbox);

        if (iou > 0.3) {
          if (loc.tag === kept.tag) {
            isDuplicate = true;
            break;
          } else if (iou > 0.7) {
            isDuplicate = true;
            break;
          }
        }
      }

      if (!isDuplicate) {
        merged.push(loc);
      }
    }

    console.log(`_merge_locations: Merge complete, ${merged.length} unique locations`);
    return merged;
  }

  private addVisualExamples(
    parts: (string | { inlineData: { data: string; mimeType: 'image/jpeg' } })[],
    visualExamples: VisualExamples
  ): void {
    try {
      parts.push('\n\nVISUAL EXAMPLES:\nThe following are examples of equipment symbols to look for:\n');

      // The visual examples contain an image and bounding boxes
      // We'll add a description and the full reference image
      for (const example of visualExamples.examples) {
        parts.push(`Example: ${example.name} at bbox [${example.bbox.join(', ')}]`);
      }

      // Add the reference image
      const imageData = visualExamples.image.split(',')[1] || visualExamples.image;
      parts.push({
        inlineData: {
          data: imageData,
          mimeType: 'image/jpeg'
        }
      });
    } catch (error) {
      console.error('Error processing visual examples:', error);
    }
  }

  private parseJsonResponse(text: string): Location[] {
    try {
      const match = text.match(/\[.*\]/s);
      const jsonStr = match ? match[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      return [];
    }
  }

  async extractGrdSymbols(image: Buffer): Promise<string> {
    const prompt = `
    You are an expert mechanical engineer. Analyze the provided cover page image and identify the symbols used for Grilles, Registers, and Diffusers (GRDs).
    
    Look for a legend or a schedule that defines these symbols. If found, extract each symbol's bounding box and its description/type.
    
    Return the result as a JSON list of objects with the following keys:
    - id: A unique identifier for the symbol (e.g., "symbol_1").
    - name: The name or type of the symbol (e.g., "Supply Diffuser", "Return Grille").
    - description: A brief description if available.
    - bbox: [ymin, xmin, ymax, xmax] coordinates (0-1000 scale) of the symbol in the image.
    `;

    const response = await retryWithBackoff(async () => {
      return await this.flashModel.generateContent([
        prompt,
        {
          inlineData: {
            data: image.toString('base64'),
            mimeType: 'image/jpeg'
          }
        }
      ]);
    }, 5, 2000);

    const text = response.response.text();
    const jsonMatch = text.match(/\[.*\]/s);
    const result = jsonMatch ? jsonMatch[0] : text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    console.log(`Gemini Symbol Response: ${result}`);
    return result;
  }
}

// Singleton instance
let geminiServiceInstance: GeminiService | null = null;

export function getGeminiService(): GeminiService {
  if (!geminiServiceInstance) {
    geminiServiceInstance = new GeminiService();
  }
  return geminiServiceInstance;
}
