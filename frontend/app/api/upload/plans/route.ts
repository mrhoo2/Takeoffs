import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getPdfService } from '@/lib/services/pdf-service';
import { getGeminiService } from '@/lib/services/gemini-service';
import { storage } from '@/lib/storage';
import type { SSEEvent, VisualExamples } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 900; // 15 minutes

function createSSEMessage(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log('Plans SSE generator started, sending connected message...');
        
        // Send connection confirmation
        controller.enqueue(encoder.encode(
          createSSEMessage({ status: 'connected', message: 'Connection established' })
        ));

        console.log('Plans SSE: Connected message sent, starting processing...');

        // Parse the form data
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const equipmentStr = formData.get('equipment') as string;
        const scheduleText = formData.get('schedule_text') as string | null;
        const visualExamplesStr = formData.get('visual_examples') as string | null;
        const modelName = (formData.get('model_name') as string) || 'flash';
        
        if (!file) {
          controller.enqueue(encoder.encode(
            createSSEMessage({ status: 'error', message: 'No file provided' })
          ));
          controller.close();
          return;
        }

        const filename = file.name;
        console.log('=== PLANS UPLOAD STARTED (SSE) ===');

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

        controller.enqueue(encoder.encode(
          createSSEMessage({ status: 'processing', step: 'Extracting text...' })
        ));

        // Extract text
        const planText = await pdfService.extractTextFromPdf(content);
        console.log(`Text extracted: ${planText?.length || 0} chars`);

        // Parse visual examples
        let visualExamples: VisualExamples | undefined;
        if (visualExamplesStr) {
          try {
            visualExamples = JSON.parse(visualExamplesStr);
          } catch {
            // Ignore parse errors
          }
        }

        controller.enqueue(encoder.encode(
          createSSEMessage({ 
            status: 'processing', 
            step: `AI processing ${images.length} page(s) - this may take several minutes...` 
          })
        ));

        // Process with Gemini
        console.log(`=== STARTING GEMINI PROCESSING (${modelName}) ===`);
        const geminiService = getGeminiService();

        // Set up heartbeat for long-running process
        let heartbeatCount = 0;
        const heartbeatInterval = setInterval(() => {
          heartbeatCount++;
          const elapsedSecs = heartbeatCount * 5;
          const elapsedMins = Math.floor(elapsedSecs / 60);
          const remainingSecs = elapsedSecs % 60;
          controller.enqueue(encoder.encode(
            createSSEMessage({ 
              status: 'processing', 
              step: `AI processing floor plans... (${elapsedMins}m ${remainingSecs}s elapsed)` 
            })
          ));
          console.log(`[Heartbeat] Gemini processing plans: ${elapsedMins}m ${remainingSecs}s elapsed`);
        }, 5000);

        let locationsJson: string;
        try {
          locationsJson = await geminiService.findEquipmentLocations(
            images,
            equipmentStr,
            scheduleText || undefined,
            planText,
            visualExamples,
            modelName
          );
          console.log('=== GEMINI PROCESSING COMPLETE ===');
          console.log(`Locations result length: ${locationsJson?.length || 0}`);
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
          createSSEMessage({ status: 'processing', step: 'Storing results...' })
        ));

        // Store PDF
        const pdfId = uuidv4();
        storage.pdf.store(pdfId, content);
        console.log(`PDF stored with ID: ${pdfId}`);

        // Get page info
        let pageInfo;
        try {
          pageInfo = await pdfService.getPdfPageInfo(content);
          console.log(`Page info retrieved: ${pageInfo.length} pages`);
        } catch (pageError) {
          console.error('Error getting page info:', pageError);
          pageInfo = images.map(() => ({ width: 800, height: 600 })); // Fallback
        }

        // Encode images as base64 for direct use in the frontend
        const encodedImages: string[] = images.map(imgBuffer => {
          return `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;
        });
        console.log(`Encoded ${encodedImages.length} images for frontend`);

        // Parse locations JSON
        let locations;
        try {
          locations = JSON.parse(locationsJson);
        } catch {
          locations = locationsJson;
        }

        // Build response data - include images for direct rendering
        const responseData = {
          filename,
          locations,
          pdfId,
          pageInfo,
          pageCount: images.length,
          modelUsed: modelName,
          images: encodedImages  // Include base64 images for frontend rendering
        };

        console.log(`Sending final result with ${pageInfo.length} pages, locations length: ${locationsJson.length}`);

        controller.enqueue(encoder.encode(
          createSSEMessage({ status: 'complete', result: responseData as any })
        ));
        console.log('=== PLANS UPLOAD COMPLETE ===');

      } catch (error) {
        console.error('Error in plans processing:', error);
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
