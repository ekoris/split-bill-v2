import { useState } from 'react'
import ImageUpload from './components/ImageUpload'
import BillCalculator from './components/BillCalculator'
import './App.css'

function App() {
  const [extractedData, setExtractedData] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleDataExtracted = (data) => {
    setExtractedData(data)
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Split Bill App</h1>
        <p>Upload foto struk dari Gojek atau Shopee Food untuk menghitung split bill</p>
      </header>
      
      <main className="app-main">
        {!extractedData ? (
          <ImageUpload 
            onDataExtracted={handleDataExtracted}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
          />
        ) : (
          <BillCalculator 
            extractedData={extractedData}
            onReset={() => setExtractedData(null)}
          />
        )}
      </main>
    </div>
  )
}

export default App
