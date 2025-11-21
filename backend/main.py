from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
import io
import base64
import json
from services.gemini_service import GeminiService
from services.pdf_service import PDFService

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
    )

# Initialize services
gemini_service = GeminiService()
pdf_service = PDFService()

@app.get("/")
async def root():
    return {"message": "Construction Drawing Processor API"}

@app.post("/upload/schedule")
async def upload_schedule(file: UploadFile = File(...)):
    content = await file.read()
    
    # Always convert to images for bounding box extraction and visualization
    images = await pdf_service.convert_pdf_to_images(content)
    
    # Limit to first 5 pages to avoid hitting payload limits too easily
    # In production, we'd handle this more robustly (e.g., batching)
    processed_images = images[:5]
    
    equipment_json = await gemini_service.extract_equipment_types(processed_images)
    
    # Convert images to base64 for frontend display
    import base64
    from io import BytesIO
    
    encoded_images = []
    for img in processed_images:
        buffered = BytesIO()
        img.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        encoded_images.append(f"data:image/jpeg;base64,{img_str}")
    
    # Extract text from the schedule PDF
    schedule_text = await pdf_service.extract_text_from_pdf(content)
    
    return {
        "filename": file.filename, 
        "equipment": equipment_json,
        "images": encoded_images,
        "text": schedule_text
    }

@app.post("/upload/plans")
async def upload_plans(
    file: UploadFile = File(...),
    equipment: str = Form(...), # Expecting JSON string of selected equipment
    schedule_text: str = Form(None),
    visual_examples: str = Form(None) # Expecting JSON string of visual examples
):
    content = await file.read()
    images = await pdf_service.convert_pdf_to_images(content)
    
    if not images:
        raise HTTPException(status_code=400, detail="Could not convert PDF to images")
    
    # Extract text from plans for context
    plan_text = await pdf_service.extract_text_from_pdf(content)
    
    # Process images with Gemini
    # Note: The original code limited to 5 pages for processed_images,
    # but the requested change processes all images.
    processed_images = images
    
    # Parse visual examples if provided
    examples_data = None
    if visual_examples:
        try:
            examples_data = json.loads(visual_examples)
        except json.JSONDecodeError:
            print("Failed to parse visual examples JSON")

    locations_json = await gemini_service.find_equipment_locations(
        processed_images, 
        equipment, 
        schedule_text=schedule_text, 
        plan_text=plan_text,
        visual_examples=examples_data # Pass examples_data
    )
    
    # Convert images to base64 for frontend display
    # Note: The original code encoded `processed_images` (which was `images[:5]`),
    # but the requested change encodes all `images`.
    encoded_images = []
    for img in images:
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG")
        encoded_images.append(f"data:image/jpeg;base64,{base64.b64encode(buffered.getvalue()).decode('utf-8')}")
    
    return {
        "filename": file.filename,
        "locations": locations_json,
        "images": encoded_images
    }

@app.post("/upload/cover-page")
async def upload_cover_page(file: UploadFile = File(...)):
    content = await file.read()
    images = await pdf_service.convert_pdf_to_images(content)
    
    if not images:
        raise HTTPException(status_code=400, detail="Could not convert PDF to images")
    
    # Process only the first page (cover page)
    cover_page = images[0]
    
    # Skip auto-extraction to speed up upload
    # symbols_json = await gemini_service.extract_grd_symbols(cover_page)
    symbols_json = []
    
    # Convert image to base64
    import base64
    from io import BytesIO
    
    buffered = BytesIO()
    cover_page.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    encoded_image = f"data:image/jpeg;base64,{img_str}"
    
    return {
        "filename": file.filename,
        "symbols": symbols_json,
        "image": encoded_image
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
