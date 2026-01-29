import * as mupdf from 'mupdf';
import type { Location, PageInfo } from '../types';

export class PDFService {
  /**
   * Extract text content from a PDF file
   */
  async extractTextFromPdf(fileContent: Buffer): Promise<string> {
    try {
      // Convert Node.js Buffer to Uint8Array for mupdf
      const uint8Array = new Uint8Array(fileContent.buffer, fileContent.byteOffset, fileContent.byteLength);
      const doc = mupdf.Document.openDocument(uint8Array, 'application/pdf');
      let text = '';
      
      const pageCount = doc.countPages();
      for (let i = 0; i < pageCount; i++) {
        const page = doc.loadPage(i);
        const structuredText = page.toStructuredText('preserve-whitespace');
        const pageText = JSON.stringify(structuredText);
        text += pageText + '\n';
      }
      
      return text;
    } catch (error) {
      console.error('Error extracting text:', error);
      return '';
    }
  }

  /**
   * Convert PDF pages to JPEG images
   */
  async convertPdfToImages(fileContent: Buffer, dpi: number = 300): Promise<Buffer[]> {
    try {
      const doc = mupdf.Document.openDocument(fileContent, 'application/pdf');
      const images: Buffer[] = [];
      
      const pageCount = doc.countPages();
      const scale = dpi / 72; // PDF points to pixels at given DPI
      
      for (let i = 0; i < pageCount; i++) {
        const page = doc.loadPage(i);
        
        // Create a pixmap at the specified DPI
        const pixmap = page.toPixmap(
          mupdf.Matrix.scale(scale, scale),
          mupdf.ColorSpace.DeviceRGB,
          false, // alpha
          true   // annots
        );
        
        // Convert to PNG buffer
        const pngData = pixmap.asPNG();
        
        // Convert PNG to JPEG using sharp
        const sharp = (await import('sharp')).default;
        const jpegBuffer = await sharp(Buffer.from(pngData))
          .jpeg({ quality: 85 })
          .toBuffer();
        
        images.push(jpegBuffer);
      }
      
      return images;
    } catch (error) {
      console.error('Error converting PDF to images:', error);
      return [];
    }
  }

  /**
   * Get page dimensions for all pages in a PDF
   */
  async getPdfPageInfo(fileContent: Buffer): Promise<PageInfo[]> {
    try {
      const doc = mupdf.Document.openDocument(fileContent, 'application/pdf');
      const pageInfo: PageInfo[] = [];
      
      const pageCount = doc.countPages();
      for (let i = 0; i < pageCount; i++) {
        const page = doc.loadPage(i);
        const bounds = page.getBounds();
        pageInfo.push({
          width: bounds[2] - bounds[0],  // x1 - x0
          height: bounds[3] - bounds[1]  // y1 - y0
        });
      }
      
      return pageInfo;
    } catch (error) {
      console.error('Error getting PDF page info:', error);
      return [];
    }
  }

  /**
   * Convert a single PDF page to SVG
   * Note: This method is not currently used - images are used instead for better performance
   */
  async convertPdfPageToSvg(fileContent: Buffer, pageNum: number): Promise<{ svg: string; width: number; height: number } | null> {
    try {
      const doc = mupdf.Document.openDocument(fileContent, 'application/pdf');
      
      const pageCount = doc.countPages();
      if (pageNum < 1 || pageNum > pageCount) {
        return null;
      }
      
      const page = doc.loadPage(pageNum - 1); // Convert to 0-indexed
      const bounds = page.getBounds();
      const width = bounds[2] - bounds[0];
      const height = bounds[3] - bounds[1];
      
      // Convert to SVG using mupdf's SVG output
      // Use mupdf.Buffer for proper type compatibility
      const mupdfBuffer = new mupdf.Buffer();
      const output = new mupdf.DocumentWriter(mupdfBuffer, 'svg', '');
      const device = output.beginPage(bounds);
      page.run(device, mupdf.Matrix.identity);
      output.endPage();
      output.close();
      
      // Get SVG content from the mupdf buffer
      const svgData = mupdfBuffer.asUint8Array();
      const svg = new TextDecoder().decode(svgData);
      
      return { svg, width, height };
    } catch (error) {
      console.error('Error converting PDF page to SVG:', error);
      return null;
    }
  }

