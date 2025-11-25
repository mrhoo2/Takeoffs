import anthropic
import os
from dotenv import load_dotenv
import asyncio
from functools import wraps
import json
import re
import base64
from PIL import Image
import io

load_dotenv()

def retry_with_backoff(retries=3, initial_delay=1):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            delay = initial_delay
            for i in range(retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if i == retries - 1:
                        raise e
                    print(f"Claude API error: {e}. Retrying in {delay} seconds...")
                    await asyncio.sleep(delay)
                    delay *= 2
        return wrapper
    return decorator

class ClaudeService:
    def __init__(self):
        api_key = os.getenv("OPUS_API_KEY")
        if not api_key:
            print("Warning: OPUS_API_KEY not set")
            self.client = None
        else:
            self.client = anthropic.Anthropic(api_key=api_key)
            self.model = 'claude-opus-4-5-20251101'

    def _image_to_base64(self, image):
        """Convert PIL Image to base64 string for Claude API"""
        buffered = io.BytesIO()
        image.save(buffered, format="JPEG")
        return base64.b64encode(buffered.getvalue()).decode('utf-8')

    def _create_image_content(self, image):
        """Create Claude API image content block"""
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": self._image_to_base64(image)
            }
        }

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

        message_content = []
        
        # Text-based extraction
        if isinstance(content, str):
            message_content.append({
                "type": "text",
                "text": f"{prompt_text}\n\nText content:\n{content}"
            })
        else:
            # Image-based extraction
            message_content.append({"type": "text", "text": prompt_text})
            if isinstance(content, list):
                for img in content:
                    message_content.append(self._create_image_content(img))
            else:
                message_content.append(self._create_image_content(content))

        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=[{"role": "user", "content": message_content}]
        )

        text = response.content[0].text
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            text = match.group(0)
        else:
            text = text.replace("```json", "").replace("```", "").strip()
        
        print(f"Claude Response: {text}") # Debug log
        return text

    @retry_with_backoff(retries=5, initial_delay=2)
    async def find_equipment_locations(self, plan_images, equipment_list, schedule_text=None, plan_text=None, visual_examples=None):
        # If single image, convert to list
        if not isinstance(plan_images, list):
            plan_images = [plan_images]

        all_locations = []
        
        for page_idx, image in enumerate(plan_images):
            # Check image size - if large, use tiling
            width, height = image.size
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
        
        message_content = [{"type": "text", "text": prompt}]
        
        # Add visual examples if provided
        if visual_examples and visual_examples.get('image') and visual_examples.get('examples'):
            self._add_visual_examples(message_content, visual_examples)

        message_content.append(self._create_image_content(image))

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": message_content}]
            )
            return self._parse_json_response(response.content[0].text)
        except Exception as e:
            print(f"Error processing page {page_num}: {e}")
            return []

    async def process_with_tiling(self, image, equipment_list, page_num, schedule_text, plan_text, visual_examples):
        width, height = image.size
        
        TILE_SIZE = 1500
        OVERLAP = 300
        
        tiles = []
        import math
        cols = math.ceil((width - OVERLAP) / (TILE_SIZE - OVERLAP))
        rows = math.ceil((height - OVERLAP) / (TILE_SIZE - OVERLAP))
        
        print(f"Splitting image into {rows}x{cols} grid")
        
        for r in range(rows):
            for c in range(cols):
                left = c * (TILE_SIZE - OVERLAP)
                top = r * (TILE_SIZE - OVERLAP)
                
                if left + TILE_SIZE > width:
                    left = width - TILE_SIZE
                if top + TILE_SIZE > height:
                    top = height - TILE_SIZE
                    
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
        
        semaphore = asyncio.Semaphore(10)
        
        async def process_tile_wrapper(tile):
            async with semaphore:
                print(f"Processing tile {tile['index']+1}/{len(tiles)}")
                return await self._process_single_tile(tile, equipment_list, page_num, visual_examples, width, height)

        tasks = [process_tile_wrapper(tile) for tile in tiles]
        results = await asyncio.gather(*tasks)
        
        for res in results:
            all_tile_locations.extend(res)
                
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
        
        message_content = [{"type": "text", "text": prompt}]
        
        if visual_examples and visual_examples.get('image') and visual_examples.get('examples'):
            self._add_visual_examples(message_content, visual_examples)
            
        message_content.append(self._create_image_content(tile['image']))
        
        tile_locations = []
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": message_content}]
            )
            raw_locations = self._parse_json_response(response.content[0].text)
            
            tile_w, tile_h = tile['size']
            offset_x, offset_y = tile['offset']
            
            for loc in raw_locations:
                if loc.get('confidence', 0) < 0.6:
                    continue

                if 'bbox' in loc:
                    ymin, xmin, ymax, xmax = loc['bbox']
                    
                    abs_ymin = (ymin / 1000 * tile_h) + offset_y
                    abs_xmin = (xmin / 1000 * tile_w) + offset_x
                    abs_ymax = (ymax / 1000 * tile_h) + offset_y
                    abs_xmax = (xmax / 1000 * tile_w) + offset_x
                    
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
        y_top = max(box1[0], box2[0])
        x_left = max(box1[1], box2[1])
        y_bottom = min(box1[2], box2[2])
        x_right = min(box1[3], box2[3])

        if x_right < x_left or y_bottom < y_top:
            return 0.0

        intersection_area = (x_right - x_left) * (y_bottom - y_top)
        box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
        box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
        union_area = box1_area + box2_area - intersection_area
        
        if union_area == 0:
            return 0.0
            
        return intersection_area / union_area

    def _merge_locations(self, locations):
        if not locations:
            return []
            
        filtered_locations = [loc for loc in locations if loc.get('confidence', 0) >= 0.6]
        sorted_locs = sorted(filtered_locations, key=lambda x: x.get('confidence', 0), reverse=True)
        
        merged = []
        
        for loc in sorted_locs:
            is_duplicate = False
            
            for kept in merged:
                iou = self._calculate_iou(loc['bbox'], kept['bbox'])
                
                if iou > 0.3:
                    if loc.get('tag') == kept.get('tag'):
                        is_duplicate = True
                        break
                    elif iou > 0.7:
                        is_duplicate = True
                        break
            
            if not is_duplicate:
                merged.append(loc)
                
        return merged

    def _add_visual_examples(self, message_content, visual_examples):
        try:
            # Decode base64 image
            img_data = base64.b64decode(visual_examples['image'].split(',')[1])
            ref_image = Image.open(io.BytesIO(img_data))
            
            message_content.append({
                "type": "text",
                "text": "\n\nVISUAL EXAMPLES:\nThe following images are examples of equipment symbols to look for:\n"
            })
            
            for example in visual_examples['examples']:
                bbox = example['bbox']
                
                # Convert 0-1000 scale to pixels
                width, height = ref_image.size
                left = (bbox[1] / 1000) * width
                top = (bbox[0] / 1000) * height
                right = (bbox[3] / 1000) * width
                bottom = (bbox[2] / 1000) * height
                
                # Crop
                cropped = ref_image.crop((left, top, right, bottom))
                
                # Add to content
                message_content.append({
                    "type": "text",
                    "text": f"Example: {example['name']}"
                })
                message_content.append(self._create_image_content(cropped))
                
        except Exception as e:
            print(f"Error processing visual examples: {e}")

    def _parse_json_response(self, text):
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
        
        message_content = [
            {"type": "text", "text": prompt},
            self._create_image_content(image)
        ]
        
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=[{"role": "user", "content": message_content}]
        )
        
        text = response.content[0].text
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            text = match.group(0)
        else:
            text = text.replace("```json", "").replace("```", "").strip()
            
        print(f"Claude Symbol Response: {text}") # Debug log
        return text
