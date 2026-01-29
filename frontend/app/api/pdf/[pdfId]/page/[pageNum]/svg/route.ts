import { NextRequest, NextResponse } from 'next/server';
import { getPdfService } from '@/lib/services/pdf-service';
import { storage } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pdfId: string; pageNum: string }> }
) {
  const { pdfId, pageNum } = await params;
  const pageNumber = parseInt(pageNum, 10);

  if (!storage.pdf.has(pdfId)) {
    return NextResponse.json(
      { detail: 'PDF not found' },
      { status: 404 }
    );
  }

  const content = storage.pdf.get(pdfId)!;
  const pdfService = getPdfService();
  
  const pageData = await pdfService.convertPdfPageToSvg(content, pageNumber);

  if (!pageData) {
    return NextResponse.json(
      { detail: 'Page not found' },
      { status: 404 }
    );
  }

  return new Response(pageData.svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'X-Page-Width': String(pageData.width),
      'X-Page-Height': String(pageData.height),
    },
  });
}
