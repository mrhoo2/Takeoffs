from pypdf import PdfReader
from pdf2image import convert_from_bytes
import fitz  # PyMuPDF
import io

class PDFService:
    def __init__(self):
        pass

    async def extract_text_from_pdf(self, file_content: bytes) -> str:
        try:
            reader = PdfReader(io.BytesIO(file_content))
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
        except Exception as e:
            print(f"Error extracting text: {e}")
            return ""

    async def convert_pdf_to_images(self, file_content: bytes, dpi: int = 300):
        try:
            images = convert_from_bytes(file_content, dpi=dpi)
            return images
        except Exception as e:
            print(f"Error converting PDF to images: {e}")
            return []

    async def get_pdf_page_info(self, file_content: bytes) -> list[dict]:
        """
        Get page dimensions without converting to SVG.
        Returns a list of dicts with 'width' and 'height'.
        """
        try:
            doc = fitz.open(stream=file_content, filetype="pdf")
            page_info = []
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                rect = page.rect
                page_info.append({
                    "width": rect.width,
                    "height": rect.height
                })
            
            doc.close()
            return page_info
            
        except Exception as e:
            print(f"Error getting PDF page info: {e}")
            return []

    async def convert_pdf_page_to_svg(self, file_content: bytes, page_num: int) -> dict | None:
        """
        Convert a single PDF page to SVG format using PyMuPDF.
        Returns a dict with 'svg' (string), 'width', and 'height'.
        """
        try:
            doc = fitz.open(stream=file_content, filetype="pdf")
            
            if page_num < 1 or page_num > len(doc):
                doc.close()
                return None
            
            page = doc[page_num - 1]  # Convert to 0-indexed
            
            # Get page dimensions in points (1 point = 1/72 inch)
            rect = page.rect
            width = rect.width
            height = rect.height
            
            # Convert page to SVG
            svg_content = page.get_svg_image()
            
            doc.close()
            
            return {
                "svg": svg_content,
                "width": width,
                "height": height
            }
            
        except Exception as e:
            print(f"Error converting PDF page to SVG: {e}")
            return None

    async def convert_pdf_to_svg(self, file_content: bytes) -> list[dict]:
        """
        Convert PDF pages to SVG format using PyMuPDF.
        Returns a list of dicts with 'svg' (string) and 'dimensions' (width, height).
        """
        try:
            doc = fitz.open(stream=file_content, filetype="pdf")
            svg_pages = []
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                
                # Get page dimensions in points (1 point = 1/72 inch)
                rect = page.rect
                width = rect.width
                height = rect.height
                
                # Convert page to SVG
                svg_content = page.get_svg_image()
                
                svg_pages.append({
                    "svg": svg_content,
                    "width": width,
                    "height": height
                })
            
            doc.close()
            return svg_pages
            
        except Exception as e:
            print(f"Error converting PDF to SVG: {e}")
            return []