  /**
   * Generate a summary PDF with marked-up locations using annotations
   */
  async generateSummaryPdf(
    pdfContent: Buffer,
    locations: Location[] | string,
    reviewStatus?: Record<string, 'correct' | 'incorrect' | 'duplicate' | 'manual'>,
    equipmentList?: unknown[]
  ): Promise<Buffer> {
    try {
      // Parse locations if string
      const parsedLocations: Location[] = typeof locations === 'string' 
        ? JSON.parse(locations) 
        : locations;

      // Build review status map with string keys
      const reviewMap: Record<string, string> = {};
      if (reviewStatus) {
        for (const [k, v] of Object.entries(reviewStatus)) {
          reviewMap[String(k)] = v;
        }
      }

      // Open the PDF document
      const doc = mupdf.Document.openDocument(pdfContent, 'application/pdf') as mupdf.PDFDocument;
      
      // Group locations by page
      const locationsByPage: Record<number, Array<[number, Location]>> = {};
      parsedLocations.forEach((loc, i) => {
        const p = loc.page || 1;
        if (!locationsByPage[p]) {
          locationsByPage[p] = [];
        }
        locationsByPage[p].push([i, loc]);
      });

      // Add annotations to each page
      const pageCount = doc.countPages();
      
      for (const [relPageIdxStr, pageLocs] of Object.entries(locationsByPage)) {
        const pageNum = parseInt(relPageIdxStr);
        const pageIdx = pageNum - 1; // 0-indexed
        
        if (pageIdx < 0 || pageIdx >= pageCount) continue;
        
        const page = doc.loadPage(pageIdx) as mupdf.PDFPage;
        const bounds = page.getBounds();
        const pageWidth = bounds[2] - bounds[0];
        const pageHeight = bounds[3] - bounds[1];
        
        for (const [globalIdx, loc] of pageLocs) {
          const bbox = loc.bbox;
          if (!bbox) continue;
          
          // bbox: [ymin, xmin, ymax, xmax] 0-1000 scale
          const [ymin, xmin, ymax, xmax] = bbox;
          
          const pdfXmin = (xmin / 1000) * pageWidth;
          const pdfYmin = pageHeight - (ymax / 1000) * pageHeight; // Flip Y (PDF origin is bottom-left)
          const pdfXmax = (xmax / 1000) * pageWidth;
          const pdfYmax = pageHeight - (ymin / 1000) * pageHeight;
          
          // Center point
          const centerX = (pdfXmin + pdfXmax) / 2;
          const centerY = (pdfYmin + pdfYmax) / 2;
          
          // Determine color based on status
          const statusRaw = reviewMap[String(globalIdx)];
          let color: [number, number, number] = [0, 0.45, 0.87]; // Default Blue
          
          if (statusRaw === 'correct') {
            color = [0, 0.6, 0]; // Green
          } else if (statusRaw === 'manual') {
            color = [0.55, 0.36, 0.96]; // Purple
          } else if (statusRaw === 'incorrect') {
            color = [0.8, 0, 0]; // Red
          } else if (statusRaw === 'duplicate') {
            color = [0.8, 0.8, 0]; // Yellow
          }
          
          // Create a circle annotation
          const radius = 5;
          const annot = page.createAnnotation('Circle');
          annot.setRect([
            centerX - radius,
            centerY - radius,
            centerX + radius,
            centerY + radius
          ]);
          annot.setColor(color);
          annot.setBorderWidth(2);
          annot.update();
        }
      }

      // Save the document with annotations
      const outputBuffer = doc.saveToBuffer('incremental');
      // Convert mupdf.Buffer to Node.js Buffer
      const outputData = outputBuffer.asUint8Array();
      return Buffer.from(outputData);
      
    } catch (error) {
      console.error('Error generating summary PDF:', error);
      // Return original PDF on error
      return pdfContent;
    }
  }

