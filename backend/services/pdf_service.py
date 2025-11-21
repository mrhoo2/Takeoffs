from pypdf import PdfReader
from pdf2image import convert_from_bytes
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

    async def convert_pdf_to_images(self, file_content: bytes):
        try:
            images = convert_from_bytes(file_content)
            return images
        except Exception as e:
            print(f"Error converting PDF to images: {e}")
            return []
