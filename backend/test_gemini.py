import asyncio
import os
from dotenv import load_dotenv
from services.gemini_service import GeminiService

load_dotenv()

async def main():
    try:
        print("Initializing GeminiService...")
        service = GeminiService()
        print("GeminiService initialized.")
        
        # Test extraction with simple text
        print("Testing extraction...")
        result = await service.extract_equipment_types("Test mechanical schedule")
        print("Result:", result)
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
