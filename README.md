# Takeoffs - AI-Powered Construction Takeoff Automation

**Takeoffs** is an intelligent application designed to automate the process of identifying and counting equipment on construction floor plans. By leveraging Google's Gemini Pro Vision API, it extracts equipment from mechanical schedules, learns from visual examples, and automatically locates instances on floor plans.

## 🚀 Features

- **Smart Schedule Parsing**: Upload mechanical schedules (PDF) to automatically extract equipment types and tags.
- **Visual Learning**: Define "Visual Examples" by drawing bounding boxes around symbols on a legend or reference page. The AI uses these examples to improve detection accuracy.
- **Automated Detection**: Upload floor plans (PDF), and the system uses Gemini Pro Vision to find and tag all instances of the selected equipment.
- **Interactive Verification**: Review the results on an interactive, zoomable map. Verify confidence scores and correct any misidentifications.
- **Modern UI**: Built with a clean, responsive interface following the BuildVision design system.

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 15](https://nextjs.org/) (React)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: React Hooks

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **Server**: [Uvicorn](https://www.uvicorn.org/)
- **AI Model**: [Google Gemini Pro 1.5](https://ai.google.dev/)
- **PDF Processing**: `pypdf`, `pdf2image`

## 📦 Installation

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- Google Gemini API Key

### 1. Clone the Repository
```bash
git clone https://github.com/mrhoo2/Takeoffs.git
cd Takeoffs
```

### 2. Backend Setup
Navigate to the backend directory and set up the Python environment.

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend` directory:
```env
GEMINI_API_KEY=your_api_key_here
```

Start the backend server:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
Navigate to the frontend directory and install dependencies.

```bash
cd ../frontend
npm install
```

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📖 Usage Workflow

1.  **Upload Schedule**: Upload a PDF containing the mechanical equipment schedule.
2.  **Select Equipment**: Choose the equipment types you want to count (e.g., WSHP, RTU).
3.  **Visual Examples (Optional)**: Upload a legend or cover page and draw boxes around symbol examples to train the AI.
4.  **Upload Floor Plans**: Upload the floor plan PDFs where the equipment is located.
5.  **Verify**: Review the detected locations on the interactive map.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