  /**
   * Generate a summary PDF with full OCG layer support
   * This uses lower-level PDF object manipulation for proper layer toggling
   */
  async generateSummaryPdfWithLayers(
    pdfContent: Buffer,
    locations: Location[] | string,
    reviewStatus?: Record<string, 'correct' | 'incorrect' | 'duplicate' | 'manual'>,
    equipmentList?: unknown[]
  ): Promise<Buffer> {
    try {
      // Parse locations if string
      const parsedLocations: Location[] = typeof locations === 'string' 
        ? JSON.parse(locations) 
        : locations;

      // Build review status map with string keys
      const reviewMap: Record<string, string> = {};
      if (reviewStatus) {
        for (const [k, v] of Object.entries(reviewStatus)) {
          reviewMap[String(k)] = v;
        }
      }

      // Open the PDF document
      const doc = mupdf.Document.openDocument(pdfContent, 'application/pdf') as mupdf.PDFDocument;
      
      // Add OCG (Optional Content Groups)
      // Get the PDF object for the document catalog
      const trailer = doc.getTrailer();
      const root = trailer.get('Root');
      
      // Create OCGs
      const primaryOcg = doc.addObject({
        Type: doc.newName('OCG'),
        Name: doc.newString('BuildVision AI Takeoffs'),
        Intent: doc.newName('View')
      });
      
      const incorrectOcg = doc.addObject({
        Type: doc.newName('OCG'),
        Name: doc.newString('BuildVision AI Takeoffs - Incorrect'),
        Intent: doc.newName('View')
      });

      // Create OCGs array
      const ocgsArray = doc.addObject(doc.newArray());
      ocgsArray.push(primaryOcg);
      ocgsArray.push(incorrectOcg);
      
      // Create OFF array for default config
      const offArray = doc.addObject(doc.newArray());
      offArray.push(incorrectOcg);
      
      // Default configuration - show primary, hide incorrect
      const defaultConfig = doc.addObject({
        Name: doc.newString('Default'),
        Creator: doc.newString('BuildVision AI'),
        BaseState: doc.newName('ON'),
        OFF: offArray,
        Order: ocgsArray,
        Intent: doc.newName('View')
      });
      
      const ocProperties = doc.addObject({
        OCGs: ocgsArray,
        D: defaultConfig
      });
      
      // Add OCProperties to the document catalog
      root.put('OCProperties', ocProperties);

      // Group locations by page
      const locationsByPage: Record<number, Array<[number, Location]>> = {};
      parsedLocations.forEach((loc, i) => {
        const p = loc.page || 1;
        if (!locationsByPage[p]) {
          locationsByPage[p] = [];
        }
        locationsByPage[p].push([i, loc]);
      });

      // Add annotations to each page
      const pageCount = doc.countPages();
      
      for (const [relPageIdxStr, pageLocs] of Object.entries(locationsByPage)) {
        const pageNum = parseInt(relPageIdxStr);
        const pageIdx = pageNum - 1; // 0-indexed
        
        if (pageIdx < 0 || pageIdx >= pageCount) continue;
        
        const page = doc.loadPage(pageIdx) as mupdf.PDFPage;
        const bounds = page.getBounds();
        const pageWidth = bounds[2] - bounds[0];
        const pageHeight = bounds[3] - bounds[1];
        
        for (const [globalIdx, loc] of pageLocs) {
          const bbox = loc.bbox;
          if (!bbox) continue;
          
          // bbox: [ymin, xmin, ymax, xmax] 0-1000 scale
          const [ymin, xmin, ymax, xmax] = bbox;
          
          const pdfXmin = (xmin / 1000) * pageWidth;
          const pdfYmin = pageHeight - (ymax / 1000) * pageHeight; // Flip Y
          const pdfXmax = (xmax / 1000) * pageWidth;
          const pdfYmax = pageHeight - (ymin / 1000) * pageHeight; // Flip Y
          
          // Center point
          const centerX = (pdfXmin + pdfXmax) / 2;
          const centerY = (pdfYmin + pdfYmax) / 2;
          
          // Determine status and corresponding OCG
          const statusRaw = reviewMap[String(globalIdx)];
          let color: [number, number, number] = [0, 0.45, 0.87]; // Default Blue
          let targetOcg = primaryOcg;
          
          if (statusRaw === 'correct') {
            color = [0, 0.6, 0]; // Green
            targetOcg = primaryOcg;
          } else if (statusRaw === 'manual') {
            color = [0.55, 0.36, 0.96]; // Purple
            targetOcg = primaryOcg;
          } else if (statusRaw === 'incorrect') {
            color = [0.8, 0, 0]; // Red
            targetOcg = incorrectOcg;
          } else if (statusRaw === 'duplicate') {
            color = [0.8, 0.8, 0]; // Yellow
            targetOcg = incorrectOcg;
          }
          
          // Create annotation with OCG reference
          const radius = 5;
          const annot = page.createAnnotation('Circle');
          annot.setRect([
            centerX - radius,
            centerY - radius,
            centerX + radius,
            centerY + radius
          ]);
          annot.setColor(color);
          annot.setBorderWidth(2);
          
          // Set the annotation's OC (optional content) reference
          const annotObj = annot.getObject();
          annotObj.put('OC', targetOcg);
          
          annot.update();
        }
      }

      // Save the document with annotations
      const outputBuffer = doc.saveToBuffer('incremental');
      // Convert mupdf.Buffer to Node.js Buffer
      const outputData = outputBuffer.asUint8Array();
      return Buffer.from(outputData);
      
    } catch (error) {
      console.error('Error generating summary PDF with layers:', error);
      // Fall back to simple annotation-based approach
      return this.generateSummaryPdf(pdfContent, locations, reviewStatus, equipmentList);
    }
  }
}

// Singleton instance
let pdfServiceInstance: PDFService | null = null;

export function getPdfService(): PDFService {
  if (!pdfServiceInstance) {
    pdfServiceInstance = new PDFService();
  }
  return pdfServiceInstance;
}
