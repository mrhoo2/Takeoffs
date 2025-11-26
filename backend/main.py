from fastapi import FastAPI, UploadFile, File, HTTPException, Form, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware
import uvicorn
import os
import io
import base64
import json
import uuid
import time
import traceback
import logging
from services.gemini_service import GeminiService
from services.pdf_service import PDFService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all requests and responses with timing"""
    
    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        # Log request
        logger.info(f"[{request_id}] → {request.method} {request.url.path}")
        logger.info(f"[{request_id}]   Client: {request.client.host if request.client else 'unknown'}")
        
        try:
            response = await call_next(request)
            
            # Calculate timing
            duration = time.time() - start_time
            
            # Log response
            logger.info(f"[{request_id}] ← {response.status_code} ({duration:.2f}s)")
            
            # Add custom headers for debugging
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{duration:.2f}s"
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"[{request_id}] ✗ Error after {duration:.2f}s: {type(e).__name__}: {str(e)}")
            logger.error(f"[{request_id}]   Traceback: {traceback.format_exc()}")
            raise


app.add_middleware(RequestLoggingMiddleware)

# In-memory storage for uploaded PDFs (in production, use a proper storage solution)
pdf_storage: dict[str, bytes] = {}

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:3001",
        "https://bv-takeoffs.onrender.com",  # Backend URL
        "https://*.vercel.app",  # Vercel preview deployments
        "https://bvtakeoffs.vercel.app",  # Production Vercel domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Page-Width", "X-Page-Height"],
)

# Global exception handler with detailed logging
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception for {request.method} {request.url.path}")
    logger.error(f"Exception type: {type(exc).__name__}")
    logger.error(f"Exception message: {str(exc)}")
    logger.error(f"Traceback:\n{traceback.format_exc()}")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "type": type(exc).__name__,
            "path": str(request.url.path),
        },
    )

# Initialize services
gemini_service = GeminiService()
pdf_service = PDFService()

@app.get("/")
async def root():
    return {"message": "Construction Drawing Processor API"}

# In-memory storage for schedule images (similar to pdf_storage)
schedule_image_storage: dict[str, list[str]] = {}

@app.post("/upload/schedule")
async def upload_schedule(file: UploadFile = File(...)):
    """
    Upload schedule endpoint that streams progress updates via SSE to keep connection alive.
    Images are stored server-side and fetched separately to avoid large SSE payloads.
    """
    import asyncio
    
    logger.info(f"=== SCHEDULE UPLOAD STARTED (SSE) ===")
    logger.info(f"Filename: {file.filename}")
    
    try:
        content = await file.read()
        filename = file.filename
        logger.info(f"File read: {len(content)} bytes")
    except Exception as e:
        logger.error(f"Failed to read uploaded file: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
    
    async def generate_progress():
        """Generator that yields SSE events with heartbeats during Gemini processing"""
        nonlocal content, filename
        
        # Immediately send connection confirmation
        yield f"data: {json.dumps({'status': 'connected', 'message': 'Connection established'})}\n\n"
        
        try:
            yield f"data: {json.dumps({'status': 'processing', 'step': 'Converting PDF to images...'})}\n\n"
            
            # Convert to images
            images = await pdf_service.convert_pdf_to_images(content, dpi=200)
            logger.info(f"Converted to {len(images)} images")
            
            if not images:
                yield f"data: {json.dumps({'status': 'error', 'message': 'Could not convert PDF to images'})}\n\n"
                return
            
            # Limit to first 5 pages
            processed_images = images[:5]
            
            yield f"data: {json.dumps({'status': 'processing', 'step': 'Analyzing schedule with AI...'})}\n\n"
            
            # Process with Gemini - with heartbeat to keep connection alive
            logger.info("Calling Gemini to extract equipment types...")
            
            # Create a task for Gemini processing
            gemini_task = asyncio.create_task(
                gemini_service.extract_equipment_types(processed_images)
            )
            
            # Send heartbeat every 5 seconds while waiting for Gemini
            heartbeat_count = 0
            while not gemini_task.done():
                done, pending = await asyncio.wait(
                    {gemini_task}, 
                    timeout=5.0,
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                if not done:
                    heartbeat_count += 1
                    elapsed_secs = heartbeat_count * 5
                    yield f"data: {json.dumps({'status': 'processing', 'step': f'AI analyzing schedule... ({elapsed_secs}s elapsed)'})}\n\n"
                    print(f"\r[Heartbeat] Gemini processing schedule: {elapsed_secs}s elapsed", end="", flush=True)
            
            if heartbeat_count > 0:
                print()
            
            # Get the result
            try:
                equipment_json = await gemini_task
                logger.info(f"Gemini returned equipment JSON: {len(equipment_json) if equipment_json else 0} chars")
            except Exception as gemini_error:
                logger.error(f"Gemini processing failed: {gemini_error}")
                logger.error(traceback.format_exc())
                yield f"data: {json.dumps({'status': 'error', 'message': f'AI processing failed: {str(gemini_error)}'})}\n\n"
                return
            
            yield f"data: {json.dumps({'status': 'processing', 'step': 'Storing images...'})}\n\n"
            
            # Store images server-side with an ID (instead of sending huge base64 in SSE)
            schedule_id = str(uuid.uuid4())
            from io import BytesIO
            encoded_images = []
            total_image_size = 0
            
            for i, img in enumerate(processed_images):
                buffered = BytesIO()
                img.save(buffered, format="JPEG", quality=85)
                img_bytes = buffered.getvalue()
                total_image_size += len(img_bytes)
                img_str = base64.b64encode(img_bytes).decode("utf-8")
                encoded_images.append(f"data:image/jpeg;base64,{img_str}")
            
            schedule_image_storage[schedule_id] = encoded_images
            logger.info(f"Stored {len(encoded_images)} images ({total_image_size / 1024 / 1024:.2f} MB) with ID: {schedule_id}")
            
            yield f"data: {json.dumps({'status': 'processing', 'step': 'Extracting text...'})}\n\n"
            
            # Extract text
            schedule_text = await pdf_service.extract_text_from_pdf(content)
            logger.info(f"Extracted {len(schedule_text) if schedule_text else 0} chars of text")
            
            # Build smaller response (images fetched separately)
            response_data = {
                "filename": filename, 
                "equipment": equipment_json,
                "scheduleId": schedule_id,
                "imageCount": len(encoded_images),
                "text": schedule_text
            }
            
            response_size = len(json.dumps(response_data))
            logger.info(f"Response size: {response_size / 1024:.2f} KB")
            
            yield f"data: {json.dumps({'status': 'complete', 'result': response_data})}\n\n"
            logger.info("=== SCHEDULE UPLOAD COMPLETE ===")
            
        except Exception as e:
            logger.error(f"Error in schedule processing: {e}")
            logger.error(traceback.format_exc())
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
    
    return StreamingResponse(
        generate_progress(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/schedule/{schedule_id}/images")
async def get_schedule_images(schedule_id: str):
    """Fetch stored schedule images by ID"""
    if schedule_id not in schedule_image_storage:
        raise HTTPException(status_code=404, detail="Schedule images not found")
    
    return {"images": schedule_image_storage[schedule_id]}

# Storage for async job results
job_storage: dict[str, dict] = {}


@app.post("/upload/plans")
async def upload_plans(
    file: UploadFile = File(...),
    equipment: str = Form(...), # Expecting JSON string of selected equipment
    schedule_text: str = Form(None),
    visual_examples: str = Form(None) # Expecting JSON string of visual examples
):
    """
    Upload plans endpoint that streams progress updates via SSE to keep connection alive.
    """
    import asyncio
    
    logger.info("=== PLANS UPLOAD STARTED (SSE) ===")
    
    content = await file.read()
    filename = file.filename
    logger.info(f"File read: {len(content)} bytes")
    
    async def generate_progress():
        """Generator that yields SSE events with heartbeats during Gemini processing"""
        nonlocal content, filename
        
        logger.info("Plans SSE generator started, sending connected message...")
        
        # Immediately send connection confirmation
        yield f"data: {json.dumps({'status': 'connected', 'message': 'Connection established'})}\n\n"
        
        logger.info("Plans SSE: Connected message sent, starting processing...")
        
        try:
            yield f"data: {json.dumps({'status': 'processing', 'step': 'Converting PDF to images...'})}\n\n"
            
            # High-resolution images for processing
            images = await pdf_service.convert_pdf_to_images(content, dpi=200)
            logger.info(f"Converted to {len(images)} images")
            
            if not images:
                yield f"data: {json.dumps({'status': 'error', 'message': 'Could not convert PDF to images'})}\n\n"
                return
            
            yield f"data: {json.dumps({'status': 'processing', 'step': 'Extracting text...'})}\n\n"
            
            # Extract text
            plan_text = await pdf_service.extract_text_from_pdf(content)
            logger.info(f"Text extracted: {len(plan_text) if plan_text else 0} chars")
            
            # Parse visual examples
            examples_data = None
            if visual_examples:
                try:
                    examples_data = json.loads(visual_examples)
                except json.JSONDecodeError:
                    pass
            
            yield f"data: {json.dumps({'status': 'processing', 'step': f'AI processing {len(images)} page(s) - this may take several minutes...'})}\n\n"
            
            # Process with Gemini - with heartbeat to keep connection alive
            logger.info("=== STARTING GEMINI PROCESSING ===")
            
            # Create a task for Gemini processing
            gemini_task = asyncio.create_task(
                gemini_service.find_equipment_locations(
                    images, 
                    equipment, 
                    schedule_text=schedule_text, 
                    plan_text=plan_text,
                    visual_examples=examples_data
                )
            )
            
            # Send heartbeat every 5 seconds while waiting for Gemini (same as schedule)
            heartbeat_count = 0
            while not gemini_task.done():
                # Wait up to 5 seconds for the task to complete
                done, pending = await asyncio.wait(
                    {gemini_task}, 
                    timeout=5.0,
                    return_when=asyncio.FIRST_COMPLETED
                )
                
                if not done:
                    # Task not done yet, send heartbeat
                    heartbeat_count += 1
                    elapsed_secs = heartbeat_count * 5
                    elapsed_mins = elapsed_secs // 60
                    remaining_secs = elapsed_secs % 60
                    yield f"data: {json.dumps({'status': 'processing', 'step': f'AI processing floor plans... ({elapsed_mins}m {remaining_secs}s elapsed)'})}\n\n"
                    # Single line heartbeat log that overwrites previous
                    print(f"\r[Heartbeat] Gemini processing plans: {elapsed_mins}m {remaining_secs}s elapsed", end="", flush=True)
            
            # Print newline after heartbeats complete
            if heartbeat_count > 0:
                print()  # Move to next line after heartbeat updates
            
            # Get the result
            try:
                locations_json = await gemini_task  # Use await to get result and propagate any exception
                logger.info(f"=== GEMINI PROCESSING COMPLETE ===")
                logger.info(f"Locations result length: {len(locations_json) if locations_json else 0}")
            except Exception as gemini_error:
                logger.error(f"Gemini processing failed: {gemini_error}")
                logger.error(traceback.format_exc())
                yield f"data: {json.dumps({'status': 'error', 'message': f'AI processing failed: {str(gemini_error)}'})}\n\n"
                return
            
            yield f"data: {json.dumps({'status': 'processing', 'step': 'Storing results...'})}\n\n"
            
            # Store PDF
            pdf_id = str(uuid.uuid4())
            pdf_storage[pdf_id] = content
            logger.info(f"PDF stored with ID: {pdf_id}")
            
            # Get page info
            try:
                page_info = await pdf_service.get_pdf_page_info(content)
                logger.info(f"Page info retrieved: {len(page_info)} pages")
            except Exception as page_error:
                logger.error(f"Error getting page info: {page_error}")
                page_info = [{"width": 800, "height": 600} for _ in images]  # Fallback
            
            # Build final response
            response_data = {
                "filename": filename,
                "locations": locations_json,
                "pdfId": pdf_id,
                "pageInfo": page_info,
                "pageCount": len(images)
            }
            
            logger.info(f"Sending final result with {len(page_info)} pages, locations length: {len(locations_json)}")
            
            # Send final result
            yield f"data: {json.dumps({'status': 'complete', 'result': response_data})}\n\n"
            logger.info("=== PLANS UPLOAD COMPLETE ===")
            
        except Exception as e:
            logger.error(f"Error in plans processing: {e}")
            logger.error(traceback.format_exc())
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"
    
    # Wrap generator to ensure proper data flushing
    async def wrapped_generator():
        async for chunk in generate_progress():
            yield chunk
            # Give event loop time to flush data
            await asyncio.sleep(0.01)
    
    return StreamingResponse(
        wrapped_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering if present
        }
    )


@app.get("/pdf/{pdf_id}/page/{page_num}/svg")
async def get_pdf_page_svg(pdf_id: str, page_num: int):
    """Serve individual PDF pages as SVG on-demand"""
    if pdf_id not in pdf_storage:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    content = pdf_storage[pdf_id]
    
    # Convert only the requested page to SVG (more efficient)
    page_data = await pdf_service.convert_pdf_page_to_svg(content, page_num)
    
    if page_data is None:
        raise HTTPException(status_code=404, detail="Page not found")
    
    return Response(
        content=page_data["svg"],
        media_type="image/svg+xml",
        headers={
            "X-Page-Width": str(page_data["width"]),
            "X-Page-Height": str(page_data["height"]),
        }
    )

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
    # Note: reload=False helps avoid gRPC fork issues with Gemini SDK
    # For development, restart manually after code changes
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
