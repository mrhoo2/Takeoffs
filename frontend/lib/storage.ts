/**
 * In-memory storage for PDFs and schedule images
 * Note: This data is lost on server restart
 */

// Storage for uploaded PDFs
const pdfStorage = new Map<string, Buffer>();

// Storage for schedule images
const scheduleImageStorage = new Map<string, string[]>();

export const storage = {
  // PDF storage methods
  pdf: {
    store(id: string, content: Buffer): void {
      pdfStorage.set(id, content);
      console.log(`PDF stored with ID: ${id}`);
    },

    get(id: string): Buffer | undefined {
      return pdfStorage.get(id);
    },

    has(id: string): boolean {
      return pdfStorage.has(id);
    },

    delete(id: string): boolean {
      return pdfStorage.delete(id);
    },

    size(): number {
      return pdfStorage.size;
    }
  },

  // Schedule image storage methods
  scheduleImages: {
    store(id: string, images: string[]): void {
      scheduleImageStorage.set(id, images);
      console.log(`Stored ${images.length} schedule images with ID: ${id}`);
    },

    get(id: string): string[] | undefined {
      return scheduleImageStorage.get(id);
    },

    has(id: string): boolean {
      return scheduleImageStorage.has(id);
    },

    delete(id: string): boolean {
      return scheduleImageStorage.delete(id);
    },

    size(): number {
      return scheduleImageStorage.size;
    }
  }
};
