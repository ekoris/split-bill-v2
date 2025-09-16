import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Tesseract from 'tesseract.js'
import { Upload, FileImage, Loader2 } from 'lucide-react'

const ImageUpload = ({ onDataExtracted, isProcessing, setIsProcessing }) => {
  const [uploadedImage, setUploadedImage] = useState(null)
  const [ocrProgress, setOcrProgress] = useState(0)

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0]
    if (file) {
      setUploadedImage(URL.createObjectURL(file))
      setIsProcessing(true)
      setOcrProgress(0)

      try {
        const { data: { text } } = await Tesseract.recognize(
          file,
          'ind+eng',
          {
            logger: m => {
              if (m.status === 'recognizing text') {
                setOcrProgress(Math.round(m.progress * 100))
              }
            }
          }
        )

        // Parse the extracted text to find relevant information
        const parsedData = parseReceiptText(text)
        onDataExtracted(parsedData)
      } catch (error) {
        console.error('OCR Error:', error)
        alert('Gagal memproses gambar. Silakan coba lagi.')
      } finally {
        setIsProcessing(false)
      }
    }
  }, [onDataExtracted, setIsProcessing])

 const parseReceiptText = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  let items = [];
  let summary = {};
  let platform = 'Unknown';

  // Detect platform
  const textLower = text.toLowerCase();
  if (textLower.includes('gojek') || textLower.includes('gofood')) {
    platform = 'Gojek/GoFood';
  } else if (textLower.includes('shopee') || textLower.includes('shopeefood')) {
    platform = 'Shopee Food';
  }

  lines.forEach((line) => {
    const priceMatch = line.match(/-?Rp\s*([\d.,]+)/i);
    if (priceMatch) {
      const rawNum = parseInt(priceMatch[1].replace(/[.,]/g, ""), 10);
      const isNegative = line.includes('-');
      const value = isNegative ? -rawNum : rawNum;

      const lineLower = line.toLowerCase();

      if (lineLower.includes('subtotal')) {
        summary.sub_total = value;
      } else if (lineLower.includes('diskon') || lineLower.includes('discount') || lineLower.includes('promo')) {
        summary.voucher_diskon = value;
      } else if (lineLower.includes('pengiriman') || lineLower.includes('ongkir')) {
        summary.pengiriman = value;
      } else if (lineLower.includes('layanan')) {
        summary.layanan = value;
      } else if (lineLower.startsWith('rp')) {
        summary.total = value;
      } else {
        // Parsing item
        const parts = line.split(" ");
        let qty = 1;
        let name = "";

        const qtyIndex = parts.findIndex(p => /\d+x/.test(p));
        if (qtyIndex !== -1) {
          qty = parseInt(parts[qtyIndex].replace("x", ""), 10);
          name = parts.slice(qtyIndex + 1, parts.length - 1).join(" ");
        } else {
          name = parts.slice(0, parts.length - 1).join(" ");
        }

        // harga total & satuan
        const totalPriceNum = rawNum;
        const unitPriceNum = Math.round(totalPriceNum / qty);

        items.push({
          qty,
          name,
          price: `Rp${unitPriceNum.toLocaleString("id-ID")}`,
          total_price: `Rp${totalPriceNum.toLocaleString("id-ID")}`
        });
      }
    }
  });

  return {
    platform,
    item_detail: items,
    summary,
    rawText: text
  };
};





  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: false,
    disabled: isProcessing
  })

  return (
    <div className="image-upload">
      <div 
        {...getRootProps()} 
        className={`dropzone ${
          isDragActive ? 'active' : ''
        } ${isProcessing ? 'processing' : ''}`}
      >
        <input {...getInputProps()} />
        
        {!uploadedImage && !isProcessing && (
          <div className="upload-content">
            <Upload size={48} className="upload-icon" />
            <h3>Upload Foto Struk</h3>
            <p>
              {isDragActive
                ? 'Drop foto struk di sini...'
                : 'Drag & drop foto struk atau klik untuk memilih file'}
            </p>
            <p className="supported-formats">
              Mendukung: JPG, PNG, WEBP
            </p>
          </div>
        )}

        {uploadedImage && !isProcessing && (
          <div className="preview">
            <img src={uploadedImage} alt="Uploaded receipt" className="preview-image" />
          </div>
        )}

        {isProcessing && (
          <div className="processing">
            <Loader2 size={48} className="processing-icon" />
            <h3>Memproses Gambar...</h3>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${ocrProgress}%` }}
              ></div>
            </div>
            <p>{ocrProgress}% selesai</p>
          </div>
        )}
      </div>

      {uploadedImage && !isProcessing && (
        <button 
          className="reset-button"
          onClick={() => {
            setUploadedImage(null)
            setOcrProgress(0)
          }}
        >
          <FileImage size={20} />
          Upload Foto Lain
        </button>
      )}
    </div>
  )
}

export default ImageUpload