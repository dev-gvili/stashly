// src/ocr/tesseractService.ts
import { create } from 'tesseract.js';
import sharp from 'sharp';
import { Buffer } from 'buffer';

// Initialize Tesseract engine (run once at startup)
const tesseract = create("eng", 1, {

    logger: m => console.log(m) // Optional: log Tesseract progress
});

// Pre-trained model configuration
const configureOCR = async (engine: typeof tesseract) => {
  await engine.loadLanguageData('eng');
  await engine.loadModel('eng'); // Base model
  await engine.loadModel('eng') // English model
    .then(() => engine.loadModel('fra') // French (optional)
      .then(() => engine.loadModel('spa') // Spanish (optional))
    );
  
  // Configure page segmentation mode (PSM)
  engine.setPageSegMode(5); // Assume a single block of text
  engine.setVariable('psm', '7'); // Assume a block of text
  engine.setVariable('oem', '1'); // Make OCR engine more aggressive
};

// Image preprocessing utilities
const preprocessImage = async (buffer: Buffer): Promise<Buffer> => {
  // Convert to grayscale
  const grayscale = await sharp(buffer)
    .grayscale()
    .trim()
    .toBuffer();
  
  // Resize for optimal OCR (adjust based on your needs)
  return await sharp(grayscale)
    .resize({ width: 800, height: 600 })
    .toBuffer();
};

// Main OCR processing function
export const processImageForText = async (
  file: File,
  metadata: FileMetadata
): Promise<ClassificationResult> => {
  try {
    // 1. Preprocess image
    const processedBuffer = await preprocessImage(file.arrayBuffer());
    
    // 2. Extract text
    const { data: { text } } = await tesseract.recognize(
      processedBuffer,
      'eng',
      {
        logger: () => {},
        config: {
          pages: '1',
          oSDir: '/usr/share/tesseract-ocr',
          language: 'eng',
          config: '--psm 7 --oem 1'
        }
      }
    );

    // 3. Extract metadata from text (basic example)
    const extractedMetadata: FileMetadata = {
      text,
      fileType: file.type.split('/')[1] || 'unknown',
      size: file.size,
      createdAt: metadata.createdAt,
      exif: metadata.exif || {}
    };

    // 4. Return classification result
    return {
      fileId: metadata.id,
      category: extractCategoryFromText(text),
      confidence: parseFloat(getConfidenceFromTesseract(text)),
      extractedMetadata
    };
  } catch (error) {
    console.error('OCR processing failed:', error);
    throw new Error('OCR processing failed');
  }
};

// Helper functions
const extractCategoryFromText = (text: string): string => {
  // Simple keyword-based categorization
  const keywords: { [key: string]: string[] } = {
    'invoice': ['invoice', 'bill', 'payment'],
    'contract': ['contract', 'agreement', 'treaty'],
    'receipt': ['receipt', 'purchase', 'expense'],
    'letter': ['letter', 'email', 'correspondence']
  };

  // Case-insensitive matching
  for (const [category, terms] of Object.entries(keywords)) {
    if (terms.some(term => text.toLowerCase().includes(term))) {
      return category;
    }
  }
  return 'unknown';
};

const getConfidenceFromTesseract = (text: string): number => {
  // Tesseract returns confidence per line (0-1 scale)
  // We'll average them for a general confidence score
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return 0;
  
  const confidences = lines.map(line => {
    const result = tesseract.recognize(Buffer.from(line), 'eng', {
      config: '--psm 7 --oem 1',
      outputBaseOS: 'linux'
    });
    return parseFloat(result.data.text.split('\n')[0].match(/confidence: (\d+\.\d+)/)?.[1] || '0') || 0;
  });
  
  return confidences.reduce((a, b) => a + b, 0) / confidences.length;
};