import { NextRequest, NextResponse } from 'next/server';
import { getPdfService } from '@/lib/services/pdf-service';
import { storage } from '@/lib/storage';
import type { ExportRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { pdfId, locations, reviewStatus, equipmentList } = body;

    if (!storage.pdf.has(pdfId)) {
      return NextResponse.json(
        { detail: 'PDF not found' },
        { status: 404 }
      );
    }

    const content = storage.pdf.get(pdfId)!;
    const pdfService = getPdfService();

    // Generate the marked-up PDF with OCG layers
    const outputPdf = await pdfService.generateSummaryPdfWithLayers(
      content,
      locations,
      reviewStatus,
      equipmentList
    );

    return new Response(new Uint8Array(outputPdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=takeoff_summary.pdf',
      },
    });
  } catch (error) {
    console.error('Error generating summary PDF:', error);
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
