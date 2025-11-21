from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import os
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
    
    return {
        "filename": file.filename, 
        "equipment": equipment_json,
        "images": encoded_images
    }

@app.post("/upload/plans")
async def upload_plans(
    file: UploadFile = File(...), 
    equipment: str = Form(...) # Expecting JSON string of selected equipment
):
    content = await file.read()
    images = await pdf_service.convert_pdf_to_images(content)
    
    if not images:
        raise HTTPException(status_code=400, detail="Could not convert PDF to images")
    
    # Process first 5 pages
    processed_images = images[:5]
    
    locations_json = await gemini_service.find_equipment_locations(processed_images, equipment)
    
    # Convert images to base64
    import base64
    from io import BytesIO
    
    encoded_images = []
    for img in processed_images:
        buffered = BytesIO()
        img.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        encoded_images.append(f"data:image/jpeg;base64,{img_str}")
    
    return {
        "filename": file.filename, 
        "locations": locations_json,
        "images": encoded_images
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
