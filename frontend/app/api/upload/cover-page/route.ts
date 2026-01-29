import { NextRequest, NextResponse } from 'next/server';
import { getPdfService } from '@/lib/services/pdf-service';
import { getGeminiService } from '@/lib/services/gemini-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { detail: 'No file provided' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const content = Buffer.from(arrayBuffer);

    const pdfService = getPdfService();
    const images = await pdfService.convertPdfToImages(content);

    if (images.length === 0) {
      return NextResponse.json(
        { detail: 'Could not convert PDF to images' },
        { status: 400 }
      );
    }

    // Process only the first page (cover page)
    const coverPage = images[0];

    // Skip auto-extraction to speed up upload (as in original)
    // const geminiService = getGeminiService();
    // const symbolsJson = await geminiService.extractGrdSymbols(coverPage);
    const symbolsJson: string[] = [];

    // Convert image to base64
    const base64 = coverPage.toString('base64');
    const encodedImage = `data:image/jpeg;base64,${base64}`;

    return NextResponse.json({
      filename: file.name,
      symbols: symbolsJson,
      image: encodedImage,
    });
  } catch (error) {
    console.error('Error processing cover page:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to process cover page' },
      { status: 500 }
    );
  }
}
