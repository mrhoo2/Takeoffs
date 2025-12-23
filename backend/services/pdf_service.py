from pypdf import PdfReader
from pdf2image import convert_from_bytes
import fitz  # PyMuPDF
import io
import json

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

    async def generate_summary_pdf(self, pdf_content: bytes, locations: list | str, review_status: dict = None, equipment_list: list = None, schedule_id: str = None) -> bytes:
        """
        Generate a summary PDF with an executive summary and unflattened markups on a dedicated layer.
        """
        try:
            # Parse locations if string
            if isinstance(locations, str):
                locations = json.loads(locations)
            
            # Robust review status mapping
            review_map = {}
            if review_status:
                # review_status might have string keys or integer keys
                for k, v in review_status.items():
                    review_map[str(k)] = v
            
            # 1. Open original PDF
            original_doc = fitz.open(stream=pdf_content, filetype="pdf")
            
            # 2. Create summary document and first page
            final_doc = fitz.open()
            page = final_doc.new_page()
            
            # Add Title
            page.insert_text((50, 50), "BuildVision AI Takeoff Summary", fontsize=20, color=(0, 0.45, 0.87))
            
            # Add Executive Summary Header
            page.insert_text((50, 100), "Equipment Takeoff Status", fontsize=16, color=(0, 0, 0))
            
            # Draw a table for equipment status
            y_offset = 140
            headers = ["Equipment Type", "Tag", "Page", "Status"]
            col_widths = [150, 100, 50, 100]
            
            # Table headers
            x_offset = 50
            for i, header in enumerate(headers):
                page.insert_text((x_offset, y_offset), header, fontsize=10, color=(0, 0, 0))
                x_offset += col_widths[i]
            
            y_offset += 20
            page.draw_line((50, y_offset - 15), (50 + sum(col_widths), y_offset - 15), color=(0.8, 0.8, 0.8))
            
            # Equipment data status mapping
            status_map = {
                'correct': 'Correct',
                'incorrect': 'Incorrect',
                'duplicate': 'Duplicate',
                'manual': 'Manual'
            }
            
            # 3. Add rows to summary table
            for i, loc in enumerate(locations):
                if y_offset > 750:
                    page = final_doc.new_page()
                    y_offset = 50
                
                # Use string key to match review_map
                status_raw = review_map.get(str(i))
                status_text = status_map.get(status_raw, 'No Status')
                
                row_data = [
                    str(loc.get('type', '')),
                    str(loc.get('tag', '')),
                    str(loc.get('page', '1')),
                    status_text
                ]
                
                x_offset = 50
                for j, val in enumerate(row_data):
                    page.insert_text((x_offset, y_offset), val, fontsize=9, color=(0, 0, 0))
                    x_offset += col_widths[j]
                
                y_offset += 15
            
            # Record number of summary pages
            summary_page_count = len(final_doc)

            # 4. Append the original PDF content
            final_doc.insert_pdf(original_doc)
            original_doc.close()
            
            # 5. Group locations by page for marking up
            locations_by_page = {}
            for i, loc in enumerate(locations):
                p = loc.get("page", 1)
                if p not in locations_by_page:
                    locations_by_page[p] = []
                locations_by_page[p].append((i, loc))
            
            # 6. Create OCGs (Layers)
            # Primary layer (Visible by default)
            primary_ocg = final_doc.add_ocg("BuildVision AI Takeoffs", on=True, intent="View", usage="Design")
            # Incorrect layer (Hidden by default)
            incorrect_ocg = final_doc.add_ocg("BuildVision AI Takeoffs - Incorrect", on=False, intent="View", usage="Design")
            
            # 7. Draw markers on plan pages
            # Plan pages start after the summary pages
            for rel_page_idx, page_locs in locations_by_page.items():
                abs_page_idx = summary_page_count + (rel_page_idx - 1)
                if abs_page_idx >= len(final_doc): continue
                
                page = final_doc[abs_page_idx]
                
                for global_idx, loc in page_locs:
                    bbox = loc.get("bbox")
                    if not bbox: continue
                    
                    # bbox: [ymin, xmin, ymax, xmax] 0-1000 scale
                    rect = page.rect
                    ymin, xmin, ymax, xmax = bbox
                    
                    pdf_xmin = (xmin / 1000) * rect.width
                    pdf_ymin = (ymin / 1000) * rect.height
                    pdf_xmax = (xmax / 1000) * rect.width
                    pdf_ymax = (ymax / 1000) * rect.height
                    
                    # Center point
                    center_x = (pdf_xmin + pdf_xmax) / 2
                    center_y = (pdf_ymin + pdf_ymax) / 2
                    
                    # Status-based color and layer
                    # Use string key to match review_map
                    status_raw = review_map.get(str(global_idx))
                    color = (0, 0.45, 0.87) # Default Blue
                    target_ocg = primary_ocg
                    
                    if status_raw == 'correct': 
                        color = (0, 0.6, 0) # Green
                        target_ocg = primary_ocg
                    elif status_raw == 'manual': 
                        color = (0.55, 0.36, 0.96) # Purple - manual entries treated as correct
                        target_ocg = primary_ocg
                    elif status_raw == 'incorrect': 
                        color = (0.8, 0, 0) # Red
                        target_ocg = incorrect_ocg
                    elif status_raw == 'duplicate': 
                        color = (0.8, 0.8, 0) # Yellow
                        target_ocg = incorrect_ocg
                    
                    # Draw on the selected OCG layer (using 'oc' instead of 'ocg')
                    page.draw_circle((center_x, center_y), 5, color=color, fill=color, oc=target_ocg)
                    page.insert_text((pdf_xmax + 2, center_y + 2), loc.get("tag", "Equipment"), fontsize=8, color=(0, 0, 0), oc=target_ocg)

            # 8. Save and return final bytes
            output_bytes = final_doc.write()
            final_doc.close()
            return output_bytes
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"Error generating summary PDF: {e}")
            return pdf_content
