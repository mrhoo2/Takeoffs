import asyncio
from unittest.mock import MagicMock, AsyncMock
from PIL import Image
import sys
import os

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from services.gemini_service import GeminiService

async def test_tiling():
    # Create a large dummy image (3000x3000)
    img = Image.new('RGB', (3000, 3000), color='white')
    
    service = GeminiService()
    
    # Mock the model
    service.model = MagicMock()
    service.model.generate_content_async = AsyncMock()
    
    # Mock response to return a dummy location in the center of the tile
    # We expect 4 tiles for a 3000x3000 image with 1500 tile size and 300 overlap
    # (0,0), (0, 1500-300?), actually let's see how the logic works
    # 3000 width, 1500 tile, 300 overlap.
    # Col 1: 0 to 1500
    # Col 2: 1200 to 2700
    # Col 3: 1500 to 3000 (last tile adjustment)
    
    # Let's just return a generic response and see if it merges correctly
    service.model.generate_content_async.return_value.text = """
    [
        {
            "type": "Test Equipment",
            "tag": "TEST-1",
            "bbox": [500, 500, 600, 600], 
            "confidence": 0.95
        }
    ]
    """
    # Note: bbox is 0-1000 relative to tile.
    # If tile is 1500x1500, [500, 500, 600, 600] corresponds to:
    # ymin=750, xmin=750, ymax=900, xmax=900 pixels relative to tile.
    
    print("Running tiling test...")
    locations_json = await service.find_equipment_locations([img], "Test Equipment")
    print("Result:", locations_json)
    
    # We expect multiple detections (one per tile) but merged into fewer if they overlap?
    # Actually with the mock returning the same relative bbox for every tile, they will be at different absolute locations.
    # So we should see multiple distinct items.
    
if __name__ == "__main__":
    asyncio.run(test_tiling())
