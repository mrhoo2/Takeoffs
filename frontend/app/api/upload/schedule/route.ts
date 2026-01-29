import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getPdfService } from '@/lib/services/pdf-service';
import { getGeminiService } from '@/lib/services/gemini-service';
import { storage } from '@/lib/storage';
import type { SSEEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

function createSSEMessage(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send connection confirmation
        controller.enqueue(encoder.encode(
          createSSEMessage({ status: 'connected', message: 'Connection established' })
        ));

        // Parse the form data
        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
          controller.enqueue(encoder.encode(
            createSSEMessage({ status: 'error', message: 'No file provided' })
          ));
          controller.close();
          return;
        }

        const filename = file.name;
        console.log(`=== SCHEDULE UPLOAD STARTED (SSE) ===`);
        console.log(`Filename: ${filename}`);

        // Read file content
        const arrayBuffer = await file.arrayBuffer();
        const content = Buffer.from(arrayBuffer);
        console.log(`File read: ${content.length} bytes`);

        controller.enqueue(encoder.encode(
          createSSEMessage({ status: 'processing', step: 'Converting PDF to images...' })
        ));

        // Convert PDF to images
        const pdfService = getPdfService();
        const images = await pdfService.convertPdfToImages(content, 200);
        console.log(`Converted to ${images.length} images`);

        if (images.length === 0) {
          controller.enqueue(encoder.encode(
            createSSEMessage({ status: 'error', message: 'Could not convert PDF to images' })
          ));
          controller.close();
          return;
        }

        // Limit to first 5 pages
        const processedImages = images.slice(0, 5);

        controller.enqueue(encoder.encode(
          createSSEMessage({ status: 'processing', step: 'Analyzing schedule with AI...' })
        ));

        // Process with Gemini
        console.log('Calling Gemini to extract equipment types...');
        const geminiService = getGeminiService();

        // Set up heartbeat for long-running process
        let heartbeatCount = 0;
        const heartbeatInterval = setInterval(() => {
          heartbeatCount++;
          const elapsedSecs = heartbeatCount * 5;
          controller.enqueue(encoder.encode(
            createSSEMessage({ 
              status: 'processing', 
              step: `AI analyzing schedule... (${elapsedSecs}s elapsed)` 
            })
          ));
          console.log(`[Heartbeat] Gemini processing schedule: ${elapsedSecs}s elapsed`);
        }, 5000);

        let equipmentJson: string;
        try {
          equipmentJson = await geminiService.extractEquipmentTypes(processedImages);
          console.log(`Gemini returned equipment JSON: ${equipmentJson?.length || 0} chars`);
        } catch (geminiError) {
          clearInterval(heartbeatInterval);
          console.error('Gemini processing failed:', geminiError);
          controller.enqueue(encoder.encode(
            createSSEMessage({ 
              status: 'error', 
              message: `AI processing failed: ${geminiError instanceof Error ? geminiError.message : String(geminiError)}` 
            })
          ));
          controller.close();
          return;
        }

        clearInterval(heartbeatInterval);

        controller.enqueue(encoder.encode(
          createSSEMessage({ status: 'processing', step: 'Storing images...' })
        ));

        // Store images with a unique ID
        const scheduleId = uuidv4();
        const encodedImages: string[] = [];
        let totalImageSize = 0;

        for (const imgBuffer of processedImages) {
          totalImageSize += imgBuffer.length;
          const base64 = imgBuffer.toString('base64');
          encodedImages.push(`data:image/jpeg;base64,${base64}`);
        }

        storage.scheduleImages.store(scheduleId, encodedImages);
        console.log(`Stored ${encodedImages.length} images (${(totalImageSize / 1024 / 1024).toFixed(2)} MB) with ID: ${scheduleId}`);

        controller.enqueue(encoder.encode(
          createSSEMessage({ status: 'processing', step: 'Extracting text...' })
        ));

        // Extract text
        const scheduleText = await pdfService.extractTextFromPdf(content);
        console.log(`Extracted ${scheduleText?.length || 0} chars of text`);

        // Parse equipment JSON
        let equipment;
        try {
          equipment = JSON.parse(equipmentJson);
        } catch {
          equipment = equipmentJson;
        }

        // Build response data - include images directly to avoid storage issues in dev
        const responseData = {
          filename,
          equipment,
          scheduleId,
          imageCount: encodedImages.length,
          images: encodedImages, // Include images directly in response
          text: scheduleText
        };

        const responseSize = JSON.stringify(responseData).length;
        console.log(`Response size: ${(responseSize / 1024).toFixed(2)} KB`);

        controller.enqueue(encoder.encode(
          createSSEMessage({ status: 'complete', result: responseData as any })
        ));
        console.log('=== SCHEDULE UPLOAD COMPLETE ===');

      } catch (error) {
        console.error('Error in schedule processing:', error);
        controller.enqueue(encoder.encode(
          createSSEMessage({ 
            status: 'error', 
            message: error instanceof Error ? error.message : String(error) 
          })
        ));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
