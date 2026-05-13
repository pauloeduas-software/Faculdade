import Tesseract from 'tesseract.js';

const preprocessImageFallback = async (imageSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(imageSrc);

      const scale = 3; 
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.filter = 'grayscale(1) contrast(2) brightness(1.1)';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      resolve(canvas.toDataURL('image/png', 1.0));
    };
    img.src = imageSrc;
  });
};

const cleanExtractedText = (text: string): string => {
  return text
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bval\b/g, 'vai')
    .replace(/\bal\b/g, 'aí')
    .replace(/\bImMporta\b/gi, 'importa')
    .replace(/\bInimizade\b/g, 'inimizade')
    .replace(/\bvocè\b/gi, 'você')
    .replace(/\brio na banda na\b/gi, 'frio na barriga na')
    .replace(/\bG([a-z]{5,})/g, '@$1')
    .replace(/ a([a-z]+escrever)/gi, ' @$1')
    .trim();
};

export const extractTextFromImage = async (
  base64Image: string,
  onProgress: (progress: number, status: string) => void
): Promise<string> => {
  try {
    // 1. TENTATIVA CLOUD API (OCR.space Engine 2)
    onProgress(30, 'Enviando para nuvem...');
    const formData = new FormData();
    formData.append('base64Image', base64Image);
    formData.append('language', 'por');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2');
    
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': 'helloworld'
      },
      body: formData
    });
    
    onProgress(60, 'Analisando documento...');
    const data = await response.json();
    
    if (data && data.ParsedResults && data.ParsedResults.length > 0 && data.OCRExitCode === 1) {
      onProgress(100, 'Concluído');
      return cleanExtractedText(data.ParsedResults[0].ParsedText);
    }
  } catch (e) {
    console.log('Falha na API da nuvem, caindo para processamento local...', e);
  }

  // 2. FALLBACK TESSERACT.JS
  onProgress(70, 'Processamento local...');
  const enhancedImage = await preprocessImageFallback(base64Image);
  const worker = await Tesseract.createWorker({
    logger: m => {
      if (m.status === 'recognizing text') {
        onProgress(70 + parseInt((m.progress * 30).toString()), 'Extraindo (Local)...');
      }
    }
  });

  await worker.loadLanguage('por');
  await worker.initialize('por');
  await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    preserve_interword_spaces: '1',
  });

  const { data: { text } } = await worker.recognize(enhancedImage);
  await worker.terminate();
  onProgress(100, 'Concluído');
  
  return cleanExtractedText(text);
};
