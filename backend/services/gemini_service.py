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
    async def find_equipment_locations(self, plan_images, equipment_list, schedule_text=None, plan_text=None, visual_examples=None):
        prompt = f"""
        You are an expert mechanical engineer. Analyze the provided floor plan images and locate the following equipment:
        {equipment_list}
        
        For each piece of equipment found, provide its PRECISE location using a bounding box.
        
        Return the result as a JSON list of objects with the following keys:
        - type: The type of equipment found.
        - tag: The specific tag found (e.g., "WSHP-1").
        - page: The page number (1-indexed) where the equipment is found.
        - bbox: [ymin, xmin, ymax, xmax] coordinates (0-1000 scale) of the equipment on the plan. Ensure this box tightly encloses the equipment symbol and its tag.
        - confidence: Your confidence level (0.0-1.0).
        """
        
        if schedule_text:
            prompt += f"\n\nContext from Mechanical Schedule:\n{schedule_text[:10000]}..." # Truncate to avoid huge context
            
        if plan_text:
            prompt += f"\n\nContext from Floor Plans (Text Extracted):\n{plan_text[:10000]}..." # Truncate
        
        # Prepare content list with prompt
        content = [prompt]
        
        # Add visual examples if provided
        if visual_examples and visual_examples.get('image') and visual_examples.get('examples'):
            try:
                import base64
                from PIL import Image
                import io

                # Decode base64 image
                img_data = base64.b64decode(visual_examples['image'].split(',')[1])
                ref_image = Image.open(io.BytesIO(img_data))
                
                prompt += "\n\nVISUAL EXAMPLES:\nThe following images are examples of equipment symbols to look for:\n"
                
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

        # Add plan images
        if isinstance(plan_images, list):
            content.extend(plan_images)
        else:
            content.append(plan_images)

        response = await self.model.generate_content_async(content)
        
        # Robust JSON extraction
        import re
        text = response.text
        match = re.search(r'\[.*\]', text, re.DOTALL)
        if match:
            text = match.group(0)
        else:
            text = text.replace("```json", "").replace("```", "").strip()
            
        print(f"Gemini Location Response: {text}") # Debug log
        return text

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
