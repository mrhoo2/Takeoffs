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
    async def find_equipment_locations(self, plan_images, equipment_list):
        prompt = f"""
        You are an expert mechanical engineer. Analyze the provided floor plan images and locate the following equipment:
        {equipment_list}
        
        For each piece of equipment found, provide its approximate location.
        
        Return the result as a JSON list of objects with the following keys:
        - type: The type of equipment found.
        - tag: The specific tag found (e.g., "WSHP-1").
        - page: The page number (1-indexed) where the equipment is found.
        - x: The x-coordinate (0-100) from the left.
        - y: The y-coordinate (0-100) from the top.
        - confidence: Your confidence level (0.0-1.0).
        """
        
        # Prepare content list with prompt and all images
        content = [prompt]
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
