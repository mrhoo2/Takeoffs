import google.generativeai as genai
import os
from dotenv import load_dotenv
import time
import asyncio
from functools import wraps
from google.api_core import exceptions

load_dotenv()

def retry_with_backoff(retries=3, initial_delay=1):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            delay = initial_delay
            for i in range(retries):
                try:
                    return await func(*args, **kwargs)
                except (exceptions.ResourceExhausted, exceptions.ServiceUnavailable, exceptions.InternalServerError) as e:
                    if i == retries - 1:
                        raise e
                    print(f"Gemini API error: {e}. Retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
                    delay *= 2
                except Exception as e:
                    # For other errors (like 400 Bad Request), don't retry
                    raise e
        return wrapper
    return decorator

class GeminiService:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            print("Warning: GEMINI_API_KEY not set")
        else:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-3-pro-preview')

    @retry_with_backoff(retries=5, initial_delay=2)
    async def extract_equipment_types(self, content):
        prompt_text = """
        You are an expert mechanical engineer. Analyze the following mechanical schedule and extract a list of equipment types.
        For each equipment type, identify if it is "typical" (multiple instances, usually alphabetical tags like WSHP-A) or "instance-based" (unique instances, usually numeric tags like RTU-1).
        
        Also, provide the bounding box of the row or section where this equipment is listed in the schedule.
        
        Return the result as a JSON list of objects with the following keys:
        - type: The name/type of the equipment (e.g., "Water Source Heat Pump", "Rooftop Unit").
        - tag_prefix: The prefix used in the tags (e.g., "WSHP", "RTU").
        - is_typical: Boolean, true if typical, false if instance-based.
        - tags: A list of example tags found (e.g., ["WSHP-A", "WSHP-B"] or ["RTU-1"]).
        - page: The page number (1-indexed) where this equipment is found.
        - bbox: [ymin, xmin, ymax, xmax] coordinates (0-1000 scale) of the equipment entry in the schedule.
        """

        # Text-based extraction (no bbox possible really, but we keep interface)
        if isinstance(content, str):
            full_prompt = f"{prompt_text}\n\nText content:\n{content}"
            response = await self.model.generate_content_async(full_prompt)
        else:
            # Image-based extraction (content is list of images)
            full_prompt = [prompt_text]
            if isinstance(content, list):
                full_prompt.extend(content)
            else:
                full_prompt.append(content)
            response = await self.model.generate_content_async(full_prompt)

        # Robust JSON extraction
        import re
        text = response.text
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            text = match.group(0)
        else:
            # Fallback cleanup if regex fails (unlikely for valid JSON)
            text = text.replace("```json", "").replace("```", "").strip()
        
        print(f"Gemini Response: {text}") # Debug log
        return text

    @retry_with_backoff(retries=5, initial_delay=2)
    @retry_with_backoff(retries=5, initial_delay=2)
    async def find_equipment_locations(self, plan_images, equipment_list, schedule_text=None, plan_text=None, visual_examples=None):
        # If single image, convert to list
        if not isinstance(plan_images, list):
            plan_images = [plan_images]

        all_locations = []
        
        import json
        
        for page_idx, image in enumerate(plan_images):
            # Check image size - if large, use tiling
            width, height = image.size
            # Threshold for tiling: e.g., > 2000x2000 pixels
            if width > 2000 or height > 2000:
                print(f"Image size {width}x{height} exceeds threshold. Using tiling strategy.")
                page_locations = await self.process_with_tiling(
                    image, 
                    equipment_list, 
                    page_idx + 1,
                    schedule_text,
                    plan_text,
                    visual_examples
                )
            else:
                # Standard processing for smaller images
                page_locations = await self._process_single_image(
                    image, 
                    equipment_list, 
                    page_idx + 1,
                    schedule_text,
                    plan_text,
                    visual_examples
                )
            
            all_locations.extend(page_locations)
            
        return json.dumps(all_locations)

    async def _process_single_image(self, image, equipment_list, page_num, schedule_text, plan_text, visual_examples):
        prompt = f"""
        You are an expert mechanical engineer. Analyze the provided floor plan image and locate the following equipment:
        {equipment_list}
        
        For each piece of equipment found, provide its PRECISE location using a bounding box.
        
        Return the result as a JSON list of objects with the following keys:
        - type: The type of equipment found.
        - tag: The specific tag found (e.g., "WSHP-1").
        - page: {page_num}
        - bbox: [ymin, xmin, ymax, xmax] coordinates (0-1000 scale) of the equipment on the plan. Ensure this box tightly encloses the equipment symbol and its tag.
        - confidence: Your confidence level (0.0-1.0).
        """
        
        if schedule_text:
            prompt += f"\n\nContext from Mechanical Schedule:\n{schedule_text[:5000]}..."
            
        if plan_text:
            prompt += f"\n\nContext from Floor Plans (Text Extracted):\n{plan_text[:5000]}..."
        
        content = [prompt]
        
        # Add visual examples if provided
        if visual_examples and visual_examples.get('image') and visual_examples.get('examples'):
            self._add_visual_examples(content, visual_examples)

        content.append(image)

        try:
            response = await self.model.generate_content_async(content)
            return self._parse_json_response(response.text)
        except Exception as e:
            print(f"Error processing page {page_num}: {e}")
            return []

    async def process_with_tiling(self, image, equipment_list, page_num, schedule_text, plan_text, visual_examples):
        width, height = image.size
        
        # Define tile size and overlap
        TILE_SIZE = 1500 # Process 1500x1500px tiles
        OVERLAP = 300    # 300px overlap to catch items on boundaries
        
        tiles = []
        # Calculate grid
        import math
        cols = math.ceil((width - OVERLAP) / (TILE_SIZE - OVERLAP))
        rows = math.ceil((height - OVERLAP) / (TILE_SIZE - OVERLAP))
        
        print(f"Splitting image into {rows}x{cols} grid")
        
        for r in range(rows):
            for c in range(cols):
                # Calculate coordinates
                left = c * (TILE_SIZE - OVERLAP)
                top = r * (TILE_SIZE - OVERLAP)
                
                # Adjust last tile to align with edge
                if left + TILE_SIZE > width:
                    left = width - TILE_SIZE
                if top + TILE_SIZE > height:
                    top = height - TILE_SIZE
                    
                # Ensure we don't go negative (if image smaller than tile)
                left = max(0, left)
                top = max(0, top)
                
                right = min(width, left + TILE_SIZE)
                bottom = min(height, top + TILE_SIZE)
                
                tile_img = image.crop((left, top, right, bottom))
                tiles.append({
                    'image': tile_img,
                    'offset': (left, top),
                    'size': (right - left, bottom - top),
                    'index': len(tiles)
                })

        all_tile_locations = []
        
        # Semaphore to control concurrency (max 10 requests at a time)
        semaphore = asyncio.Semaphore(10)
        
        async def process_tile_wrapper(tile):
            async with semaphore:
                print(f"Processing tile {tile['index']+1}/{len(tiles)}")
                return await self._process_single_tile(tile, equipment_list, page_num, visual_examples, width, height)

        # Create tasks for all tiles
        tasks = [process_tile_wrapper(tile) for tile in tiles]
        
        # Run tasks in parallel
        results = await asyncio.gather(*tasks)
        
        # Flatten results
        for res in results:
            all_tile_locations.extend(res)
                
        # Merge duplicates (NMS-like)
        return self._merge_locations(all_tile_locations)

    async def _process_single_tile(self, tile, equipment_list, page_num, visual_examples, full_width, full_height):
        prompt = f"""
        You are an expert mechanical engineer. Analyze the provided floor plan tile (part of a larger plan) and locate the following equipment:
        {equipment_list}
        
        IMPORTANT INSTRUCTIONS:
        1. Ignore any equipment symbols that are significantly cut off at the edges of this tile. They will be captured in overlapping tiles.
        2. Be extremely strict with tag matching. Do not hallucinate tags. If a tag is not clearly legible, do not invent one.
        3. Provide a confidence score (0.0-1.0) for each detection.
        
        For each piece of equipment found, provide its PRECISE location using a bounding box.
        
        Return the result as a JSON list of objects with the following keys:
        - type: The type of equipment found.
        - tag: The specific tag found (e.g., "WSHP-1").
        - bbox: [ymin, xmin, ymax, xmax] coordinates (0-1000 scale) RELATIVE TO THIS TILE.
        - confidence: Your confidence level (0.0-1.0).
        """
        
        content = [prompt]
        if visual_examples and visual_examples.get('image') and visual_examples.get('examples'):
            self._add_visual_examples(content, visual_examples)
            
        content.append(tile['image'])
        
        tile_locations = []
        try:
            response = await self.model.generate_content_async(content)
            raw_locations = self._parse_json_response(response.text)
            
            # Convert relative bbox to absolute bbox
            tile_w, tile_h = tile['size']
            offset_x, offset_y = tile['offset']
            
            for loc in raw_locations:
                # Filter low confidence immediately if possible, but we do it in merge too
                if loc.get('confidence', 0) < 0.6:
                    continue

                if 'bbox' in loc:
                    # 0-1000 scale -> pixels relative to tile
                    ymin, xmin, ymax, xmax = loc['bbox']
                    
                    abs_ymin = (ymin / 1000 * tile_h) + offset_y
                    abs_xmin = (xmin / 1000 * tile_w) + offset_x
                    abs_ymax = (ymax / 1000 * tile_h) + offset_y
                    abs_xmax = (xmax / 1000 * tile_w) + offset_x
                    
                    # Convert back to 0-1000 scale relative to FULL image
                    loc['bbox'] = [
                        (abs_ymin / full_height) * 1000,
                        (abs_xmin / full_width) * 1000,
                        (abs_ymax / full_height) * 1000,
                        (abs_xmax / full_width) * 1000
                    ]
                    loc['page'] = page_num
                    tile_locations.append(loc)
                    
        except Exception as e:
            print(f"Error processing tile {tile['index']}: {e}")
            
        return tile_locations

    def _calculate_iou(self, box1, box2):
        # box: [ymin, xmin, ymax, xmax] (0-1000 scale)
        
        # Determine intersection rectangle
        y_top = max(box1[0], box2[0])
        x_left = max(box1[1], box2[1])
        y_bottom = min(box1[2], box2[2])
        x_right = min(box1[3], box2[3])

        if x_right < x_left or y_bottom < y_top:
            return 0.0

        intersection_area = (x_right - x_left) * (y_bottom - y_top)

        # Determine union area
        box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
        box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
        
        union_area = box1_area + box2_area - intersection_area
        
        if union_area == 0:
            return 0.0
            
        return intersection_area / union_area

    def _merge_locations(self, locations):
        if not locations:
            return []
            
        # Filter out low confidence (redundant check but safe)
        filtered_locations = [loc for loc in locations if loc.get('confidence', 0) >= 0.6]
        
        # Sort by confidence descending
        sorted_locs = sorted(filtered_locations, key=lambda x: x.get('confidence', 0), reverse=True)
        
        merged = []
        
        for loc in sorted_locs:
            is_duplicate = False
            
            for kept in merged:
                iou = self._calculate_iou(loc['bbox'], kept['bbox'])
                
                # If IoU is high, it's likely the same object
                if iou > 0.3:
                    # If tags match, definitely duplicate
                    if loc.get('tag') == kept.get('tag'):
                        is_duplicate = True
                        break
                    # If tags differ but IoU is very high, it's probably the same object and one reading is wrong.
                    # Since we sorted by confidence, we keep the previous (higher confidence) one.
                    elif iou > 0.7:
                        is_duplicate = True
                        break
            
            if not is_duplicate:
                merged.append(loc)
                
        return merged

    def _add_visual_examples(self, content, visual_examples):
        try:
            import base64
            from PIL import Image
            import io

            # Decode base64 image
            img_data = base64.b64decode(visual_examples['image'].split(',')[1])
            ref_image = Image.open(io.BytesIO(img_data))
            
            content.append("\n\nVISUAL EXAMPLES:\nThe following images are examples of equipment symbols to look for:\n")
            
            for example in visual_examples['examples']:
                bbox = example['bbox'] # [ymin, xmin, ymax, xmax] 0-1000 scale
                
                # Convert 0-1000 scale to pixels
                width, height = ref_image.size
                left = (bbox[1] / 1000) * width
                top = (bbox[0] / 1000) * height
                right = (bbox[3] / 1000) * width
                bottom = (bbox[2] / 1000) * height
                
                # Crop
                cropped = ref_image.crop((left, top, right, bottom))
                
                # Add to content
                content.append(f"Example: {example['name']}")
                content.append(cropped)
                
        except Exception as e:
            print(f"Error processing visual examples: {e}")

    def _parse_json_response(self, text):
        import json
        import re
        
        try:
            match = re.search(r'\[.*\]', text, re.DOTALL)
            if match:
                json_str = match.group(0)
            else:
                json_str = text.replace("```json", "").replace("```", "").strip()
            return json.loads(json_str)
        except Exception as e:
            print(f"Error parsing JSON: {e}")
            return []

    @retry_with_backoff(retries=5, initial_delay=2)
    async def extract_grd_symbols(self, image):
        prompt = """
        You are an expert mechanical engineer. Analyze the provided cover page image and identify the symbols used for Grilles, Registers, and Diffusers (GRDs).
        
        Look for a legend or a schedule that defines these symbols. If found, extract each symbol's bounding box and its description/type.
        
        Return the result as a JSON list of objects with the following keys:
        - id: A unique identifier for the symbol (e.g., "symbol_1").
        - name: The name or type of the symbol (e.g., "Supply Diffuser", "Return Grille").
        - description: A brief description if available.
        - bbox: [ymin, xmin, ymax, xmax] coordinates (0-1000 scale) of the symbol in the image.
        """
        
        response = await self.model.generate_content_async([prompt, image])
        
        # Robust JSON extraction
        import re
        text = response.text
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            text = match.group(0)
        else:
            text = text.replace("```json", "").replace("```", "").strip()
            
        print(f"Gemini Symbol Response: {text}") # Debug log
        return text
